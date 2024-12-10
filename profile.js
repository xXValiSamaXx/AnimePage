import { DB } from './auth-db.js';

const Profile = {
    chartInstances: {
        type: null,
        score: null
    },

    init() {
        const profileBtn = document.getElementById('profileBtn');
        if (profileBtn) {
            profileBtn.addEventListener('click', () => this.showProfile());
        }

        const closeButton = document.querySelector('#profileModal .close-modal');
        if (closeButton) {
            closeButton.addEventListener('click', () => this.hideProfile());
        }

        const modal = document.getElementById('profileModal');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.hideProfile();
                }
            });
        }

        // Agregar listener para redimensionar las gráficas cuando cambie el tamaño de la ventana
        window.addEventListener('resize', () => {
            if (modal && !modal.classList.contains('hidden')) {
                this.loadProfileData();
            }
        });
    },

    showProfile() {
        const modal = document.getElementById('profileModal');
        if (!modal) return;

        modal.classList.remove('hidden');
        modal.classList.add('flex');
        
        // Pequeño delay para asegurar que el modal esté visible
        setTimeout(() => {
            this.loadProfileData();
        }, 100);
    },

    hideProfile() {
        const modal = document.getElementById('profileModal');
        if (!modal) return;

        modal.classList.add('hidden');
        modal.classList.remove('flex');
        this.destroyExistingCharts();
    },

    async loadProfileData() {
        try {
            const favorites = await DB.getFavorites();
            this.renderFavorites(favorites);
            this.renderCharts(favorites);
        } catch (error) {
            console.error('Error loading profile data:', error);
            showMessage('Error cargando datos del perfil', 'error');
        }
    },

    renderFavorites(favorites) {
        const container = document.getElementById('favoritesList');
        if (!container) return;

        container.innerHTML = favorites.map(anime => `
            <div class="bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden shadow">
                <div class="relative" style="padding-top: 56.25%;">
                    <img src="${anime.image_url}" alt="${anime.title}" 
                         class="absolute top-0 left-0 w-full h-full object-cover">
                </div>
                <div class="p-3">
                    <h4 class="font-semibold dark:text-white truncate text-sm">${anime.title}</h4>
                    <div class="flex justify-between items-center mt-2">
                        <span class="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 
                                   dark:text-blue-200 px-2 py-1 rounded-full">
                            ${anime.type}
                        </span>
                        <span class="text-xs dark:text-gray-300">★ ${anime.score || 'N/A'}</span>
                    </div>
                </div>
            </div>
        `).join('');
    },

    renderCharts(favorites) {
        if (!favorites || favorites.length === 0) return;

        this.destroyExistingCharts();

        const typeCtx = document.getElementById('typeChart');
        const scoreCtx = document.getElementById('scoreChart');

        if (typeCtx && scoreCtx) {
            const typeData = this.prepareTypeData(favorites);
            const scoreData = this.prepareScoreData(favorites);

            const defaultOptions = {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: {
                            color: document.documentElement.classList.contains('dark') ? '#fff' : '#000',
                            font: {
                                size: 12
                            }
                        }
                    }
                }
            };

            // Gráfica de tipos (pie)
            this.chartInstances.type = new Chart(typeCtx, {
                type: 'pie',
                data: {
                    labels: typeData.labels,
                    datasets: [{
                        data: typeData.data,
                        backgroundColor: ['#54a0ff', '#ff6b81'],
                    }]
                },
                options: {
                    ...defaultOptions,
                    plugins: {
                        ...defaultOptions.plugins,
                        legend: {
                            position: 'bottom',
                            labels: {
                                padding: 20,
                                font: {
                                    size: 12
                                }
                            }
                        }
                    }
                }
            });

            // Gráfica de puntuaciones (bar)
            this.chartInstances.score = new Chart(scoreCtx, {
                type: 'bar',
                data: {
                    labels: scoreData.labels,
                    datasets: [{
                        label: 'Cantidad de Animes',
                        data: scoreData.data,
                        backgroundColor: '#54a0ff',
                        borderRadius: 4
                    }]
                },
                options: {
                    ...defaultOptions,
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                stepSize: 1,
                                color: document.documentElement.classList.contains('dark') ? '#fff' : '#000'
                            },
                            grid: {
                                color: document.documentElement.classList.contains('dark') ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
                            }
                        },
                        x: {
                            ticks: {
                                color: document.documentElement.classList.contains('dark') ? '#fff' : '#000'
                            },
                            grid: {
                                display: false
                            }
                        }
                    }
                }
            });
        }
    },

    destroyExistingCharts() {
        Object.values(this.chartInstances).forEach(chart => {
            if (chart) {
                chart.destroy();
            }
        });
        this.chartInstances = { type: null, score: null };
    },

    prepareTypeData(favorites) {
        const types = {};
        favorites.forEach(anime => {
            if (anime.type) {
                types[anime.type] = (types[anime.type] || 0) + 1;
            }
        });
        return {
            labels: Object.keys(types),
            data: Object.values(types)
        };
    },

    prepareScoreData(favorites) {
        const scores = {};
        favorites.forEach(anime => {
            if (anime.score) {
                const score = Math.floor(anime.score);
                scores[score] = (scores[score] || 0) + 1;
            }
        });
        const sortedScores = Object.entries(scores)
            .sort(([a], [b]) => Number(a) - Number(b));
        return {
            labels: sortedScores.map(([score]) => score),
            data: sortedScores.map(([, count]) => count)
        };
    }
};

// Inicializar el perfil cuando el DOM esté cargado
document.addEventListener('DOMContentLoaded', () => {
    Profile.init();
});

// Función auxiliar para mostrar mensajes
function showMessage(message, type) {
    if (window.showMessage) {
        window.showMessage(message, type);
    } else {
        console.log(`${type}: ${message}`);
    }
}

export default Profile