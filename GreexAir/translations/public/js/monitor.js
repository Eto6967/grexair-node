'use strict';
const socket = io();
let isLiveMode = true;
let _ot = null;

function setOnline(on) {
    var lb=document.getElementById('live-btn'),lt=document.getElementById('live-btn-text');
    var sb=document.getElementById('sensor-badge'),st=document.getElementById('sensor-status-text');
    if(lb&&lt){lb.className=on?'live-btn active':'live-btn offline-mode';lt.textContent=on?'ONLINE':'OFFLINE';}
    if(sb&&st){sb.className=on?'color-green':'color-red';st.textContent=on?(window.GX_TR&&window.GX_TR.sensor_active?window.GX_TR.sensor_active:'Arduino aktív'):(window.GX_TR&&window.GX_TR.sensor_nodata_long?window.GX_TR.sensor_nodata_long:'Nincs adat (>3 p)');}
}
function resetOff(){if(_ot)clearTimeout(_ot);setOnline(true);_ot=setTimeout(()=>setOnline(false),180000);}
_ot=setTimeout(()=>setOnline(false),180000);

function co2Col(ppm){
    var n=parseInt(ppm);
    if(isNaN(n)||n<=0)return{hex:'#5ac8fa',bg:'rgba(10,132,255,0.12)',ring:'rgba(10,132,255,0.28)'};
    if(n<800) return{hex:'#30d158',bg:'rgba(48,209,88,0.13)',  ring:'rgba(48,209,88,0.25)' };
    if(n<1000)return{hex:'#ffd60a',bg:'rgba(255,214,10,0.12)', ring:'rgba(255,214,10,0.28)'};
    if(n<1200)return{hex:'#ff9f0a',bg:'rgba(255,159,10,0.13)', ring:'rgba(255,159,10,0.28)'};
    if(n<1500)return{hex:'#ff6a00',bg:'rgba(255,106,0,0.13)',  ring:'rgba(255,106,0,0.28)' };
    return    {hex:'#ff453a',bg:'rgba(255,69,58,0.14)',ring:'rgba(255,69,58,0.25)'};
}
function colorCard(cardId,valId,ppm){
    var card=document.getElementById(cardId),valDiv=document.getElementById(valId);
    if(!card||!valDiv)return;
    var c=co2Col(ppm),n=parseInt(ppm),txt=(isNaN(n)||n<=0)?'&mdash;':n;
    valDiv.innerHTML='<b style="color:'+c.hex+';font-weight:600;font-family:\'JetBrains Mono\',monospace;font-size:clamp(1.7rem,3.5vw,2.1rem);letter-spacing:-1.5px;line-height:1">'+txt+'</b><span style="color:rgba(255,255,255,0.28);font-size:11px;font-weight:300;font-family:Geist,sans-serif"> ppm</span>';
    card.style.borderTop='2px solid '+c.hex;
    card.style.background='linear-gradient(180deg,'+c.bg+' 0%,rgba(255,255,255,0.02) 60%)';
    card.style.boxShadow='0 0 0 1px '+c.ring+',0 16px 48px rgba(0,0,0,0.55),inset 0 1px 0 rgba(255,255,255,0.07)';
}

function isoToUnix(s){
    if(!s)return null;
    var d=new Date(s.replace(' ','T')+'Z');
    return isNaN(d)?null:d.getTime()/1000;
}
function fmtTime(unix){
    return new Date(unix*1000).toLocaleTimeString('hu-HU',{hour:'2-digit',minute:'2-digit'});
}

function measureW(id,fallback){
    var vw=window.innerWidth;
    if(vw<=640){
        // CO2 chart: fix 750px, a CSS overflow:auto miatt görgethetővé válik
        if(id==='co2ChartWrap') return 750;
        // speed/accel: teljes képernyőszélesség
        return Math.max(vw-20,100);
    }
    if(vw<=1200 && (id==='speedChartWrap'||id==='accelChartWrap')) return Math.max(Math.floor(vw/2)-30,100);
    var el=document.getElementById(id);
    if(!el)return fallback||800;
    var parent=el.parentElement;
    while(parent){
        var r=parent.getBoundingClientRect();
        if(r.width>50)return Math.max(Math.floor(r.width)-8,100);
        parent=parent.parentElement;
    }
    return fallback||800;
}

var uXAxis={
    stroke:'rgba(255,255,255,0.35)',
    ticks:{stroke:'rgba(255,255,255,0.08)',width:1,size:4},
    grid:{show:false},
    font:"10px 'Geist',-apple-system,sans-serif",
    values:function(u,vals){return vals.map(function(v){return v!=null?fmtTime(v):'';});},
    space:55
};
var uYAxis={
    stroke:'rgba(255,255,255,0.35)',
    ticks:{stroke:'rgba(255,255,255,0.08)',width:1,size:4},
    grid:{stroke:'rgba(255,255,255,0.06)',width:1},
    font:"10px 'Geist',-apple-system,sans-serif"
};

function makeTooltipPlugin(seriesInfo){
    var tt=document.createElement('div');
    tt.style.cssText='position:absolute;display:none;pointer-events:none;background:rgba(13,17,25,0.96);border:1px solid rgba(255,255,255,0.12);border-radius:8px;padding:8px 12px;z-index:100;font-family:Geist,-apple-system,sans-serif;font-size:11px;color:rgba(255,255,255,0.85);box-shadow:0 8px 24px rgba(0,0,0,0.5);white-space:nowrap;min-width:120px';
    return{hooks:{
        init:function(u){u.over.appendChild(tt);},
        setCursor:function(u){
            var idx=u.cursor.idx;
            if(idx==null){tt.style.display='none';return;}
            var ts=u.data[0][idx];
            if(ts==null){tt.style.display='none';return;}
            var html='<div style="color:rgba(255,255,255,0.45);margin-bottom:5px;font-size:10px">'+fmtTime(ts)+'</div>';
            for(var s=0;s<seriesInfo.length;s++){
                var val=u.data[s+1]?u.data[s+1][idx]:null;
                if(val==null||isNaN(val))continue;
                var si=seriesInfo[s];
                html+='<div style="display:flex;align-items:center;gap:6px;margin-top:3px"><span style="width:8px;height:8px;border-radius:50%;background:'+si.color+';flex-shrink:0;display:inline-block"></span><span style="color:rgba(255,255,255,0.55);font-size:10px">'+si.label+'</span><span style="color:'+si.color+';font-weight:700;font-family:JetBrains Mono,monospace;margin-left:auto;padding-left:10px">'+(Number.isInteger(val)?val:val.toFixed(2))+' '+si.unit+'</span></div>';
            }
            tt.innerHTML=html;tt.style.display='block';
            var ow=u.over.offsetWidth,oh=u.over.offsetHeight,cx=u.cursor.left,cy=u.cursor.top;
            var tw=tt.offsetWidth+16,th=tt.offsetHeight+16,tx=cx+12,ty=cy-th/2;
            if(tx+tw>ow)tx=cx-tw;if(ty<0)ty=4;if(ty+th>oh)ty=oh-th-4;
            tt.style.left=Math.round(tx)+'px';tt.style.top=Math.round(ty)+'px';
        },
        setData:function(){tt.style.display='none';}
    }};
}

function makeCo2Plugin(){
    return{hooks:{draw:[function(u){
        var ctx=u.ctx,bbox=u.bbox;
        var smooth=u.data[1]||[],raw=u.data[2]||[],all=[];
        for(var i=0;i<smooth.length;i++)if(smooth[i]!=null&&!isNaN(smooth[i]))all.push(smooth[i]);
        for(var i=0;i<raw.length;i++)if(raw[i]!=null&&!isNaN(raw[i]))all.push(raw[i]);
        if(all.length<2)return;
        var maxV=Math.max.apply(null,all),minV=Math.min.apply(null,all);
        if(maxV===minV)return;
        var yMax=Math.round(u.valToPos(maxV,'y',true)),yMin=Math.round(u.valToPos(minV,'y',true));
        var x0=bbox.left,x1=bbox.left+bbox.width;
        ctx.save();
        ctx.setLineDash([6,4]);ctx.lineWidth=1.5;
        ctx.strokeStyle='rgba(255,69,58,0.75)';
        ctx.beginPath();ctx.moveTo(x0,yMax);ctx.lineTo(x1,yMax);ctx.stroke();
        ctx.strokeStyle='rgba(48,209,88,0.75)';
        ctx.beginPath();ctx.moveTo(x0,yMin);ctx.lineTo(x1,yMin);ctx.stroke();
        ctx.setLineDash([]);
        ctx.font="bold 13px 'JetBrains Mono',monospace";
        ctx.shadowColor='rgba(0,0,0,0.95)';ctx.shadowBlur=6;ctx.textAlign='left';
        ctx.fillStyle='rgba(255,69,58,0.95)';ctx.textBaseline='bottom';
        ctx.fillText('MAX '+Math.round(maxV),x0+6,Math.max(yMax-3, 14));
        ctx.fillStyle='rgba(48,209,88,0.95)';ctx.textBaseline='top';
        ctx.fillText('MIN '+Math.round(minV),x0+6,yMin+3);

        /* ── ANOMÁLIA DETEKTÁLÁS — vonal átszínezés ──
           Ha 5 percen belül > 150 ppm ugrás: piros (emelkedés) / sárga (csökkenés) vonal */
        var ts=u.data[0]||[];
        var WINDOW_SEC=180;
        var THRESHOLD=200;
        ctx.shadowBlur=0;

        // 1. lépés: megjelöljük melyik indexek anomálisak és milyen irányban
        var anomalyColor=new Array(smooth.length).fill(null);
        for(var i=1;i<smooth.length;i++){
            if(smooth[i]==null||isNaN(smooth[i]))continue;
            var refIdx=0;
            for(var j=i-1;j>=0;j--){
                if(ts[i]-ts[j]>=WINDOW_SEC){refIdx=j;break;}
            }
            if(smooth[refIdx]==null||isNaN(smooth[refIdx]))continue;
            var delta=smooth[i]-smooth[refIdx];
            if(Math.abs(delta)<THRESHOLD)continue;
            // Jelöljük meg az érintett szakaszt (refIdx-től i-ig)
            for(var k=refIdx;k<=i;k++){
                anomalyColor[k]=delta>0?'rise':'fall';
            }
        }

        // 2. lépés: megrajzoljuk a színes vonalat az anomália szakaszokon
        ctx.save();
        ctx.lineWidth=3;
        ctx.lineJoin='round';
        ctx.lineCap='round';

        var k=0;
        while(k<smooth.length){
            if(!anomalyColor[k]||smooth[k]==null||isNaN(smooth[k])){k++;continue;}
            var color=anomalyColor[k]==='rise'?'rgba(255,69,58,0.9)':'rgba(255,214,10,0.9)';
            ctx.strokeStyle=color;
            ctx.beginPath();
            var started=false;
            var segStart=k;
            // Rajzoljuk a folytonos anomália szakaszt
            while(k<smooth.length&&anomalyColor[k]===anomalyColor[segStart]&&smooth[k]!=null&&!isNaN(smooth[k])){
                var px2=Math.round(u.valToPos(ts[k],'x',true));
                var py2=Math.round(u.valToPos(smooth[k],'y',true));
                if(px2<bbox.left||px2>bbox.left+bbox.width){k++;continue;}
                if(!started){ctx.moveTo(px2,py2);started=true;}
                else{ctx.lineTo(px2,py2);}
                k++;
            }
            if(started)ctx.stroke();
        }
        ctx.restore();

        if(isLiveMode&&u.data[0]&&u.data[0].length>0){
            var li=u.data[0].length-1;
            var lVal=(smooth[li]!=null&&!isNaN(smooth[li]))?smooth[li]:(raw[li]!=null?raw[li]:null);
            if(lVal!=null&&!isNaN(lVal)){
                var px=Math.round(u.valToPos(u.data[0][li],'x',true));
                var py=Math.round(u.valToPos(lVal,'y',true));
                ctx.beginPath();ctx.arc(px,py,10,0,2*Math.PI);ctx.fillStyle='rgba(255,69,58,0.35)';ctx.fill();
                ctx.beginPath();ctx.arc(px,py,5,0,2*Math.PI);ctx.fillStyle='#ff453a';ctx.fill();
                ctx.lineWidth=2;ctx.strokeStyle='#fff';ctx.stroke();
                var cW=bbox.left+bbox.width,tx=px,ty=py-15;
                ctx.textAlign=px>cW-80?'right':'center';ctx.textBaseline=py<35?'top':'bottom';
                if(px>cW-80)tx=px-8;if(py<35)ty=py+15;
                ctx.font="bold 12px 'JetBrains Mono',monospace";
                ctx.fillStyle='#ff453a';ctx.shadowColor='rgba(0,0,0,0.85)';ctx.shadowBlur=4;
                ctx.fillText('ÉLŐ: '+Math.round(lVal)+' ppm',tx,ty);
            }
        }
        ctx.restore();
    }]}};
}

function makeMinMaxPlugin(){
    return{hooks:{draw:[function(u){
        var ctx=u.ctx,bbox=u.bbox;
        var vals=(u.data[1]||[]).filter(function(v){return v!=null&&!isNaN(v);});
        if(vals.length<2)return;
        var maxV=Math.max.apply(null,vals),minV=Math.min.apply(null,vals);
        if(maxV===minV)return;
        var yMax=Math.round(u.valToPos(maxV,'y',true));
        var yMin=Math.round(u.valToPos(minV,'y',true));
        var x0=bbox.left,x1=bbox.left+bbox.width;
        ctx.save();
        ctx.setLineDash([5,4]);ctx.lineWidth=1.5;
        ctx.strokeStyle='rgba(255,69,58,0.65)';
        ctx.beginPath();ctx.moveTo(x0,yMax);ctx.lineTo(x1,yMax);ctx.stroke();
        ctx.strokeStyle='rgba(48,209,88,0.65)';
        ctx.beginPath();ctx.moveTo(x0,yMin);ctx.lineTo(x1,yMin);ctx.stroke();
        ctx.setLineDash([]);
        ctx.font="bold 12px 'JetBrains Mono',monospace";
        ctx.shadowColor='rgba(0,0,0,0.95)';ctx.shadowBlur=6;ctx.textAlign='left';
        var maxLabel='MAX '+(Number.isInteger(maxV)?maxV:maxV.toFixed(1));
        var minLabel='MIN '+(Number.isInteger(minV)?minV:minV.toFixed(1));
        ctx.fillStyle='rgba(255,69,58,0.95)';ctx.textBaseline='bottom';
        ctx.fillText(maxLabel,x0+5,Math.max(yMax-3,14));
        ctx.fillStyle='rgba(48,209,88,0.95)';ctx.textBaseline='top';
        ctx.fillText(minLabel,x0+5,yMin+3);
        ctx.restore();
    }]}};
}

/* ═══════════════════════════════
   uPlot inicializálás
   ═══════════════════════════════ */
window.co2UPlot=null;window.speedUPlot=null;window.accelUPlot=null;
window._uplotReady=false;window._pendingZoom=null;

function initUPlots(){
    var isMobile = window.innerWidth <= 640;
    var trendLbl = (window.GX_TR && window.GX_TR.toggle_trend)      || 'Trend';
    var rawLbl   = (window.GX_TR && window.GX_TR.toggle_raw)        || 'Nyers';
    var speedLbl = (window.GX_TR && window.GX_TR.chart_speed_title) || 'Sebesség';
    var accelLbl = (window.GX_TR && window.GX_TR.chart_accel_title) || 'Gyorsulás';

    if (isMobile) {
        // ── MOBIL: Chart.js ──

        // Min/Max vonal plugin — minden mobile chartnál
        var minMaxPlugin = {
            id: 'minMaxLines',
            afterDraw: function(chart) {
                var ctx = chart.ctx;
                var yAxis = chart.scales.y;
                var xAxis = chart.scales.x;
                if (!yAxis || !xAxis) return;
                var allData = [];
                chart.data.datasets.forEach(function(ds) {
                    ds.data.forEach(function(v) { if(v!=null&&!isNaN(v)) allData.push(+v); });
                });
                if (allData.length < 2) return;
                var maxV = Math.max.apply(null, allData);
                var minV = Math.min.apply(null, allData);
                if (maxV === minV) return;
                var yMax = yAxis.getPixelForValue(maxV);
                var yMin = yAxis.getPixelForValue(minV);
                var x0 = xAxis.left, x1 = xAxis.right;
                ctx.save();
                ctx.setLineDash([5, 4]);
                ctx.lineWidth = 1.5;
                // MAX piros vonal
                ctx.strokeStyle = 'rgba(255,69,58,0.75)';
                ctx.beginPath(); ctx.moveTo(x0, yMax); ctx.lineTo(x1, yMax); ctx.stroke();
                // MIN zöld vonal
                ctx.strokeStyle = 'rgba(48,209,88,0.75)';
                ctx.beginPath(); ctx.moveTo(x0, yMin); ctx.lineTo(x1, yMin); ctx.stroke();
                ctx.setLineDash([]);
                // Feliratok
                ctx.font = "bold 10px 'JetBrains Mono',monospace";
                ctx.shadowColor = 'rgba(0,0,0,0.95)'; ctx.shadowBlur = 5;
                ctx.textAlign = 'left';
                ctx.fillStyle = 'rgba(255,69,58,0.95)'; ctx.textBaseline = 'bottom';
                ctx.fillText('MAX ' + Math.round(maxV), x0 + 4, Math.max(yMax - 3, 12));
                ctx.fillStyle = 'rgba(48,209,88,0.95)'; ctx.textBaseline = 'top';
                ctx.fillText('MIN ' + Math.round(minV), x0 + 4, yMin + 3);
                ctx.restore();
            }
        };
        var co2MobileCanvas = document.getElementById('co2ChartMobile');
        var co2WrapDiv      = document.getElementById('co2ChartWrap');
        var speedWrapDiv    = document.getElementById('speedChartWrap');
        var accelWrapDiv    = document.getElementById('accelChartWrap');

        // CO2 wrap: canvas-t mutatjuk, uPlot div-et elrejtjük
        if (co2WrapDiv)      co2WrapDiv.style.display = 'none';
        if (co2MobileCanvas) co2MobileCanvas.style.display = 'block';

        // Speed wrap: canvas-t rakunk bele
        if (speedWrapDiv) {
            var sc = document.createElement('canvas');
            sc.id = 'speedChartMobile';
            speedWrapDiv.appendChild(sc);
        }
        if (accelWrapDiv) {
            var ac = document.createElement('canvas');
            ac.id = 'accelChartMobile';
            accelWrapDiv.appendChild(ac);
        }

        var mobileOpts = {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: function(ctx) {
                    return ' ' + Math.round(ctx.parsed.y) + ' ppm';
                }}}
            },
            elements: { line: { borderCapStyle: 'round' } },
            scales: {
                x: { grid: { display: false }, border: { display: false }, ticks: { color: 'rgba(255,255,255,0.35)', maxTicksLimit: 5, font: { size: 9 }, maxRotation: 0 }},
                y: { grid: { color: 'rgba(255,255,255,0.06)' }, border: { display: false }, ticks: { color: 'rgba(255,255,255,0.35)', font: { size: 9 }, maxTicksLimit: 5 }}
            }
        };

        window.co2ChartMobile = co2MobileCanvas ? new Chart(co2MobileCanvas.getContext('2d'), {
            type: 'line',
            data: { labels: [], datasets: [
                { label: trendLbl, data: [], borderColor: '#0a84ff', backgroundColor: 'rgba(10,132,255,0.08)', borderWidth: 2, pointRadius: 0, tension: 0.3, fill: true },
                { label: rawLbl,   data: [], borderColor: 'rgba(10,132,255,0.35)', backgroundColor: 'transparent', borderWidth: 1, pointRadius: 0, tension: 0.1 }
            ]},
            options: mobileOpts,
            plugins: [minMaxPlugin]
        }) : null;

        var speedCanvas = document.getElementById('speedChartMobile');
        window.speedChartMobile = speedCanvas ? new Chart(speedCanvas.getContext('2d'), {
            type: 'line',
            data: { labels: [], datasets: [
                { label: speedLbl, data: [], borderColor: '#bf5af2', backgroundColor: 'rgba(191,90,242,0.07)', borderWidth: 2, pointRadius: 0, tension: 0.3, fill: true }
            ]},
            options: mobileOpts,
            plugins: [minMaxPlugin]
        }) : null;

        var accelCanvas = document.getElementById('accelChartMobile');
        window.accelChartMobile = accelCanvas ? new Chart(accelCanvas.getContext('2d'), {
            type: 'line',
            data: { labels: [], datasets: [
                { label: accelLbl, data: [], borderColor: '#ff9f0a', backgroundColor: 'rgba(255,159,10,0.07)', borderWidth: 2, pointRadius: 0, tension: 0.3, fill: true }
            ]},
            options: mobileOpts,
            plugins: [minMaxPlugin]
        }) : null;

        window._uplotReady = true;
        window._isMobileChart = true;
        if (window._pendingZoom) { var z=window._pendingZoom; window._pendingZoom=null; window.applyZoom(z); }
        return;
    }

    // ── ASZTALI: uPlot ──
    var w1=measureW('co2ChartWrap',800);
    var w2=measureW('speedChartWrap',500);
    var w3=measureW('accelChartWrap',500);
    console.log('uPlot init widths:',w1,w2,w3);

    window.co2UPlot=new uPlot({
        width:w1,height:400,padding:[20,4,0,0],
        cursor:{show:true,sync:{key:'gx'}},legend:{show:false},
        plugins:[makeCo2Plugin(),makeTooltipPlugin([{label:trendLbl,color:'#0a84ff',unit:'ppm'},{label:rawLbl,color:'rgba(10,132,255,0.7)',unit:'ppm'}])],
        series:[{},{label:trendLbl,stroke:'#0a84ff',fill:'rgba(10,132,255,0.07)',width:2.5,points:{show:false},spanGaps:true},{label:rawLbl,stroke:'rgba(10,132,255,0.38)',fill:'transparent',width:1,points:{show:false},spanGaps:true}],
        axes:[uXAxis,uYAxis],
        scales:{x:{time:true},y:{auto:true,range:function(u,mn,mx){return[mn-15,mx+20];}}}
    },[[],[],[]],document.getElementById('co2ChartWrap'));

    window.speedUPlot=new uPlot({
        width:w2,height:210,padding:[0,4,0,0],
        cursor:{show:true,sync:{key:'gx'}},legend:{show:false},
        plugins:[makeMinMaxPlugin(),makeTooltipPlugin([{label:speedLbl,color:'#bf5af2',unit:'ppm/p'}])],
        series:[{},{label:speedLbl,stroke:'#bf5af2',fill:'rgba(191,90,242,0.07)',width:2,points:{show:false},spanGaps:true}],
        axes:[uXAxis,uYAxis],scales:{x:{time:true},y:{auto:true}}
    },[[],[]],document.getElementById('speedChartWrap'));

    window.accelUPlot=new uPlot({
        width:w3,height:210,padding:[0,4,0,0],
        cursor:{show:true,sync:{key:'gx'}},legend:{show:false},
        plugins:[makeMinMaxPlugin(),makeTooltipPlugin([{label:accelLbl,color:'#ff9f0a',unit:'ppm/p²'}])],
        series:[{},{label:accelLbl,stroke:'#ff9f0a',fill:'rgba(255,159,10,0.07)',width:2,points:{show:false},spanGaps:true}],
        axes:[uXAxis,uYAxis],scales:{x:{time:true},y:{auto:true}}
    },[[],[]],document.getElementById('accelChartWrap'));

    window._uplotReady=true;
    console.log('uPlot kész.');
    if(window._pendingZoom){var z=window._pendingZoom;window._pendingZoom=null;window.applyZoom(z);}

    // ResizeObserver — automatikusan korrigál
    function resizeAllCharts(){
        if(!window._uplotReady||window._isFullscreen)return;
        var w1=measureW('co2ChartWrap',800);
        var w2=measureW('speedChartWrap',400);
        var w3=measureW('accelChartWrap',400);
        if(window.co2UPlot   && Math.abs(w1-window.co2UPlot.width)>5)   window.co2UPlot.setSize({width:w1,height:400});
        if(window.speedUPlot && Math.abs(w2-window.speedUPlot.width)>5)  window.speedUPlot.setSize({width:w2,height:210});
        if(window.accelUPlot && Math.abs(w3-window.accelUPlot.width)>5)  window.accelUPlot.setSize({width:w3,height:210});
    }
    window._resizeAllCharts=resizeAllCharts;

    if(typeof ResizeObserver!=='undefined'){
        var ro=new ResizeObserver(function(){
            clearTimeout(window._roTimer);
            window._roTimer=setTimeout(resizeAllCharts,80);
        });
        var co2El=document.getElementById('co2ChartWrap');
        var spdEl=document.getElementById('speedChartWrap');
        var accEl=document.getElementById('accelChartWrap');
        if(co2El)ro.observe(co2El.parentElement||co2El);
        if(spdEl)ro.observe(spdEl.parentElement||spdEl);
        if(accEl)ro.observe(accEl.parentElement||accEl);
    }
    // Fallback: 500ms után még egyszer korrigál (iOS Safari)
    setTimeout(resizeAllCharts,500);
    setTimeout(resizeAllCharts,1500);
}

/* window.load + requestAnimationFrame = layout garantáltan kész */
window.addEventListener('load',function(){
    requestAnimationFrame(function(){
        initUPlots();
        // Mobilon az uPlot szélessége lehet hibás — egy kis delay után korrigáljuk
        setTimeout(function(){
            if(!window._uplotReady) return;
            var w1=measureW('co2ChartWrap',800);
            var w2=measureW('speedChartWrap',500);
            var w3=measureW('accelChartWrap',500);
            if(window.co2UPlot && w1!==window.co2UPlot.width) window.co2UPlot.setSize({width:w1,height:400});
            if(window.speedUPlot && w2!==window.speedUPlot.width) window.speedUPlot.setSize({width:w2,height:210});
            if(window.accelUPlot && w3!==window.accelUPlot.width) window.accelUPlot.setSize({width:w3,height:210});
        },300);
    });
});

var _resizeTimer;
window.addEventListener('resize',function(){
    if(window._isFullscreen)return;
    clearTimeout(_resizeTimer);
    _resizeTimer=setTimeout(function(){
        if(!window._uplotReady)return;
        if(window.co2UPlot)   window.co2UPlot.setSize({width:measureW('co2ChartWrap',800),height:400});
        if(window.speedUPlot) window.speedUPlot.setSize({width:measureW('speedChartWrap',400),height:210});
        if(window.accelUPlot) window.accelUPlot.setSize({width:measureW('accelChartWrap',400),height:210});
    },200);
});

/* ═══════════════════════════════
   Chart.js — időbeli eloszlás
   ═══════════════════════════════ */
Chart.defaults.color='rgba(255,255,255,0.35)';
Chart.defaults.font.family="'Geist','Inter',-apple-system,sans-serif";
Chart.defaults.font.size=11;
var NOGRID={display:false},NB={display:false},TK={color:'rgba(255,255,255,0.35)',font:{size:10}};

window.timeBarChart=new Chart(document.getElementById('timeBarChart').getContext('2d'),{
    type:'bar',
    data:{labels:['Kiváló (<800)','Jó (800–1000)','Figyelem (1000–1500)','Kritikus (>1500)'],
        datasets:[{data:[],backgroundColor:['rgba(48,209,88,0.75)','rgba(255,214,10,0.75)','rgba(255,159,10,0.75)','rgba(255,69,58,0.75)'],borderColor:['#30d158','#ffd60a','#ff9f0a','#ff453a'],borderWidth:1,borderRadius:4,barThickness:18}]},
    options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,animation:false,
        plugins:{legend:{display:false},tooltip:{callbacks:{label:function(ctx){
            var m=Math.round(ctx.parsed.x);
            if(m<=0)return' 0 perc';if(m<60)return' '+m+' perc';
            var h=Math.floor(m/60),mn=m%60;return' '+h+' óra'+(mn>0?' '+mn+' perc':'');
        }}}},
        scales:{
            x:{grid:NOGRID,border:NB,ticks:{...TK,maxTicksLimit:6,callback:function(v){
                var m=Math.round(v);if(m<=0)return'0';if(m<60)return m+'p';
                var h=Math.floor(m/60),mn=m%60;return h+'ó'+(mn>0?' '+mn+'p':'');
            }}},
            y:{grid:{display:false},border:NB,ticks:{color:'rgba(255,255,255,0.65)',font:{size:11,weight:'600'}}}
        }}
});

/* ── Gauge ── */
function updateGauge(ppm){
    var f=document.getElementById('gauge-fill'),v=document.getElementById('gauge-val');
    if(!f||!v)return;
    var n=parseInt(ppm);
    if(isNaN(n)||n<=0){v.textContent='—';v.style.color='#5ac8fa';return;}
    f.style.strokeDashoffset=(173-173*Math.min(Math.max((n-400)/1600,0),1)).toFixed(2);
    var c=co2Col(n);f.style.stroke=c.hex;f.style.filter='drop-shadow(0 0 8px '+c.hex+'aa)';
    v.textContent=n;v.style.color=c.hex;
}

/* ── applyZoom ── */
window._fullChartArrays=null;
window._fullTimestamps=[];
window._pendingZoom=null;

window.applyZoom=function(z){
    var src=window._fullChartArrays;
    if(!src||!src.ts||!src.ts.length)return;
    if(!window._uplotReady){window._pendingZoom=z;return;}

    var startIdx=0;
    if(z!=='all'&&src.ts.length>0){
        var mins=parseInt(z),lastTs=src.ts[src.ts.length-1],cutoff=lastTs-mins*60;
        for(var i=0;i<src.ts.length;i++){if(src.ts[i]>=cutoff){startIdx=i;break;}}
    }

    var ts=src.ts.slice(startIdx),smooth=src.smooth.slice(startIdx),raw=src.raw.slice(startIdx);
    var speeds=src.speeds.slice(startIdx),accels=src.accels.slice(startIdx);

    // Mobil: Chart.js
    if(window._isMobileChart){
        var labels=ts.map(function(t){return new Date(t*1000).toLocaleTimeString('hu-HU',{hour:'2-digit',minute:'2-digit'});});
        if(window.co2ChartMobile){
            window.co2ChartMobile.data.labels=labels;
            window.co2ChartMobile.data.datasets[0].data=smooth;
            window.co2ChartMobile.data.datasets[1].data=raw;
            window.co2ChartMobile.update('none');
        }
        if(window.speedChartMobile){
            window.speedChartMobile.data.labels=labels;
            window.speedChartMobile.data.datasets[0].data=speeds;
            window.speedChartMobile.update('none');
        }
        if(window.accelChartMobile){
            window.accelChartMobile.data.labels=labels;
            window.accelChartMobile.data.datasets[0].data=accels;
            window.accelChartMobile.update('none');
        }
        return;
    }

    // Asztali: uPlot
    window.co2UPlot.setData([ts,smooth,raw],true);
    window.speedUPlot.setData([ts,speeds],true);
    window.accelUPlot.setData([ts,accels],true);
};

/* ── updateUI ── */
function updateUI(payload){
    if(!payload)return;
    var cur=parseInt(payload.kpi.current),avg=parseInt(payload.kpi.avg);
    var max=parseInt(payload.kpi.max),min=parseInt(payload.kpi.min);

    colorCard('card-current','kpi-current',cur);
    var cc=document.getElementById('card-current');if(cc){cc.style.background='';cc.style.boxShadow='';}

    var ad=document.getElementById('kpi-avg'),ac=document.getElementById('card-avg');
    if(ad&&ac){ac.style.borderTop='2px solid #bf5af2';ac.style.background='';ac.style.boxShadow='';
        ad.innerHTML='<b style="color:#bf5af2;font-weight:600;font-family:\'JetBrains Mono\',monospace;font-size:clamp(1.7rem,3.5vw,2.1rem);letter-spacing:-1.5px;line-height:1">'+(isNaN(avg)?'—':avg)+'</b><span style="color:rgba(255,255,255,0.28);font-size:11px;font-weight:300;font-family:Geist,sans-serif"> ppm</span>';}

    var md=document.getElementById('kpi-max'),mc=document.getElementById('card-max');
    if(md&&mc){mc.style.borderTop='2px solid #ff453a';mc.style.background='';mc.style.boxShadow='';
        md.innerHTML='<b style="color:#ff453a;font-weight:600;font-family:\'JetBrains Mono\',monospace;font-size:clamp(1.7rem,3.5vw,2.1rem);letter-spacing:-1.5px;line-height:1">'+(isNaN(max)?'—':max)+'</b><span style="color:rgba(255,255,255,0.28);font-size:11px;font-weight:300;font-family:Geist,sans-serif"> ppm</span>';}

    var nd=document.getElementById('kpi-min'),nc=document.getElementById('card-min');
    if(nd&&nc){nc.style.borderTop='2px solid #30d158';nc.style.background='';nc.style.boxShadow='';
        nd.innerHTML='<b style="color:#30d158;font-weight:600;font-family:\'JetBrains Mono\',monospace;font-size:clamp(1.7rem,3.5vw,2.1rem);letter-spacing:-1.5px;line-height:1">'+(isNaN(min)?'—':min)+'</b><span style="color:rgba(255,255,255,0.28);font-size:11px;font-weight:300;font-family:Geist,sans-serif"> ppm</span>';}

    var rd=document.getElementById('kpi-range');
    if(rd&&!isNaN(max)&&!isNaN(min)){
        rd.innerHTML='<b style="color:#5ac8fa;font-weight:600;font-family:\'JetBrains Mono\',monospace;font-size:clamp(1.7rem,3.5vw,2.1rem);letter-spacing:-1.5px;line-height:1">'+(max-min)+'</b><span style="color:rgba(255,255,255,0.28);font-size:11px;font-weight:300;font-family:Geist,sans-serif"> ppm</span>';}

    updateGauge(cur);

    var sBox=document.getElementById('air-status-box');
    if(sBox){
        var statusText = (GX_TR && payload.air_status_key && GX_TR[payload.air_status_key])
            ? GX_TR[payload.air_status_key]
            : (payload.air_status_text || '-');
        // Update label + dot + ppm
        var asbLabel = document.getElementById('asb-label');
        var asbPpm   = document.getElementById('asb-ppm');
        if (asbLabel) asbLabel.textContent = statusText;
        if (asbPpm && payload.kpi && payload.kpi.current !== undefined)
            asbPpm.textContent = payload.kpi.current + ' ppm';
        sBox.className='air-status-box '+(payload.air_status_class||'status-neutral');
    }

    var lu=document.getElementById('last-update');
    if(lu){
        if(payload.timestamp){var dt=new Date(payload.timestamp.replace(' ','T')+'Z');
            lu.textContent=isNaN(dt)?(payload.last_update||'—'):dt.toLocaleTimeString('hu-HU',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
        }else{lu.textContent=payload.last_update||'—';}
    }

    if(payload.chartData&&payload.chartData.length){
        var chartSource = payload.chartData;
        // Mobilon max 2000 pont — gyors renderelés
        if(window._isMobileChart && chartSource.length > 2000){
            var step = Math.ceil(chartSource.length / 2000);
            var thinned = [];
            for(var i=0;i<chartSource.length;i+=step) thinned.push(chartSource[i]);
            chartSource = thinned;
        }
        var ts    =chartSource.map(function(d){return isoToUnix(d.x);});
        // Nyers értékek
        var rawArr=chartSource.map(function(d){return d.y_raw!=null?+d.y_raw:(d.y_smooth!=null?+d.y_smooth:null);});
        // Kliens oldali mozgóátlag simítás a ritkulás után (15 pontos ablak)
        function movingAvg(arr, win){
            var half=Math.floor(win/2);
            return arr.map(function(v,i){
                if(v==null||isNaN(v))return v;
                var sum=0,cnt=0;
                for(var j=Math.max(0,i-half);j<=Math.min(arr.length-1,i+half);j++){
                    if(arr[j]!=null&&!isNaN(arr[j])){sum+=arr[j];cnt++;}
                }
                return cnt>0?Math.round(sum/cnt*100)/100:v;
            });
        }
        var smooth = window._isMobileChart ? movingAvg(rawArr, 15) : chartSource.map(function(d){
            return d.y_smooth!=null?+d.y_smooth:(d.y_raw!=null?+d.y_raw:null);
        });
        var raw=rawArr;
        var speeds=chartSource.map(function(d){return d.speed!=null?+d.speed:null;});
        var accels=chartSource.map(function(d){return d.accel!=null?+d.accel:null;});

        window._fullChartArrays={ts:ts,smooth:smooth,raw:raw,speeds:speeds,accels:accels};
        window._fullTimestamps=payload.chartData.map(function(d){return d.x||'';});

        var activeBtn=document.querySelector('.ch-opt.active');

        // Mobilon korrigáljuk a szélességet mielőtt megrajzolunk
        if(window._uplotReady){
            var cw=measureW('co2ChartWrap',800);
            var sw=measureW('speedChartWrap',400);
            var aw=measureW('accelChartWrap',400);
            if(window.co2UPlot   && Math.abs(cw - window.co2UPlot.width)   > 10) window.co2UPlot.setSize({width:cw, height:400});
            if(window.speedUPlot && Math.abs(sw - window.speedUPlot.width)  > 10) window.speedUPlot.setSize({width:sw, height:210});
            if(window.accelUPlot && Math.abs(aw - window.accelUPlot.width)  > 10) window.accelUPlot.setSize({width:aw, height:210});
        }

        window.applyZoom(activeBtn?activeBtn.dataset.zoom:'all');
        // Mobilon korrigáljuk a méreteket az adatbetöltés után
        setTimeout(function(){ if(window._resizeAllCharts)window._resizeAllCharts(); },100);
    }

    if(payload.timeStats){window.timeBarChart.data.datasets[0].data=payload.timeStats;window.timeBarChart.update('none');}

    if(isLiveMode&&payload.chartData&&payload.chartData.length>0){
        var lpt=payload.chartData[payload.chartData.length-1].x;
        if(lpt){var ldt=new Date(lpt.replace(' ','T')+'Z'),diff=Date.now()-ldt.getTime();
            if(!isNaN(diff)&&diff<180000){if(_ot)clearTimeout(_ot);setOnline(true);_ot=setTimeout(function(){setOnline(false);},180000-diff);}
            else{if(_ot)clearTimeout(_ot);setOnline(false);}
        }
    }
}

socket.on('update_data',function(p){if(isLiveMode){resetOff();updateUI(p);}});
socket.on('status_message',function(d){var el=document.getElementById('sensor-status-text');if(isLiveMode&&el)el.textContent=d.msg;});

document.getElementById('btn-history')&&document.getElementById('btn-history').addEventListener('click',function(){
    var date=document.getElementById('date-selector')&&document.getElementById('date-selector').value;
    if(!date)return;
    var offset=(new Date()).getTimezoneOffset()*60000;
    var localToday=(new Date(Date.now()-offset)).toISOString().split('T')[0];
    isLiveMode=(date===localToday);
    if(isLiveMode){setOnline(true);resetOff();var el=document.getElementById('sensor-status-text');if(el)el.textContent=(window.GX_TR&&window.GX_TR.sensor_active)||'Arduino aktív';}
    else{if(_ot)clearTimeout(_ot);setOnline(false);}
    fetch('/api/history',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({date:date})})
        .then(function(r){return r.json();}).then(function(d){if(d.error)alert(d.error);else updateUI(d);}).catch(function(e){console.error(e);});
});

document.getElementById('btn-live')&&document.getElementById('btn-live').addEventListener('click',function(){
    isLiveMode=true;setOnline(true);resetOff();
    var el=document.getElementById('sensor-status-text');if(el)el.textContent=(window.GX_TR&&window.GX_TR.sensor_active)||'Arduino aktív';
});
