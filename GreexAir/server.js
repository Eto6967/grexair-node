const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const dayjs = require('dayjs');
const fs = require('fs');
const dataManager = require('./dataManager');
const config = require('./config');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.set('view engine', 'ejs');
app.use('/static', express.static('public'));
app.use(express.json());

function prepPayload(data, isLive = true) {
    if (!data || data.length === 0) return null;
    
    try {
        const kpi = dataManager.calculateKpi(data);
        const status = dataManager.getStatus(kpi.current);
        const lastDataObj = data[data.length - 1];
        const lastTime = dayjs(lastDataObj.Ido);
        
        const advanced = dataManager.processAdvancedData(data);
        
        // TELJESEN KIVÉVE AZ ONLINE/OFFLINE LOGIKA! Csak a nyers adatokat küldjük.
        return {
            kpi, 
            air_status_text: status.text, 
            air_status_class: status.cssClass,
            chartData: advanced.chartData,
            timeStats: advanced.timeStats,
            last_update: isLive ? lastTime.format("HH:mm:ss") : "Archívum", 
            timestamp: lastTime.format('YYYY-MM-DD HH:mm:ss')
        };
    } catch (err) {
        console.error("❌ Hiba a prepPayload feldolgozásakor:", err);
        return null;
    }
}

setInterval(async () => {
    try {
        const data = await dataManager.getLatestSensorData();
        if (data && data.length > 0) {
            const payload = prepPayload(data, true);
            if (payload) io.emit('update_data', payload);
        }
    } catch (err) {
        console.error("❌ Hiba az élő adat lekérdezésekor:", err.message);
    }
}, 3000);

app.get('/', async (req, res) => {
    try {
        const todayStr = dayjs().format('YYYY-MM-DD');
        const availableDates = await dataManager.getAvailableDates();
        
        const hasTodayData = availableDates.includes(todayStr);
        let dates = [...availableDates];
        
        if (!hasTodayData) dates.unshift(todayStr);
        const defaultDate = hasTodayData ? todayStr : (dates.length > 1 ? dates[1] : todayStr);

        res.render('monitor', { 
            today_date: todayStr, 
            available_dates: dates, 
            default_date: defaultDate, 
            start_live: hasTodayData 
        });
    } catch (err) {
        console.error("❌ Hiba a főoldal renderelésekor:", err.message);
        res.send("Hiba történt a főoldal betöltésekor.");
    }
});

app.get('/demo', async (req, res) => {
    res.render('index', { payload: prepPayload(await dataManager.loadAndCleanData(config.FILE_DEMO), false) });
});

app.get('/upload', (req, res) => res.render('live', { error: null, payload: null }));
app.post('/upload', multer({ dest: 'uploads/' }).single('file'), async (req, res) => {
    let payload = null, error = null;
    if (req.file) {
        try { 
            payload = prepPayload(await dataManager.loadAndCleanData(req.file.path), false); 
            fs.unlinkSync(req.file.path); 
        }
        catch (e) { error = e.message; }
    }
    res.render('live', { payload, error });
});

app.post('/api/history', async (req, res) => {
    const targetDate = req.body.date;
    try {
        const rawData = await dataManager.getHistoryData(targetDate);
        const payload = prepPayload(rawData, false);
        if (payload) {
            res.json(payload);
        } else {
            res.json({ error: 'Nincs adat ezen a napon.' });
        }
    } catch (err) {
        res.json({ error: 'Szerver hiba az adat lekérésekor.' });
    }
});

io.on('connection', async (socket) => {
    try {
        const data = await dataManager.getLatestSensorData();
        const payload = prepPayload(data, true);
        if (payload) socket.emit('update_data', payload);
    } catch (err) {
        console.error("❌ Hiba a kliens csatlakozásakor:", err.message);
    }
});

server.listen(5000, () => console.log('🚀 Szerver: http://localhost:5000'));