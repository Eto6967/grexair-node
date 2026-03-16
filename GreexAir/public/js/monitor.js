'use strict';
const socket = io();
let isLiveMode = true;
let _ot = null;

function setOnline(on) {
    var lb=document.getElementById('live-btn'),lt=document.getElementById('live-btn-text');
    var sb=document.getElementById('sensor-badge'),st=document.getElementById('sensor-status-text');
    if(lb&&lt){lb.className=on?'live-btn active':'live-btn offline-mode';lt.textContent=on?'ONLINE':'OFFLINE';}
    if(sb&&st){sb.className=on?'color-green':'color-red';st.textContent=on?'Arduino aktív':'Nincs adat (>3 p)';}
}
function resetOff(){if(_ot)clearTimeout(_ot);setOnline(true);_ot=setTimeout(()=>setOnline(false),180000);}
_ot=setTimeout(()=>setOnline(false),180000);

function co2Col(ppm){
    var n=parseInt(ppm);
    if(isNaN(n)||n<=0)return{hex:'#5ac8fa',bg:'rgba(10,132,255,0.12)',ring:'rgba(10,132,255,0.28)'};
    if(n<800) return{hex:'#30d158',bg:'rgba(48,209,88,0.13)',  ring:'rgba(48,209,88,0.25)'  };
    if(n<1000)return{hex:'#ffd60a',bg:'rgba(255,214,10,0.12)', ring:'rgba(255,214,10,0.28)' };
    if(n<1200)return{hex:'#ff9f0a',bg:'rgba(255,159,10,0.13)', ring:'rgba(255,159,10,0.28)' };
    if(n<1500)return{hex:'#ff6a00',bg:'rgba(255,106,0,0.13)',  ring:'rgba(255,106,0,0.28)'  };
    return           {hex:'#ff453a',bg:'rgba(255,69,58,0.14)', ring:'rgba(255,69,58,0.25)'  };
}

function colorCard(cardId, valId, ppm) {
    var card=document.getElementById(cardId), valDiv=document.getElementById(valId);
    if(!card||!valDiv) return;
    var c=co2Col(ppm), n=parseInt(ppm), txt=(isNaN(n)||n<=0)?'&mdash;':n;
    valDiv.innerHTML='<b style="color:'+c.hex+';font-weight:600;font-family:\'JetBrains Mono\',monospace;font-size:clamp(1.7rem,3.5vw,2.1rem);letter-spacing:-1.5px;line-height:1">'+txt+'</b>'
        +'<span style="color:rgba(255,255,255,0.28);font-size:11px;font-weight:300;font-family:Geist,sans-serif"> ppm</span>';
    card.style.borderTop='2px solid '+c.hex;
    card.style.background='linear-gradient(180deg,'+c.bg+' 0%,rgba(255,255,255,0.02) 60%)';
    card.style.boxShadow='0 0 0 1px '+c.ring+',0 16px 48px rgba(0,0,0,0.55),inset 0 1px 0 rgba(255,255,255,0.07)';
}

/* ── Chart.js defaults ── */
Chart.defaults.color = 'rgba(255,255,255,0.35)';
Chart.defaults.font.family = "'Geist','Inter',-apple-system,sans-serif";
Chart.defaults.font.size = 11;

/* Grid: halvany vizszintes vonalak */
var GRID = { display:true, drawBorder:false, drawTicks:false, color:'rgba(255,255,255,0.15)', lineWidth:1 };
var NOGRID = { display:false };
var NB = { display:false };
var TK = { color:'rgba(255,255,255,0.35)', font:{ size:10 } };

var base = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    // --- ÚJDONSÁG: Jobb oldali térköz (padding), hogy kiférjen a piros pötty ---
    layout: {
        padding: {
            right: 10 
        }
    },
    // --------------------------------------------------------------------------
    plugins: { legend: { display:false } },
    elements: { point:{ radius:0, hitRadius:8 }, line:{ tension:0.45, borderCapStyle:'round' } },
    scales: {
        x: { grid: NOGRID, border: NB, ticks: { ...TK, maxTicksLimit:8, maxRotation:0 } },
        y: { grid: GRID,   border: NB, ticks: TK }
    },
    interaction: { mode:'index', intersect:false }
};

/* ── Live dot plugin ── */
var livePlugin = {
    id: 'liveIndicator',
    afterDraw: function(chart) {
        if(!isLiveMode || chart.canvas.id !== 'co2Chart') return;
        var meta = chart.getDatasetMeta(0);
        if(!meta || !meta.data || !meta.data.length) return;
        var pt = meta.data[meta.data.length-1];
        if(!pt || isNaN(pt.x) || isNaN(pt.y)) return;
        var raw = chart.data.datasets[1] ? chart.data.datasets[1].data : [];
        var ppm = raw[raw.length-1];
        if(ppm === undefined) ppm = chart.data.datasets[0].data[chart.data.datasets[0].data.length-1];
        if(ppm === undefined) return;
        var ctx = chart.ctx;
        ctx.save();
        ctx.beginPath(); ctx.arc(pt.x,pt.y,10,0,2*Math.PI); ctx.fillStyle='rgba(255,69,58,0.35)'; ctx.fill();
        ctx.beginPath(); ctx.arc(pt.x,pt.y,5,0,2*Math.PI);  ctx.fillStyle='#ff453a'; ctx.fill();
        ctx.lineWidth=2; ctx.strokeStyle='#fff'; ctx.stroke();
        var tx=pt.x, ty=pt.y-15;
        ctx.textAlign    = pt.x > chart.width-80 ? 'right' : 'center';
        ctx.textBaseline = pt.y < 35 ? 'top' : 'bottom';
        if(pt.x > chart.width-80) tx = pt.x-8;
        if(pt.y < 35) ty = pt.y+15;
        ctx.font = "bold 12px 'JetBrains Mono',monospace";
        ctx.fillStyle = '#ff453a'; ctx.shadowColor='rgba(0,0,0,0.85)'; ctx.shadowBlur=4;
        ctx.fillText('ELO: '+Math.round(ppm)+' ppm', tx, ty);
        ctx.restore();
    }
};

/* ── Min/Max dashed line plugin ── */
var minMaxPlugin = {
    id: 'minMaxLines',
    afterDatasetsDraw: function(chart) {
        if(chart.config.type !== 'line') return;
        var vals = [];
        (chart.data.datasets || []).forEach(function(ds) {
            var n = (ds.data || []).filter(function(v){ return v!=null && !isNaN(+v); }).map(Number);
            if(n.length > vals.length) vals = n;
        });
        if(vals.length < 2) return;
        var maxV = Math.max.apply(null, vals);
        var minV = Math.min.apply(null, vals);
        if(maxV === minV) return;
        var ctx = chart.ctx, yS = chart.scales.y, xS = chart.scales.x;
        if(!yS || !xS) return;
        var top = yS.top, bot = yS.bottom;
        var yMax = Math.max(top+2, Math.min(bot-2, yS.getPixelForValue(maxV)));
        var yMin = Math.max(top+2, Math.min(bot-2, yS.getPixelForValue(minV)));
        var x0 = xS.left, x1 = xS.right;
        ctx.save();
        ctx.setLineDash([6,4]); ctx.lineWidth=1.5;
        ctx.strokeStyle='rgba(255,69,58,0.75)';
        ctx.beginPath(); ctx.moveTo(x0,yMax); ctx.lineTo(x1,yMax); ctx.stroke();
        ctx.strokeStyle='rgba(48,209,88,0.75)';
        ctx.beginPath(); ctx.moveTo(x0,yMin); ctx.lineTo(x1,yMin); ctx.stroke();
        ctx.setLineDash([]);
        ctx.font = "bold 10px 'JetBrains Mono',monospace";
        ctx.shadowColor='rgba(0,0,0,0.9)'; ctx.shadowBlur=4; ctx.textAlign='left';
        ctx.fillStyle='rgba(255,69,58,0.95)'; ctx.textBaseline='bottom';
        ctx.fillText('MAX '+Math.round(maxV), x0+4, yMax-2);
        ctx.fillStyle='rgba(48,209,88,0.95)'; ctx.textBaseline='top';
        ctx.fillText('MIN '+Math.round(minV), x0+4, yMin+2);
        ctx.restore();
    }
};

Chart.register(livePlugin, minMaxPlugin);

/* ── Időalapú zoom függvény ── */
window._fullChartArrays = null;
window._fullTimestamps = [];

function applyZoom(zoom) {
    var f = window._fullChartArrays;
    if (!f) return;
    var labels = f.labels, smooth = f.smooth, raw = f.raw, speeds = f.speeds, accels = f.accels;

    if (zoom !== 'all' && window._fullTimestamps.length) {
        var mins = parseInt(zoom);
        var lastTs = window._fullTimestamps[window._fullTimestamps.length - 1];
        var refTime = new Date(lastTs.replace(' ', 'T') + 'Z').getTime();
        var cutoff = refTime - mins * 60000;
        var startIdx = 0;
        for (var i = window._fullTimestamps.length - 1; i >= 0; i--) {
            var t = new Date(window._fullTimestamps[i].replace(' ', 'T') + 'Z').getTime();
            if (t <= cutoff) { startIdx = i + 1; break; }
        }
        labels  = labels.slice(startIdx);
        smooth  = smooth.slice(startIdx);
        raw     = raw.slice(startIdx);
        speeds  = speeds.slice(startIdx);
        accels  = accels.slice(startIdx);
    }

    var minCo2 = Math.min.apply(null, smooth.concat(raw).filter(function(v){ return !isNaN(v); }));
    if (window.co2Chart && window.co2Chart.options.scales && window.co2Chart.options.scales.y)
        window.co2Chart.options.scales.y.min = Math.max(-10, Math.floor(minCo2) - 20);

    if (window.speedChart && speeds.length) {
        var minSpd = Math.min.apply(null, speeds.filter(function(v){ return !isNaN(v); }));
        var maxSpd = Math.max.apply(null, speeds.filter(function(v){ return !isNaN(v); }));
        window.speedChart.options.scales.y.min = minSpd - 0.5;
        window.speedChart.options.scales.y.max = maxSpd + 0.5;
    }
    if (window.accelChart && accels.length) {
        var minAcc = Math.min.apply(null, accels.filter(function(v){ return !isNaN(v); }));
        var maxAcc = Math.max.apply(null, accels.filter(function(v){ return !isNaN(v); }));
        window.accelChart.options.scales.y.min = minAcc - 0.2;
        window.accelChart.options.scales.y.max = maxAcc + 0.2;
    }

    window.co2Chart.data.labels = labels;
    window.co2Chart.data.datasets[0].data = smooth;
    window.co2Chart.data.datasets[1].data = raw;
    window.co2Chart.update('none');
    window.speedChart.data.labels = labels;
    window.speedChart.data.datasets[0].data = speeds;
    window.speedChart.update('none');
    window.accelChart.data.labels = labels;
    window.accelChart.data.datasets[0].data = accels;
    window.accelChart.update('none');
}

/* ── Charts ── */
window.co2Chart = new Chart(document.getElementById('co2Chart').getContext('2d'), {
    type: 'line',
    data: { labels:[], datasets:[
        { label:'Trend (SavGol)', data:[], borderColor:'#0a84ff', backgroundColor:'rgba(10,132,255,0.07)', borderWidth:2.5, tension:0.45, fill:true,  order:1 },
        { label:'Nyers',          data:[], borderColor:'rgba(10,132,255,0.28)', backgroundColor:'transparent', borderWidth:1, tension:0.45, fill:false, order:2 }
    ]},
    options: { ...base, plugins:{
        legend:{ display:true, position:'top', labels:{ color:'rgba(255,255,255,0.55)', boxWidth:24, boxHeight:2, usePointStyle:false, font:{size:11}, padding:16 } },
        minMaxLines:{}, liveIndicator:{}
    }}
});

window.speedChart = new Chart(document.getElementById('speedChart').getContext('2d'), {
    type: 'line',
    data: { labels:[], datasets:[{ label:'Sebesseg', data:[], borderColor:'#bf5af2', backgroundColor:'rgba(191,90,242,0.07)', borderWidth:2, tension:0.45, fill:true }] },
    options: { ...base, plugins:{ legend:{display:false}, minMaxLines:{} },
        scales:{ x:{ grid:NOGRID, border:NB, ticks:{...TK,maxTicksLimit:8,maxRotation:0} },
                 y:{ grid:GRID, border:NB, ticks:TK, afterDataLimits:function(a){ if(a.max!=null)a.max+=20; if(a.min!=null)a.min-=20; } } } }
});

window.accelChart = new Chart(document.getElementById('accelChart').getContext('2d'), {
    type: 'line',
    data: { labels:[], datasets:[{ label:'Gyorsulas', data:[], borderColor:'#ff9f0a', backgroundColor:'rgba(255,159,10,0.07)', borderWidth:2, tension:0.45, fill:true }] },
    options: { ...base, plugins:{ legend:{display:false}, minMaxLines:{} },
        scales:{ x:{ grid:NOGRID, border:NB, ticks:{...TK,maxTicksLimit:8,maxRotation:0} },
                 y:{ grid:GRID, border:NB, ticks:TK, afterDataLimits:function(a){ if(a.max!=null)a.max+=30; if(a.min!=null)a.min-=30; } } } }
});

window.timeBarChart = new Chart(document.getElementById('timeBarChart').getContext('2d'), {
    type: 'bar',
    data: { labels:['Jo (<1000)','Figyelem (<1500)','Kritikus (>1500)'],
        datasets:[{ data:[], backgroundColor:['rgba(48,209,88,0.75)','rgba(255,159,10,0.75)','rgba(255,69,58,0.75)'], borderColor:['#30d158','#ff9f0a','#ff453a'], borderWidth:1, borderRadius:4, barThickness:18 }] },
    options:{ indexAxis:'y', responsive:true, maintainAspectRatio:false, animation:false,
        plugins:{ legend:{display:false} },
        scales:{ x:{ grid:NOGRID, border:NB, ticks:{...TK,maxTicksLimit:5} }, y:{ grid:{display:false}, border:NB, ticks:{ color:'rgba(255,255,255,0.65)', font:{size:11,weight:'600'} } } } }
});

/* ── Gauge ── */
function updateGauge(ppm) {
    var f=document.getElementById('gauge-fill'), v=document.getElementById('gauge-val');
    if(!f||!v) return;
    var n=parseInt(ppm);
    if(isNaN(n)||n<=0){ v.textContent='—'; v.style.color='#5ac8fa'; return; }
    f.style.strokeDashoffset = (173 - 173*Math.min(Math.max((n-400)/1600,0),1)).toFixed(2);
    var c=co2Col(n);
    f.style.stroke=c.hex; f.style.filter='drop-shadow(0 0 8px '+c.hex+'aa)';
    v.textContent=n; v.style.color=c.hex;
}

/* ── applyZoom ── */
window.applyZoom = function(z){
    var src = window._fullChartArrays;
    var ts  = window._fullTimestamps;
    if(!src || !src.labels || !src.labels.length) return;
    var labels,smooth,raw,speeds,accels;
    if(z==='all'){
        labels=src.labels.slice();smooth=src.smooth.slice();raw=src.raw.slice();speeds=src.speeds.slice();accels=src.accels.slice();
    } else {
        var mins=parseInt(z);
        var cutoffMs=null;
        if(ts && ts.length){
            var lastTs=new Date(ts[ts.length-1].replace(' ','T')+'Z');
            if(!isNaN(lastTs)) cutoffMs=lastTs.getTime()-mins*60000;
        }
        var startIdx=0;
        if(cutoffMs!==null && ts){
            for(var i=0;i<ts.length;i++){
                var t=new Date(ts[i].replace(' ','T')+'Z');
                if(!isNaN(t)&&t.getTime()>=cutoffMs){startIdx=i;break;}
            }
        }
        labels=src.labels.slice(startIdx);smooth=src.smooth.slice(startIdx);raw=src.raw.slice(startIdx);speeds=src.speeds.slice(startIdx);accels=src.accels.slice(startIdx);
    }
    if(window.co2Chart){window.co2Chart.data.labels=labels;window.co2Chart.data.datasets[0].data=smooth;window.co2Chart.data.datasets[1].data=raw;window.co2Chart.update('none');}
    if(window.speedChart){window.speedChart.data.labels=labels;window.speedChart.data.datasets[0].data=speeds;window.speedChart.update('none');}
    if(window.accelChart){window.accelChart.data.labels=labels;window.accelChart.data.datasets[0].data=accels;window.accelChart.update('none');}
};


function updateUI(payload) {
    if(!payload) return;
    var cur=parseInt(payload.kpi.current), avg=parseInt(payload.kpi.avg);
    var max=parseInt(payload.kpi.max),     min=parseInt(payload.kpi.min);

    colorCard('card-current','kpi-current',cur);
    colorCard('card-avg',    'kpi-avg',    900);
	colorCard('card-max',    'kpi-max',    1600);
    colorCard('card-min',    'kpi-min',    400);
	
	// 1. JELENLEGI
    colorCard('card-current', 'kpi-current', cur);
    var curCard = document.getElementById('card-current');
    if(curCard) {
        curCard.style.background = ''; // Üres string visszaadja az alap szürke CSS hátteret!
        curCard.style.boxShadow = '';
    }
	
	// 2. ÁTLAG - Lila (Purple)
    colorCard('card-avg', 'kpi-avg', 1600); 
    var avgDiv = document.getElementById('kpi-avg');
    var avgCard = document.getElementById('card-avg');
    if(avgDiv && avgCard) {
        avgCard.style.borderTop = '2px solid #bf5af2';
        avgCard.style.background = ''; // Alap szürke háttér
        avgCard.style.boxShadow = '';
        avgDiv.innerHTML = '<b style="color:#bf5af2;font-weight:600;font-family:\'JetBrains Mono\',monospace;font-size:clamp(1.7rem,3.5vw,2.1rem);letter-spacing:-1.5px;line-height:1">' + (isNaN(avg) ? '—' : avg) + '</b>'
            + '<span style="color:rgba(255,255,255,0.28);font-size:11px;font-weight:300;font-family:Geist,sans-serif"> ppm</span>';
    }

    // 3. MAXIMUM - Piros
    colorCard('card-max', 'kpi-max', 1600);
    var maxDiv = document.getElementById('kpi-max');
    var maxCard = document.getElementById('card-max');
    if(maxDiv && maxCard) {
        maxCard.style.borderTop = '2px solid #ff453a';
        maxCard.style.background = ''; // Alap szürke háttér
        maxCard.style.boxShadow = '';
        maxDiv.innerHTML = '<b style="color:#ff453a;font-weight:600;font-family:\'JetBrains Mono\',monospace;font-size:clamp(1.7rem,3.5vw,2.1rem);letter-spacing:-1.5px;line-height:1">' + (isNaN(max) ? '—' : max) + '</b>'
            + '<span style="color:rgba(255,255,255,0.28);font-size:11px;font-weight:300;font-family:Geist,sans-serif"> ppm</span>';
    }
    
    // 4. MINIMUM - Zöld
    colorCard('card-min', 'kpi-min', 400);
    var minDiv = document.getElementById('kpi-min');
    var minCard = document.getElementById('card-min');
    if(minDiv && minCard) {
        minCard.style.borderTop = '2px solid #30d158';
        minCard.style.background = ''; // Alap szürke háttér
        minCard.style.boxShadow = '';
        minDiv.innerHTML = '<b style="color:#30d158;font-weight:600;font-family:\'JetBrains Mono\',monospace;font-size:clamp(1.7rem,3.5vw,2.1rem);letter-spacing:-1.5px;line-height:1">' + (isNaN(min) ? '—' : min) + '</b>'
            + '<span style="color:rgba(255,255,255,0.28);font-size:11px;font-weight:300;font-family:Geist,sans-serif"> ppm</span>';
    }
	
var rDiv=document.getElementById('kpi-range');
    if(rDiv&&!isNaN(max)&&!isNaN(min)){
        var v=max-min;
        rDiv.innerHTML='<b style="color:#5ac8fa;font-weight:600;font-family:\'JetBrains Mono\',monospace;font-size:clamp(1.7rem,3.5vw,2.1rem);letter-spacing:-1.5px;line-height:1">'+v+'</b>'
            +'<span style="color:rgba(255,255,255,0.28);font-size:11px;font-weight:300;font-family:Geist,sans-serif"> ppm</span>';
    }

    

    updateGauge(cur);

    var sBox=document.getElementById('air-status-box');
    if(sBox){ sBox.textContent=payload.air_status_text||'—'; sBox.className='air-status-box '+(payload.air_status_class||'status-neutral'); }
   var lu = document.getElementById('last-update');
    if (lu) {
        if (payload.timestamp) {
            // Ugyanaz a trükk, mint a grafikonoknál: 'Z' hozzáadása az időzóna miatt
            var dt = new Date(payload.timestamp.replace(' ', 'T') + 'Z');
            lu.textContent = isNaN(dt) ? (payload.last_update || '—') : dt.toLocaleTimeString('hu-HU', {hour: '2-digit', minute: '2-digit', second: '2-digit'});
        } else {
            lu.textContent = payload.last_update || '—';
        }
    }

    if(payload.chartData && payload.chartData.length) {
        var labels = payload.chartData.map(function(d){
            var dt=new Date((d.x||'').replace(' ','T')+'Z');
            return isNaN(dt) ? (d.x||'').substring(11,16) : dt.toLocaleTimeString('hu-HU',{hour:'2-digit',minute:'2-digit'});
        });
        
        var smooth = payload.chartData.map(function(d){ return d.y_smooth; });
        var raw = payload.chartData.map(function(d){ return d.y_raw; });
        var speeds = payload.chartData.map(function(d){ return d.speed; });
        var accels = payload.chartData.map(function(d){ return d.accel; });

        // --- TELJES ADAT MENTESE + ZOOM ---
        window._fullChartArrays = { labels: labels, smooth: smooth, raw: raw, speeds: speeds, accels: accels };
        window._fullTimestamps = payload.chartData.map(function(d){ return d.x || ''; });
        var activeBtn = document.querySelector('.ch-opt.active');
        var zoom = activeBtn ? activeBtn.dataset.zoom : 'all';
        applyZoom(zoom);
    }
    if(payload.timeStats){ window.timeBarChart.data.datasets[0].data=payload.timeStats; window.timeBarChart.update('none'); }
    
// --- ONLINE/OFFLINE: utolso meres idobelyege vs mostani ido (local time, Z nelkul) ---
    if (isLiveMode && payload.chartData && payload.chartData.length > 0) {
        var lastPointTime = payload.chartData[payload.chartData.length - 1].x;
        if (lastPointTime) {
            var lastDt = new Date(lastPointTime.replace(' ', 'T') + 'Z');
            var diffMs = Date.now() - lastDt.getTime();
            if (!isNaN(diffMs) && diffMs < 180000) {
                if (_ot) clearTimeout(_ot);
                setOnline(true);
                _ot = setTimeout(function(){ setOnline(false); }, 180000 - diffMs);
            } else {
                if (_ot) clearTimeout(_ot);
                setOnline(false);
            }
        }
    }
}

socket.on('update_data', function(p){ if(isLiveMode){ resetOff(); updateUI(p); } });
socket.on('status_message', function(d){ var el=document.getElementById('sensor-status-text'); if(isLiveMode&&el) el.textContent=d.msg; });

document.getElementById('btn-history') && document.getElementById('btn-history').addEventListener('click', function(){
    var date = document.getElementById('date-selector') && document.getElementById('date-selector').value;
    if(!date) return;
    
    // 1. Kiszámoljuk a pontos mai dátumot helyi idő szerint
    var offset = (new Date()).getTimezoneOffset() * 60000;
    var localToday = (new Date(Date.now() - offset)).toISOString().split('T')[0];
    
    // 2. Ellenőrizzük, hogy a választott dátum ma van-e
    isLiveMode = (date === localToday); 
    
    // 3. Ha a mai napot választottad, visszakapcsolja az ÉLŐ módot, amúgy OFFLINE-ba teszi
    if (isLiveMode) {
        setOnline(true);
        resetOff();
        var el = document.getElementById('sensor-status-text'); 
        if(el) el.textContent = 'Arduino aktív';
    } else {
        if(_ot) clearTimeout(_ot);
        setOnline(false); // Ez szürkíti ki és írja ki, hogy OFFLINE
    }
    
    // 4. Adatok lekérése a szervertől
    fetch('/api/history',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({date:date})})
    .then(function(r){return r.json();}).then(function(d){
        if(d.error) alert(d.error);
        else {
            updateUI(d);
            // Ha visszaváltunk a mai napra, frissítsük be a CO2 grafikont is!
            if (isLiveMode && window.co2Chart) window.co2Chart.update('none');
        }
    }).catch(function(e){console.error(e);});
});

document.getElementById('btn-live') && document.getElementById('btn-live').addEventListener('click', function(){
    isLiveMode=true; setOnline(true); resetOff();
    var el=document.getElementById('sensor-status-text'); if(el) el.textContent='Visszatérés élő módra...';
});