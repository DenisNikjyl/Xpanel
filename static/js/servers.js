// Xpanel - Servers Management JavaScript

class ServersManager {
    constructor() {
        this.auth = new XpanelAuth();
        this.servers = [];
        this.searchTerm = '';
        this.init();
    }

    init() {
        this.setupEventHandlers();
        this.loadServers();
        this.loadStats();
        this.startRealTimeUpdates();
    }

    setupEventHandlers() {
        // Add server button
        document.getElementById('add-server-btn')?.addEventListener('click', () => this.showAddServerModal());
        
        // Server form
        document.getElementById('server-form')?.addEventListener('submit', (e) => this.handleServerSubmit(e));
        
        // Search
        document.getElementById('server-search')?.addEventListener('input', (e) => this.handleSearch(e));
        
        // Modal controls
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', (e) => this.closeModal(e));
        });
        
        // Auth toggle
        document.querySelectorAll('input[name="auth_type"]').forEach(radio => {
            radio.addEventListener('change', () => this.toggleAuthFields());
        });
        
        // Global click handler for modals
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal-backdrop')) {
                this.closeModal(e);
            }
        });
    }

    async loadServers() {
        try {
            const response = await fetch('/api/servers', {
                headers: {
                    'Authorization': `Bearer ${this.auth.getToken()}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                this.servers = await response.json();
                this.renderServers();
                this.updateStats();
            } else if (response.status === 401) {
                this.auth.logout();
                window.location.href = '/login';
            }
        } catch (error) {
            console.error('Failed to load servers:', error);
            this.showNotification('Failed to load servers', 'error');
        }
    }

    renderServers() {
        const container = document.getElementById('servers-container');
        if (!container) return;

        const filteredServers = this.filterServers();

        if (filteredServers.length === 0) {
            this.displayEmptyServers();
            return;
        }

        container.innerHTML = '';
        
        filteredServers.forEach(server => {
            const serverCard = this.createServerCard(server);
            container.appendChild(serverCard);
        });

        // Animate cards in
        this.animateCardsIn();
    }

    createServerCard(server) {
        const card = document.createElement('div');
        card.className = 'server-card';
        card.setAttribute('data-server-id', server.id);

        const statusClass = this.getServerStatusClass(server.status);
        const statusIcon = this.getServerStatusIcon(server.status);

        card.innerHTML = `
            <div class="server-header">
                <div class="server-info">
                    <div class="server-name">${server.name}</div>
                    <div class="server-address">${server.host}:${server.port || 22}</div>
                </div>
                <div class="server-status ${statusClass}">
                    <i class="${statusIcon}"></i>
                    <span>${server.status}</span>
                </div>
            </div>
            
            <div class="server-metrics">
                <div class="metric">
                    <div class="metric-icon">
                        <i class="fas fa-microchip"></i>
                    </div>
                    <div class="metric-info">
                        <div class="metric-label">CPU</div>
                        <div class="metric-value">${server.cpu_usage || 0}%</div>
                    </div>
                    <div class="metric-bar">
                        <div class="metric-fill" style="width: ${server.cpu_usage || 0}%"></div>
                    </div>
                </div>
                
                <div class="metric">
                    <div class="metric-icon">
                        <i class="fas fa-memory"></i>
                    </div>
                    <div class="metric-info">
                        <div class="metric-label">Memory</div>
                        <div class="metric-value">${server.memory_usage || 0}%</div>
                    </div>
                    <div class="metric-bar">
                        <div class="metric-fill" style="width: ${server.memory_usage || 0}%"></div>
                    </div>
                </div>
                
                <div class="metric">
                    <div class="metric-icon">
                        <i class="fas fa-hdd"></i>
                    </div>
                    <div class="metric-info">
                        <div class="metric-label">Disk</div>
                        <div class="metric-value">${server.disk_usage || 0}%</div>
                    </div>
                    <div class="metric-bar">
                        <div class="metric-fill" style="width: ${server.disk_usage || 0}%"></div>
                    </div>
                </div>
            </div>
            
            <div class="server-actions">
                <button class="action-btn secondary" onclick="serversManager.connectToServer('${server.id}')">
                    <i class="fas fa-terminal"></i>
                    Terminal
                </button>
                <button class="action-btn primary" onclick="serversManager.manageServer('${server.id}')">
                    <i class="fas fa-cog"></i>
                    Manage
                </button>
                ${server.agent_status !== 'installed' ? 
                    `<button class="action-btn success" onclick="serversManager.installAgent('${server.id}')">
                        <i class="fas fa-download"></i>
                        Install Agent
                    </button>` : ''
                }
                <div class="dropdown">
                    <button class="action-btn secondary dropdown-toggle">
                        <i class="fas fa-ellipsis-v"></i>
                    </button>
                    <div class="dropdown-menu">
                        <a href="#" onclick="serversManager.editServer('${server.id}')">
                            <i class="fas fa-edit"></i>
                            Edit
                        </a>
                        <a href="#" onclick="serversManager.deleteServer('${server.id}')">
                            <i class="fas fa-trash"></i>
                            Delete
                        </a>
                    </div>
                </div>
            </div>
        `;

        return card;
    }

    filterServers() {
        if (!this.searchTerm) return this.servers;
        
        return this.servers.filter(server => 
            server.name.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
            server.host.toLowerCase().includes(this.searchTerm.toLowerCase())
        );
    }

    displayEmptyServers() {
        const container = document.getElementById('servers-container');
        if (!container) return;

        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">
                    <i class="fas fa-server"></i>
                </div>
                <div class="empty-title">No servers found</div>
                <div class="empty-description">
                    ${this.searchTerm ? 
                        'No servers match your search criteria.' : 
                        'Get started by adding your first server.'
                    }
                </div>
                ${!this.searchTerm ? 
                    '<button class="btn-primary" onclick="serversManager.showAddServerModal()">Add Server</button>' : 
                    ''
                }
            </div>
        `;
    }

    getServerStatusClass(status) {
        const statusMap = {
            'online': 'success',
            'offline': 'danger',
            'connecting': 'warning',
            'unknown': 'secondary'
        };
        return statusMap[status] || 'secondary';
    }

    getServerStatusIcon(status) {
        const iconMap = {
            'online': 'fas fa-circle',
            'offline': 'fas fa-circle',
            'connecting': 'fas fa-spinner fa-spin',
            'unknown': 'fas fa-question-circle'
        };
        return iconMap[status] || 'fas fa-question-circle';
    }

    // Modal Management
    showAddServerModal() {
        const modal = document.getElementById('add-server-modal');
        if (modal) {
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
            
            // Reset form
            const form = document.getElementById('server-form');
            if (form) form.reset();
            
            // Focus first input
            const firstInput = modal.querySelector('input');
            if (firstInput) {
                setTimeout(() => firstInput.focus(), 100);
            }
        }
    }

    closeModal(e) {
        const modal = e.target.closest('.modal');
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }
    }

    // Server Management
    async handleServerSubmit(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const serverData = {
            name: formData.get('name'),
            host: formData.get('host'),
            port: parseInt(formData.get('port')) || 22,
            username: formData.get('username'),
            auth_type: formData.get('auth_type'),
            password: formData.get('password'),
            key_file: formData.get('key_file'),
            description: formData.get('description')
        };

        try {
            const response = await fetch('/api/servers', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.auth.getToken()}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(serverData)
            });

            if (response.ok) {
                this.showNotification('Server added successfully', 'success');
                this.closeModal({ target: document.getElementById('add-server-modal') });
                await this.loadServers();
            } else {
                const error = await response.json();
                this.showNotification(error.message || 'Failed to add server', 'error');
            }
        } catch (error) {
            console.error('Failed to add server:', error);
            this.showNotification('Failed to add server', 'error');
        }
    }

    async installAgent(serverId) {
        const server = this.servers.find(s => s.id === serverId);
        if (!server) return;

        this.showInstallationModal(server);
    }

    showInstallationModal(server) {
        const modal = document.getElementById('install-agent-modal');
        if (!modal) return;

        // Update modal title
        const title = modal.querySelector('.modal-title');
        if (title) {
            title.innerHTML = `<i class="fas fa-download"></i> Installing Agent on ${server.name}`;
        }

        // Reset progress
        const progressFill = document.getElementById('install-progress-fill');
        const progressPercentage = document.getElementById('install-progress-percentage');
        const terminal = document.getElementById('install-terminal');

        if (progressFill) progressFill.style.width = '0%';
        if (progressPercentage) progressPercentage.textContent = '0%';
        if (terminal) terminal.innerHTML = '';

        modal.classList.add('active');
        document.body.style.overflow = 'hidden';

        // Start installation
        this.performAgentInstallation(server);
    }

    async performAgentInstallation(server) {
        const terminal = document.getElementById('install-terminal');
        const progressFill = document.getElementById('install-progress-fill');
        const progressPercentage = document.getElementById('install-progress-percentage');

        const steps = [
            { text: 'Connecting to server...', delay: 1000 },
            { text: 'Checking system requirements...', delay: 1500 },
            { text: 'Downloading agent files...', delay: 2000 },
            { text: 'Installing dependencies...', delay: 2500 },
            { text: 'Configuring agent service...', delay: 1500 },
            { text: 'Starting agent...', delay: 1000 },
            { text: 'Verifying connection...', delay: 1500 }
        ];

        let currentStep = 0;
        const totalSteps = steps.length;

        for (const step of steps) {
            this.addTerminalLine(`[INFO] ${step.text}`, 'info');
            
            // Update progress
            const progress = Math.round(((currentStep + 1) / totalSteps) * 100);
            if (progressFill) progressFill.style.width = `${progress}%`;
            if (progressPercentage) progressPercentage.textContent = `${progress}%`;

            await this.delay(step.delay);
            currentStep++;
        }

        // Make actual API call
        try {
            const response = await fetch(`/api/servers/${server.id}/install-agent`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.auth.getToken()}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    host: server.host,
                    port: server.port,
                    username: server.username,
                    password: server.password,
                    key_file: server.key_file
                })
            });

            const result = await response.json();

            if (result.success) {
                this.addTerminalLine('[SUCCESS] Agent installed successfully!', 'success');
                this.showNotification('Agent installed successfully', 'success');
                
                // Update server status
                server.agent_status = 'installed';
                this.renderServers();
            } else {
                this.addTerminalLine(`[ERROR] ${result.error}`, 'error');
                this.showNotification('Agent installation failed', 'error');
            }
        } catch (error) {
            this.addTerminalLine(`[ERROR] Installation failed: ${error.message}`, 'error');
            this.showNotification('Agent installation failed', 'error');
        }

        // Enable close button
        const closeBtn = document.querySelector('#install-agent-modal .modal-close');
        if (closeBtn) closeBtn.disabled = false;
    }

    addTerminalLine(text, type = 'info') {
        const terminal = document.getElementById('install-terminal');
        if (!terminal) return;

        const line = document.createElement('div');
        line.className = 'terminal-line';
        
        const prompt = document.createElement('span');
        prompt.className = 'terminal-prompt';
        prompt.textContent = '$';
        
        const textSpan = document.createElement('span');
        textSpan.className = `terminal-text ${type}`;
        textSpan.textContent = text;
        
        line.appendChild(prompt);
        line.appendChild(textSpan);
        terminal.appendChild(line);
        
        // Auto scroll
        terminal.scrollTop = terminal.scrollHeight;
    }

    // Utility Functions
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    animateCardsIn() {
        const cards = document.querySelectorAll('.server-card');
        cards.forEach((card, index) => {
            card.style.opacity = '0';
            card.style.transform = 'translateY(20px)';
            
            setTimeout(() => {
                card.style.transition = 'all 0.3s ease';
                card.style.opacity = '1';
                card.style.transform = 'translateY(0)';
            }, index * 100);
        });
    }

    // Event Handlers
    handleSearch(e) {
        this.searchTerm = e.target.value;
        this.renderServers();
    }

    toggleAuthFields() {
        const authType = document.querySelector('input[name="auth_type"]:checked')?.value;
        const passwordField = document.getElementById('password-field');
        const keyField = document.getElementById('key-field');
        
        if (authType === 'password') {
            passwordField?.style.setProperty('display', 'block');
            keyField?.style.setProperty('display', 'none');
        } else {
            passwordField?.style.setProperty('display', 'none');
            keyField?.style.setProperty('display', 'block');
        }
    }

    // Notifications
    showNotification(message, type = 'info') {
        const container = document.querySelector('.notifications') || this.createNotificationContainer();
        
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <div class="notification-message">${message}</div>
                <button class="notification-close" onclick="this.parentElement.parentElement.remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        
        container.appendChild(notification);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    }

    createNotificationContainer() {
        const container = document.createElement('div');
        container.className = 'notifications';
        document.body.appendChild(container);
        return container;
    }

    // Stats and Updates
    async loadStats() {
        try {
            const response = await fetch('/api/stats', {
                headers: {
                    'Authorization': `Bearer ${this.auth.getToken()}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const stats = await response.json();
                this.updateStatsCards(stats);
            }
        } catch (error) {
            console.error('Failed to load stats:', error);
        }
    }

    updateStats() {
        const totalServers = this.servers.length;
        const onlineServers = this.servers.filter(s => s.status === 'online').length;
        const offlineServers = this.servers.filter(s => s.status === 'offline').length;
        const agentsInstalled = this.servers.filter(s => s.agent_status === 'installed').length;

        document.getElementById('total-servers').textContent = totalServers;
        document.getElementById('online-servers').textContent = onlineServers;
        document.getElementById('offline-servers').textContent = offlineServers;
        document.getElementById('agents-installed').textContent = agentsInstalled;
    }

    startRealTimeUpdates() {
        // Update stats every 30 seconds
        setInterval(() => {
            this.loadStats();
        }, 30000);
        
        // Update servers every 60 seconds
        setInterval(() => {
            this.loadServers();
        }, 60000);
    }

    // Server Actions
    connectToServer(serverId) {
        window.location.href = `/terminal?server=${serverId}`;
    }

    manageServer(serverId) {
        console.log('Managing server:', serverId);
        this.showNotification('Server management panel coming soon', 'info');
    }

    editServer(serverId) {
        console.log('Editing server:', serverId);
        this.showNotification('Edit server feature coming soon', 'info');
    }

    async deleteServer(serverId) {
        if (!confirm('Are you sure you want to delete this server?')) return;
        
        try {
            const response = await fetch(`/api/servers/${serverId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${this.auth.getToken()}`
                }
            });

            if (response.ok) {
                this.showNotification('Server deleted successfully', 'success');
                await this.loadServers();
            } else {
                this.showNotification('Failed to delete server', 'error');
            }
        } catch (error) {
            console.error('Failed to delete server:', error);
            this.showNotification('Failed to delete server', 'error');
        }
    }
}

// Initialize servers manager
document.addEventListener('DOMContentLoaded', () => {
    window.serversManager = new ServersManager();
});
