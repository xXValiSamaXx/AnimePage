// Importar módulos
import { Auth, DB, DEFAULT_PROFILE_IMAGE } from './auth-db.js';
import { ThemeManager } from './theme-manager.js';
import { VideoPlayer } from './video-player.js';
import jQueryExtensions from './jquery-extensions.js';


// Constants and State Management
const JIKAN_API = 'https://api.jikan.moe/v4';
let currentPage = 1;
let currentView = 'grid';
let searchCache = new Map();
let lastSearchParams = null;
let lastSearchResults = [];

// Initialize Application
$(document).ready(async function() {
    // Inicializar las extensiones de jQuery
    jQueryExtensions.initJQueryExtensions();
    
    // Inicializar componentes
    initializeUI();
    initializeTheme();
    initializeAuth();
    setupEventListeners();
    
    // Aplicar las extensiones después de la inicialización
    jQueryExtensions.applyJQueryExtensions();
    
    // Iniciar con la temporada actual
    lastSearchParams = null;
    await searchAnime(currentPage);
});

// Authentication Initialization
function initializeAuth() {
    // Setup event listeners for auth buttons
    $('#loginModal').on('click', '.close-modal', () => {
        $('#loginModal').addClass('hidden').removeClass('flex');
    });

    $('#registerModal').on('click', '.close-modal', () => {
        $('#registerModal').addClass('hidden').removeClass('flex');
    });

    // Handle login form submission
    $('#loginForm').on('submit', async function(e) {
        e.preventDefault();
        const username = this.username.value;
        const password = this.password.value;
        await handleLogin(username, password);
    });

    // Handle register form submission
    $('#registerForm').on('submit', async function(e) {
        e.preventDefault();
        try {
            const username = this.username.value;
            const email = this.email.value;
            const password = this.password.value;
            await Auth.register(username, email, password);
            $('#registerModal').addClass('hidden').removeClass('flex');
            showMessage('Registration successful!', 'success');
        } catch (error) {
            showMessage(error.message, 'error');
        }
    });

    // Event handler para mostrar el modal de login
    $(document).on('click', '#loginBtn', () => {
        $('#loginModal').removeClass('hidden').addClass('flex');
    });

    // Event handler para mostrar el modal de registro
    $(document).on('click', '#registerBtn', () => {
        $('#registerModal').removeClass('hidden').addClass('flex');
    });

    // Event handler para logout
    $(document).on('click', '#logoutBtn', () => {
        Auth.logout();
        showMessage('Logout successful!', 'success');
    });

    // Update UI when auth state changes
    window.addEventListener('authStateChanged', updateAuthUI);
    updateAuthUI(); // Llamar inmediatamente para configurar el estado inicial
}

// Asegúrate de llamar a initializeAuth cuando el documento esté listo
$(document).ready(function() {
    initializeAuth();
});

// Theme Initialization
function initializeTheme() {
    ThemeManager.init();
}

// Setup Event Listeners
function setupEventListeners() {
    // Search events
    $('#searchBtn').on('click', handleSearch);
    $('#searchInput').on('keypress', function(e) {
        if (e.which === 13) handleSearch();
    });

    // Filter changes
    $('.filter-select').on('change', handleSearch);
    $('#scoreSlider').on('slidechange', handleSearch);

    // View toggle
    $('#gridView, #listView').on('click', function() {
        currentView = $(this).attr('id').replace('View', '');
        updateViewToggle(currentView);
        displayResults(lastSearchResults);
    });

    // Toggle advanced search
    $('#toggleAdvanced').on('click', function(e) {
        e.preventDefault();
        const $advancedSearch = $('#advancedSearch');
        
        if ($advancedSearch.hasClass('show')) {
            $advancedSearch.removeClass('show');
            setTimeout(() => {
                $advancedSearch.addClass('hidden');
            }, 300);
        } else {
            $advancedSearch.removeClass('hidden');
            // Forzar un reflow
            $advancedSearch[0].offsetHeight;
            $advancedSearch.addClass('show');
        }
    });

    // Modal close buttons
    $('.close-modal').on('click', function() {
        $(this).closest('.modal').addClass('hidden').removeClass('flex');
    });

    // Close modals with escape key
    $(document).on('keydown', function(e) {
        if (e.key === 'Escape') {
            $('.modal').addClass('hidden').removeClass('flex');
        }
    });

    // Handle favorite button clicks
    $(document).on('click', '.favorite-btn', async function(e) {
        e.preventDefault();
        e.stopPropagation();
        if (!Auth.isLoggedIn()) {
            showMessage('Please login to add favorites', 'warning');
            return;
        }
        const animeId = $(this).closest('[data-anime-id]').data('animeId');
        const anime = lastSearchResults.find(a => a.mal_id === animeId);
        if (anime) {
            await toggleFavorite(anime);
        }
    });

    // Handle watch button clicks
    $(document).on('click', '.watch-btn', async function(e) {
        e.preventDefault();
        e.stopPropagation();
        if (!Auth.isLoggedIn()) {
            showMessage('Please login to watch', 'warning');
            return;
        }
        const animeId = $(this).closest('[data-anime-id]').data('animeId');
        const anime = lastSearchResults.find(a => a.mal_id === animeId);
        if (anime) {
            await handleWatch(anime);
        }
    });

    // Quick preview
    $(document).on('click', '.quick-preview-btn', function(e) {
        e.preventDefault();
        e.stopPropagation();
        const animeId = $(this).closest('[data-anime-id]').data('animeId');
        const anime = lastSearchResults.find(a => a.mal_id === animeId);
        if (anime) {
            showQuickPreview(anime);
        }
    });
}

// Inicialización de componentes del perfil
function initializeProfileComponents() {
    // Manejo del dropdown del perfil
    const profileDropdown = document.getElementById('profileDropdown');
    const profileMenu = document.getElementById('profileMenu');
    
    if (profileDropdown) {
        profileDropdown.addEventListener('click', function(e) {
            e.stopPropagation();
            profileMenu.classList.toggle('hidden');
        });
    }

    // Cerrar el dropdown al hacer click fuera
    document.addEventListener('click', function(e) {
        if (profileMenu && !profileMenu.contains(e.target) && 
            !e.target.matches('#profileDropdown, #profileDropdown *')) {
            profileMenu.classList.add('hidden');
        }
    });

    // Manejo del modal de perfil
    const openProfileBtn = document.getElementById('openProfile');
    const profileModal = document.getElementById('profileModal');
    
    if (openProfileBtn) {
        openProfileBtn.addEventListener('click', function() {
            profileMenu.classList.add('hidden');
            if (profileModal) {
                profileModal.classList.remove('hidden');
                profileModal.classList.add('flex');
            }
        });
    }
}

function initializeProfileImageHandlers() {
    const uploadImageBtn = document.getElementById('uploadImageBtn');
    const profileImageInput = document.getElementById('profileImage');
    const previewImage = document.getElementById('previewImage');
    const userAvatar = document.getElementById('userAvatar'); // Añadir referencia al avatar
    
    if (uploadImageBtn && profileImageInput) {
        uploadImageBtn.addEventListener('click', function() {
            profileImageInput.click();
        });

        profileImageInput.addEventListener('change', async function(e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = async function(e) {
                    const base64Image = e.target.result;
                    
                    // Actualizar todas las previsualizaciones
                    if (previewImage) {
                        previewImage.src = base64Image;
                    }
                    
                    // Si el usuario está logueado, actualizar su imagen en la DB
                    const user = Auth.getCurrentUser();
                    if (user) {
                        try {
                            // Actualizar en la base de datos
                            await DB.updateProfileImage(user.username, base64Image);
                            
                            // Actualizar el avatar en el header
                            if (userAvatar) {
                                userAvatar.src = base64Image;
                            }
                            
                            // Actualizar el localStorage para mantener la persistencia
                            const currentUser = Auth.getCurrentUser();
                            currentUser.profileImage = base64Image;
                            Auth._setCurrentUser(currentUser);
                            
                            showMessage('Profile image updated successfully!', 'success');
                        } catch (error) {
                            console.error('Error updating profile image:', error);
                            showMessage('Error updating profile image', 'error');
                        }
                    }
                };
                reader.readAsDataURL(file);
            }
        });
    }
}

// Modificar el manejo del formulario de registro
function initializeRegistrationForm() {
    const registerForm = document.getElementById('registerForm');
    
    if (registerForm) {
        registerForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            try {
                const username = this.username.value;
                const email = this.email.value;
                const password = this.password.value;
                const previewImage = document.getElementById('previewImage');
                
                // Verificar que los campos no estén vacíos
                if (!username || !email || !password) {
                    throw new Error('All fields are required');
                }

                // Usar la imagen del preview si existe, si no usar la default
                let profileImage = DEFAULT_PROFILE_IMAGE;
                if (previewImage && previewImage.src !== DEFAULT_PROFILE_IMAGE) {
                    profileImage = previewImage.src;
                }

                // Mostrar indicador de carga
                showMessage('Registering user...', 'info');

                // Registrar usuario con la imagen
                const user = await Auth.register(username, email, password, profileImage);
                
                // Cerrar modal y limpiar formulario
                const registerModal = document.getElementById('registerModal');
                if (registerModal) {
                    registerModal.classList.add('hidden');
                    registerModal.classList.remove('flex');
                    registerForm.reset();
                }
                
                showMessage('Registration successful!', 'success');
                
                // Actualizar UI y asegurarse de que la imagen se muestre
                const userAvatar = document.getElementById('userAvatar');
                if (userAvatar) {
                    userAvatar.src = profileImage;
                }
                
                updateAuthUI();

            } catch (error) {
                console.error('Registration error:', error);
                showMessage(error.message || 'Registration failed', 'error');
            }
        });
    }
}

function updateAuthUI() {
    const user = Auth.getCurrentUser();
    const loggedInContent = document.querySelector('.logged-in-content');
    const loggedOutContent = document.querySelector('.logged-out-content');
    const usernameDisplay = document.querySelector('.username-display');
    const userAvatar = document.getElementById('userAvatar');

    if (user) {
        if (loggedInContent) loggedInContent.classList.remove('hidden');
        if (loggedOutContent) loggedOutContent.classList.add('hidden');
        if (usernameDisplay) usernameDisplay.textContent = user.username;
        if (userAvatar) {
            userAvatar.src = user.profileImage || DEFAULT_PROFILE_IMAGE;
        }
        
        // También actualizar la imagen en el modal de perfil si está abierto
        const profileModalImage = document.querySelector('#profileModal img[alt="Profile"]');
        if (profileModalImage) {
            profileModalImage.src = user.profileImage || DEFAULT_PROFILE_IMAGE;
        }
    } else {
        if (loggedInContent) loggedInContent.classList.add('hidden');
        if (loggedOutContent) loggedOutContent.classList.remove('hidden');
    }
}

    // Inicialización
    document.addEventListener('DOMContentLoaded', function() {
        initializeProfileComponents();
        initializeProfileImageHandlers();
        initializeRegistrationForm();
        updateAuthUI();
    });

    // Event listener para actualizaciones de estado de autenticación
    window.addEventListener('authStateChanged', updateAuthUI);

    // Funciones para mostrar y ocultar el loading
    function showLoading() {
        const $loading = $('.loading');
        $loading.removeClass('hidden').addClass('flex');
        // Prevenir scroll mientras está cargando
        $('body').css('overflow', 'hidden');
    }

    function hideLoading() {
        const $loading = $('.loading');
        $loading.addClass('hidden').removeClass('flex');
        // Restaurar scroll
        $('body').css('overflow', '');
    }

// Search Implementation
async function searchAnime(page = 1) {
    showLoading();
    
    try {
        let url;
        
        // Si hay parámetros de búsqueda, usar la búsqueda normal
        if (lastSearchParams && (lastSearchParams.q || lastSearchParams.type || lastSearchParams.status || 
            lastSearchParams.rating || lastSearchParams.genres || lastSearchParams.genres_exclude)) {
            const params = {
                ...lastSearchParams,
                page,
                limit: 12,
                order_by: lastSearchParams.order_by || 'start_date',  // Por defecto ordenar por fecha
                sort: 'desc'  // Más recientes primero
            };
            
            const cacheKey = JSON.stringify({...params, page});
            if (searchCache.has(cacheKey)) {
                const cachedData = searchCache.get(cacheKey);
                lastSearchResults = cachedData.data;
                displayResults(cachedData.data);
                displayPagination(cachedData.pagination);
                updateActiveFilters(params);
                hideLoading();
                return;
            }

            const queryString = new URLSearchParams(params).toString();
            url = `${JIKAN_API}/anime?${queryString}`;
        } else {
            // Si no hay parámetros, mostrar la temporada actual ordenada por fecha
            url = `${JIKAN_API}/seasons/now?page=${page}&limit=12&order_by=start_date&sort=desc`;
        }

        const response = await fetch(url);
        const data = await $.ajax({
            url: url,
            method: 'GET',
            dataType: 'json'
        });

        // Rate limiting handling
        if (response.status === 429) {
            showMessage('Rate limit reached. Please wait a moment and try again.', 'warning');
            setTimeout(() => searchAnime(page), 1000);
            return;
        }

        // Cache the results
        if (lastSearchParams) {
            const cacheKey = JSON.stringify({...lastSearchParams, page});
            searchCache.set(cacheKey, data);
        }

        lastSearchResults = data.data;
        displayResults(data.data);
        if (data.pagination) {
            displayPagination(data.pagination);
        }
        
        if (lastSearchParams) {
            updateActiveFilters(lastSearchParams);
        }

    } catch (error) {
        console.error('Error:', error);
        showMessage('An error occurred while fetching the data.', 'error');
    } finally {
        hideLoading();
    }
}

// Display Pagination
function displayPagination(pagination) {
    if (!pagination) return;

    const $pagination = $('#pagination');
    $pagination.empty();

    const maxButtons = 5;
    const lastPage = pagination.last_visible_page || 1;
    let startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2));
    let endPage = Math.min(lastPage, startPage + maxButtons - 1);

    if (endPage - startPage + 1 < maxButtons) {
        startPage = Math.max(1, endPage - maxButtons + 1);
    }

    // Previous button
    if (currentPage > 1) {
        $pagination.append(`
            <button class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition" 
                    data-page="${currentPage - 1}">
                Previous
            </button>
        `);
    }

    // First page
    if (startPage > 1) {
        $pagination.append(`
            <button class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition" 
                    data-page="1">1</button>
        `);
        if (startPage > 2) {
            $pagination.append('<span class="px-3 py-2">...</span>');
        }
    }

    // Page numbers
    for (let i = startPage; i <= endPage; i++) {
        const isActive = i === currentPage;
        $pagination.append(`
            <button class="px-4 py-2 ${isActive ? 'bg-blue-800' : 'bg-blue-600'} 
                         text-white rounded hover:bg-blue-700 transition" 
                    data-page="${i}">
                ${i}
            </button>
        `);
    }

    // Last page
    if (endPage < lastPage) {
        if (endPage < lastPage - 1) {
            $pagination.append('<span class="px-3 py-2">...</span>');
        }
        $pagination.append(`
            <button class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition" 
                    data-page="${lastPage}">${lastPage}</button>
        `);
    }

    // Next button
    if (pagination.has_next_page || currentPage < lastPage) {
        $pagination.append(`
            <button class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition" 
                    data-page="${currentPage + 1}">
                Next
            </button>
        `);
    }

    // Add click handlers
    $pagination.find('button').on('click', function() {
        const newPage = parseInt($(this).data('page'));
        if (newPage !== currentPage) {
            currentPage = newPage;
            searchAnime(currentPage);
            $('html, body').animate({ scrollTop: 0 }, 'slow');
        }
    });
}

// Display Results with Animation
function displayResults(animes) {
    const $results = $('#results');
    
    // Filter favorites if necessary
    if (lastSearchParams && lastSearchParams._favorites) {
        animes = animes.filter(async anime => {
            const favorites = await DB.getFavorites();
            return favorites.some(f => f.mal_id === anime.mal_id);
        });
    }
    
    // Show no results message if empty
    if (!animes || animes.length === 0) {
        showNoResults();
        return;
    }
    
    $results.fadeOut(200, function() {
        $results.empty();

        if (currentView === 'grid') {
            $results.removeClass('block').addClass('grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6');
        } else {
            $results.removeClass('grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6').addClass('block');
        }

        animes.forEach((anime, index) => {
            const $template = $(document.getElementById(
                currentView === 'grid' ? 'animeCardTemplate' : 'animeListTemplate'
            ).content.cloneNode(true));

            // Asegurarse de que el botón de Quick Preview siempre esté presente
            if (currentView === 'grid') {
                const $previewButton = $template.find('.quick-preview-btn');
                if (!$previewButton.length) {
                    const $imageContainer = $template.find('.relative.group');
                    $imageContainer.append(`
                        <div class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all duration-300 flex items-center justify-center">
                            <button class="quick-preview-btn opacity-0 group-hover:opacity-100 bg-blue-600 text-white px-4 py-2 rounded transition-all duration-300">
                                Quick Preview
                            </button>
                        </div>
                    `);
                }
            }

            populateTemplate($template, anime);
            
            const $item = $($template);
            $item.hide();
            $results.append($item);
            
            // Staggered animation
            $item.delay(index * 100).fadeIn(500);
        });

        $results.fadeIn(200);
        
        // Refresh favorites after displaying results
        if (Auth.isLoggedIn()) {
            refreshFavorites();
        }
    });
}


// Template Population
function populateTemplate($template, anime) {
    $template.find('img').attr('src', anime.images.jpg.large_image_url);
    $template.find('.title').text(anime.title);
    $template.find('.type').text(anime.type || 'N/A');
    $template.find('.score').text(`★ ${anime.score || 'N/A'}`);
    
    // Asegurar que todos los botones tienen los event listeners correctos
    $template.find('.details-btn').on('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        window.open(anime.url, '_blank');
    });

    $template.find('.quick-preview-btn').on('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        showQuickPreview(anime);
    });
    
    const $container = $template.find('.anime-card, .anime-list-item');
    $container.attr('data-anime-id', anime.mal_id);
    
    // Add hover effects and event listeners
    $container.hover(
        function() { $(this).find('.details-btn, .quick-preview-btn').addClass('scale-105'); },
        function() { $(this).find('.details-btn, .quick-preview-btn').removeClass('scale-105'); }
    );
}

function showQuickPreview(anime) {
    const previewHtml = createQuickPreviewHtml(anime);
    const $preview = $('#quickPreview');
    
    $preview
        .html(previewHtml)
        .removeClass('hidden')
        .addClass('flex fade-in');

    // Inicializar tabs y cargar contenido
    initializePreviewTabs();
    loadEpisodesAndStreaming(anime.mal_id);

    // Event listeners para cerrar
    $preview.on('click', function(e) {
        if (e.target === this) {
            closeQuickPreview();
        }
    });

    $preview.find('.close-preview').on('click', closeQuickPreview);

    // Escape key para cerrar
    $(document).on('keydown.preview', function(e) {
        if (e.key === 'Escape') {
            closeQuickPreview();
        }
    });
}

function closeQuickPreview() {
    const $preview = $('#quickPreview');
    $preview
        .addClass('hidden')
        .removeClass('flex')
        .empty();
    
    // Remover event listeners
    $preview.off('click');
    $(document).off('keydown.preview');
}

function createQuickPreviewHtml(anime) {
    return `
        <div class="fixed inset-0 flex items-center justify-center p-4 bg-black bg-opacity-50">
            <div class="bg-white dark:bg-gray-900 rounded-lg w-full max-w-6xl max-h-[90vh] overflow-hidden">
                <div class="flex justify-between items-start p-4 border-b dark:border-gray-700">
                    <h2 class="text-2xl font-bold dark:text-white">${anime.title}</h2>
                    <button class="close-preview text-gray-500 hover:text-gray-700 dark:text-gray-400 
                                dark:hover:text-gray-200 text-2xl">×</button>
                </div>
                
                <div class="overflow-y-auto p-4" style="max-height: calc(90vh - 4rem);">
                    <div class="flex flex-col md:flex-row gap-4 mb-4">
                        <img src="${anime.images.jpg.large_image_url}" 
                             alt="${anime.title}" 
                             class="w-full md:w-1/3 h-auto object-cover rounded">
                        <div class="flex-1 space-y-4">
                            <div class="grid grid-cols-2 gap-4">
                                <p class="dark:text-white"><strong>Type:</strong> ${anime.type || 'N/A'}</p>
                                <p class="dark:text-white"><strong>Episodes:</strong> ${anime.episodes || 'N/A'}</p>
                                <p class="dark:text-white"><strong>Status:</strong> ${anime.status || 'N/A'}</p>
                                <p class="dark:text-white"><strong>Score:</strong> ${anime.score || 'N/A'}</p>
                            </div>
                            <div class="mt-4">
                                <h3 class="font-bold text-lg mb-2 dark:text-white">Synopsis</h3>
                                <p class="text-gray-600 dark:text-gray-300">
                                    ${anime.synopsis || 'No synopsis available.'}
                                </p>
                            </div>
                        </div>
                    </div>

                    <!-- Tabs para episodios y streaming -->
                    <div class="border-t dark:border-gray-700 pt-4">
                        <div class="flex space-x-4 mb-4">
                            <button class="tab-button active px-4 py-2 rounded-lg bg-blue-600 text-white" 
                                    data-tab="episodes">Episodes</button>
                            <button class="tab-button px-4 py-2 rounded-lg hover:bg-blue-100 dark:hover:bg-gray-700" 
                                    data-tab="streaming">Streaming Links</button>
                        </div>

                        <!-- Contenedor de episodios -->
                        <div id="episodesContent" class="tab-content active">
                            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto p-2">
                                <div class="loading-episodes text-center py-4">
                                    <div class="animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent mx-auto"></div>
                                    <p class="mt-2 dark:text-white">Loading episodes...</p>
                                </div>
                            </div>
                        </div>

                        <!-- Contenedor de links de streaming -->
                        <div id="streamingContent" class="tab-content hidden">
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto p-2">
                                <div class="loading-streaming text-center py-4">
                                    <div class="animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent mx-auto"></div>
                                    <p class="mt-2 dark:text-white">Loading streaming links...</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

async function loadEpisodesAndStreaming(animeId) {
    try {
        // Cargar información de streaming
        const streamingResponse = await fetch(`${JIKAN_API}/anime/${animeId}/streaming`);
        const streamingData = await streamingResponse.json();

        // Cargar episodios
        const episodesResponse = await fetch(`${JIKAN_API}/anime/${animeId}/episodes`);
        const episodesData = await episodesResponse.json();

        // Actualizar contenido de streaming
        const $streamingContent = $('#streamingContent');
        if (streamingData.data && streamingData.data.length > 0) {
            const streamingHtml = streamingData.data.map(link => `
                <a href="${link.url}" target="_blank" 
                   class="flex items-center p-4 bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-lg transition-shadow">
                    <span class="flex-1 dark:text-white">${link.name}</span>
                    <svg class="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                </a>
            `).join('');
            $streamingContent.html(streamingHtml || '<p class="text-center dark:text-white">No official streaming links available.</p>');
        } else {
            $streamingContent.html('<p class="text-center dark:text-white">No official streaming links available.</p>');
        }

        // Actualizar contenido de episodios
        const $episodesContent = $('#episodesContent');
        if (episodesData.data && episodesData.data.length > 0) {
            const episodesHtml = episodesData.data.map(episode => `
                <div class="episode-card bg-white dark:bg-gray-800 rounded-lg shadow p-4 hover:shadow-lg transition-shadow">
                    <h4 class="font-semibold dark:text-white">Episode ${episode.mal_id}</h4>
                    <p class="text-sm text-gray-600 dark:text-gray-300 mb-2 h-12 overflow-hidden">
                        ${episode.title || 'No title'}
                    </p>
                    <div class="flex gap-2">
                        <button class="watch-episode-btn flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 
                                    transition-colors flex items-center justify-center gap-2"
                                data-episode-id="${episode.mal_id}">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                                    d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                            </svg>
                            Watch
                        </button>
                        <button class="episode-info-btn p-2 text-gray-600 hover:text-blue-600 dark:text-gray-400 
                                    dark:hover:text-blue-400 transition-colors"
                                data-episode-id="${episode.mal_id}"
                                title="Episode Information">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </button>
                    </div>
                </div>
            `).join('');
            $episodesContent.html(episodesHtml);

            // Agregar event listeners para los botones de episodios
            $episodesContent.find('.watch-episode-btn').on('click', function() {
                const episodeId = $(this).data('episode-id');
                handlePlayEpisode(episodeId, animeId);
            });

            // Event listeners para los botones de información
            $episodesContent.find('.episode-info-btn').on('click', async function() {
                const episodeId = $(this).data('episode-id');
                try {
                    const response = await fetch(`${JIKAN_API}/anime/${animeId}/episodes/${episodeId}`);
                    const data = await response.json();
                    if (data.data) {
                        showMessage(`Episode ${episodeId}: ${data.data.title}`, 'info');
                    }
                } catch (error) {
                    console.error('Error fetching episode info:', error);
                    showMessage('Error loading episode information', 'error');
                }
            });
        } else {
            $episodesContent.html('<p class="text-center dark:text-white">No episodes information available.</p>');
        }

    } catch (error) {
        console.error('Error loading episodes and streaming:', error);
        $('#episodesContent, #streamingContent').html(
            '<p class="text-center text-red-500">Error loading content. Please try again later.</p>'
        );
    }
}

// Estilos adicionales necesarios
const styles = `
    .episode-card {
        transition: all 0.2s ease-in-out;
    }

    .episode-card:hover {
        transform: translateY(-2px);
    }

    .watch-episode-btn:hover svg {
        transform: scale(1.1);
    }

    .episode-info-btn:hover svg {
        transform: rotate(15deg);
    }

    .episode-card .episode-info-btn,
    .episode-card .watch-episode-btn {
        transition: all 0.2s ease-in-out;
    }
`;

// Agregar estilos al documento
if (!document.getElementById('episodeStyles')) {
    const styleElement = document.createElement('style');
    styleElement.id = 'episodeStyles';
    styleElement.textContent = styles;
    document.head.appendChild(styleElement);
}

// Función para inicializar los tabs
function initializePreviewTabs() {
    $('.tab-button').on('click', function() {
        const tabId = $(this).data('tab');
        
        // Actualizar botones
        $('.tab-button').removeClass('bg-blue-600 text-white').addClass('hover:bg-blue-100 dark:hover:bg-gray-700');
        $(this).addClass('bg-blue-600 text-white').removeClass('hover:bg-blue-100 dark:hover:bg-gray-700');
        
        // Actualizar contenido
        $('.tab-content').addClass('hidden');
        $(`#${tabId}Content`).removeClass('hidden');
    });
}

async function handlePlayEpisode(episodeId, animeId) {
    try {
        // Obtener videos disponibles
        const videosResponse = await fetch(`${JIKAN_API}/anime/${animeId}/videos/episodes`);
        const videosData = await videosResponse.json();
        
        // Obtener información del episodio
        const episodeResponse = await fetch(`${JIKAN_API}/anime/${animeId}/episodes`);
        const episodeData = await episodeResponse.json();

        // Obtener links externos como respaldo
        const externalResponse = await fetch(`${JIKAN_API}/anime/${animeId}/external`);
        const externalData = await externalResponse.json();
        
        if (episodeData.data) {
            // Crear el modal con reproductor y links
            const playerHtml = `
                <div id="videoPlayerModal" class="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4">
                    <div class="bg-white dark:bg-gray-800 w-full max-w-4xl rounded-lg overflow-hidden shadow-xl">
                        <!-- Barra superior -->
                        <div class="flex justify-between items-center bg-blue-600 p-4">
                            <h3 class="text-white font-semibold truncate">
                                Episode ${episodeId} - ${episodeData.data.title || 'No title'}
                            </h3>
                            <button id="closePlayer" class="text-white hover:text-gray-200 transition-colors">
                                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        
                        <!-- Contenedor del reproductor -->
                        <div class="relative bg-black" style="padding-top: 56.25%">
                            ${videosData.data?.episodes?.length > 0 ? `
                                <iframe
                                    src="${videosData.data.episodes.find(ep => ep.mal_id === episodeId)?.url || videosData.data.episodes[0].url}"
                                    class="absolute inset-0 w-full h-full"
                                    allowfullscreen
                                    frameborder="0"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                ></iframe>
                            ` : `
                                <div class="absolute inset-0 flex items-center justify-center bg-gray-900">
                                    <div class="text-center text-gray-400">
                                        <svg class="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                                  d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                                  d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        <p>No video available</p>
                                    </div>
                                </div>
                            `}
                        </div>

                        <!-- Sección de videos disponibles -->
                        <div class="p-4 overflow-y-auto max-h-60">
                            ${videosData.data?.episodes?.length > 0 ? `
                                <div class="mb-4">
                                    <h4 class="text-lg font-semibold mb-2 dark:text-white">Available Episodes</h4>
                                    <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                        ${videosData.data.episodes.map(video => `
                                            <button class="episode-button p-2 text-sm bg-gray-100 dark:bg-gray-700 
                                                         rounded hover:bg-blue-100 dark:hover:bg-blue-900 
                                                         transition-colors truncate
                                                         ${video.mal_id === episodeId ? 'bg-blue-100 dark:bg-blue-900' : ''}"
                                                    data-url="${video.url}"
                                                    title="${video.title}">
                                                ${video.episode} - ${video.title}
                                            </button>
                                        `).join('')}
                                    </div>
                                </div>
                            ` : ''}

                            <!-- Trailers disponibles -->
                            ${videosData.data?.promo?.length > 0 ? `
                                <div class="mb-4">
                                    <h4 class="text-lg font-semibold mb-2 dark:text-white">Trailers</h4>
                                    <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                        ${videosData.data.promo.map(video => `
                                            <button class="trailer-button p-2 text-sm bg-gray-100 dark:bg-gray-700 
                                                         rounded hover:bg-blue-100 dark:hover:bg-blue-900 
                                                         transition-colors truncate"
                                                    data-url="${video.trailer.embed_url}"
                                                    title="${video.title}">
                                                ${video.title}
                                            </button>
                                        `).join('')}
                                    </div>
                                </div>
                            ` : ''}

                            <!-- Links externos como respaldo -->
                            <div class="mt-4">
                                <h4 class="text-lg font-semibold mb-2 dark:text-white">External Links</h4>
                                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    ${externalData.data?.map(link => `
                                        <a href="${link.url}" target="_blank" 
                                           class="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 
                                                  rounded hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
                                            <span class="flex items-center dark:text-white text-sm">
                                                <svg class="w-4 h-4 mr-2 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                                                          d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                                </svg>
                                                ${link.name}
                                            </span>
                                        </a>
                                    `).join('') || '<p class="text-gray-500 dark:text-gray-400 text-center">No external links available</p>'}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            // Agregar el modal al DOM
            $('body').append(playerHtml);

            // Event listeners
            $('#closePlayer').on('click', () => {
                $('#videoPlayerModal').remove();
                $(document).off('keydown.videoPlayer');
            });

            // Cambiar episodio/trailer
            $('.episode-button, .trailer-button').on('click', function() {
                const videoUrl = $(this).data('url');
                const $iframe = $('#videoPlayerModal iframe');
                
                // Actualizar la URL del iframe
                if ($iframe.length) {
                    $iframe.attr('src', videoUrl);
                }

                // Actualizar estilo del botón activo
                $(this).siblings().removeClass('bg-blue-100 dark:bg-blue-900');
                $(this).addClass('bg-blue-100 dark:bg-blue-900');
            });

            // Manejar tecla Escape
            $(document).on('keydown.videoPlayer', (e) => {
                if (e.key === 'Escape') {
                    $('#videoPlayerModal').remove();
                    $(document).off('keydown.videoPlayer');
                }
            });

            // Clic fuera del modal para cerrar
            $('#videoPlayerModal').on('click', function(e) {
                if (e.target === this) {
                    $(this).remove();
                    $(document).off('keydown.videoPlayer');
                }
            });

            showMessage(`Playing episode ${episodeId}`, 'info');
        } else {
            showMessage('Episode information not available', 'warning');
        }
    } catch (error) {
        console.error('Error loading episode:', error);
        showMessage('Error loading episode', 'error');
    }
}

// Agregar estilos necesarios para el reproductor
const playerStyles = `
    .video-player-modal {
        background: rgba(0, 0, 0, 0.9);
    }
    
    .video-progress {
        cursor: pointer;
    }
    
    .video-progress:hover .progress-bar {
        height: 4px;
    }
    
    .control-button {
        transition: all 0.2s ease;
    }
    
    .control-button:hover {
        transform: scale(1.1);
    }
`;

// Agregar estilos al documento
$('<style>').text(playerStyles).appendTo('head');

// Handle Watch Button Click
async function handleWatch(anime) {
    try {
        // Fetch full anime details to get streaming links
        const response = await fetch(`${JIKAN_API}/anime/${anime.mal_id}/full`);
        const data = await response.json();
        
        if (data.data.streaming_links?.length > 0) {
            // Use first available streaming link
            const streamUrl = data.data.streaming_links[0].url;
            VideoPlayer.showPlayer(streamUrl, anime.title);
        } else {
            showMessage('No streaming links available', 'warning');
        }
    } catch (error) {
        console.error('Error fetching streaming links:', error);
        showMessage('Error loading streaming information', 'error');
    }
}

// Toggle Favorite
async function toggleFavorite(anime) {
    if (!Auth.isLoggedIn()) {
        showMessage('Please login to add favorites', 'warning');
        return;
    }

    try {
        const favorites = await DB.getFavorites();
        const isFavorite = favorites.some(f => f.mal_id === anime.mal_id);
        
        if (isFavorite) {
            await DB.removeFavorite(anime.mal_id);
            showMessage('Removed from favorites', 'success');
        } else {
            await DB.addFavorite({
                mal_id: anime.mal_id,
                title: anime.title,
                image_url: anime.images.jpg.large_image_url,
                type: anime.type,
                score: anime.score
            });
            showMessage('Added to favorites', 'success');
        }
        
        await refreshFavorites();
    } catch (error) {
        console.error('Error toggling favorite:', error);
        showMessage('Error updating favorites', 'error');
    }
}

// Collect Search Parameters
function collectSearchParams() {
    const params = {
        q: $('#searchInput').val(),
        type: $('#typeFilter').val(),
        status: $('#statusFilter').val(),
        rating: $('#ratingFilter').val(),
        order_by: 'start_date', // Siempre ordenar por fecha
        sort: 'desc', // Más recientes primero
        min_score: $('#scoreSlider').slider('values', 0),
        max_score: $('#scoreSlider').slider('values', 1),
    };

    // Solo agregar order_by del select si específicamente se selecciona
    const selectedSort = $('#sortFilter').val();
    if (selectedSort && selectedSort !== 'start_date') {
        params.order_by = selectedSort;
    }

    // Si el filtro de favoritos está activo
    if ($('#favoritesFilter').val() === 'favorites') {
        params._favorites = true;
    }

    return params;
}

function setupModalHandlers() {
    // Close modal when clicking the close button or outside
    document.querySelectorAll('.close-modal').forEach(button => {
        button.addEventListener('click', function() {
            closeModal(this.closest('.modal, [id$="Modal"]').id);
        });
    });

    // Close modal when clicking outside
    document.querySelectorAll('.modal, [id$="Modal"]').forEach(modal => {
        modal.addEventListener('click', function(e) {
            if (e.target === this) {
                closeModal(this.id);
            }
        });
    });

    // Close modals with Escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal, [id$="Modal"]').forEach(modal => {
                if (!modal.classList.contains('hidden')) {
                    closeModal(modal.id);
                }
            });
        }
    });
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        // Reset form if exists
        const form = modal.querySelector('form');
        if (form) form.reset();
    }
}

function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
}

// Initialize UI Elements
function initializeUI() {
    // Initialize jQuery UI elements
    $("#scoreSlider").slider({
        range: true,
        min: 0,
        max: 10,
        values: [0, 10],
        step: 0.1,
        slide: function(event, ui) {
            $("#scoreMin").text(ui.values[0]);
            $("#scoreMax").text(ui.values[1]);
        }
    });

    // Initialize autocomplete with improved behavior
    $("#searchInput").autocomplete({
        source: async function(request, response) {
            try {
                const res = await fetch(`${JIKAN_API}/anime?q=${request.term}&limit=5&order_by=start_date&sort=desc`);
                const data = await res.json();
                const animes = data.data.map(anime => ({
                    label: anime.title,
                    value: anime.title,
                    id: anime.mal_id,
                    data: anime
                }));

                // Check for exact match
                const exactMatch = animes.find(a => 
                    a.label.toLowerCase() === request.term.toLowerCase()
                );

                if (exactMatch) {
                    // Si hay coincidencia exacta, mostrar solo ese resultado
                    response([exactMatch]);
                    // Y actualizar la búsqueda principal
                    displayResults([exactMatch.data]);
                } else {
                    response(animes);
                }
            } catch (error) {
                console.error('Autocomplete error:', error);
                response([]);
            }
        },
        select: function(event, ui) {
            // Cuando se selecciona un anime, mostrar solo ese
            displayResults([ui.item.data]);
        },
        minLength: 2,
        classes: {
            "ui-autocomplete": "dark:bg-gray-800 dark:text-white dark:border-gray-600"
        }
    });

    // Initialize tooltips
    $('[data-tooltip]').tooltip({
        content: function() {
            return $(this).attr('data-tooltip');
        },
        position: {
            my: "center bottom-20",
            at: "center top"
        },
        classes: {
            "ui-tooltip": "dark:bg-gray-800 dark:text-white dark:border-gray-600"
        }
    });

    // Initialize view toggle
    updateViewToggle(currentView);
    setupModalHandlers();
}

// Show No Results Message
function showNoResults() {
    const $results = $('#results');
    $results.empty().append(`
        <div class="col-span-full text-center py-12">
            <div class="text-4xl mb-4">😔</div>
            <h3 class="text-xl font-bold mb-2 dark:text-white">No results found</h3>
            <p class="text-gray-600 dark:text-gray-400">Try with different filters or search terms</p>
        </div>
    `);
}

// Show Message
function showMessage(message, type = 'info') {
    const colors = {
        success: 'bg-green-500',
        error: 'bg-red-500',
        warning: 'bg-yellow-500',
        info: 'bg-blue-500'
    };

    const $message = $('<div>')
        .addClass(`fixed top-4 right-4 ${colors[type]} text-white px-6 py-3 rounded shadow-lg z-50`)
        .text(message);

    $('body').append($message);
    
    setTimeout(() => {
        $message.fadeOut(300, function() {
            $(this).remove();
        });
    }, 3000);
}

// Update Active Filters
function updateActiveFilters(params) {
    const $filters = $('#activeFilters');
    $filters.empty();

    Object.entries(params).forEach(([key, value]) => {
        if (value && key !== 'page' && key !== 'limit' && key !== 'sort') {
            $filters.append(`
                <span class="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 px-3 py-1 rounded-full text-sm flex items-center gap-2">
                    ${key}: ${value}
                    <button class="remove-filter" data-filter="${key}">×</button>
                </span>
            `);
        }
    });

    // Add remove filter handlers
    $('.remove-filter').on('click', function() {
        const filter = $(this).data('filter');
        $(`#${filter}Filter`).val('');
        handleSearch();
    });
}

// View Toggle Update
function updateViewToggle(view) {
    if (view === 'grid') {
        $('#gridView').addClass('bg-blue-600').removeClass('bg-gray-600');
        $('#listView').addClass('bg-gray-600').removeClass('bg-blue-600');
    } else {
        $('#listView').addClass('bg-blue-600').removeClass('bg-gray-600');
        $('#gridView').addClass('bg-gray-600').removeClass('bg-blue-600');
    }
}

// Handle Search
function handleSearch() {
    currentPage = 1;
    const params = collectSearchParams();
    lastSearchParams = params;
    searchAnime(currentPage);
}

// Función para refrescar los favoritos
async function refreshFavorites() {
    try {
        if (!Auth.isLoggedIn()) return;
        
        const favorites = await DB.getFavorites();
        const favoriteIds = new Set(favorites.map(f => f.mal_id));
        
        // Actualizar botones de favoritos en la lista/grid principal
        $('.favorite-btn').each(function() {
            const animeId = parseInt($(this).closest('[data-anime-id]').data('animeId'));
            if (favoriteIds.has(animeId)) {
                $(this).addClass('bg-red-500 text-white').removeClass('bg-red-100 text-red-600');
            } else {
                $(this).removeClass('bg-red-500 text-white').addClass('bg-red-100 text-red-600');
            }
        });

        // Actualizar la lista de favoritos en el modal de perfil
        const $favoritesList = $('#favoritesList');
        if ($favoritesList.length) {
            $favoritesList.empty();
            
            favorites.forEach(favorite => {
                const favoriteCard = `
                    <div class="favorite-card bg-white dark:bg-gray-700 rounded-lg shadow overflow-hidden">
                        <img src="${favorite.image_url}" alt="${favorite.title}" 
                             class="w-full h-32 object-cover">
                        <div class="p-2">
                            <h4 class="text-sm font-semibold truncate dark:text-white">${favorite.title}</h4>
                            <div class="flex justify-between items-center mt-2">
                                <span class="text-xs dark:text-gray-300">${favorite.type || 'N/A'}</span>
                                <button class="remove-favorite text-red-500 hover:text-red-700" 
                                        data-anime-id="${favorite.mal_id}">
                                    ×
                                </button>
                            </div>
                        </div>
                    </div>
                `;
                $favoritesList.append(favoriteCard);
            });

            // Actualizar los gráficos si existen
            updateProfileCharts(favorites);
        }
    } catch (error) {
        console.error('Error refreshing favorites:', error);
        showMessage('Error updating favorites display', 'error');
    }
}

// Función para actualizar los gráficos del perfil
function updateProfileCharts(favorites) {
    try {
        // Asegurarse de que tenemos favoritos para mostrar
        if (!favorites || !favorites.length) return;

        // Configuración del tema
        const isDark = document.documentElement.classList.contains('dark');
        const textColor = isDark ? 'white' : 'black';

        // Gráfico de tipos
        const typeData = _.groupBy(favorites, 'type');
        const typeChartElement = document.getElementById('typeChart');
        
        if (typeChartElement) {
            // Destruir el gráfico existente si lo hay
            const existingChart = Chart.getChart(typeChartElement);
            if (existingChart) {
                existingChart.destroy();
            }

            new Chart(typeChartElement, {
                type: 'pie',
                data: {
                    labels: Object.keys(typeData),
                    datasets: [{
                        data: Object.values(typeData).map(group => group.length),
                        backgroundColor: [
                            '#3B82F6', '#10B981', '#F59E0B', '#EF4444',
                            '#8B5CF6', '#EC4899', '#6366F1'
                        ]
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'right',
                            labels: {
                                color: textColor,
                                font: {
                                    size: 12
                                }
                            }
                        },
                        title: {
                            display: true,
                            text: 'Distribution by Type',
                            color: textColor
                        }
                    }
                }
            });
        }

        // Gráfico de puntuaciones
        const scoreData = favorites.reduce((acc, fav) => {
            if (fav.score) {
                const score = Math.floor(fav.score);
                acc[score] = (acc[score] || 0) + 1;
            }
            return acc;
        }, {});

        const scoreChartElement = document.getElementById('scoreChart');
        if (scoreChartElement) {
            // Destruir el gráfico existente si lo hay
            const existingChart = Chart.getChart(scoreChartElement);
            if (existingChart) {
                existingChart.destroy();
            }

            new Chart(scoreChartElement, {
                type: 'bar',
                data: {
                    labels: Object.keys(scoreData),
                    datasets: [{
                        label: 'Number of Anime',
                        data: Object.values(scoreData),
                        backgroundColor: '#3B82F6',
                        borderColor: '#2563EB',
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                color: textColor,
                                stepSize: 1
                            },
                            grid: {
                                color: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
                            }
                        },
                        x: {
                            ticks: {
                                color: textColor
                            },
                            grid: {
                                color: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
                            }
                        }
                    },
                    plugins: {
                        legend: {
                            labels: {
                                color: textColor
                            }
                        },
                        title: {
                            display: true,
                            text: 'Score Distribution',
                            color: textColor
                        }
                    }
                }
            });
        }
    } catch (error) {
        console.error('Error updating charts:', error);
        showMessage('Error updating profile charts', 'error');
    }
}

// Event listener para eliminar favoritos desde el perfil
$(document).on('click', '.remove-favorite', async function() {
    const animeId = $(this).data('anime-id');
    try {
        await DB.removeFavorite(animeId);
        await refreshFavorites();
        showMessage('Removed from favorites', 'success');
    } catch (error) {
        console.error('Error removing favorite:', error);
        showMessage('Error removing favorite', 'error');
    }
});

// Asegurarse de que los favoritos se actualicen cuando cambia el estado de autenticación
window.addEventListener('authStateChanged', refreshFavorites);

// Llamar a refreshFavorites después de login exitoso
async function handleLogin(username, password) {
    try {
        await Auth.login(username, password);
        $('#loginModal').addClass('hidden').removeClass('flex');
        showMessage('Login successful!', 'success');
        await refreshFavorites(); // Actualizar favoritos después del login
    } catch (error) {
        showMessage(error.message, 'error');
    }
}