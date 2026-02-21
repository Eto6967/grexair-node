document.addEventListener("DOMContentLoaded", function() {
    
    // --- PRELOADER ---
    window.addEventListener('load', function() {
        const preloader = document.getElementById('preloader');
        if(preloader) {
            preloader.style.opacity = '0';
            setTimeout(function() {
                preloader.style.display = 'none';
                document.body.classList.add('loaded');
            }, 500);
        }
    });

    // --- DARK / LIGHT MODE LOGIKA (Default: Dark) ---
    const themeToggle = document.getElementById('theme-toggle');
    const icon = themeToggle.querySelector('i');
    
    // Kiolvassuk a mentett témát. Ha nincs, 'dark' az alapértelmezett.
    const currentTheme = localStorage.getItem('theme') || 'dark';
    
    // Csak akkor kell osztályt váltani, ha VILÁGOS kell.
    if (currentTheme === 'light') {
        document.body.classList.add('light-mode');
        icon.classList.remove('fa-sun');
        icon.classList.add('fa-moon');
    } else {
        document.body.classList.remove('light-mode');
        icon.classList.remove('fa-moon');
        icon.classList.add('fa-sun');
    }

    themeToggle.addEventListener('click', function() {
        document.body.classList.toggle('light-mode');
        
        if (document.body.classList.contains('light-mode')) {
            localStorage.setItem('theme', 'light');
            icon.classList.remove('fa-sun');
            icon.classList.add('fa-moon');
        } else {
            localStorage.setItem('theme', 'dark');
            icon.classList.remove('fa-moon');
            icon.classList.add('fa-sun');
        }
    });

    // --- STICKY NAV ---
    const nav = document.querySelector('nav');
    if (nav) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 10) {
                nav.classList.add('scrolled');
            } else {
                nav.classList.remove('scrolled');
            }
        });
    }
});