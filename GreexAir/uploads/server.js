require('dotenv').config();
const express = require('express');
const http    = require('http');
const { Server } = require('socket.io');
const multer  = require('multer');
const dayjs   = require('dayjs');
const fs      = require('fs');
const dataManager = require('./dataManager');
const config  = require('./config');
const { getTr } = require('./translations');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server);

app.set('view engine', 'ejs');
app.use('/static', express.static('public'));
app.use(express.json());

// ── Cookie parser (beépített, nem kell npm install) ───────────
app.use(function(req, res, next) {
    req.cookies = {};
    const raw = req.headers.cookie || '';
    raw.split(';').forEach(function(c) {
        const idx = c.indexOf('=');
        if (idx < 0) return;
        const key = c.slice(0, idx).trim();
        const val = c.slice(idx + 1).trim();
        req.cookies[key] = val;
    });
    next();
});

// ── SZOBA NEVEK ───────────────────────────────────────────────
// Csak a dashboard kliensek kapják a CO2 adatokat
// A kvízes telefonok SOHA nem kerülnek ebbe a szobába
const DASHBOARD_ROOM = 'dashboard';

// ── PAYLOAD BUILDER ───────────────────────────────────────────
function prepPayload(data, isLive = true) {
    if (!data || data.length === 0) return null;
    try {
        // ★ Live módban a teljes napi cache-ből számolunk KPI-t (max/min pontos!)
        // History módban a ritkított adatból (nincs teljes cache)
        const kpi = (isLive && dataManager.getFullKpi)
            ? (dataManager.getFullKpi() || dataManager.calculateKpi(data))
            : dataManager.calculateKpi(data);
        const status      = dataManager.getStatus(kpi.current);
        const lastDataObj = data[data.length - 1];
        const lastTime    = dayjs(lastDataObj.Ido);
        const advanced    = dataManager.processAdvancedData(data, 15, isLive);
        return {
            kpi,
            air_status_text:  status.text,
            air_status_key:   status.key,
            air_status_class: status.cssClass,
            chartData:        advanced.chartData,
            timeStats:        advanced.timeStats,
            last_update:      isLive ? lastTime.format('HH:mm:ss') : 'Archívum',
            timestamp:        lastTime.format('YYYY-MM-DD HH:mm:ss')
        };
    } catch (err) {
        console.error('❌ prepPayload hiba:', err);
        return null;
    }
}

// ── LIVE BROADCAST — CSAK A DASHBOARD SZOBÁNAK ───────────────
// Quiz telefonok nem kapják meg → nem lagolnak!
setInterval(async () => {
    try {
        const data = await dataManager.getLatestSensorData();
        if (data && data.length > 0) {
            const payload = prepPayload(data, true);
            if (payload) io.to(DASHBOARD_ROOM).emit('update_data', payload);
        }
    } catch (err) {
        console.error('❌ Élő adat hiba:', err.message);
    }
}, 3000);

// ── HTTP ROUTES ───────────────────────────────────────────────
app.get('/', async (req, res) => {
    try {
        const todayStr       = dayjs().format('YYYY-MM-DD');
        const availableDates = await dataManager.getAvailableDates();
        const hasTodayData   = availableDates.includes(todayStr);
        let dates = [...availableDates];
        if (!hasTodayData) dates.unshift(todayStr);
        const defaultDate = hasTodayData ? todayStr : (dates.length > 1 ? dates[1] : todayStr);
        const lang = req.cookies.lang || 'hu';
        const tr   = getTr(lang);
        res.render('monitor', { today_date: todayStr, available_dates: dates, default_date: defaultDate, start_live: hasTodayData, lang, tr });
    } catch (err) {
        console.error('❌ Főoldal hiba:', err.message);
        res.send('Hiba történt a főoldal betöltésekor.');
    }
});

// ── NYELVVÁLASZTÓ ─────────────────────────────────────────────
app.get('/set-lang/:lang', (req, res) => {
    const allowed = ['hu','en','de','sk','ro','hr','sr','sl','uk','ru'];
    const lang    = allowed.includes(req.params.lang) ? req.params.lang : 'hu';
    res.cookie('lang', lang, { maxAge: 365 * 24 * 3600 * 1000, httpOnly: false, path: '/' });
    const back = req.headers.referer || '/';
    res.redirect(back);
});

// ── PDF RIPORT OLDAL ──────────────────────────────────────────
app.get('/report', async (req, res) => {
    try {
        const dateStr = req.query.date || dayjs().format('YYYY-MM-DD');
        const theme   = req.query.theme || req.cookies.theme || 'dark';
        const lang    = req.cookies.lang || 'hu';
        const tr      = getTr(lang);

        const rawData = await dataManager.loadAndCleanData(dateStr);
        const payload = rawData && rawData.length > 0 ? prepPayload(rawData, false) : null;

        res.render('report', { payload, date: dateStr, tr, lang, theme });
    } catch(err) {
        console.error('❌ Report hiba:', err.message, err.stack);
        res.status(500).send('Hiba a riport generálásakor: ' + err.message);
    }
});

app.get('/demo', async (req, res) => {
    const lang = req.cookies.lang || 'hu';
    const tr   = getTr(lang);
    res.render('index', { payload: prepPayload(await dataManager.loadAndCleanData(config.FILE_DEMO), false), lang, tr });
});

app.get('/upload', (req, res) => {
    const lang = req.cookies.lang || 'hu';
    const tr   = getTr(lang);
    res.render('live', { error: null, payload: null, lang, tr });
});

app.post('/upload', multer({ dest: 'uploads/' }).single('file'), async (req, res) => {
    let payload = null, error = null;
    if (req.file) {
        try {
            payload = prepPayload(await dataManager.loadAndCleanData(req.file.path), false);
            fs.unlinkSync(req.file.path);
        } catch (e) { error = e.message; }
    }
    const lang = req.cookies.lang || 'hu';
    const tr   = getTr(lang);
    res.render('live', { payload, error, lang, tr });
});

app.post('/api/history', async (req, res) => {
    try {
        const rawData = await dataManager.getHistoryData(req.body.date);
        const payload = prepPayload(rawData, false);
        res.json(payload || { error: 'Nincs adat ezen a napon.' });
    } catch (err) {
        res.json({ error: 'Szerver hiba.' });
    }
});

app.get('/api/esp32', async (req, res) => {
    try {
        const data    = await dataManager.getLatestSensorData();
        const payload = prepPayload(data, true);
        if (payload?.kpi?.current !== undefined) {
            res.json({ current_co2: payload.kpi.current });
        } else {
            res.status(404).json({ error: 'Nincs érvényes adat' });
        }
    } catch (err) {
        res.status(500).json({ error: 'Szerver hiba' });
    }
});

// ── FIX: /api/live-upload csak EGYSZER ───────────────────────
app.post('/api/live-upload', async (req, res) => {
    const { ppm } = req.body;
    if (ppm !== undefined) {
        try {
            const success = await dataManager.saveSingleData(ppm);
            if (success) {
                // Friss adatot csak a dashboard szobának küldjük
                const data    = await dataManager.getLatestSensorData();
                const payload = prepPayload(data, true);
                if (payload) io.to(DASHBOARD_ROOM).emit('update_data', payload);
                return res.json({ status: 'ok' });
            }
        } catch (err) {
            console.error('❌ live-upload hiba:', err.message);
        }
    }
    res.status(400).json({ error: 'Hibás adat vagy mentési hiba' });
});

// ── SOCKET.IO ─────────────────────────────────────────────────
io.on('connection', async (socket) => {

    // ★ FIX: NEM csinálunk DB lekérdezést minden csatlakozáskor!
    // Csak akkor, ha a kliens jelzi hogy dashboard (nem quiz telefon)
    socket.on('dashboard_join', async () => {
        socket.join(DASHBOARD_ROOM);
        try {
            const data    = await dataManager.getLatestSensorData();
            const payload = prepPayload(data, true);
            if (payload) socket.emit('update_data', payload);
        } catch (err) {
            console.error('❌ Dashboard csatlakozás hiba:', err.message);
        }
    });
});

// ── QUIZ MODULE ───────────────────────────────────────────────
require('./quiz-module')(app, io);

const PORT = config.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 GrexAir szerver: http://localhost:${PORT}`));
