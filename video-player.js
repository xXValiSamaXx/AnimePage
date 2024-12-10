const VideoPlayer = {
    createPlayerContainer() {
        const container = document.createElement('div');
        container.id = 'videoPlayerModal';
        container.className = 'fixed inset-0 bg-black bg-opacity-75 hidden items-center justify-center z-50';
        container.innerHTML = `
            <div class="bg-white dark:bg-gray-800 rounded-lg p-4 max-w-4xl w-full mx-4">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-xl font-bold dark:text-white" id="videoTitle"></h3>
                    <button class="close-video text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">✕</button>
                </div>
                <div class="relative" style="padding-top: 56.25%">
                    <iframe id="videoFrame"
                            class="absolute inset-0 w-full h-full"
                            frameborder="0"
                            allowfullscreen>
                    </iframe>
                </div>
            </div>
        `;

        document.body.appendChild(container);
        
        // Event Listeners
        const closeBtn = container.querySelector('.close-video');
        closeBtn.addEventListener('click', () => this.hidePlayer());
        
        container.addEventListener('click', (e) => {
            if (e.target === container) this.hidePlayer();
        });
    },

    showPlayer(videoUrl, title) {
        const container = document.getElementById('videoPlayerModal') || this.createPlayerContainer();
        const videoFrame = container.querySelector('#videoFrame');
        const videoTitle = container.querySelector('#videoTitle');
        
        // Procesar URL para diferentes proveedores
        let embedUrl = this.getEmbedUrl(videoUrl);
        
        videoFrame.src = embedUrl;
        videoTitle.textContent = title;
        container.classList.remove('hidden');
        container.classList.add('flex');
    },

    hidePlayer() {
        const container = document.getElementById('videoPlayerModal');
        if (container) {
            container.classList.add('hidden');
            container.classList.remove('flex');
            const videoFrame = container.querySelector('#videoFrame');
            videoFrame.src = '';
        }
    },

    getEmbedUrl(url) {
        // Procesar diferentes fuentes de video
        if (url.includes('youtube.com') || url.includes('youtu.be')) {
            const videoId = this.getYoutubeId(url);
            return `https://www.youtube.com/embed/${videoId}`;
        }
        // Agregar más proveedores según sea necesario
        
        return url; // Si no coincide con ningún proveedor conocido
    },

    getYoutubeId(url) {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    }
};

export { VideoPlayer };