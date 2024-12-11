// Importar módulos
import { Auth, DB } from './auth-db.js';
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
        try {
            const username = this.username.value;
            const password = this.password.value;
            await Auth.login(username, password);
            $('#loginModal').addClass('hidden').removeClass('flex');
            showMessage('Login successful!', 'success');
        } catch (error) {
            showMessage(error.message, 'error');
        }
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

// Manejo de la imagen de perfil en el registro
function initializeProfileImageHandlers() {
    const uploadImageBtn = document.getElementById('uploadImageBtn');
    const profileImageInput = document.getElementById('profileImage');
    const previewImage = document.getElementById('previewImage');
    
    if (uploadImageBtn && profileImageInput) {
        uploadImageBtn.addEventListener('click', function() {
            profileImageInput.click();
        });

        profileImageInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    if (previewImage) {
                        previewImage.src = e.target.result;
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
                const profileImageInput = document.getElementById('profileImage');
                const previewImage = document.getElementById('previewImage');
                
                let profileImage = previewImage?.src || "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT9ZAV6OLHHc8z7I4OaVD0ljzGdeFP0tGreDi3yMFwLBZRXWt7Nh93hC8uRt-UnawErZBw&usqp=CAU";

                // Registrar usuario
                await Auth.register(username, email, password, profileImage);
                
                // Cerrar modal y mostrar mensaje
                const registerModal = document.getElementById('registerModal');
                if (registerModal) {
                    registerModal.classList.add('hidden');
                    registerModal.classList.remove('flex');
                }
                
                showMessage('Registration successful!', 'success');
                
                // Actualizar UI
                updateAuthUI();
            } catch (error) {
                showMessage(error.message, 'error');
            }
        });
    }
}

// Actualizar UI cuando cambia el estado de autenticación
function updateAuthUI() {
    const isLoggedIn = Auth.isLoggedIn();
    const user = Auth.getCurrentUser();

    const loggedInContent = document.querySelector('.logged-in-content');
    const loggedOutContent = document.querySelector('.logged-out-content');
    const usernameDisplay = document.querySelector('.username-display');
    const userAvatar = document.getElementById('userAvatar');

    if (loggedInContent) loggedInContent.classList.toggle('hidden', !isLoggedIn);
    if (loggedOutContent) loggedOutContent.classList.toggle('hidden', isLoggedIn);

    if (isLoggedIn && user) {
        if (usernameDisplay) usernameDisplay.textContent = user.username;
        if (userAvatar) {
            userAvatar.src = user.profileImage || "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT9ZAV6OLHHc8z7I4OaVD0ljzGdeFP0tGreDi3yMFwLBZRXWt7Nh93hC8uRt-UnawErZBw&usqp=CAU";
        }
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
        let data;
        
        // Si hay parámetros de búsqueda, usar la búsqueda normal
        if (lastSearchParams && (lastSearchParams.q || lastSearchParams.type || lastSearchParams.status || 
            lastSearchParams.rating || lastSearchParams.genres || lastSearchParams.genres_exclude)) {
            const params = lastSearchParams;
            params.page = page;
            params.limit = 12;
            
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
            // Si no hay parámetros, mostrar la temporada actual
            url = `${JIKAN_API}/seasons/now?page=${page}&limit=12`;
        }

        const response = await fetch(url);
        data = await response.json();

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
        $template.find('.details-btn').on('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        window.open(anime.url, '_blank');
    });
    
    const $container = $template.find('.anime-card, .anime-list-item');
    $container.attr('data-anime-id', anime.mal_id);
    
    // Add hover effects and event listeners
    $container.hover(
        function() { $(this).find('.details-btn').addClass('scale-105'); },
        function() { $(this).find('.details-btn').removeClass('scale-105'); }
    );
}

function showQuickPreview(anime) {
    const previewHtml = createQuickPreviewHtml(anime);
    const $preview = $('#quickPreview');
    
    $preview
        .html(previewHtml)
        .removeClass('hidden')
        .addClass('flex fade-in');

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
        <div class="bg-white dark:bg-gray-900 rounded-lg max-w-4xl w-full mx-4 p-6 shadow-xl">
            <div class="flex justify-between items-start mb-4">
                <h2 class="text-2xl font-bold dark:text-white">${anime.title}</h2>
                <button class="close-preview text-gray-500 hover:text-gray-700 dark:text-gray-400 
                              dark:hover:text-gray-200 text-2xl">×</button>
            </div>
            <div class="flex flex-col md:flex-row gap-4">
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
                        <p class="text-gray-600 dark:text-gray-300 line-clamp-4">
                            ${anime.synopsis || 'No synopsis available.'}
                        </p>
                    </div>
                    <div class="flex gap-2 mt-4">
                        <a href="${anime.url}" target="_blank" 
                           class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors">
                            View on MAL
                        </a>
                        ${anime.trailer ? `
                            <button class="watch-preview bg-green-600 text-white px-4 py-2 rounded 
                                         hover:bg-green-700 transition-colors">
                                Watch Trailer
                            </button>
                        ` : ''}
                    </div>
                </div>
            </div>
        </div>
    `;
}

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
        order_by: $('#sortFilter').val(),
        sort: 'desc',
        min_score: $('#scoreSlider').slider('values', 0),
        max_score: $('#scoreSlider').slider('values', 1),
    };

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

    // Initialize autocomplete
    $("#searchInput").autocomplete({
        source: async function(request, response) {
            try {
                const res = await fetch(`${JIKAN_API}/anime?q=${request.term}&limit=5`);
                const data = await res.json();
                response(data.data.map(anime => ({
                    label: anime.title,
                    value: anime.title,
                    id: anime.mal_id
                })));
            } catch (error) {
                console.error('Autocomplete error:', error);
                response([]);
            }
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