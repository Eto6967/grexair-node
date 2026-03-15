/* GrexAir main.js — demo & upload pages */
'use strict';

if (typeof DEMO_PAYLOAD === 'undefined') { console.warn('No DEMO_PAYLOAD'); }
else {
    const NG = { display:false, drawBorder:false, drawOnChartArea:false, drawTicks:false, color:'transparent', lineWidth:0 };
    const NB = { display:false, width:0, color:'transparent' };
    const TK = { color:'rgba(255,255,255,0.35)', font:{ size:10 } };
    const base = {
        responsive:true, maintainAspectRatio:false, animation:false,
        plugins:{ legend:{ display:false } },
        elements:{ point:{ radius:0 }, line:{ tension:0.45, borderCapStyle:'round' } },
        scales:{ x:{ grid:NG, border:NB, ticks:{ ...TK, maxTicksLimit:8, maxRotation:0 } }, y:{ grid:NG, border:NB, ticks:TK } },
        interaction:{ mode:'index', intersect:false }
    };

    const p = DEMO_PAYLOAD;
    const labels = (p.chartData||[]).map(d => {
        const dt = new Date((d.x||'').replace(' ','T')+'Z');
        return isNaN(dt) ? (d.x||'').substring(11,16) : dt.toLocaleTimeString('hu-HU',{ hour:'2-digit', minute:'2-digit' });
    });

    window.co2Chart = new Chart(document.getElementById('co2Chart').getContext('2d'),{
        type:'line', data:{
            labels,
            datasets:[
                { label:'Trend',  data:(p.chartData||[]).map(d=>d.y_smooth), borderColor:'#0a84ff', backgroundColor:'rgba(10,132,255,0.07)', borderWidth:2.5, tension:0.45, fill:true, order:1 },
                { label:'Nyers',  data:(p.chartData||[]).map(d=>d.y_raw),    borderColor:'rgba(10,132,255,0.28)', borderWidth:1, tension:0.45, fill:false, order:2 }
            ]
        },
        options:{ ...base, plugins:{ ...base.plugins, legend:{ display:true, position:'top', labels:{ color:'rgba(255,255,255,0.55)', boxWidth:24, boxHeight:2, font:{ size:11 }, padding:16 } } } }
    });

    window.speedChart = new Chart(document.getElementById('speedChart').getContext('2d'),{
        type:'line', data:{ labels, datasets:[{ data:(p.chartData||[]).map(d=>d.speed), borderColor:'#bf5af2', backgroundColor:'rgba(191,90,242,0.07)', borderWidth:2, tension:0.45, fill:true }] }, options:base
    });

    window.accelChart = new Chart(document.getElementById('accelChart').getContext('2d'),{
        type:'line', data:{ labels, datasets:[{ data:(p.chartData||[]).map(d=>d.accel), borderColor:'#ff9f0a', backgroundColor:'rgba(255,159,10,0.07)', borderWidth:2, tension:0.45, fill:true }] }, options:base
    });

    window.timeBarChart = new Chart(document.getElementById('timeBarChart').getContext('2d'),{
        type:'bar', data:{
            labels:['Jó (<1000)','Figyelem (<1500)','Kritikus (>1500)'],
            datasets:[{ data:p.timeStats||[], backgroundColor:['rgba(48,209,88,0.75)','rgba(255,159,10,0.75)','rgba(255,69,58,0.75)'], borderColor:['#30d158','#ff9f0a','#ff453a'], borderWidth:1, borderRadius:4, barThickness:18 }]
        },
        options:{ indexAxis:'y', responsive:true, maintainAspectRatio:false, animation:false,
            plugins:{ legend:{ display:false } },
            scales:{ x:{ grid:NG, border:NB, ticks:{ ...TK, maxTicksLimit:5 } }, y:{ grid:NG, border:NB, ticks:{ color:'rgba(255,255,255,0.65)', font:{ size:11, weight:'600' } } } }
        }
    });

    setTimeout(function(){
        if(window.GX_CHARTS !== undefined) window.GX_CHARTS=[window.co2Chart,window.speedChart,window.accelChart,window.timeBarChart].filter(Boolean);
    }, 300);
}
