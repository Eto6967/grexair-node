const { Pool } = require('pg');
const config = require('./config');
const dayjs = require('dayjs');
const fs = require('fs');
const csv = require('csv-parser');
const savitzkyGolayFn = require('ml-savitzky-golay');
const savitzkyGolay = savitzkyGolayFn.default || savitzkyGolayFn;

const pool = new Pool({ connectionString: config.DB_URL, ssl: { rejectUnauthorized: false } });

pool.query(`
    CREATE TABLE IF NOT EXISTS history_cache (date_key DATE PRIMARY KEY, data_json TEXT);
    CREATE TABLE IF NOT EXISTS sensor_data (id SERIAL PRIMARY KEY, timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP, co2_ppm NUMERIC NOT NULL);
`).then(() => console.log("✅ Neon Adatbázis csatlakoztatva.")).catch(console.error);

function calculateKpi(dataArray) {
    if (!dataArray || dataArray.length === 0) return { current: '-', avg: '-', max: '-', min: '-' };
    const co2 = dataArray.map(d => Number(d.CO2_ppm)).filter(v => !isNaN(v));
    return {
        current: Math.round(co2[co2.length - 1]),
        avg: Math.round(co2.reduce((a, b) => a + b, 0) / co2.length),
        max: Math.round(Math.max(...co2)),
        min: Math.round(Math.min(...co2))
    };
}

function getStatus(val) {
    if (isNaN(val)) return { text: "Nincs adat", cssClass: "status-neutral" };
    if (val < config.THRESHOLD_WARNING) return { text: "KIVÁLÓ", cssClass: config.CLASS_GOOD };
    if (val < config.THRESHOLD_DANGER) return { text: "ELFOGADHATÓ", cssClass: config.CLASS_WARNING };
    return { text: "VESZÉLYES", cssClass: config.CLASS_DANGER };
}

// --- MEMÓRIA CACHE VÁLTOZÓK ---
let dailyCache = [];
let lastFetchedId = 0;
let currentDayStr = "";

// --- AZ OPTIMALIZÁLT LEKÉRDEZÉS ---
async function getLatestSensorData() {
    const todayStr = dayjs().format('YYYY-MM-DD');

    try {
        // 1. Új nap vagy üres cache esetén teljes mai nap betöltése
        if (currentDayStr !== todayStr || dailyCache.length === 0) {
            const res = await pool.query(
                `SELECT id, timestamp as "Ido", co2_ppm as "CO2_ppm" FROM sensor_data WHERE timestamp >= $1 ORDER BY id ASC`, 
                [`${todayStr} 00:00:00`]
            );
            dailyCache = res.rows;
            currentDayStr = todayStr;
            if (dailyCache.length > 0) {
                lastFetchedId = dailyCache[dailyCache.length - 1].id;
            }
        } 
        // 2. Csak az új adatok lekérése ID alapján (ez spórolja az adatforgalmat)
        else {
            const res = await pool.query(
                `SELECT id, timestamp as "Ido", co2_ppm as "CO2_ppm" FROM sensor_data WHERE id > $1 ORDER BY id ASC`, 
                [lastFetchedId]
            );
            if (res.rows.length > 0) {
                dailyCache = dailyCache.concat(res.rows);
                lastFetchedId = dailyCache[dailyCache.length - 1].id;
            }
        }

        let rows = [...dailyCache];

        // 3. Ritkítás (Throttling) a megjelenítéshez
        const MAX_POINTS = 1500;
        if (rows.length > MAX_POINTS) {
            const step = Math.ceil(rows.length / MAX_POINTS);
            let thinnedRows = rows.filter((_, index) => index % step === 0);
            
            // Biztosítjuk, hogy a legutolsó mérés mindig benne legyen
            if (rows.length > 0 && rows[rows.length - 1].id !== thinnedRows[thinnedRows.length - 1]?.id) {
                thinnedRows.push(rows[rows.length - 1]);
            }
            return thinnedRows;
        }

        return rows;
    } catch (err) {
        console.error("❌ Hiba az adatok lekérésekor:", err.message);
        return dailyCache; // Hiba esetén adjuk vissza a már memóriában lévőt
    }
}

async function getAvailableDates() {
    try {
        const res = await pool.query(`SELECT DISTINCT DATE(timestamp) as datum FROM sensor_data ORDER BY datum DESC`);
        return res.rows.map(r => dayjs(r.datum).format('YYYY-MM-DD'));
    } catch (err) {
        return [];
    }
}

async function getHistoryData(dateStr) {
    try {
        const cache = await pool.query("SELECT data_json FROM history_cache WHERE date_key = $1", [dateStr]);
        if (cache.rows.length > 0) return JSON.parse(cache.rows[0].data_json);

        const res = await pool.query(`SELECT timestamp as "Ido", co2_ppm as "CO2_ppm" FROM sensor_data WHERE timestamp >= $1 AND timestamp <= $2 ORDER BY timestamp ASC`, [`${dateStr} 00:00:00`, `${dateStr} 23:59:59`]);
        
        if (res.rows.length > 0 && dateStr < dayjs().format('YYYY-MM-DD')) {
            await pool.query(`INSERT INTO history_cache (date_key, data_json) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [dateStr, JSON.stringify(res.rows)]);
        }
        return res.rows;
    } catch (err) {
        return [];
    }
}

function loadAndCleanData(filename) {
    return new Promise((resolve) => {
        const results = [];
        if (!fs.existsSync(filename)) return resolve([]);

        const content = fs.readFileSync(filename, 'utf8');
        const separator = content.indexOf(';') !== -1 ? ';' : ',';

        fs.createReadStream(filename).pipe(csv({ separator: separator })).on('data', (d) => {
            const timeKey = Object.keys(d).find(k => k.toLowerCase().includes('id') || k.toLowerCase().includes('time') || k.toLowerCase().includes('dátum') || k.toLowerCase().includes('date'));
            const co2Key = Object.keys(d).find(k => k.toLowerCase().includes('co2') || k.toLowerCase().includes('ppm'));
            
            if (timeKey && co2Key && d[timeKey] && d[co2Key]) {
                let co2Val = String(d[co2Key]).replace(',', '.'); 
                let timeVal = String(d[timeKey]).trim();
                if (timeVal.length <= 8) timeVal = dayjs().format('YYYY-MM-DD ') + timeVal;
                results.push({ Ido: timeVal, CO2_ppm: parseFloat(co2Val) });
            }
        }).on('end', () => resolve(results));
    });
}

function numpyGradient(y, x) {
    let n = y.length;
    let grad = new Array(n).fill(0);
    if (n < 2) return grad;
    grad[0] = x[1] !== x[0] ? (y[1] - y[0]) / (x[1] - x[0]) : 0;
    for (let i = 1; i < n - 1; i++) {
        grad[i] = x[i+1] !== x[i-1] ? (y[i+1] - y[i-1]) / (x[i+1] - x[i-1]) : 0;
    }
    grad[n-1] = x[n-1] !== x[n-2] ? (y[n-1] - y[n-2]) / (x[n-1] - x[n-2]) : 0;
    return grad;
}

function processAdvancedData(dataArray, windowSize = 15) {
    if (!dataArray || dataArray.length === 0) {
        return { chartData: [], timeStats: [0, 0, 0] };
    }

    let rawValues = dataArray.map(d => parseFloat(d.CO2_ppm));
    let minutes = [];
    let startT = dayjs(dataArray[0].Ido);

    for (let i = 0; i < dataArray.length; i++) {
        minutes.push(dayjs(dataArray[i].Ido).diff(startT, 'second') / 60.0);
    }

    let effectiveWindow = Math.min(windowSize, rawValues.length);
    if (effectiveWindow % 2 === 0) effectiveWindow -= 1;

    let smoothValues = rawValues.slice();

    if (rawValues.length > 5 && effectiveWindow > 3) {
        try {
            let sgResult = savitzkyGolay(rawValues, 1, { windowSize: effectiveWindow, polynomial: 2, derivative: 0 });
            let padSize = Math.floor(effectiveWindow / 2);
            if (sgResult && sgResult.length < rawValues.length) {
                smoothValues = [
                    ...rawValues.slice(0, padSize),
                    ...sgResult,
                    ...rawValues.slice(rawValues.length - padSize)
                ];
            } else {
                smoothValues = sgResult;
            }
        } catch (err) {
            console.error("❌ Savgol hiba:", err.message);
        }
    }

    let speed = numpyGradient(smoothValues, minutes);
    let accel = numpyGradient(speed, minutes);

    let dt = new Array(minutes.length).fill(1);
    for (let i = 1; i < minutes.length; i++) {
        dt[i] = minutes[i] - minutes[i-1];
        if (dt[i] <= 0) dt[i] = 0.01; 
    }

    let timeGood = 0, timeWarn = 0, timeBad = 0;
    let chartData = [];

    for (let i = 0; i < dataArray.length; i++) {
        let sVal = smoothValues[i] || rawValues[i];
        if (sVal < 1000) timeGood += dt[i];
        else if (sVal < 1500) timeWarn += dt[i];
        else timeBad += dt[i];

        chartData.push({
            x: dayjs(dataArray[i].Ido).format('YYYY-MM-DD HH:mm:ss'),
            y_raw: rawValues[i],
            y_smooth: Number(sVal.toFixed(2)),
            speed: Number(speed[i] ? speed[i].toFixed(2) : 0),
            accel: Number(accel[i] ? accel[i].toFixed(2) : 0)
        });
    }

    return { chartData, timeStats: [Number(timeGood.toFixed(1)), Number(timeWarn.toFixed(1)), Number(timeBad.toFixed(1))] };
}

module.exports = { calculateKpi, getStatus, getLatestSensorData, getAvailableDates, getHistoryData, loadAndCleanData, processAdvancedData };