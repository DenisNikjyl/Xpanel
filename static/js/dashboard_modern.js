/**
 * Modern Xpanel Dashboard JavaScript
 * Enhanced with animations, modern UI interactions, and improved UX
 */

class ModernDashboard {
    constructor() {
        this.auth = null;
        this.socket = null;
        this.charts = {};
        this.updateInterval = null;
        this.isConnected = false;
        
        this.init();
    }

    async init() {
        try {
            // Wait for auth system to be ready
            if (typeof XpanelAuth !== 'undefined') {
                this.auth = new XpanelAuth();
                await this.auth.init();
                
                if (!this.auth.isAuthenticated()) {
                    window.location.href = '/login';
                    return;
                }
            }

            this.setupEventListeners();
            this.initializeNavigation();
            this.initializeModals();
            this.initializeTheme();
            this.startSystemMonitoring();
            this.loadDashboardData();
            this.initializeWebSocket();
            
            // Show welcome animation
            this.showWelcomeAnimation();
            
        } catch (error) {
            console.error('Dashboard initialization error:', error);
            this.showNotification('Ошибка инициализации панели', 'error');
        }
    }

    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const section = item.dataset.section;
                if (section) {
                    this.navigateToSection(section);
                }
            });
        });

        // Search functionality
        const searchInput = document.querySelector('.search-bar input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.handleSearch(e.target.value);
            });
        }

        // Theme switcher
        const themeSwitcher = document.querySelector('.theme-switcher');
        if (themeSwitcher) {
            themeSwitcher.addEventListener('click', () => {
                this.toggleTheme();
            });
        }

        // User menu dropdown
        const userMenu = document.querySelector('.user-menu');
        if (userMenu) {
            userMenu.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleUserDropdown();
            });
        }

        // Close dropdowns when clicking outside
        document.addEventListener('click', () => {
            this.closeAllDropdowns();
        });

        // Terminal input
        const terminalInput = document.getElementById('terminal-input');
        if (terminalInput) {
            terminalInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.executeTerminalCommand(e.target.value);
                    e.target.value = '';
                }
            });
        }

        // Modal tabs
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchModalTab(e.target.dataset.tab);
            });
        });
    }

    initializeNavigation() {
        // Set active navigation item
        const currentSection = window.location.hash.substring(1) || 'dashboard';
        this.navigateToSection(currentSection);
    }

    navigateToSection(sectionName) {
        // Update navigation active state
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        
        const activeNavItem = document.querySelector(`[data-section="${sectionName}"]`);
        if (activeNavItem) {
            activeNavItem.classList.add('active');
        }

        // Show/hide content sections with animation
        document.querySelectorAll('.content-section').forEach(section => {
            section.classList.remove('active');
        });

        const targetSection = document.getElementById(`${sectionName}-section`);
        if (targetSection) {
            setTimeout(() => {
                targetSection.classList.add('active');
                this.triggerSectionAnimation(targetSection);
            }, 100);
        }

        // Update URL hash
        window.location.hash = sectionName;

        // Load section-specific data
        this.loadSectionData(sectionName);
    }

    triggerSectionAnimation(section) {
        // Add entrance animation to cards
        const cards = section.querySelectorAll('.stat-card, .server-card, .settings-card');
        cards.forEach((card, index) => {
            card.style.opacity = '0';
            card.style.transform = 'translateY(30px)';
            
            setTimeout(() => {
                card.style.transition = 'all 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
                card.style.opacity = '1';
                card.style.transform = 'translateY(0)';
            }, index * 100);
        });
    }

    initializeModals() {
        // Modal backdrop clicks
        document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
            backdrop.addEventListener('click', () => {
                this.closeModal(backdrop.closest('.modal'));
            });
        });

        // Modal close buttons
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => {
                this.closeModal(btn.closest('.modal'));
            });
        });
    }

    initializeTheme() {
        const savedTheme = localStorage.getItem('xpanel-theme') || 'dark';
        document.body.setAttribute('data-theme', savedTheme);
        
        const themeIcon = document.querySelector('.theme-switcher i');
        if (themeIcon) {
            themeIcon.className = savedTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
        }
    }

    toggleTheme() {
        const currentTheme = document.body.getAttribute('data-theme') || 'dark';
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        document.body.setAttribute('data-theme', newTheme);
        localStorage.setItem('xpanel-theme', newTheme);
        
        const themeIcon = document.querySelector('.theme-switcher i');
        if (themeIcon) {
            themeIcon.className = newTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
        }

        this.showNotification(`Тема изменена на ${newTheme === 'dark' ? 'темную' : 'светлую'}`, 'success');
    }

    async startSystemMonitoring() {
        await this.updateSystemStats();
        
        // Update every 5 seconds
        this.updateInterval = setInterval(() => {
            this.updateSystemStats();
        }, 5000);
    }

    async updateSystemStats() {
        try {
            const headers = {};
            if (this.auth && this.auth.getToken()) {
                headers['Authorization'] = `Bearer ${this.auth.getToken()}`;
            }

            const response = await fetch('/api/system/stats', { headers });
            
            if (response.status === 401) {
                if (this.auth) {
                    this.auth.logout();
                }
                return;
            }

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const stats = await response.json();
            this.displaySystemStats(stats);
            
        } catch (error) {
            console.error('Error fetching system stats:', error);
            this.showConnectionError();
        }
    }

    displaySystemStats(stats) {
        // Update CPU
        const cpuUsage = Math.round(stats.cpu || 0);
        this.updateStatCard('cpu', cpuUsage, '%');
        
        // Update Memory
        const memoryUsage = Math.round(stats.memory?.percent || 0);
        this.updateStatCard('memory', memoryUsage, '%');
        
        // Update Disk
        const diskUsage = Math.round(stats.disk?.percent || 0);
        this.updateStatCard('disk', diskUsage, '%');
        
        // Update Network
        const networkSpeed = this.formatBytes(stats.network?.bytes_sent || 0);
        this.updateStatCard('network', networkSpeed, '');

        // Update connection status
        this.updateConnectionStatus(true);
    }

    updateStatCard(type, value, unit) {
        const valueElement = document.getElementById(`${type}-usage`);
        const progressElement = document.getElementById(`${type}-progress`);
        
        if (valueElement) {
            // Animate value change
            this.animateValue(valueElement, parseInt(valueElement.textContent) || 0, value, unit);
        }
        
        if (progressElement) {
            // Animate progress bar
            const targetWidth = type === 'network' ? Math.min(value / 100 * 100, 100) : value;
            progressElement.style.width = `${targetWidth}%`;
        }
    }

    animateValue(element, start, end, unit) {
        const duration = 1000;
        const startTime = performance.now();
        
        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            const current = Math.round(start + (end - start) * progress);
            element.textContent = `${current}${unit}`;
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };
        
        requestAnimationFrame(animate);
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    async loadDashboardData() {
        try {
            await this.loadServers();
            await this.loadCustomActions();
            this.updateServerCounts();
        } catch (error) {
            console.error('Error loading dashboard data:', error);
        }
    }

    async loadServers() {
        try {
            const headers = {};
            if (this.auth && this.auth.getToken()) {
                headers['Authorization'] = `Bearer ${this.auth.getToken()}`;
            }

            const response = await fetch('/api/servers', { headers });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const servers = await response.json();
            this.displayServers(servers);
            
        } catch (error) {
            console.error('Error loading servers:', error);
            this.displayEmptyServers();
        }
    }

    displayServers(servers) {
        const serversGrid = document.getElementById('servers-grid');
        if (!serversGrid) return;

        if (!servers || servers.length === 0) {
            this.displayEmptyServers();
            return;
        }

        serversGrid.innerHTML = servers.map(server => `
            <div class="server-card" data-server-id="${server.id}">
                <div class="server-header">
                    <h5>${server.name}</h5>
                    <span class="server-status ${server.status}">${server.status === 'online' ? 'Онлайн' : 'Офлайн'}</span>
                </div>
                <div class="server-info">
                    <p><i class="fas fa-globe"></i> ${server.ip}</p>
                    <p><i class="fas fa-microchip"></i> CPU: ${server.cpu_usage || 0}%</p>
                    <p><i class="fas fa-memory"></i> RAM: ${server.memory_usage || 0}%</p>
                    <p><i class="fas fa-hdd"></i> Диск: ${server.disk_usage || 0}%</p>
                </div>
                <div class="server-actions">
                    <button class="btn btn-secondary" onclick="dashboard.connectToServer('${server.id}')">
                        <i class="fas fa-terminal"></i>
                        Терминал
                    </button>
                    <button class="btn btn-primary" onclick="dashboard.manageServer('${server.id}')">
                        <i class="fas fa-cog"></i>
                        Управление
                    </button>
                </div>
            </div>
        `).join('');

        // Animate server cards
        this.animateServerCards();
    }

    displayEmptyServers() {
        const serversGrid = document.getElementById('servers-grid');
        if (!serversGrid) return;

        serversGrid.innerHTML = `
            <div class="empty-servers">
                <i class="fas fa-server"></i>
                <h4>Нет подключенных серверов</h4>
                <p>Добавьте свой первый сервер для начала работы</p>
                <button class="btn btn-primary" onclick="dashboard.showAddServerModal()">
                    <i class="fas fa-plus"></i>
                    Добавить сервер
                </button>
            </div>
        `;
    }

    animateServerCards() {
        const cards = document.querySelectorAll('.server-card');
        cards.forEach((card, index) => {
            card.style.opacity = '0';
            card.style.transform = 'translateY(20px) scale(0.95)';
            
            setTimeout(() => {
                card.style.transition = 'all 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
                card.style.opacity = '1';
                card.style.transform = 'translateY(0) scale(1)';
            }, index * 100);
        });
    }

    updateServerCounts() {
        const serverCards = document.querySelectorAll('.server-card');
        const onlineServers = document.querySelectorAll('.server-status.online').length;
        
        const totalElement = document.getElementById('total-servers');
        const onlineElement = document.getElementById('online-servers');
        
        if (totalElement) {
            this.animateValue(totalElement, 0, serverCards.length, '');
        }
        
        if (onlineElement) {
            this.animateValue(onlineElement, 0, onlineServers, '');
        }
    }

    async loadCustomActions() {
        try {
            const headers = {};
            if (this.auth && this.auth.getToken()) {
                headers['Authorization'] = `Bearer ${this.auth.getToken()}`;
            }

            const response = await fetch('/api/custom-actions', { headers });
            
            if (response.ok) {
                const actions = await response.json();
                this.displayCustomActions(actions);
            }
            
        } catch (error) {
            console.error('Error loading custom actions:', error);
        }
    }

    displayCustomActions(actions) {
        // Implementation for custom actions display
        console.log('Custom actions loaded:', actions);
    }

    loadSectionData(sectionName) {
        switch (sectionName) {
            case 'servers':
                this.loadServers();
                break;
            case 'monitoring':
                this.initializeCharts();
                break;
            case 'files':
                this.loadFileManager();
                break;
            case 'terminal':
                this.initializeTerminal();
                break;
        }
    }

    initializeCharts() {
        // Initialize Chart.js charts for monitoring section
        if (typeof Chart === 'undefined') return;

        const cpuChart = document.getElementById('cpu-chart');
        const memoryChart = document.getElementById('memory-chart');

        if (cpuChart && !this.charts.cpu) {
            this.charts.cpu = new Chart(cpuChart, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'CPU Usage %',
                        data: [],
                        borderColor: 'rgb(102, 126, 234)',
                        backgroundColor: 'rgba(102, 126, 234, 0.1)',
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: {
                            labels: {
                                color: '#ffffff'
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            max: 100,
                            ticks: {
                                color: '#b8b9c7'
                            },
                            grid: {
                                color: 'rgba(255, 255, 255, 0.1)'
                            }
                        },
                        x: {
                            ticks: {
                                color: '#b8b9c7'
                            },
                            grid: {
                                color: 'rgba(255, 255, 255, 0.1)'
                            }
                        }
                    }
                }
            });
        }

        if (memoryChart && !this.charts.memory) {
            this.charts.memory = new Chart(memoryChart, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Memory Usage %',
                        data: [],
                        borderColor: 'rgb(240, 147, 251)',
                        backgroundColor: 'rgba(240, 147, 251, 0.1)',
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: {
                            labels: {
                                color: '#ffffff'
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            max: 100,
                            ticks: {
                                color: '#b8b9c7'
                            },
                            grid: {
                                color: 'rgba(255, 255, 255, 0.1)'
                            }
                        },
                        x: {
                            ticks: {
                                color: '#b8b9c7'
                            },
                            grid: {
                                color: 'rgba(255, 255, 255, 0.1)'
                            }
                        }
                    }
                }
            });
        }
    }

    initializeWebSocket() {
        if (typeof io !== 'undefined') {
            this.socket = io();
            
            this.socket.on('connect', () => {
                console.log('WebSocket connected');
                this.isConnected = true;
                this.updateConnectionStatus(true);
            });

            this.socket.on('disconnect', () => {
                console.log('WebSocket disconnected');
                this.isConnected = false;
                this.updateConnectionStatus(false);
            });

            this.socket.on('system_stats', (data) => {
                this.displaySystemStats(data);
            });
        }
    }

    updateConnectionStatus(connected) {
        const statusElement = document.getElementById('connection-status');
        if (!statusElement) return;

        const indicator = statusElement.querySelector('.status-indicator');
        const text = statusElement.querySelector('span');

        if (connected) {
            indicator.className = 'status-indicator online';
            text.textContent = 'Подключено';
            statusElement.classList.remove('offline');
        } else {
            indicator.className = 'status-indicator offline';
            text.textContent = 'Отключено';
            statusElement.classList.add('offline');
        }
    }

    showConnectionError() {
        this.updateConnectionStatus(false);
        this.showNotification('Ошибка подключения к серверу', 'error');
    }

    showWelcomeAnimation() {
        const welcomeCard = document.querySelector('.welcome-card');
        if (welcomeCard) {
            welcomeCard.style.opacity = '0';
            welcomeCard.style.transform = 'translateY(-20px)';
            
            setTimeout(() => {
                welcomeCard.style.transition = 'all 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
                welcomeCard.style.opacity = '1';
                welcomeCard.style.transform = 'translateY(0)';
            }, 300);
        }
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
                <span>${message}</span>
            </div>
            <button class="notification-close">
                <i class="fas fa-times"></i>
            </button>
        `;

        // Add to page
        document.body.appendChild(notification);

        // Auto remove after 5 seconds
        setTimeout(() => {
            notification.classList.add('fade-out');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 5000);

        // Close button
        notification.querySelector('.notification-close').addEventListener('click', () => {
            notification.classList.add('fade-out');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        });
    }

    // Modal functions
    showAddServerModal() {
        const modal = document.getElementById('add-server-modal');
        if (modal) {
            modal.classList.add('active');
            document.body.classList.add('modal-open');
        }
    }

    closeAddServerModal() {
        const modal = document.getElementById('add-server-modal');
        if (modal) {
            modal.classList.remove('active');
            document.body.classList.remove('modal-open');
        }
    }

    closeModal(modal) {
        if (modal) {
            modal.classList.remove('active');
            document.body.classList.remove('modal-open');
        }
    }

    switchModalTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`${tabName}-tab`).classList.add('active');
    }

    toggleUserDropdown() {
        const dropdown = document.querySelector('.user-dropdown');
        if (dropdown) {
            dropdown.classList.toggle('active');
        }
    }

    closeAllDropdowns() {
        document.querySelectorAll('.user-dropdown').forEach(dropdown => {
            dropdown.classList.remove('active');
        });
    }

    handleSearch(query) {
        // Implement search functionality
        console.log('Searching for:', query);
    }

    executeTerminalCommand(command) {
        // Add command to terminal output
        const output = document.getElementById('terminal-output');
        if (output) {
            const line = document.createElement('div');
            line.className = 'terminal-line';
            line.innerHTML = `
                <span class="terminal-prompt">admin@xpanel:~$</span>
                <span class="terminal-text">${command}</span>
            `;
            output.appendChild(line);

            // Scroll to bottom
            output.scrollTop = output.scrollHeight;
        }

        // Execute command via API
        this.sendTerminalCommand(command);
    }

    async sendTerminalCommand(command) {
        try {
            const headers = {
                'Content-Type': 'application/json'
            };
            
            if (this.auth && this.auth.getToken()) {
                headers['Authorization'] = `Bearer ${this.auth.getToken()}`;
            }

            const response = await fetch('/api/terminal/execute', {
                method: 'POST',
                headers,
                body: JSON.stringify({ command })
            });

            if (response.ok) {
                const result = await response.json();
                this.displayTerminalOutput(result.output);
            }
        } catch (error) {
            console.error('Terminal command error:', error);
            this.displayTerminalOutput('Error executing command');
        }
    }

    displayTerminalOutput(output) {
        const terminalOutput = document.getElementById('terminal-output');
        if (terminalOutput) {
            const line = document.createElement('div');
            line.className = 'terminal-line';
            line.innerHTML = `<span class="terminal-text">${output}</span>`;
            terminalOutput.appendChild(line);
            terminalOutput.scrollTop = terminalOutput.scrollHeight;
        }
    }

    // Server management functions
    connectToServer(serverId) {
        this.navigateToSection('terminal');
        // Set selected server in terminal
        console.log('Connecting to server:', serverId);
    }

    manageServer(serverId) {
        console.log('Managing server:', serverId);
        // Open server management modal or navigate to server details
    }

    // Utility functions
    async refreshDashboard() {
        this.showNotification('Обновление данных...', 'info');
        
        try {
            await this.loadDashboardData();
            await this.updateSystemStats();
            this.showNotification('Данные обновлены', 'success');
        } catch (error) {
            console.error('Refresh error:', error);
            this.showNotification('Ошибка обновления данных', 'error');
        }
    }

    copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            this.showNotification('Скопировано в буфер обмена', 'success');
        }).catch(() => {
            this.showNotification('Ошибка копирования', 'error');
        });
    }

    copyInstallCommand() {
        const command = `curl -sSL ${window.location.origin}/api/agent/install | bash`;
        this.copyToClipboard(command);
    }

    logout() {
        if (this.auth) {
            this.auth.logout();
        } else {
            window.location.href = '/login';
        }
    }

    // Cleanup
    destroy() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        
        if (this.socket) {
            this.socket.disconnect();
        }
        
        Object.values(this.charts).forEach(chart => {
            if (chart) chart.destroy();
        });
    }
}

// Initialize dashboard when DOM is loaded
let dashboard;

document.addEventListener('DOMContentLoaded', () => {
    dashboard = new ModernDashboard();
});

// Global functions for HTML onclick handlers
window.dashboard = {
    showAddServerModal: () => dashboard?.showAddServerModal(),
    closeAddServerModal: () => dashboard?.closeAddServerModal(),
    refreshDashboard: () => dashboard?.refreshDashboard(),
    connectToServer: (id) => dashboard?.connectToServer(id),
    manageServer: (id) => dashboard?.manageServer(id),
    copyToClipboard: (text) => dashboard?.copyToClipboard(text),
    copyInstallCommand: () => dashboard?.copyInstallCommand(),
    logout: () => dashboard?.logout()
};
