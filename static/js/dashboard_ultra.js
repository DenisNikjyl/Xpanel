class UltraDashboard {
    constructor() {
        this.auth = new XpanelAuth();
        this.servers = [];
        this.currentView = 'grid';
        this.searchTerm = '';
        this.selectedServer = null;
        this.notifications = [];
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadDashboard();
        this.startRealTimeUpdates();
        this.initializeAnimations();
    }

    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => this.handleNavigation(e));
        });

        // Add server button
        const addServerBtn = document.getElementById('add-server-btn');
        if (addServerBtn) {
            addServerBtn.addEventListener('click', () => this.showAddServerModal());
        }

        // Modal close buttons
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modal = e.target.closest('.modal');
                if (modal) {
                    modal.classList.remove('active');
                }
            });
        });

        // Modal backdrop clicks
        document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
            backdrop.addEventListener('click', (e) => {
                const modal = e.target.closest('.modal');
                if (modal) {
                    modal.classList.remove('active');
                }
            });
        });

        // Add server form submission
        const addServerForm = document.getElementById('server-form');
        if (addServerForm) {
            addServerForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleAddServer(e);
            });
        }

        // Edit server form submission
        const editServerForm = document.getElementById('edit-server-form');
        if (editServerForm) {
            editServerForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleEditServer(e);
            });
        }

        document.getElementById('refresh-btn')?.addEventListener('click', () => this.refreshDashboard());
        document.getElementById('notifications-btn')?.addEventListener('click', () => this.toggleNotifications());

        // View toggle
        document.querySelectorAll('.toggle-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.toggleView(e));
        });

        // Search
        document.getElementById('server-search')?.addEventListener('input', (e) => this.handleSearch(e));

        // Modal controls
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', (e) => this.closeModal(e));
        });

        // Form submissions
        document.getElementById('server-form')?.addEventListener('submit', (e) => this.handleServerSubmit(e));

        // Auth toggle
        document.querySelectorAll('input[name="auth_type"]').forEach(radio => {
            radio.addEventListener('change', () => this.toggleAuthFields());
        });

        // Logout
        document.getElementById('logout-btn')?.addEventListener('click', () => this.logout());

        // Global click handler for modals
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal-backdrop')) {
                this.closeModal(e);
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));
    }

    async loadDashboard() {
        this.showLoading('Loading dashboard...');
        
        try {
            await this.loadStats();
            await this.loadServers();
            // this.updateUI(); // Removed as this method doesn't exist
        } catch (error) {
            console.error('Failed to load dashboard:', error);
            this.showNotification('Failed to load dashboard', 'error');
        } finally {
            this.hideLoading();
        }
    }

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

    async loadServers() {
        try {
            const response = await fetch('/api/servers', {
                headers: {
                    'Authorization': `Bearer ${this.auth.getToken()}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.servers = Array.isArray(data) ? data : (data.servers || []);
                this.renderServers();
            } else if (response.status === 401) {
                this.auth.logout();
                window.location.href = '/login';
            }
        } catch (error) {
            console.error('Failed to load servers:', error);
            this.showNotification('Failed to load servers', 'error');
        }
    }

    updateStatsCards(stats) {
        const cards = [
            { id: 'total-servers', value: stats.total_servers || 0, trend: 'up' },
            { id: 'active-servers', value: stats.active_servers || 0, trend: 'up' },
            { id: 'cpu-usage', value: `${stats.avg_cpu || 0}%`, trend: stats.cpu_trend || 'neutral' },
            { id: 'memory-usage', value: `${stats.avg_memory || 0}%`, trend: stats.memory_trend || 'neutral' }
        ];

        cards.forEach(card => {
            const element = document.getElementById(card.id);
            if (element) {
                const valueEl = element.querySelector('.stat-value');
                const trendEl = element.querySelector('.stat-trend');
                const progressEl = element.querySelector('.progress-fill');

                if (valueEl) {
                    this.animateValue(valueEl, card.value);
                }

                if (trendEl) {
                    trendEl.className = `stat-trend ${card.trend}`;
                }

                if (progressEl && typeof card.value === 'string' && card.value.includes('%')) {
                    const percentage = parseInt(card.value);
                    progressEl.style.width = `${percentage}%`;
                }
            }
        });
    }

    filterServers() {
        if (!Array.isArray(this.servers)) {
            return [];
        }
        
        const searchTerm = this.searchTerm ? this.searchTerm.toLowerCase() : '';
        const statusFilter = this.statusFilter || 'all';
        
        return this.servers.filter(server => {
            const matchesSearch = !searchTerm || 
                server.name.toLowerCase().includes(searchTerm) ||
                server.host.toLowerCase().includes(searchTerm);
            
            const matchesStatus = statusFilter === 'all' || server.status === statusFilter;
            
            return matchesSearch && matchesStatus;
        });
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

    displayEmptyServers() {
        const container = document.getElementById('servers-container');
        if (!container) return;

        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">
                    <i class="fas fa-server"></i>
                </div>
                <h3>No servers found</h3>
                <p>Add your first server to get started with monitoring</p>
                <button class="btn btn-primary" onclick="dashboard.showAddServerModal()">
                    <i class="fas fa-plus"></i> Add Server
                </button>
            </div>
        `;
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
                    '<button class="btn-primary" onclick="dashboard.showAddServerModal()">Add Server</button>' : 
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
        this.showInstallProgress(serverData);
    }

    showInstallProgress(serverData) {
        const modal = document.getElementById('installProgressModal');
        const progressBar = document.getElementById('installProgressBar');
        const progressPercent = document.getElementById('installProgressPercent');
        const terminalOutput = document.getElementById('terminalOutput');
        const cancelBtn = document.getElementById('cancelInstallBtn');
        
        modal.style.display = 'block';
        
        // Сброс состояния
        progressBar.style.width = '0%';
        progressPercent.textContent = '0%';
        terminalOutput.innerHTML = '';
        this.installationCancelled = false;
        
        // Реальная установка через WebSocket
        this.startRealInstallation(serverData);
        
        // Обработчик отмены
        cancelBtn.onclick = () => {
            this.installationCancelled = true;
            modal.style.display = 'none';
            // Отправляем сигнал отмены на сервер
            if (this.socket) {
                this.socket.emit('cancel_installation', { server_id: serverData.id });
            }
        };
    }
    
    startRealInstallation(serverData) {
        // Подключаемся к WebSocket для получения real-time логов
        if (!this.socket) {
            this.socket = io();
        }
        
        // Слушаем события установки
        this.socket.on('installation_progress', (data) => {
            if (this.installationCancelled) return;
            
            this.updateInstallProgress(data);
        });
        
        this.socket.on('installation_complete', (data) => {
            if (this.installationCancelled) return;
            
            this.handleInstallationComplete(data);
        });
        
        this.socket.on('installation_error', (data) => {
            if (this.installationCancelled) return;
            
            this.handleInstallationError(data);
        });
        
        // Запускаем установку
        fetch('/api/install-agent', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.auth.getToken()}`
            },
            body: JSON.stringify(serverData)
        })
        .then(response => response.json())
        .then(data => {
            if (!data.success) {
                this.addTerminalMessage('Ошибка', data.error || 'Неизвестная ошибка установки', 'error');
            }
        })
        .catch(error => {
            console.error('Installation error:', error);
            this.addTerminalMessage('Ошибка', 'Ошибка запуска установки: ' + error.message, 'error');
        });
    }
    
    updateInstallProgress(data) {
        const progressBar = document.getElementById('installProgressBar');
        const progressPercent = document.getElementById('installProgressPercent');
        
        // Обновляем прогресс-бар
        progressBar.style.width = data.progress + '%';
        progressPercent.textContent = data.progress + '%';
        
        // Добавляем основное сообщение
        const messageType = data.is_error ? 'error' : 'info';
        this.addTerminalMessage(data.step, data.message, messageType);
        
        // Добавляем вывод команды если есть
        if (data.command_output && data.command_output.trim()) {
            this.addTerminalOutput(data.command_output);
        }
    }
    
    handleInstallationComplete(data) {
        this.addTerminalMessage('Завершение', 'Установка агента завершена успешно!', 'success');
        
        setTimeout(() => {
            const modal = document.getElementById('installProgressModal');
            modal.style.display = 'none';
            this.refreshDashboard();
        }, 2000);
    }
    
    handleInstallationError(data) {
        this.addTerminalMessage('Ошибка', data.error || 'Произошла ошибка установки', 'error');
        
        setTimeout(() => {
            const modal = document.getElementById('installProgressModal');
            modal.style.display = 'none';
        }, 3000);
    }

    async performAgentInstallation(server) {
        const serverData = {
            host: server.host,
            port: server.port,
            username: server.username,
            password: server.password,
            key_file: server.key_file
        };

        try {
            const response = await fetch(`/api/servers/${server.id}/install-agent`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.auth.getToken()}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(serverData)
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

    addTerminalOutput(output) {
        const terminalOutput = document.getElementById('terminalOutput');
        if (!terminalOutput) return;
        
        const lines = output.split('\n');
        lines.forEach(line => {
            if (line.trim()) {
                const outputLine = document.createElement('div');
                outputLine.className = 'terminal-output';
                outputLine.textContent = line;
                terminalOutput.appendChild(outputLine);
            }
        });
        
        // Прокручиваем вниз
        terminalOutput.scrollTop = terminalOutput.scrollHeight;
    }

    addTerminalMessage(step, message, type = 'info') {
        const terminalOutput = document.getElementById('terminalOutput');
        if (!terminalOutput) return;

        const line = document.createElement('div');
        line.className = `terminal-line terminal-${type}`;
        
        const timestamp = new Date().toLocaleTimeString();
        const prefix = type === 'error' ? '[ERROR]' : type === 'success' ? '[SUCCESS]' : '[INFO]';
        
        line.innerHTML = `
            <span class="terminal-timestamp">[${timestamp}]</span>
            <span class="terminal-prefix ${type}">${prefix}</span>
            <span class="terminal-step">${step}:</span>
            <span class="terminal-message">${message}</span>
        `;
        
        terminalOutput.appendChild(line);
        terminalOutput.scrollTop = terminalOutput.scrollHeight;
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

    animateValue(element, targetValue) {
        const isPercentage = typeof targetValue === 'string' && targetValue.includes('%');
        const numericValue = isPercentage ? parseInt(targetValue) : parseInt(targetValue) || 0;
        
        let currentValue = 0;
        const increment = numericValue / 30;
        
        const animation = setInterval(() => {
            currentValue += increment;
            if (currentValue >= numericValue) {
                currentValue = numericValue;
                clearInterval(animation);
            }
            
            element.textContent = isPercentage ? 
                `${Math.round(currentValue)}%` : 
                Math.round(currentValue).toString();
        }, 50);
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

    initializeAnimations() {
        // Add intersection observer for scroll animations
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('animate-in');
                }
            });
        });

        document.querySelectorAll('.stat-card, .server-card').forEach(el => {
            observer.observe(el);
        });
    }

    // Event Handlers
    handleNavigation(e) {
        e.preventDefault();
        
        // Remove active class from all nav items
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        
        // Add active class to clicked item
        e.currentTarget.classList.add('active');
        
        // Handle navigation logic here
        const navText = e.currentTarget.querySelector('.nav-text').textContent;
        
        // Navigate to different pages based on nav item
        switch(navText) {
            case 'Dashboard':
                // Already on dashboard, just refresh
                this.refreshDashboard();
                break;
            case 'Servers':
                window.location.href = '/servers';
                break;
            case 'Terminal':
                window.location.href = '/terminal';
                break;
            case 'Analytics':
                window.location.href = '/analytics';
                break;
            case 'Agents':
                window.location.href = '/agents';
                break;
            case 'Security':
                window.location.href = '/security';
                break;
            case 'Settings':
                window.location.href = '/settings';
                break;
            default:
                console.log('Unknown navigation:', navText);
        }
    }

    toggleView(e) {
        const viewType = e.target.dataset.view;
        if (viewType) {
            this.currentView = viewType;
            
            // Update toggle buttons
            document.querySelectorAll('.toggle-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            e.target.classList.add('active');
            
            // Update view
            this.renderServers();
        }
    }

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

    handleKeyboard(e) {
        // ESC to close modals
        if (e.key === 'Escape') {
            const activeModal = document.querySelector('.modal.active');
            if (activeModal) {
                this.closeModal({ target: activeModal });
            }
        }
        
        // Ctrl+R to refresh
        if (e.ctrlKey && e.key === 'r') {
            e.preventDefault();
            this.refreshDashboard();
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

    // Loading
    showLoading(message = 'Loading...') {
        const overlay = document.querySelector('.loading-overlay') || this.createLoadingOverlay();
        const text = overlay.querySelector('.loading-text');
        if (text) text.textContent = message;
        overlay.classList.add('active');
    }

    hideLoading() {
        const overlay = document.querySelector('.loading-overlay');
        if (overlay) overlay.classList.remove('active');
    }

    createLoadingOverlay() {
        const overlay = document.createElement('div');
        overlay.className = 'loading-overlay';
        overlay.innerHTML = `
            <div class="loading-spinner">
                <div class="spinner"></div>
                <div class="loading-text">Loading...</div>
            </div>
        `;
        document.body.appendChild(overlay);
        return overlay;
    }

    // Real-time Updates
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

    async refreshDashboard() {
        this.showNotification('Refreshing dashboard...', 'info');
        await this.loadDashboard();
    }

    logout() {
        this.auth.logout();
        window.location.href = '/login';
    }

    async installAgent(serverId) {
        this.showNotification('Starting agent installation...', 'info');
        
        try {
            const response = await fetch(`/api/servers/${serverId}/install-agent`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.auth.getToken()}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const result = await response.json();
                this.showInstallationProgress(serverId, result);
            } else {
                this.showNotification('Failed to start installation', 'error');
            }
        } catch (error) {
            console.error('Installation error:', error);
            this.showNotification('Installation failed', 'error');
        }
    }

    showInstallationProgress(serverId, result) {
        // Create installation progress modal
        const modal = document.createElement('div');
        modal.className = 'modal installation-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3><i class="fas fa-download"></i> Installing Agent on ${serverId}</h3>
                    <button class="close-btn" onclick="this.closest('.modal').remove()">&times;</button>
                </div>
                <div class="installation-progress">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: 0%"></div>
                    </div>
                    <div class="progress-text">0% - Initializing...</div>
                    <div class="terminal-container">
                        <div class="terminal-header">
                            <div class="terminal-buttons">
                                <span class="terminal-button red"></span>
                                <span class="terminal-button yellow"></span>
                                <span class="terminal-button green"></span>
                            </div>
                            <span class="terminal-title">Agent Installation</span>
                        </div>
                        <div class="terminal-output" id="install-terminal-${serverId}"></div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Close</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        // Show result immediately if available
        if (result) {
            if (result.success) {
                this.addTerminalMessage(serverId, '[SUCCESS] Agent installed successfully!', 'success');
                this.updateProgress(serverId, 100, 'Installation completed');
            } else {
                this.addTerminalMessage(serverId, `[ERROR] Installation failed: ${result.error}`, 'error');
                this.updateProgress(serverId, 100, 'Installation failed');
            }
        }
    }

    addTerminalMessage(serverId, message, type = 'info') {
        const terminal = document.getElementById(`install-terminal-${serverId}`);
        if (terminal) {
            const logLine = document.createElement('div');
            logLine.className = `log-line ${type}`;
            logLine.innerHTML = `<span class="timestamp">${new Date().toLocaleTimeString()}</span> ${message}`;
            terminal.appendChild(logLine);
            terminal.scrollTop = terminal.scrollHeight;
        }
    }

    updateProgress(serverId, progress, message) {
        const progressBar = document.querySelector('.progress-fill');
        const progressText = document.querySelector('.progress-text');

        if (progressBar) {
            progressBar.style.width = `${progress}%`;
        }
        
        if (progressText) {
            progressText.textContent = `${progress}% - ${message}`;
        }
    }

    updateInstallationProgress(serverId, data) {
        this.updateProgress(serverId, data.progress, data.message);

        if (data.command_output) {
            this.addTerminalMessage(serverId, data.command_output, data.is_error ? 'error' : 'info');
        }

        if (data.progress === 100) {
            setTimeout(() => {
                document.querySelector('.installation-modal')?.remove();
                this.loadServers(); // Refresh server list
                this.showNotification('Agent installed successfully!', 'success');
            }, 2000);
        }
    }

    async manageServer(serverId) {
        try {
            const response = await fetch(`/api/servers/${serverId}/services`, {
                headers: {
                    'Authorization': `Bearer ${this.auth.getToken()}`
                }
            });

            if (response.ok) {
                const services = await response.json();
                this.openServerManagementModal(serverId, services);
            } else {
                this.showNotification('Failed to load server services', 'error');
            }
        } catch (error) {
            console.error('Failed to load server management:', error);
            this.showNotification('Failed to load server management', 'error');
        }
    }

    async editServer(serverId) {
        try {
            const response = await fetch(`/api/servers/${serverId}`, {
                headers: {
                    'Authorization': `Bearer ${this.auth.getToken()}`
                }
            });

            if (response.ok) {
                const server = await response.json();
                this.openEditServerModal(server);
            } else {
                this.showNotification('Failed to load server details', 'error');
            }
        } catch (error) {
            console.error('Failed to load server for editing:', error);
            this.showNotification('Failed to load server details', 'error');
        }
    }

    async deleteServer(serverId) {
        if (!confirm('Вы уверены, что хотите удалить этот сервер?')) return;
        
        try {
            const response = await fetch(`/api/servers/${serverId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${this.auth.getToken()}`
                }
            });

            if (response.ok) {
                this.showNotification('Сервер успешно удален', 'success');
                await this.loadServers();
            } else {
                this.showNotification('Ошибка удаления сервера', 'error');
            }
        } catch (error) {
            console.error('Failed to delete server:', error);
            this.showNotification('Ошибка удаления сервера', 'error');
        }
    }

    async handleAddServer(event) {
        const formData = new FormData(event.target);
        const serverData = {
            name: formData.get('name'),
            host: formData.get('host'),
            port: parseInt(formData.get('port')),
            username: formData.get('username'),
            password: formData.get('password'),
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
                this.showNotification('Сервер успешно добавлен', 'success');
                document.getElementById('add-server-modal').classList.remove('active');
                event.target.reset();
                await this.loadServers();
            } else {
                const error = await response.json();
                this.showNotification(error.message || 'Ошибка добавления сервера', 'error');
            }
        } catch (error) {
            console.error('Failed to add server:', error);
            this.showNotification('Ошибка добавления сервера', 'error');
        }
    }

    async handleEditServer(event) {
        const formData = new FormData(event.target);
        const serverId = event.target.dataset.serverId;
        const serverData = {
            name: formData.get('name'),
            host: formData.get('host'),
            port: parseInt(formData.get('port')),
            username: formData.get('username'),
            password: formData.get('password'),
            description: formData.get('description')
        };

        try {
            const response = await fetch(`/api/servers/${serverId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${this.auth.getToken()}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(serverData)
            });

            if (response.ok) {
                this.showNotification('Сервер успешно обновлен', 'success');
                document.getElementById('edit-server-modal').classList.remove('active');
                await this.loadServers();
            } else {
                const error = await response.json();
                this.showNotification(error.message || 'Ошибка обновления сервера', 'error');
            }
        } catch (error) {
            console.error('Failed to update server:', error);
            this.showNotification('Ошибка обновления сервера', 'error');
        }
    }

    async toggleNotifications() {
        try {
            const response = await fetch('/api/notifications', {
                headers: {
                    'Authorization': `Bearer ${this.auth.getToken()}`
                }
            });

            if (response.ok) {
                const notifications = await response.json();
                this.openNotificationsPanel(notifications);
            } else {
                this.showNotification('Failed to load notifications', 'error');
            }
        } catch (error) {
            console.error('Failed to load notifications:', error);
            this.showNotification('Failed to load notifications', 'error');
        }
    }

    openTerminalModal(serverId, sessionId) {
        // Real terminal modal implementation
        const modal = document.createElement('div');
        modal.className = 'modal terminal-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Server Terminal - ${serverId}</h3>
                    <button class="close-btn" onclick="this.closest('.modal').remove()">&times;</button>
                </div>
                <div class="terminal-container">
                    <div id="terminal-${sessionId}" class="terminal"></div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        // Initialize real terminal connection
        this.initializeTerminal(sessionId, serverId);
    }

    openServerManagementModal(serverId, services) {
        // Real server management modal
        const modal = document.createElement('div');
        modal.className = 'modal management-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Manage Server - ${serverId}</h3>
                    <button class="close-btn" onclick="this.closest('.modal').remove()">&times;</button>
                </div>
                <div class="services-list">
                    ${services.map(service => `
                        <div class="service-item">
                            <span class="service-name">${service.name}</span>
                            <span class="service-status ${service.status}">${service.status}</span>
                            <div class="service-actions">
                                <button onclick="dashboard.controlService('${serverId}', '${service.name}', 'start')">Start</button>
                                <button onclick="dashboard.controlService('${serverId}', '${service.name}', 'stop')">Stop</button>
                                <button onclick="dashboard.controlService('${serverId}', '${service.name}', 'restart')">Restart</button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    async controlService(serverId, serviceName, action) {
        try {
            const response = await fetch(`/api/servers/${serverId}/services/${serviceName}/${action}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.auth.getToken()}`
                }
            });

            if (response.ok) {
                this.showNotification(`Service ${serviceName} ${action} successful`, 'success');
                // Refresh services list
                this.manageServer(serverId);
            } else {
                this.showNotification(`Failed to ${action} service ${serviceName}`, 'error');
            }
        } catch (error) {
            console.error(`Failed to ${action} service:`, error);
            this.showNotification(`Failed to ${action} service`, 'error');
        }
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new UltraDashboard();
});

// Global functions for onclick handlers
window.closeModal = (modalId) => {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
};

// Global functions for server actions
window.installAgent = (serverId) => {
    if (window.dashboard && window.dashboard.installAgent) {
        window.dashboard.installAgent(serverId);
    } else {
        console.error('Dashboard not ready or installAgent method not found');
    }
};

window.deleteServer = (serverId) => {
    if (window.dashboard && window.dashboard.deleteServer) {
        window.dashboard.deleteServer(serverId);
    } else {
        console.error('Dashboard not ready or deleteServer method not found');
    }
};

window.manageServer = (serverId) => {
    if (window.dashboard && window.dashboard.manageServer) {
        window.dashboard.manageServer(serverId);
    } else {
        console.error('Dashboard not ready or manageServer method not found');
    }
};

window.connectToServer = (serverId) => {
    if (window.dashboard && window.dashboard.connectToServer) {
        window.dashboard.connectToServer(serverId);
    } else {
        console.error('Dashboard not ready or connectToServer method not found');
    }
};

window.editServer = (serverId) => {
    if (window.dashboard && window.dashboard.showEditServerModal) {
        window.dashboard.showEditServerModal(serverId);
    } else {
        console.error('Dashboard not ready or showEditServerModal method not found');
    }
};
