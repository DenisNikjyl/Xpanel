// Xpanel - API Client

class XpanelAPI {
    constructor() {
        this.baseURL = '';
        this.token = XpanelUtils.getAuthToken();
    }

    // Set authentication token
    setToken(token) {
        this.token = token;
        XpanelUtils.setAuthToken(token);
    }

    // Get headers for authenticated requests
    getHeaders() {
        const headers = {
            'Content-Type': 'application/json'
        };
        
        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }
        
        return headers;
    }

    // Make API request
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}/api${endpoint}`;
        const config = {
            headers: this.getHeaders(),
            ...options
        };

        try {
            const response = await fetch(url, config);
            
            if (response.status === 401) {
                XpanelUtils.removeAuthToken();
                window.location.href = '/login';
                return;
            }

            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.message || 'API request failed');
            }
            
            return data;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    }

    // Authentication
    async login(username, password) {
        return this.request('/login', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });
    }

    // System stats
    async getSystemStats() {
        return this.request('/system/stats');
    }

    // Server management
    async getServers() {
        return this.request('/servers');
    }

    async addServer(serverData) {
        return this.request('/servers', {
            method: 'POST',
            body: JSON.stringify(serverData)
        });
    }

    async getServerStats(serverId) {
        return this.request(`/servers/${serverId}/stats`);
    }

    async executeCommand(serverId, command) {
        return this.request(`/servers/${serverId}/execute`, {
            method: 'POST',
            body: JSON.stringify({ command })
        });
    }

    async getServerFiles(serverId, path = '/') {
        return this.request(`/servers/${serverId}/files?path=${encodeURIComponent(path)}`);
    }

    async removeServer(serverId) {
        return this.request(`/servers/${serverId}`, {
            method: 'DELETE'
        });
    }
}

// Create global API instance
window.api = new XpanelAPI();
