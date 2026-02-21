const socket = io();
let isLiveMode = true;

// Globális Chart.js beállítások
Chart.defaults.color = '#737373';
Chart.defaults.font.family = 'Inter';

// --- ÚJ JAVÍTÁS: A PIROS "ÉLŐ" PÖTTY ÉS FELIRAT PLUGINKÉNT ---
const liveIndicatorPlugin = { 
    id: 'liveIndicator', 
    afterDraw: (chart) => { 
        // Csak Élő módban, és csak a CO2 grafikonon rajzolunk
        if (!isLiveMode || chart.canvas.id !== 'co2Chart') return; 
        
        const meta = chart.getDatasetMeta(0); 
        if (!meta || !meta.data || meta.data.length === 0) return; 
        
        // Megkeressük az utolsó pont koordinátáit
        const pt = meta.data[meta.data.length - 1]; 
        if (!pt || isNaN(pt.x) || isNaN(pt.y)) return; 
        
        // Kivesszük a legfrissebb nyers (vagy simított) adatot
        const rawData = chart.data.datasets[1].data;
        const currentPpm = rawData[rawData.length - 1] || chart.data.datasets[0].data[chart.data.datasets[0].data.length - 1];
        
        if (currentPpm === undefined) return;

        const ctx = chart.ctx; 
        ctx.save(); 
        
        // Halvány piros "aura"
        ctx.beginPath(); 
        ctx.arc(pt.x, pt.y, 10, 0, 2 * Math.PI); 
        ctx.fillStyle = 'rgba(239, 68, 68, 0.4)'; 
        ctx.fill(); 
        
        // Belső, éles piros pötty fehér kerettel
        ctx.beginPath(); 
        ctx.arc(pt.x, pt.y, 5, 0, 2 * Math.PI); 
        ctx.fillStyle = '#ef4444'; 
        ctx.fill(); 
        ctx.lineWidth = 2; 
        ctx.strokeStyle = '#ffffff'; 
        ctx.stroke(); 
        
        // Szöveg elhelyezésének kiszámítása, hogy ne lógjon ki a képernyőről
        let textX = pt.x;
        let textY = pt.y - 15;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        
        if (pt.x > chart.width - 70) { ctx.textAlign = 'right'; textX = pt.x - 8; }
        if (pt.y < 35) { ctx.textBaseline = 'top'; textY = pt.y + 15; }

        // ÉLŐ felirat kirajzolása árnyékkal, hogy olvasható maradjon
        ctx.font = 'bold 12px Inter, sans-serif'; 
        ctx.fillStyle = '#ef4444'; 
        ctx.shadowColor = 'rgba(0,0,0,0.8)'; 
        ctx.shadowBlur = 4; 
        ctx.fillText(`🔴 ÉLŐ: ${Math.round(currentPpm)} ppm`, textX, textY); 
        ctx.restore(); 
    } 
};

// Regisztráljuk az "Élő pötty" bővítményt a Chart.js-ben
Chart.register(liveIndicatorPlugin);

const commonOpts = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    plugins: { legend: { display: false } },
    elements: { point: { radius: 0 } },
    scales: {
        x: { grid: { color: 'rgba(255,255,255,0.06)' }, ticks: { color: '#737373' } },
        y: { grid: { color: 'rgba(255,255,255,0.06)' }, ticks: { color: '#737373' } }
    },
    interaction: { mode: 'index', intersect: false }
};

// 1. CO2 Nyers és Simított
let co2Chart = new Chart(document.getElementById('co2Chart').getContext('2d'), {
    type: 'line',
    data: {
        labels: [],
        datasets: [
            { label: 'Trend (savgol)', data: [], borderColor: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.1)', borderWidth: 2, tension: 0.3, fill: true, order: 1 },
            { label: 'Nyers', data: [], borderColor: 'rgba(59, 130, 246, 0.3)', borderWidth: 1, tension: 0.3, fill: false, order: 2 }
        ]
    },
    options: { ...commonOpts, plugins: { legend: { display: true, position: 'top' } } }
});

// 2. Sebesség
let speedChart = new Chart(document.getElementById('speedChart').getContext('2d'), {
    type: 'line',
    data: { labels: [], datasets: [{ label: 'Sebesség', data: [], borderColor: '#8b5cf6', backgroundColor: 'rgba(139, 92, 246, 0.1)', borderWidth: 1.5, fill: true, tension: 0.3 }] },
    options: commonOpts
});

// 3. Gyorsulás
let accelChart = new Chart(document.getElementById('accelChart').getContext('2d'), {
    type: 'line',
    data: { labels: [], datasets: [{ label: 'Gyorsulás', data: [], borderColor: '#d946ef', backgroundColor: 'rgba(217, 70, 239, 0.1)', borderWidth: 1.5, fill: true, tension: 0.3 }] },
    options: commonOpts
});

// 4. Időbeli eloszlás
let timeBarChart = new Chart(document.getElementById('timeBarChart').getContext('2d'), {
    type: 'bar',
    data: {
        labels: ['JÓ (<1000)', 'FIGYELEM (<1500)', 'KRITIKUS (>1500)'],
        datasets: [{ data: [], backgroundColor: ['#10b981', '#f59e0b', '#ef4444'], borderWidth: 0, barThickness: 20 }]
    },
    options: {
        indexAxis: 'y',
        responsive: true, maintainAspectRatio: false, animation: false,
        plugins: { legend: { display: false } },
        scales: {
            x: { grid: { color: 'rgba(255,255,255,0.06)' }, ticks: { color: '#737373' } },
            y: { grid: { display: false }, ticks: { color: '#d4d4d4', font: { weight: 'bold' } } }
        }
    }
});

function updateUI(payload) {
    if (!payload) return;

    document.getElementById('kpi-current').innerText = payload.kpi.current;
    document.getElementById('kpi-avg').innerText = payload.kpi.avg;
    document.getElementById('kpi-max').innerText = payload.kpi.max;
    document.getElementById('kpi-min').innerText = payload.kpi.min;

    const sBadge = document.getElementById('sensor-badge');
    const sTxt = document.getElementById('sensor-status-text');
    if (sTxt && sBadge && payload.sensor_status) {
        sTxt.innerText = payload.sensor_status.text;
        sBadge.className = 'sensor-badge ' + payload.sensor_status.color_class;
    }

    const lBtn = document.getElementById('live-btn');
    const lTxt = document.getElementById('live-btn-text');
    if (lBtn && lTxt && isLiveMode && payload.sensor_status) {
        if (payload.sensor_status.is_active) {
            lBtn.className = 'live-btn active';
            lTxt.innerText = 'ONLINE';
        } else {
            lBtn.className = 'live-btn offline-mode';
            lTxt.innerText = 'OFFLINE';
        }
    }

    const sBox = document.getElementById('status-box');
    if(sBox) {
        sBox.innerHTML = `Állapot: <span>${payload.air_status_text}</span>`;
        sBox.className = 'status-box ' + payload.air_status_class;
    }

    document.getElementById('last-update').innerText = payload.last_update;

    if (payload.chartData) {
        // Időzóna konvertálás (+1/+2 óra) a grafikonon
        const newLabels = payload.chartData.map(d => {
            const dt = new Date(d.x.replace(' ', 'T') + 'Z');
            return isNaN(dt) ? d.x.substring(11, 16) : dt.toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' });
        });

        co2Chart.data.labels = newLabels;
        co2Chart.data.datasets[0].data = payload.chartData.map(d => d.y_smooth);
        co2Chart.data.datasets[1].data = payload.chartData.map(d => d.y_raw);
        co2Chart.update();

        speedChart.data.labels = newLabels;
        speedChart.data.datasets[0].data = payload.chartData.map(d => d.speed);
        speedChart.update();

        accelChart.data.labels = newLabels;
        accelChart.data.datasets[0].data = payload.chartData.map(d => d.accel);
        accelChart.update();
    }

    if (payload.timeStats) {
        timeBarChart.data.datasets[0].data = payload.timeStats;
        timeBarChart.update();
    }
}

socket.on('update_data', (payload) => {
    if (isLiveMode) updateUI(payload);
});

socket.on('status_message', (data) => {
    const sTxt = document.getElementById('sensor-status-text');
    if (isLiveMode && sTxt) {
        sTxt.innerText = data.msg;
    }
});

document.getElementById('btn-history')?.addEventListener('click', () => {
    const selectedDate = document.getElementById('date-selector').value;
    isLiveMode = false;
    
    fetch('/api/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: selectedDate })
    })
    .then(res => res.json())
    .then(data => {
        if (data.error) alert(data.error);
        else updateUI(data);
    })
    .catch(err => console.error("API Hiba:", err));
});

document.getElementById('btn-live')?.addEventListener('click', () => {
    isLiveMode = true;
    const sTxt = document.getElementById('sensor-status-text');
    if (sTxt) {
        sTxt.innerText = "Visszatérés élő módra...";
    }
});