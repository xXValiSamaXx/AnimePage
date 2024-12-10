const ThemeManager = {
    init() {
        this.applyTheme(this.getCurrentTheme());
        this.setupThemeToggle();
    },

    getCurrentTheme() {
        return localStorage.getItem('theme') || 'light';
    },

    applyTheme(theme) {
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        localStorage.setItem('theme', theme);
        
        // Actualizar el botón de toggle
        const toggleBtn = document.getElementById('themeToggle');
        if (toggleBtn) {
            toggleBtn.innerHTML = theme === 'dark' ? '☀️' : '🌙';
            toggleBtn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
        }
    },

    toggleTheme() {
        const currentTheme = this.getCurrentTheme();
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        this.applyTheme(newTheme);
    },

    setupThemeToggle() {
        // Asegurarse de que el botón existe
        let toggleBtn = document.getElementById('themeToggle');
        if (!toggleBtn) {
            toggleBtn = document.createElement('button');
            toggleBtn.id = 'themeToggle';
            toggleBtn.className = 'fixed right-4 top-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-full transition-colors duration-200 z-50';
            document.body.appendChild(toggleBtn);
        }

        toggleBtn.addEventListener('click', () => this.toggleTheme());
        
        // Aplicar el tema inicial
        this.applyTheme(this.getCurrentTheme());
    }
};

export { ThemeManager };