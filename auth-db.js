let db = null;

const DB = {
    async init() {
        return new Promise((resolve, reject) => {
            if (db) {
                resolve(db);
                return;
            }

            const request = indexedDB.open('animeDB', 1);

            request.onerror = () => {
                console.error('Error opening database:', request.error);
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
                }

                if (!database.objectStoreNames.contains('favorites')) {
                    const favStore = database.createObjectStore('favorites', { keyPath: 'mal_id' });
                    favStore.createIndex('userId', 'userId', { unique: false });
                }
            };
        });
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
    }
};

const Auth = {
    async register(username, email, password) {
        console.log('Starting registration process...');
        
        try {
            const hashedPassword = await this._hashPassword(password);
            const database = await DB.init();
            
            return new Promise((resolve, reject) => {
                const transaction = database.transaction(['users'], 'readwrite');
                const store = transaction.objectStore('users');
                
                transaction.oncomplete = () => {
                    console.log('Transaction completed successfully');
                };
                
                transaction.onerror = (event) => {
                    console.error('Transaction error:', event.target.error);
                    reject(new Error('Transaction failed'));
                };
                
                try {
                    const user = {
                        username,
                        email,
                        password: hashedPassword,
                        createdAt: new Date().toISOString()
                    };
                    
                    store.add(user);
                    
                    this._setCurrentUser(user);
                    resolve(user);
                    console.log('Registration successful');
                } catch (error) {
                    console.error('Error during store operations:', error);
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

export { DB, Auth };