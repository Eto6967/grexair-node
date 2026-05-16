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
`).then(() => console.log('✅ Neon Adatbázis csatlakoztatva.')).catch(console.error);

// ── Max adatpontok grafikonhoz ─────────────────────────────────
const MAX_CHART_POINTS = 1200;

// ── Gyors min/max — reduce, nem spread (nem crashel 36k pontnál) ─
function fastMin(arr) { let m = Infinity;  for (let i = 0; i < arr.length; i++) if (arr[i] < m) m = arr[i]; return m; }
function fastMax(arr) { let m = -Infinity; for (let i = 0; i < arr.length; i++) if (arr[i] > m) m = arr[i]; return m; }

// ── KPI számítás ──────────────────────────────────────────────
function calculateKpi(dataArray) {
    if (!dataArray || dataArray.length === 0) return { current: '-', avg: '-', max: '-', min: '-' };
    const co2 = dataArray.map(d => Number(d.CO2_ppm)).filter(v => !isNaN(v));
    if (!co2.length) return { current: '-', avg: '-', max: '-', min: '-' };
    let sum = 0, mn = co2[0], mx = co2[0];
    for (let i = 0; i < co2.length; i++) {
        sum += co2[i];
        if (co2[i] < mn) mn = co2[i];
        if (co2[i] > mx) mx = co2[i];
    }
    return {
        current: Math.round(co2[co2.length - 1]),
        avg:     Math.round(sum / co2.length),
        max:     Math.round(mx),
        min:     Math.round(mn)
    };
}

function getStatus(val) {
    if (isNaN(val)) return { text: 'Nincs adat', key: 'air_nodata',    cssClass: 'status-neutral' };
    if (val < config.THRESHOLD_WARNING) return { text: 'KIVÁLÓ',      key: 'air_excellent',  cssClass: config.CLASS_GOOD };
    if (val < config.THRESHOLD_DANGER)  return { text: 'ELFOGADHATÓ', key: 'air_acceptable', cssClass: config.CLASS_WARNING };
    return                                     { text: 'VESZÉLYES',   key: 'air_dangerous',  cssClass: config.CLASS_DANGER };
}

// ── Ritkítás: max N pont, az utolsó mindig benne van ─────────
function thinRows(rows, maxPts) {
    if (rows.length <= maxPts) return rows;
    const step = Math.ceil(rows.length / maxPts);
    const result = [];
    for (let i = 0; i < rows.length; i += step) result.push(rows[i]);
    // Utolsó pont mindig benne legyen
    if (result[result.length - 1] !== rows[rows.length - 1]) {
        result.push(rows[rows.length - 1]);
    }
    return result;
}

// ── Memória cache ─────────────────────────────────────────────
let dailyCache    = [];
let lastFetchedId = 0;
let currentDayStr = '';

async function getLatestSensorData() {
    const todayStr = dayjs().format('YYYY-MM-DD');
    try {
        if (currentDayStr !== todayStr || dailyCache.length === 0) {
            const res = await pool.query(
                `SELECT id, timestamp as "Ido", co2_ppm as "CO2_ppm" FROM sensor_data WHERE timestamp >= $1 ORDER BY id ASC`,
                [`${todayStr} 00:00:00`]
            );
            dailyCache    = res.rows;
            currentDayStr = todayStr;
            if (dailyCache.length > 0) lastFetchedId = dailyCache[dailyCache.length - 1].id;
        } else {
            const res = await pool.query(
                `SELECT id, timestamp as "Ido", co2_ppm as "CO2_ppm" FROM sensor_data WHERE id > $1 ORDER BY id ASC`,
                [lastFetchedId]
            );
            if (res.rows.length > 0) {
                dailyCache    = dailyCache.concat(res.rows);
                lastFetchedId = dailyCache[dailyCache.length - 1].id;
            }
        }
        // ★ CHART: ritkított adat (max MAX_CHART_POINTS) — de a KPI a teljes cache-ből számol!
        return thinRows(dailyCache, MAX_CHART_POINTS);
    } catch (err) {
        console.error('❌ Hiba az adatok lekérésekor:', err.message);
        return thinRows(dailyCache, MAX_CHART_POINTS);
    }
}

// ★ ÚJ: KPI a TELJES napi cache-ből — nem a ritkítottból!
// Így a max/min/avg pontos marad 36k mérésnél is
function getFullKpi() {
    if (!dailyCache.length) return null;
    return calculateKpi(dailyCache);
}

async function getAvailableDates() {
    try {
        const res = await pool.query(`SELECT DISTINCT DATE(timestamp) as datum FROM sensor_data ORDER BY datum DESC`);
        return res.rows.map(r => dayjs(r.datum).format('YYYY-MM-DD'));
    } catch (err) { return []; }
}

async function getHistoryData(dateStr) {
    try {
        // 1. Ellenőrzük a cache-t — de most a processed payload-ot cache-eljük, nem a nyers sorokat
        const cacheKey = `processed_${dateStr}`;
        const cache = await pool.query('SELECT data_json FROM history_cache WHERE date_key = $1', [dateStr]);
        if (cache.rows.length > 0) {
            const parsed = JSON.parse(cache.rows[0].data_json);
            // Ha a cache már feldolgozott payload (van chartData), adjuk vissza közvetlenül
            if (parsed && parsed.chartData) return parsed;
            // Ha nyers sorok (régi cache formátum), ritkítsuk és dolgozzuk fel
            return thinRows(parsed, MAX_CHART_POINTS);
        }

        // 2. DB lekérdezés — csak a szükséges oszlopok
        const res = await pool.query(
            `SELECT timestamp as "Ido", co2_ppm as "CO2_ppm"
             FROM sensor_data
             WHERE timestamp >= $1 AND timestamp <= $2
             ORDER BY timestamp ASC`,
            [`${dateStr} 00:00:00`, `${dateStr} 23:59:59`]
        );

        if (!res.rows.length) return [];

        // 3. ★ RITKÍTÁS FELDOLGOZÁS ELŐTT — max MAX_CHART_POINTS sor megy a savgol-ba
        const thinned = thinRows(res.rows, MAX_CHART_POINTS);

        // 4. Cache-eljük a nyers (ritkított) sorokat a múltbeli napokhoz
        if (dateStr < dayjs().format('YYYY-MM-DD')) {
            await pool.query(
                `INSERT INTO history_cache (date_key, data_json) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
                [dateStr, JSON.stringify(thinned)]
            ).catch(() => {}); // Cache hiba nem blokkolja a választ
        }

        return thinned;
    } catch (err) {
        console.error('❌ History hiba:', err.message);
        return [];
    }
}

async function saveSingleData(ppm) {
    try {
        const val = parseFloat(ppm);
        if (isNaN(val)) return false;
        await pool.query('INSERT INTO sensor_data (co2_ppm) VALUES ($1)', [val]);
        return true;
    } catch (err) {
        console.error('❌ saveSingleData hiba:', err.message);
        return false;
    }
}

function loadAndCleanData(filename) {
    return new Promise((resolve) => {
        const results = [];
        if (!fs.existsSync(filename)) return resolve([]);
        const content   = fs.readFileSync(filename, 'utf8');
        const separator = content.indexOf(';') !== -1 ? ';' : ',';
        fs.createReadStream(filename).pipe(csv({ separator })).on('data', (d) => {
            const timeKey = Object.keys(d).find(k => k.toLowerCase().includes('id') || k.toLowerCase().includes('time') || k.toLowerCase().includes('date'));
            const co2Key  = Object.keys(d).find(k => k.toLowerCase().includes('co2') || k.toLowerCase().includes('ppm'));
            if (timeKey && co2Key && d[timeKey] && d[co2Key]) {
                let co2Val  = String(d[co2Key]).replace(',', '.');
                let timeVal = String(d[timeKey]).trim();
                if (timeVal.length <= 8) timeVal = dayjs().format('YYYY-MM-DD ') + timeVal;
                results.push({ Ido: timeVal, CO2_ppm: parseFloat(co2Val) });
            }
        }).on('end', () => resolve(thinRows(results, MAX_CHART_POINTS)));
    });
}

function numpyGradient(y, x) {
    const n    = y.length;
    const grad = new Array(n).fill(0);
    if (n < 2) return grad;
    grad[0] = x[1] !== x[0] ? (y[1] - y[0]) / (x[1] - x[0]) : 0;
    for (let i = 1; i < n - 1; i++) {
        grad[i] = x[i+1] !== x[i-1] ? (y[i+1] - y[i-1]) / (x[i+1] - x[i-1]) : 0;
    }
    grad[n-1] = x[n-1] !== x[n-2] ? (y[n-1] - y[n-2]) / (x[n-1] - x[n-2]) : 0;
    return grad;
}

// ══════════════════════════════════════════════════════════════
// MH-Z19C OPTIMALIZÁLT SZŰRŐ PIPELINE
// ══════════════════════════════════════════════════════════════

// ── 1. SPIKE REJECT ───────────────────────────────────────────
// Az MH-Z19C fizikailag ~30-60 sec alatt vált szintet.
// Ha egy mérés a szomszédokhoz képest >MAX_JUMP ppm-t ugrik,
// interpoláljuk át, nem vesszük valódinak.
function spikeReject(raw, minutes) {
    const n = raw.length;
    const out = raw.slice();
    // MAX_JUMP: 3 mp alatt max 80 ppm változás reális
    // (1500→400 ppm nyitott ablakkal ~2-3 perc alatt)
    const MAX_JUMP_PER_MIN = 120; // ppm/perc max elfogadott változás
    for (let i = 1; i < n - 1; i++) {
        const dt_prev = Math.max(0.05, minutes[i]   - minutes[i-1]);
        const dt_next = Math.max(0.05, minutes[i+1] - minutes[i]);
        const jump_prev = Math.abs(raw[i] - raw[i-1]) / dt_prev;
        const jump_next = Math.abs(raw[i] - raw[i+1]) / dt_next;
        // Ha mindkét irányban nagy ugrás → spike → interpolál
        if (jump_prev > MAX_JUMP_PER_MIN && jump_next > MAX_JUMP_PER_MIN) {
            out[i] = (raw[i-1] + raw[i+1]) / 2;
        }
    }
    return out;
}

// ── 2. 1D KALMAN FILTER ───────────────────────────────────────
// MH-Z19C paraméterek:
//   process_noise (Q): CO2 lassan változik → kis Q
//   measurement_noise (R): szenzorzaj ±30-50 ppm → nagy R
//   A magas R/Q arány = erős simítás, lassú követés
//
// Adaptív: ha gyors változás detektálható (pl. ablaknyitás),
// átmenetileg növeli Q-t → gyorsabban követi az igazi értéket
function kalmanFilter(values, minutes) {
    const n = values.length;
    const out = new Array(n);

    // Alap paraméterek az MH-Z19C zajmodelljéhez
    const Q_base = 2.0;   // process noise (CO2 változás bizonytalansága)
    const R      = 60;   // measurement noise variance (≈ 20 ppm std)

    let x = values[0];   // state estimate
    let P = 100;          // estimate covariance (kezdeti bizonytalanság)

    out[0] = x;

    for (let i = 1; i < n; i++) {
        const dt = Math.max(0.05, minutes[i] - minutes[i-1]);

        // Adaptív Q: ha az előző lépésben nagy volt a változás,
        // növeljük Q-t → szenzor gyorsabban reagál valódi változásra
        const prevChange = Math.abs(values[i] - values[i-1]);
        const Q = Q_base + (prevChange > 3 ? prevChange * 2.0 : 0);

        // ── Predict ──
        // x_pred = x (random walk modell — CO2 lassan drift)
        const P_pred = P + Q * dt;

        // ── Update ──
        const K = P_pred / (P_pred + R);   // Kalman gain
        x = x + K * (values[i] - x);        // state update
        P = (1 - K) * P_pred;               // covariance update

        out[i] = x;
    }

    return out;
}

// ── Gyors ISO string → "HH:MM:SS" konverzió dayjs nélkül ────
function fastFormatTimestamp(isoStr) {
    // Kezeli a Date objektumot ÉS a string formátumot
    if (isoStr instanceof Date) {
        // Date objektum → "YYYY-MM-DD HH:MM:SS" (UTC)
        return isoStr.toISOString().replace('T', ' ').substring(0, 19);
    }
    const s = String(isoStr);
    if (s.length >= 19 && /^\d{4}/.test(s)) return s.substring(0, 19);
    return s;
}

function processAdvancedData(dataArray, windowSize = 15) {
    if (!dataArray || dataArray.length === 0) return { chartData: [], timeStats: [0, 0, 0] };

    if (dataArray.length > MAX_CHART_POINTS) {
        dataArray = thinRows(dataArray, MAX_CHART_POINTS);
    }

    const n         = dataArray.length;
    const rawValues = new Array(n);
    const minutes   = new Array(n);

    // Robusztus timestamp parsing — kezeli a Date objektumot ÉS a string formátumot
    function parseIdo(v) {
        if (v instanceof Date) return v.getTime();
        const s = String(v);
        // "2024-03-15 14:23:45" → "2024-03-15T14:23:45"
        if (/^\d{4}-\d{2}-\d{2}/.test(s)) return new Date(s.replace(' ', 'T')).getTime();
        // Fallback: natív Date parse
        return new Date(s).getTime();
    }
    const startMs = parseIdo(dataArray[0].Ido);
    for (let i = 0; i < n; i++) {
        rawValues[i] = parseFloat(dataArray[i].CO2_ppm);
        const ms     = parseIdo(dataArray[i].Ido);
        minutes[i]   = isNaN(ms) ? i * 0.05 : (ms - startMs) / 60000;
    }

    // ══════════════════════════════════════════════════════════
    // MH-Z19C SZŰRŐ PIPELINE
    //
    // LÉPÉS 1 — Spike Reject
    //   Fizikailag lehetetlen értékek (pl. kommunikációs hiba)
    //   interpolációval helyettesítve.
    //
    // LÉPÉS 2 — Kalman Filter
    //   MH-Z19C zajmodelljéhez hangolva (R=400, Q_base=0.5).
    //   Adaptív: ablaknyitás / CO2 csúcs esetén gyorsabban követ.
    //   Eredmény: stabil, simított trendvonal.
    //
    // LÉPÉS 3 — Savitzky-Golay a Kalman kimeneten
    //   Csak a derivált (sebesség, gyorsulás) számításhoz.
    //   Kisebb ablak (9) — a Kalman már simított, nem kell nagy ablak.
    // ══════════════════════════════════════════════════════════

    // Lépés 1: Spike reject
    const denoised = spikeReject(rawValues, minutes);

    // Lépés 2: Kalman filter
    const kalmanValues = kalmanFilter(denoised, minutes);

    // Lépés 3: Savitzky-Golay a sebességhez/gyorsuláshoz
    // Kisebb ablak — a Kalman kimenet már sima
    const sgWindow = Math.min(9, n % 2 === 0 ? n - 1 : n);
    const effectiveSgWindow = sgWindow % 2 === 0 ? sgWindow - 1 : sgWindow;
    let sgValues = kalmanValues.slice();
    if (n > 5 && effectiveSgWindow > 3) {
        try {
            const sgResult = savitzkyGolay(kalmanValues, 1, {
                windowSize: effectiveSgWindow,
                polynomial: 2,
                derivative: 0
            });
            const padSize = Math.floor(effectiveSgWindow / 2);
            if (sgResult && sgResult.length < n) {
                sgValues = [...kalmanValues.slice(0, padSize), ...sgResult, ...kalmanValues.slice(n - padSize)];
            } else {
                sgValues = sgResult;
            }
        } catch (err) {
            // Savgol hiba esetén Kalman kimenet marad
            sgValues = kalmanValues;
        }
    }

    // Sebesség és gyorsulás a kétszer szűrt adatból
    const speed = numpyGradient(sgValues, minutes);
    const accel = numpyGradient(speed, minutes);

    let timeGood = 0, timeWarn = 0, timeBad = 0;
    const chartData = new Array(n);

    for (let i = 0; i < n; i++) {
        const dt   = i === 0 ? 1 : Math.max(0.01, minutes[i] - minutes[i-1]);
        // y_smooth = Kalman kimenet (trendvonal a grafikonon)
        const sVal = kalmanValues[i];

        if      (sVal < 1000) timeGood += dt;
        else if (sVal < 1500) timeWarn += dt;
        else                  timeBad  += dt;

        chartData[i] = {
            x:        fastFormatTimestamp(dataArray[i].Ido),
            y_raw:    rawValues[i],      // nyers mérés
            y_smooth: +sVal.toFixed(1),  // Kalman szűrt trendvonal
            speed:    +(speed[i] || 0).toFixed(3),
            accel:    +(accel[i] || 0).toFixed(3)
        };
    }

    return {
        chartData,
        timeStats: [+timeGood.toFixed(1), +timeWarn.toFixed(1), +timeBad.toFixed(1)]
    };
}


// ── HENDERSON MOVING AVERAGE FILTER ──────────────────────────
// PDF riporthoz — az összes mérési pontot felhasználja
function hendersonWeights(m) {
    const n = Math.floor(m / 2);
    const out = new Array(m);
    let sum = 0;
    for (let i = -n; i <= n; i++) {
        const num = (n + 1) * (n + 1) - i * i;
        const den = (2 * n + 1) * (2 * n + 2) * (2 * n + 3);
        let w = (315 / (8 * den)) *
            (num * (3 * (n + 1) * (n + 1) - 11 * i * i - 16)) /
            ((n + 1) * (n + 1));
        if (isNaN(w)) w = 0;
        out[i + n] = Math.max(0, w);
        sum += out[i + n];
    }
    if (sum > 0) for (let i = 0; i < m; i++) out[i] /= sum;
    return out;
}

function hendersonFilter(values, m) {
    if (!m || m % 2 === 0) m = 13;
    const n = Math.floor(m / 2);
    const weights = hendersonWeights(m);
    const result = new Array(values.length);
    for (let i = 0; i < values.length; i++) {
        if (i < n || i >= values.length - n) {
            const lo = Math.max(0, i - n);
            const hi = Math.min(values.length - 1, i + n);
            let s = 0, c = 0;
            for (let j = lo; j <= hi; j++) { s += values[j]; c++; }
            result[i] = c > 0 ? s / c : values[i];
        } else {
            let s = 0;
            for (let j = 0; j < m; j++) s += weights[j] * values[i - n + j];
            result[i] = s;
        }
    }
    return result;
}

// ── TELJES NAPI ADAT — PDF RIPORTHOZ ─────────────────────────
async function getFullDayData(dateStr) {
    try {
        const isToday = dateStr === require('dayjs')().format('YYYY-MM-DD');
        let rows;
        if (isToday && dailyCache.length > 0) {
            rows = [...dailyCache];
        } else {
            const res = await pool.query(
                `SELECT timestamp as "Ido", co2_ppm as "CO2_ppm"
                 FROM sensor_data
                 WHERE timestamp >= $1 AND timestamp <= $2
                 ORDER BY timestamp ASC`,
                [dateStr + ' 00:00:00', dateStr + ' 23:59:59']
            );
            rows = res.rows;
        }
        if (!rows || !rows.length) return null;

        // Robusztus timestamp parse
        function parseTs(v) {
            if (v instanceof Date) return v.getTime();
            const s = String(v);
            if (/^\d{4}-\d{2}-\d{2}/.test(s)) return new Date(s.replace(' ', 'T')).getTime();
            return new Date(s).getTime();
        }

        const rawValues = rows.map(r => parseFloat(r.CO2_ppm));
        const validRaw  = rawValues.filter(v => !isNaN(v));
        if (!validRaw.length) return null;

        // Henderson szűrő az összes ponton
        let m = Math.min(23, rows.length);
        if (m % 2 === 0) m -= 1;
        const trend = m >= 3 ? hendersonFilter(rawValues, m) : rawValues.slice();

        // KPI az összes pontból
        let sum = 0, mn = validRaw[0], mx = validRaw[0];
        for (const v of validRaw) { sum += v; if (v < mn) mn = v; if (v > mx) mx = v; }

        // Időbeli + sebesség eloszlás
        let tGood = 0, tWarn = 0, tBad = 0;
        let speedBuckets = { calm:0, slow:0, medium:0, fast:0 };
        const startMs = parseTs(rows[0].Ido);
        for (let i = 1; i < rows.length; i++) {
            const dt = Math.max(0.01,
                (parseTs(rows[i].Ido) - parseTs(rows[i-1].Ido)) / 60000
            );
            const v = trend[i];
            if      (v < 1000) tGood += dt;
            else if (v < 1500) tWarn += dt;
            else               tBad  += dt;
            const spd = Math.abs(rawValues[i] - rawValues[i-1]) / dt;
            if      (spd < 5)  speedBuckets.calm   += dt;
            else if (spd < 20) speedBuckets.slow   += dt;
            else if (spd < 60) speedBuckets.medium += dt;
            else               speedBuckets.fast   += dt;
        }

        // Timestamp → "HH:MM" (kezeli Date objektumot és stringet egyaránt)
        function toHHMM(v) {
            if (v instanceof Date) {
                const h = String(v.getHours()).padStart(2, '0');
                const m = String(v.getMinutes()).padStart(2, '0');
                return h + ':' + m;
            }
            const s = String(v);
            const m = s.match(/[T ](\d{2}:\d{2})/);
            return m ? m[1] : s.substring(11, 16);
        }

        // Mini chart (max 300 pont a szerver-oldali SVG-hez)
        const step = Math.max(1, Math.ceil(rows.length / 300));
        const chartPoints = [];
        for (let i = 0; i < rows.length; i += step) {
            chartPoints.push({
                x: toHHMM(rows[i].Ido),
                y: rawValues[i],
                t: trend[i]
            });
        }
        if (chartPoints[chartPoints.length-1] !== rows[rows.length-1]) {
            const last = rows[rows.length-1];
            chartPoints.push({ x: toHHMM(last.Ido), y: rawValues[rawValues.length-1], t: trend[trend.length-1] });
        }

        return {
            rows, rawValues, trend,
            count: rows.length,
            kpi: {
                current: Math.round(validRaw[validRaw.length - 1]),
                avg:     Math.round(sum / validRaw.length),
                max:     Math.round(mx),
                min:     Math.round(mn)
            },
            timeStats:    [+tGood.toFixed(1), +tWarn.toFixed(1), +tBad.toFixed(1)],
            speedBuckets,
            chartPoints
        };
    } catch (err) {
        console.error('❌ getFullDayData hiba:', err.message);
        return null;
    }
}

module.exports = {
    calculateKpi, getStatus, getFullKpi,
    getLatestSensorData, getAvailableDates, getHistoryData,
    loadAndCleanData, processAdvancedData, saveSingleData,
    getFullDayData, hendersonFilter
};
