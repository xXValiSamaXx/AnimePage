const DEFAULT_PROFILE_IMAGE = "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT9ZAV6OLHHc8z7I4OaVD0ljzGdeFP0tGreDi3yMFwLBZRXWt7Nh93hC8uRt-UnawErZBw&usqp=CAU";

let dbInitPromise = null;
let db = null; // Add this line to declare the db variable

const DB = {
    async init() {
        if (dbInitPromise) return dbInitPromise;

        dbInitPromise = new Promise((resolve, reject) => {
            if (db) {
                resolve(db);
                return;
            }

            const request = indexedDB.open('animeDB', 2);

            request.onerror = () => {
                console.error('Error opening database:', request.error);
                dbInitPromise = null; // Reset promise on error
                reject(request.error);
            };

            request.onsuccess = (event) => {
                db = event.target.result;
                resolve(db);
            };

            request.onupgradeneeded = (event) => {
                const database = event.target.result;

                if (!database.objectStoreNames.contains('users')) {
                    const userStore = database.createObjectStore('users', { keyPath: 'username' });
                    userStore.createIndex('username_idx', 'username', { unique: true });
                    userStore.createIndex('email', 'email', { unique: true });
                    userStore.createIndex('profileImage', 'profileImage', { unique: false });
                }

                if (!database.objectStoreNames.contains('favorites')) {
                    const favStore = database.createObjectStore('favorites', { keyPath: 'mal_id' });
                    favStore.createIndex('userId', 'userId', { unique: false });
                }
            };
        });

        return dbInitPromise;
    },
    
    async addFavorite(animeData) {
        const user = Auth.getCurrentUser();
        if (!user) throw new Error('User must be logged in');

        const database = await this.init();
        return new Promise((resolve, reject) => {
            const transaction = database.transaction(['favorites'], 'readwrite');
            const store = transaction.objectStore('favorites');

            animeData.userId = user.username;
            const request = store.put(animeData);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    },

    async removeFavorite(mal_id) {
        const database = await this.init();
        return new Promise((resolve, reject) => {
            const transaction = database.transaction(['favorites'], 'readwrite');
            const store = transaction.objectStore('favorites');

            const request = store.delete(mal_id);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    },

    async getFavorites() {
        const user = Auth.getCurrentUser();
        if (!user) throw new Error('User must be logged in');

        const database = await this.init();
        return new Promise((resolve, reject) => {
            const transaction = database.transaction(['favorites'], 'readonly');
            const store = transaction.objectStore('favorites');
            const index = store.index('userId');

            const request = index.getAll(user.username);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    // Nuevo método para actualizar la imagen de perfil
    async updateProfileImage(username, imageData) {
        const database = await this.init();
        return new Promise((resolve, reject) => {
            const transaction = database.transaction(['users'], 'readwrite');
            const store = transaction.objectStore('users');

            const request = store.get(username);
            request.onsuccess = () => {
                const user = request.result;
                if (!user) {
                    reject(new Error('User not found'));
                    return;
                }

                user.profileImage = imageData;
                const updateRequest = store.put(user);
                updateRequest.onsuccess = () => {
                    Auth._setCurrentUser(user);
                    resolve(user);
                };
                updateRequest.onerror = () => reject(updateRequest.error);
            };
            request.onerror = () => reject(request.error);
        });
    }
};

const Auth = {
    async register(username, email, password, profileImage = null) {
        console.log('Starting registration process...');
        
        try {
            const hashedPassword = await this._hashPassword(password);
            const database = await DB.init();
            
            return new Promise((resolve, reject) => {
                try {
                    const transaction = database.transaction(['users'], 'readwrite');
                    const store = transaction.objectStore('users');
                    
                    const user = {
                        username,
                        email,
                        password: hashedPassword,
                        profileImage: profileImage || DEFAULT_PROFILE_IMAGE,
                        createdAt: new Date().toISOString()
                    };
    
                    transaction.oncomplete = () => {
                        console.log('Transaction completed successfully');
                        this._setCurrentUser(user);
                        resolve(user);
                    };
                    
                    transaction.onerror = (event) => {
                        console.error('Transaction error:', event.target.error);
                        reject(event.target.error);
                    };
    
                    const request = store.add(user);
                    request.onerror = (event) => {
                        console.error('Store error:', event.target.error);
                        reject(event.target.error);
                    };
                } catch (error) {
                    console.error('Error during transaction:', error);
                    reject(error);
                }
            });
        } catch (error) {
            console.error('Registration error:', error);
            throw error;
        }
    },

    async login(username, password) {
        const database = await DB.init();
        return new Promise(async (resolve, reject) => {
            const transaction = database.transaction(['users'], 'readonly');
            const store = transaction.objectStore('users');

            const request = store.get(username);
            
            request.onsuccess = async () => {
                const user = request.result;
                if (!user) {
                    reject(new Error('User not found'));
                    return;
                }

                const hashedPassword = await this._hashPassword(password);
                if (user.password !== hashedPassword) {
                    reject(new Error('Invalid password'));
                    return;
                }

                this._setCurrentUser(user);
                resolve(user);
            };

            request.onerror = () => reject(request.error);
        });
    },

    logout() {
        localStorage.removeItem('currentUser');
        window.dispatchEvent(new Event('authStateChanged'));
    },

    getCurrentUser() {
        const userStr = localStorage.getItem('currentUser');
        return userStr ? JSON.parse(userStr) : null;
    },

    isLoggedIn() {
        return !!this.getCurrentUser();
    },

    _setCurrentUser(user) {
        const userToStore = { ...user };
        delete userToStore.password;
        localStorage.setItem('currentUser', JSON.stringify(userToStore));
        window.dispatchEvent(new Event('authStateChanged'));
    },

    async _hashPassword(password) {
        const encoder = new TextEncoder();
        const data = encoder.encode(password);
        const hash = await crypto.subtle.digest('SHA-256', data);
        return Array.from(new Uint8Array(hash))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    }
};

window.addEventListener('unhandledrejection', function(event) {
    console.error('Unhandled promise rejection:', event.reason);
});

export { DB, Auth, DEFAULT_PROFILE_IMAGE };