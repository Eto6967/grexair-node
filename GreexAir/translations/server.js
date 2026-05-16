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

        const full = await dataManager.getFullDayData(dateStr);
        const kpi  = full ? full.kpi          : { current:'-', avg:'-', max:'-', min:'-' };
        const ts   = full ? full.timeStats    : [0,0,0,0];
        const sp   = full ? full.speedBuckets : { calm:0, slow:0, medium:0, fast:0 };
        const cnt  = full ? full.count        : 0;
        const pts  = full ? full.chartPoints  : [];

        // Peak time keresése
        let peakTime = '-';
        if (pts.length > 0) {
            let maxV = -Infinity, maxI = 0;
            pts.forEach((p,i) => { if((p.y||0) > maxV){ maxV=p.y; maxI=i; } });
            peakTime = pts[maxI].x || '-';
        }

        // Status
        const avgPpm = typeof kpi.avg === 'number' ? kpi.avg : parseInt(kpi.avg);
        let statusClass = 'status-neutral', statusText = tr.air_nodata || 'Nincs adat';
        if (!isNaN(avgPpm)) {
            if      (avgPpm < 800)  { statusClass='status-good';    statusText = tr.air_excellent  || 'KIVÁLÓ'; }
            else if (avgPpm < 1200) { statusClass='status-warning';  statusText = tr.air_acceptable || 'ELFOGADHATÓ'; }
            else                    { statusClass='status-danger';   statusText = tr.air_dangerous  || 'VESZÉLYES'; }
        }

        const totalMin = (ts[0]||0)+(ts[1]||0)+(ts[2]||0)+(ts[3]||0);
        const pct    = v => totalMin > 0 ? Math.round(v/totalMin*100) : 0;
        const totalSp = (sp.calm||0)+(sp.slow||0)+(sp.medium||0)+(sp.fast||0);
        const spPct  = v => totalSp > 0 ? Math.round(v/totalSp*100) : 0;
        const filterN = Math.min(23, cnt);

        // Értékelés szöveg
        const critPct = pct(ts[3]||0);
        const warnPct = pct((ts[2]||0)+(ts[3]||0));
        let evalText = '';
        if (kpi.avg !== '-') {
            evalText = tr.rpt_eval_text
                .replace('{date}', dateStr)
                .replace('{cnt}', cnt.toLocaleString())
                .replace('{avg}', kpi.avg)
                .replace('{max}', kpi.max)
                .replace('{peak}', peakTime);
            if (critPct > 10) evalText += ' ' + tr.rpt_eval_critical.replace('{pct}', critPct);
            else if (warnPct > 50) evalText += ' ' + tr.rpt_eval_warning.replace('{pct}', warnPct);
            else evalText += ' ' + tr.rpt_eval_ok;
        }

        // Téma
        const isDark = theme === 'dark';
        const C = isDark ? {
            bg:'radial-gradient(ellipse at 20% 0%,rgba(10,132,255,0.10) 0%,transparent 55%),radial-gradient(ellipse at 80% 100%,rgba(48,209,88,0.07) 0%,transparent 55%),#07090f',
            card:'rgba(255,255,255,0.05)', cardBorder:'rgba(255,255,255,0.09)', cardHi:'rgba(255,255,255,0.13)',
            text:'rgba(255,255,255,0.93)', text2:'rgba(255,255,255,0.55)', text3:'rgba(255,255,255,0.28)',
            line:'rgba(255,255,255,0.07)',
            blue:'#0a84ff', green:'#30d158', amber:'#ff9f0a', red:'#ff453a', purple:'#bf5af2', teal:'#5ac8fa',
            goodBg:'rgba(48,209,88,0.10)', goodBorder:'rgba(48,209,88,0.25)', goodText:'#30d158',
            warnBg:'rgba(255,159,10,0.10)', warnBorder:'rgba(255,159,10,0.25)', warnText:'#ff9f0a',
            critBg:'rgba(255,69,58,0.10)', critBorder:'rgba(255,69,58,0.20)', critText:'#ff453a',
            barTrack:'rgba(255,255,255,0.06)', printBg:'#07090f', evalBg:'rgba(255,255,255,0.04)', evalBorder:'rgba(255,255,255,0.09)', evalText:'rgba(255,255,255,0.65)',
            chartGrid:'rgba(255,255,255,0.06)', chartTick:'rgba(255,255,255,0.38)',
        } : {
            bg:'radial-gradient(ellipse at 20% 0%,rgba(10,100,220,0.07) 0%,transparent 55%),#f2f5fc',
            card:'rgba(255,255,255,0.88)', cardBorder:'rgba(15,30,100,0.10)', cardHi:'rgba(255,255,255,0.60)',
            text:'#0b1222', text2:'rgba(11,18,34,0.60)', text3:'rgba(11,18,34,0.38)',
            line:'rgba(11,18,34,0.08)',
            blue:'#0055cc', green:'#178a35', amber:'#b84d00', red:'#c42020', purple:'#7a3ab8', teal:'#0077aa',
            goodBg:'rgba(23,138,53,0.09)', goodBorder:'rgba(23,138,53,0.22)', goodText:'#178a35',
            warnBg:'rgba(184,77,0,0.09)', warnBorder:'rgba(184,77,0,0.22)', warnText:'#b84d00',
            critBg:'rgba(196,32,32,0.09)', critBorder:'rgba(196,32,32,0.18)', critText:'#c42020',
            barTrack:'rgba(11,18,34,0.06)', printBg:'#f2f5fc', evalBg:'rgba(11,18,34,0.03)', evalBorder:'rgba(11,18,34,0.10)', evalText:'rgba(11,18,34,0.65)',
            chartGrid:'rgba(11,18,34,0.07)', chartTick:'rgba(11,18,34,0.45)',
        };

        // Chart.js adatok JSON-ba
        const chartLabels = JSON.stringify(pts.map(p => p.x));
        const rawData     = JSON.stringify(pts.map(p => p.y));
        const trendData   = JSON.stringify(pts.map(p => p.t));

        // SVG fallback nyomtatáshoz
        const svgW=720, svgH=190, pL=46, pR=14, pT=16, pB=30;
        const cW=svgW-pL-pR, cH=svgH-pT-pB;
        let svgChart = '';
        if (pts.length >= 2) {
            const allV = pts.flatMap(p=>[p.y||0,p.t||0]).filter(v=>!isNaN(v));
            const yMin = Math.floor(Math.min(...allV)/50)*50;
            const yMax = Math.ceil(Math.max(...allV)/50)*50+50;
            const yRng = yMax-yMin || 1, xRng = pts.length-1 || 1;
            const px = i => (pL+(i/xRng)*cW).toFixed(1);
            const py = v => (pT+cH-((v-yMin)/yRng)*cH).toFixed(1);
            const gridC=C.chartGrid, tickC=C.chartTick;
            const rawC=isDark?'rgba(10,132,255,0.30)':'rgba(10,100,220,0.28)';
            const areaC=isDark?'rgba(10,132,255,0.06)':'rgba(10,100,220,0.05)';
            let inner='';
            const step = yRng<=300?50:yRng<=600?100:200;
            for (let v=yMin; v<=yMax; v+=step) {
                inner+=`<line x1="${pL}" y1="${py(v)}" x2="${svgW-pR}" y2="${py(v)}" stroke="${gridC}" stroke-width="1"/>`;
                inner+=`<text x="${pL-5}" y="${(parseFloat(py(v))+3.5).toFixed(1)}" text-anchor="end" font-size="9" fill="${tickC}" font-family="'JetBrains Mono',monospace">${v}</text>`;
            }
            const xStep=Math.max(1,Math.floor(pts.length/7));
            pts.forEach((p,i)=>{ if(i%xStep===0||i===pts.length-1) inner+=`<text x="${px(i)}" y="${(pT+cH+16).toFixed(1)}" text-anchor="middle" font-size="8" fill="${tickC}" font-family="'JetBrains Mono',monospace">${p.x}</text>`; });
            const aPath=`M${px(0)},${(pT+cH).toFixed(1)} `+pts.map((p,i)=>`L${px(i)},${py(p.y)}`).join(' ')+` L${px(pts.length-1)},${(pT+cH).toFixed(1)} Z`;
            const rPath=pts.map((p,i)=>`${i===0?'M':'L'}${px(i)},${py(p.y)}`).join(' ');
            const tPath=pts.map((p,i)=>`${i===0?'M':'L'}${px(i)},${py(p.t)}`).join(' ');
            inner+=`<path d="${aPath}" fill="${areaC}"/>`;
            inner+=`<path d="${rPath}" fill="none" stroke="${rawC}" stroke-width="1.2"/>`;
            inner+=`<path d="${tPath}" fill="none" stroke="#0a84ff" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>`;
            inner+=`<line x1="${pL}" y1="${py(kpi.max)}" x2="${svgW-pR}" y2="${py(kpi.max)}" stroke="rgba(255,69,58,0.55)" stroke-width="1" stroke-dasharray="5,3"/>`;
            inner+=`<line x1="${pL}" y1="${py(kpi.min)}" x2="${svgW-pR}" y2="${py(kpi.min)}" stroke="rgba(48,209,88,0.55)" stroke-width="1" stroke-dasharray="5,3"/>`;
            inner+=`<text x="${pL+4}" y="${(parseFloat(py(kpi.max))-3).toFixed(1)}" font-size="8" fill="rgba(255,69,58,0.85)" font-family="'JetBrains Mono',monospace">MAX ${kpi.max}</text>`;
            inner+=`<text x="${pL+4}" y="${(parseFloat(py(kpi.min))+9).toFixed(1)}" font-size="8" fill="rgba(48,209,88,0.85)" font-family="'JetBrains Mono',monospace">MIN ${kpi.min}</text>`;
            svgChart=`<svg viewBox="0 0 ${svgW} ${svgH}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block">${inner}</svg>`;
        }

        // Speed row helper
        const speedRow = (label, color, mins) => {
            const p = spPct(mins);
            return `<tr>
              <td><span style="display:inline-flex;align-items:center;gap:7px">
                <span style="width:8px;height:8px;border-radius:50%;background:${color};box-shadow:0 0 5px ${color}80;display:inline-block;flex-shrink:0"></span>
                <span style="font-size:11px;color:${C.text2}">${label}</span>
              </span></td>
              <td style="text-align:right;font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:600;color:${C.text}">${Math.round(mins)} min</td>
              <td style="width:120px;padding:0 12px">
                <div style="height:5px;background:${C.barTrack};border-radius:3px;overflow:hidden">
                  <div style="height:100%;width:${p}%;background:${color};border-radius:3px"></div>
                </div>
              </td>
              <td style="text-align:right;font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:700;color:${color}">${p}%</td>
            </tr>`;
        };

        const html = `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>GrexAir CO₂ · ${dateStr}</title>
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Geist:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/hammerjs@2.0.8/hammer.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-zoom@2.0.1/dist/chartjs-plugin-zoom.min.js"></script>
<style>
*{box-sizing:border-box;margin:0;padding:0}
html{font-size:14px}
body{font-family:'Geist',-apple-system,'Segoe UI',sans-serif;background:${C.bg};color:${C.text};min-height:100vh;-webkit-font-smoothing:antialiased;padding:28px 20px 60px}
@media print{
  body{background:${C.printBg}!important;padding:10px 8px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .no-print{display:none!important}
  .print-only{display:block!important}
  .card{break-inside:avoid}
  #interactive-chart{display:none!important}
  #print-chart{display:block!important}
}
.print-only{display:none}
#print-chart{display:none}
.wrap{max-width:860px;margin:0 auto}
.actions{display:flex;gap:8px;margin-bottom:22px}
.btn{padding:9px 18px;border-radius:10px;font-size:12px;font-weight:700;cursor:pointer;border:none;font-family:inherit;transition:opacity .15s,transform .1s}
.btn:active{transform:scale(.97)}
.btn-print{background:linear-gradient(135deg,${C.blue},#0055dd);color:#fff;box-shadow:0 4px 14px rgba(10,132,255,.30)}
.btn-close{background:${C.card};border:1px solid ${C.cardBorder};color:${C.text2}}
.btn-reset{background:${C.card};border:1px solid ${C.cardBorder};color:${C.text3};font-size:11px;padding:6px 12px}
.card{background:${C.card};border:1px solid ${C.cardBorder};border-radius:16px;backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);position:relative;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,${isDark?'0.35':'0.08'})}
.card::after{content:'';position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,${C.cardHi} 40%,rgba(255,255,255,0.04) 70%,transparent)}
.header{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:22px;padding-bottom:16px;border-bottom:1px solid ${C.line}}
.brand{display:flex;align-items:center;gap:11px}
.brand-icon{width:42px;height:42px;border-radius:12px;background:linear-gradient(135deg,${C.blue},${C.green});display:flex;align-items:center;justify-content:center;font-size:18px;box-shadow:0 4px 14px rgba(10,132,255,.28);flex-shrink:0}
.brand-name{font-size:22px;font-weight:800;letter-spacing:-.5px}
.brand-sub{font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:${C.text3};margin-top:2px}
.meta{text-align:right}
.meta-badge{display:inline-block;padding:4px 12px;border-radius:20px;background:${C.card};border:1px solid ${C.cardBorder};font-size:14px;font-weight:700;color:${C.text};letter-spacing:.5px;margin-bottom:5px;font-family:'JetBrains Mono',monospace}
.meta-row{font-size:10px;color:${C.text3};margin-top:2px}
.meta-row strong{color:${C.text2};font-weight:600}
.sec{font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:${C.text3};margin:18px 0 9px;display:flex;align-items:center;gap:8px}
.sec::after{content:'';flex:1;height:1px;background:${C.line}}
.kpi-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:0}
.kpi{padding:14px 10px;text-align:center;border-right:1px solid ${C.cardBorder}}
.kpi:last-child{border-right:none}
.kpi-label{font-size:8px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:${C.text3};margin-bottom:9px}
.kpi-num{font-family:'JetBrains Mono',monospace;font-size:28px;font-weight:600;letter-spacing:-2px;line-height:1}
.kpi-unit{font-size:10px;color:${C.text3};font-weight:300;font-family:'Geist',sans-serif;margin-top:3px}
.c-blue{color:${C.blue}} .c-pur{color:${C.purple}} .c-red{color:${C.red}} .c-green{color:${C.green}} .c-teal{color:${C.teal}}
.status{padding:11px 18px;border-radius:10px;text-align:center;font-size:12px;font-weight:800;letter-spacing:1.5px;margin:10px 0 16px}
.status-good{background:${C.goodBg};color:${C.goodText};border:1px solid ${C.goodBorder}}
.status-warning{background:${C.warnBg};color:${C.warnText};border:1px solid ${C.warnBorder}}
.status-danger{background:${C.critBg};color:${C.critText};border:1px solid ${C.critBorder}}
.status-neutral{background:${C.card};color:${C.text3};border:1px solid ${C.cardBorder}}
.chart-header{display:flex;align-items:center;justify-content:space-between;padding:14px 16px 8px}
.chart-legend{display:flex;gap:14px}
.leg{display:flex;align-items:center;gap:5px;font-size:10px;color:${C.text2}}
.leg-line{width:20px;height:2px;border-radius:2px}
.chart-canvas-wrap{position:relative;height:240px;padding:0 12px 8px}
.filter-note{font-size:10px;color:${C.text3};padding:7px 14px 10px;line-height:1.6}
.two-col{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.ql-list{padding:6px 4px}
.ql-row{display:flex;align-items:center;gap:10px;margin-bottom:9px}
.ql-row:last-child{margin-bottom:0}
.ql-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0}
.ql-label{font-size:11px;color:${C.text2};min-width:100px}
.ql-track{flex:1;height:5px;background:${C.barTrack};border-radius:3px;overflow:hidden}
.ql-fill{height:100%;border-radius:3px}
.ql-pct{font-size:11px;font-weight:700;min-width:30px;text-align:right;font-family:'JetBrains Mono',monospace}
.ql-min{font-size:10px;color:${C.text3};min-width:44px;text-align:right}
.speed-tbl{width:100%;border-collapse:collapse}
.speed-tbl th{font-size:9px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:${C.text3};text-align:left;padding:5px 8px;border-bottom:1px solid ${C.line}}
.speed-tbl td{padding:8px 8px;border-bottom:1px solid ${C.line};vertical-align:middle}
.speed-tbl tr:last-child td{border-bottom:none}
.info-row{display:flex;justify-content:space-between;align-items:center;padding:7px 4px;border-bottom:1px solid ${C.line}}
.info-row:last-child{border-bottom:none}
.info-key{font-size:11px;color:${C.text2}}
.info-val{font-size:12px;font-weight:600;color:${C.text};font-family:'JetBrains Mono',monospace}
.eval{background:${C.evalBg};border:1px solid ${C.evalBorder};border-radius:12px;padding:12px 16px;font-size:11px;color:${C.evalText};line-height:1.75}
.footer{text-align:center;font-size:10px;color:${C.text3};margin-top:26px;padding-top:14px;border-top:1px solid ${C.line};line-height:1.7}
.zoom-hint{font-size:10px;color:${C.text3};text-align:right;padding-right:4px;margin-bottom:4px}
</style>
</head>
<body>
<div class="wrap">

<div class="actions no-print">
  <button class="btn btn-print" onclick="window.print()">🖨 ${tr.report_print||'Nyomtatás / PDF'}</button>
  <button class="btn btn-close" onclick="window.close()">✕ ${tr.report_close||'Bezárás'}</button>
  <button class="btn btn-reset" onclick="resetZoom()" id="btn-reset" style="display:none">${tr.rpt_zoom_reset}</button>
</div>

<div class="header">
  <div class="brand">
    <div class="brand-icon"><img src="/static/logo.png" alt="GrexAir" style="width:28px;height:28px;object-fit:contain" onerror="this.replaceWith(Object.assign(document.createElement('span'),{style:'color:#fff;font-size:13px;font-weight:800',textContent:'CO2'}))"></div>
    <div>
      <div class="brand-name">GrexAir</div>
      <div class="brand-sub">CO₂ Monitor</div>
    </div>
  </div>
  <div class="meta">
    <div class="meta-badge">${dateStr}</div>
    <div class="meta-row"><strong>${tr.rpt_measurements}:</strong> ${cnt.toLocaleString()}</div>
    <div class="meta-row"><strong>${tr.report_generated||'Generálva'}:</strong> ${dayjs().format('HH:mm')}</div>
    <div class="meta-row"><strong>${tr.rpt_filter}:</strong> Henderson ${filterN}-${tr.rpt_min_label}</div>
  </div>
</div>

<div class="sec">${tr.report_summary||'Összefoglalás'}</div>
<div class="card">
  <div class="kpi-grid">
    <div class="kpi"><div class="kpi-label">${tr.report_current||'Utolsó'}</div><div class="kpi-num c-blue">${kpi.current}</div><div class="kpi-unit">ppm</div></div>
    <div class="kpi"><div class="kpi-label">${tr.report_avg||'Átlag'}</div><div class="kpi-num c-pur">${kpi.avg}</div><div class="kpi-unit">ppm</div></div>
    <div class="kpi"><div class="kpi-label">${tr.report_max||'Maximum'}</div><div class="kpi-num c-red">${kpi.max}</div><div class="kpi-unit">ppm</div></div>
    <div class="kpi"><div class="kpi-label">${tr.report_min||'Minimum'}</div><div class="kpi-num c-green">${kpi.min}</div><div class="kpi-unit">ppm</div></div>
    <div class="kpi"><div class="kpi-label">${tr.report_range||'Tartomány'}</div><div class="kpi-num c-teal">${(!isNaN(kpi.max)&&!isNaN(kpi.min))?kpi.max-kpi.min:'-'}</div><div class="kpi-unit">ppm</div></div>
  </div>
</div>

<div class="status ${statusClass}">${statusText}</div>

<div class="sec">${tr.rpt_chart_title}</div>
<div class="card">
  <div class="chart-header">
    <div class="chart-legend">
      <div class="leg"><div class="leg-line" style="background:#0a84ff;height:2.5px"></div>${tr.rpt_trend_label} (${filterN}-pt)</div>
      <div class="leg"><div class="leg-line" style="background:rgba(10,132,255,0.38);height:1.5px"></div>${tr.rpt_raw_label}</div>
      <div class="leg"><div class="leg-line" style="background:rgba(255,69,58,0.55);height:1px;border-top:1px dashed rgba(255,69,58,.5)"></div>MAX/MIN</div>
    </div>
    <div class="zoom-hint no-print">${tr.rpt_zoom_hint}</div>
  </div>
  <div id="interactive-chart" class="chart-canvas-wrap">
    <canvas id="rptChart"></canvas>
  </div>
  <div id="print-chart" class="print-only">${svgChart}</div>
  <div class="filter-note">${tr.rpt_filter_note.replace('{N}', filterN).replace('{cnt}', cnt.toLocaleString())}</div>
</div>

<div class="sec">${tr.rpt_daily_stats}</div>
<div class="two-col">

  <div class="card" style="padding:14px 16px">
    <div style="font-size:10px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:${C.text3};margin-bottom:10px">${tr.rpt_daily_stats}</div>
    <div class="info-row"><span class="info-key">${tr.rpt_peak_time}</span><span class="info-val">${peakTime}</span></div>
    <div class="info-row"><span class="info-key">${tr.report_max||'Maximum'}</span><span class="info-val" style="color:${C.red}">${kpi.max} ppm</span></div>
    <div class="info-row"><span class="info-key">${tr.report_min||'Minimum'}</span><span class="info-val" style="color:${C.green}">${kpi.min} ppm</span></div>
    <div class="info-row"><span class="info-key">${tr.report_avg||'Átlag'}</span><span class="info-val" style="color:${C.purple}">${kpi.avg} ppm</span></div>
    <div class="info-row"><span class="info-key">${tr.rpt_measurements}</span><span class="info-val">${cnt.toLocaleString()}</span></div>
  </div>

  <div class="card" style="padding:14px 16px">
    <div style="font-size:10px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:${C.text3};margin-bottom:10px">${tr.rpt_quality_dist}</div>
    <div class="ql-list">
      <div class="ql-row"><div class="ql-dot" style="background:${C.green};box-shadow:0 0 5px ${C.green}80"></div><div class="ql-label">${tr.quality_excellent||'Kiváló'} <span style="font-size:9px;color:${C.text3}">&lt;800</span></div><div class="ql-track"><div class="ql-fill" style="width:${pct(ts[0])}%;background:${C.green}"></div></div><div class="ql-pct" style="color:${C.green}">${pct(ts[0])}%</div><div class="ql-min">${Math.round(ts[0])}m</div></div>
      <div class="ql-row"><div class="ql-dot" style="background:#ffd60a;box-shadow:0 0 5px rgba(255,214,10,.5)"></div><div class="ql-label">${tr.quality_good||'Jó'} <span style="font-size:9px;color:${C.text3}">800–1k</span></div><div class="ql-track"><div class="ql-fill" style="width:${pct(ts[1]||0)}%;background:#ffd60a"></div></div><div class="ql-pct" style="color:#ffd60a">${pct(ts[1]||0)}%</div><div class="ql-min">${Math.round(ts[1]||0)}m</div></div>
      <div class="ql-row"><div class="ql-dot" style="background:${C.amber};box-shadow:0 0 5px ${C.amber}80"></div><div class="ql-label">${tr.quality_warning||'Figyelem'} <span style="font-size:9px;color:${C.text3}">1k–1.5k</span></div><div class="ql-track"><div class="ql-fill" style="width:${pct(ts[2]||0)}%;background:${C.amber}"></div></div><div class="ql-pct" style="color:${C.amber}">${pct(ts[2]||0)}%</div><div class="ql-min">${Math.round(ts[2]||0)}m</div></div>
      <div class="ql-row"><div class="ql-dot" style="background:${C.red};box-shadow:0 0 5px ${C.red}80"></div><div class="ql-label">${tr.quality_critical||'Kritikus'} <span style="font-size:9px;color:${C.text3}">&gt;1.5k</span></div><div class="ql-track"><div class="ql-fill" style="width:${pct(ts[3]||0)}%;background:${C.red}"></div></div><div class="ql-pct" style="color:${C.red}">${pct(ts[3]||0)}%</div><div class="ql-min">${Math.round(ts[3]||0)}m</div></div>
    </div>
  </div>
</div>

<div class="sec">${tr.rpt_speed_dist}</div>
<div class="card" style="padding:14px 16px">
  <table class="speed-tbl">
    <thead><tr><th>${tr.rpt_speed_cat}</th><th style="text-align:right">${tr.rpt_speed_time}</th><th style="width:130px">${tr.rpt_speed_ratio}</th><th style="text-align:right">%</th></tr></thead>
    <tbody>
      ${speedRow(tr.rpt_speed_calm, C.green, sp.calm||0)}
      ${speedRow(tr.rpt_speed_slow, '#ffd60a', sp.slow||0)}
      ${speedRow(tr.rpt_speed_medium, C.amber, sp.medium||0)}
      ${speedRow(tr.rpt_speed_fast, C.red, sp.fast||0)}
    </tbody>
  </table>
  <div style="margin-top:10px;font-size:10px;color:${C.text3};padding:6px 8px;background:${C.card};border:1px solid ${C.cardBorder};border-radius:7px;line-height:1.6">
    ${tr.rpt_total_period}: <strong style="color:${C.text2}">${Math.round(totalSp)} ${tr.rpt_min_label}</strong> ${tr.rpt_analyzed} · ${tr.rpt_fast_vent}: <strong style="color:${C.red}">${spPct(sp.fast||0)}%</strong>
  </div>
</div>

<div class="sec">${tr.report_eval_title||'Értékelés'}</div>
<div class="eval">${evalText || '<span style="opacity:.5">${tr.rpt_no_eval}</span>'}</div>

<div class="footer">
  GrexAir CO₂ Monitor &nbsp;·&nbsp; ${dateStr} &nbsp;·&nbsp; grexair.hu<br>
  ${tr.rpt_footer.replace('{N}',filterN).replace('{cnt}',cnt.toLocaleString())} &nbsp;·&nbsp; ${dayjs().format('YYYY-MM-DD HH:mm')}
</div>

</div>

<script>
var LABELS = ${chartLabels};
var RAW    = ${rawData};
var TREND  = ${trendData};
var MAX_V  = ${kpi.max};
var MIN_V  = ${kpi.min};
var isDark = ${isDark};

var ctx = document.getElementById('rptChart');
if (ctx && LABELS.length > 0) {
  var maxLine = LABELS.map(function(){ return MAX_V; });
  var minLine = LABELS.map(function(){ return MIN_V; });
  var tickColor   = isDark ? 'rgba(255,255,255,0.38)' : 'rgba(11,18,34,0.45)';
  var gridColor   = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(11,18,34,0.07)';

  var chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: LABELS,
      datasets: [
        {
          label: '${tr.rpt_trend_label}',
          data: TREND,
          borderColor: '#0a84ff',
          borderWidth: 2.2,
          pointRadius: 0,
          tension: 0.3,
          order: 1,
        },
        {
          label: '${tr.rpt_raw_label}',
          data: RAW,
          borderColor: isDark ? 'rgba(10,132,255,0.35)' : 'rgba(10,100,220,0.30)',
          borderWidth: 1.2,
          pointRadius: 0,
          tension: 0.1,
          fill: {
            target: 'origin',
            above: isDark ? 'rgba(10,132,255,0.05)' : 'rgba(10,100,220,0.04)',
          },
          order: 2,
        },
        {
          label: 'MAX',
          data: maxLine,
          borderColor: 'rgba(255,69,58,0.55)',
          borderWidth: 1,
          borderDash: [5,3],
          pointRadius: 0,
          fill: false,
          order: 3,
        },
        {
          label: 'MIN',
          data: minLine,
          borderColor: 'rgba(48,209,88,0.55)',
          borderWidth: 1,
          borderDash: [5,3],
          pointRadius: 0,
          fill: false,
          order: 4,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 400 },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: isDark ? 'rgba(15,20,35,0.92)' : 'rgba(255,255,255,0.95)',
          titleColor: isDark ? 'rgba(255,255,255,0.9)' : '#0b1222',
          bodyColor: isDark ? 'rgba(255,255,255,0.65)' : 'rgba(11,18,34,0.65)',
          borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(11,18,34,0.10)',
          borderWidth: 1,
          padding: 10,
          callbacks: {
            label: function(ctx) {
              if (ctx.datasetIndex > 1) return null;
              return ctx.dataset.label + ': ' + ctx.raw + ' ppm';
            }
          }
        },
        zoom: {
          zoom: {
            drag: {
              enabled: true,
              backgroundColor: isDark ? 'rgba(10,132,255,0.12)' : 'rgba(10,100,220,0.10)',
              borderColor: isDark ? 'rgba(10,132,255,0.5)' : 'rgba(10,100,220,0.4)',
              borderWidth: 1,
            },
            wheel: { enabled: true, speed: 0.08 },
            pinch: { enabled: true },
            mode: 'x',
            onZoom: function() {
              document.getElementById('btn-reset').style.display = 'inline-flex';
            }
          },
          pan: {
            enabled: true,
            mode: 'x',
            modifierKey: 'shift',
          }
        }
      },
      scales: {
        x: {
          ticks: {
            color: tickColor,
            font: { family: "'JetBrains Mono',monospace", size: 10 },
            maxTicksLimit: 8,
            maxRotation: 0,
          },
          grid: { color: gridColor, drawBorder: false },
          border: { display: false },
        },
        y: {
          ticks: {
            color: tickColor,
            font: { family: "'JetBrains Mono',monospace", size: 10 },
            callback: function(v) { return v + ' ppm'; }
          },
          grid: { color: gridColor, drawBorder: false },
          border: { display: false },
        }
      }
    }
  });

  ctx.addEventListener('dblclick', function() {
    chart.resetZoom();
    document.getElementById('btn-reset').style.display = 'none';
  });

  window.resetZoom = function() {
    chart.resetZoom();
    document.getElementById('btn-reset').style.display = 'none';
  };
}
</script>
</body>
</html>`;

        res.send(html);
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
