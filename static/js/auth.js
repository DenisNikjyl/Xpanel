// Xpanel - New Authentication System

class XpanelAuth {
    constructor() {
        this.token = null;
        this.user = null;
        this.init();
    }

    init() {
        this.loadStoredAuth();
    }

    // Load authentication data from storage
    loadStoredAuth() {
        this.token = localStorage.getItem('xpanel_token');
        const userData = localStorage.getItem('xpanel_user');
        
        if (userData) {
            try {
                this.user = JSON.parse(userData);
            } catch (e) {
                this.user = null;
            }
        }
    }

    // Save authentication data to storage
    saveAuth(token, user) {
        this.token = token;
        this.user = user;
        
        localStorage.setItem('xpanel_token', token);
        localStorage.setItem('xpanel_user', JSON.stringify(user));
        
        // Also save to old token key for compatibility
        localStorage.setItem('token', token);
    }

    // Clear authentication data
    clearAuth() {
        this.token = null;
        this.user = null;
        
        localStorage.removeItem('xpanel_token');
        localStorage.removeItem('xpanel_user');
        localStorage.removeItem('token');
    }

    // Check if user is authenticated
    isAuthenticated() {
        return !!(this.token && this.user);
    }

    // Get authorization headers
    getAuthHeaders() {
        if (!this.token) {
            return {
                'Content-Type': 'application/json'
            };
        }

        return {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json'
        };
    }

    // Login user
    async login(username, password) {
        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                this.saveAuth(data.access_token, data.user);
                return { success: true, user: data.user };
            } else {
                throw new Error(data.message || 'Login failed');
            }
        } catch (error) {
            console.error('Login error:', error);
            throw error;
        }
    }

    // Register user
    async register(username, password, role = 'user') {
        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password, role })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                return { success: true, user: data.user };
            } else {
                throw new Error(data.message || 'Registration failed');
            }
        } catch (error) {
            console.error('Registration error:', error);
            throw error;
        }
    }

    // Verify token
    async verifyToken() {
        if (!this.token) {
            return false;
        }

        try {
            const response = await fetch('/api/auth/verify', {
                method: 'GET',
                headers: this.getAuthHeaders()
            });

            const data = await response.json();

            if (response.ok && data.success) {
                this.user = data.user;
                localStorage.setItem('xpanel_user', JSON.stringify(data.user));
                return true;
            } else {
                this.clearAuth();
                return false;
            }
        } catch (error) {
            console.error('Token verification error:', error);
            this.clearAuth();
            return false;
        }
    }

    // Logout user
    async logout() {
        try {
            if (this.token) {
                await fetch('/api/auth/logout', {
                    method: 'POST',
                    headers: this.getAuthHeaders()
                });
            }
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            this.clearAuth();
            window.location.href = '/login';
        }
    }

    // Make authenticated API request
    async apiRequest(url, options = {}) {
        const config = {
            headers: this.getAuthHeaders(),
            ...options
        };

        try {
            const response = await fetch(url, config);

            // Handle authentication errors
            if (response.status === 401 || response.status === 422) {
                console.log('Authentication failed, redirecting to login');
                this.clearAuth();
                window.location.href = '/login';
                return null;
            }

            return response;
        } catch (error) {
            console.error('API request error:', error);
            throw error;
        }
    }

    // Require authentication (redirect if not authenticated)
    requireAuth() {
        if (!this.isAuthenticated()) {
            console.log('Authentication required, redirecting to login');
            window.location.href = '/login';
            return false;
        }
        return true;
    }

    // Initialize authentication on page load
    async initAuth() {
        // Check if we have a token
        if (this.token) {
            // Verify token is still valid
            const isValid = await this.verifyToken();
            if (!isValid) {
                console.log('Token invalid, redirecting to login');
                window.location.href = '/login';
                return false;
            }
        } else {
            // No token, check if we're on a protected page
            const currentPath = window.location.pathname;
            const protectedPaths = ['/dashboard', '/admin'];
            
            if (protectedPaths.some(path => currentPath.startsWith(path))) {
                console.log('Protected page accessed without token, redirecting to login');
                window.location.href = '/login';
                return false;
            }
        }
        
        return true;
    }
}

// Create global auth instance
window.xpanelAuth = new XpanelAuth();

// Auto-initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
    await window.xpanelAuth.initAuth();
});

// Export for compatibility
window.XpanelAuth = XpanelAuth;
