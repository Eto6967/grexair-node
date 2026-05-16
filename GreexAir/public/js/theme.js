/* GrexAir theme.js — runs in <head> before paint */
(function() {
    var t = localStorage.getItem('gx-theme') || 'dark';
    document.documentElement.setAttribute('data-theme', t);
    function syncIcon(t) {
        var i = document.getElementById('theme-icon');
        if (i) i.className = t === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    }
    syncIcon(t);
    window.GX_CHARTS = [];
    window.updateChartTheme = function(theme) {
        var grid = theme === 'dark' ? 'transparent' : 'transparent';
        var tick = theme === 'dark' ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.40)';
        window.GX_CHARTS.forEach(function(c) {
            if (!c?.options?.scales) return;
            Object.values(c.options.scales).forEach(function(s) {
                if (s.ticks) s.ticks.color = tick;
            });
            c.update('none');
        });
    };
    document.addEventListener('DOMContentLoaded', function() {
        var btn = document.getElementById('theme-toggle');
        if (btn) btn.addEventListener('click', function() {
            var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', next);
            localStorage.setItem('gx-theme', next);
            syncIcon(next);
            window.updateChartTheme(next);
        });
        setTimeout(function() {
            window.GX_CHARTS = [window.co2Chart, window.speedChart, window.accelChart, window.timeBarChart].filter(Boolean);
            window.updateChartTheme(document.documentElement.getAttribute('data-theme'));
        }, 500);
    });
    window.addEventListener('load', function() {
        setTimeout(function() { var p=document.getElementById('preloader'); if(p)p.classList.add('gone'); }, 500);
    });
})();
