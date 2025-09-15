/**
 * Xpanel Dashboard V2 - Modern & Functional JavaScript
 */

class DashboardV2 {
    constructor() {
        this.auth = null;
        this.socket = null;
        this.charts = {};
        this.updateInterval = null;
        this.currentSection = 'dashboard';
        
        this.init();
    }

    async init() {
        try {
            // Initialize auth system
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
            this.startSystemMonitoring();
            this.loadDashboardData();
            this.initializeCharts();
            
        } catch (error) {
            console.error('Dashboard initialization error:', error);
            this.showNotification('Ошибка инициализации панели', 'error');
        }
    }

    setupEventListeners() {
        // Sidebar toggle
        const sidebarToggle = document.getElementById('sidebar-toggle');
        if (sidebarToggle) {
            sidebarToggle.addEventListener('click', () => {
                this.toggleSidebar();
            });
        }

        // Navigation items
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const section = item.dataset.section;
                if (section) {
                    this.navigateToSection(section);
                }
            });
        });

        // User menu
        const userMenu = document.getElementById('user-menu');
        const userDropdown = document.getElementById('user-dropdown');
        if (userMenu && userDropdown) {
            userMenu.addEventListener('click', (e) => {
                e.stopPropagation();
                userDropdown.classList.toggle('active');
            });
        }

        // Close dropdowns when clicking outside
        document.addEventListener('click', () => {
            document.querySelectorAll('.user-dropdown').forEach(dropdown => {
                dropdown.classList.remove('active');
            });
        });

        // Search functionality
        const searchInput = document.querySelector('.search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.handleSearch(e.target.value);
            });
        }

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

        // Responsive sidebar
        this.handleResize();
        window.addEventListener('resize', () => {
            this.handleResize();
        });
    }

    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        if (sidebar) {
            sidebar.classList.toggle('collapsed');
        }
    }

    handleResize() {
        const sidebar = document.getElementById('sidebar');
        if (window.innerWidth <= 1024) {
            sidebar?.classList.add('mobile-hidden');
        } else {
            sidebar?.classList.remove('mobile-hidden');
        }
    }

    initializeNavigation() {
        const currentSection = window.location.hash.substring(1) || 'dashboard';
        this.navigateToSection(currentSection);
    }

    navigateToSection(sectionName) {
        // Update active navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        
        const activeNavItem = document.querySelector(`[data-section="${sectionName}"]`);
        if (activeNavItem) {
            activeNavItem.classList.add('active');
        }

        // Show/hide content sections
        document.querySelectorAll('.content-section').forEach(section => {
            section.classList.remove('active');
        });

        const targetSection = document.getElementById(`${sectionName}-section`);
        if (targetSection) {
            targetSection.classList.add('active');
        }

        // Update breadcrumb
        const currentPage = document.getElementById('current-page');
        if (currentPage) {
            const sectionNames = {
                'dashboard': 'Dashboard',
                'servers': 'Серверы',
                'monitoring': 'Мониторинг',
                'terminal': 'Терминал',
                'files': 'Файлы',
                'logs': 'Логи',
                'settings': 'Настройки',
                'users': 'Пользователи'
            };
            currentPage.textContent = sectionNames[sectionName] || sectionName;
        }

        // Update URL
        window.location.hash = sectionName;
        this.currentSection = sectionName;

        // Load section-specific data
        this.loadSectionData(sectionName);
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
    }

    updateStatCard(type, value, unit) {
        const valueElement = document.getElementById(`${type}-usage`);
        const progressElement = document.getElementById(`${type}-progress`);
        
        if (valueElement) {
            this.animateValue(valueElement, parseInt(valueElement.textContent) || 0, value, unit);
        }
        
        if (progressElement) {
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
        const serversList = document.getElementById('servers-list');
        
        if (!servers || servers.length === 0) {
            this.displayEmptyServers();
            return;
        }

        const serverHTML = servers.map(server => `
            <div class="server-card" data-server-id="${server.id}">
                <div class="server-header">
                    <div class="server-name">${server.name}</div>
                    <div class="server-status ${server.status}">${server.status === 'online' ? 'Онлайн' : 'Офлайн'}</div>
                </div>
                <div class="server-info">
                    <div class="server-info-item">
                        <i class="fas fa-globe server-info-icon"></i>
                        <span>${server.ip}</span>
                    </div>
                    <div class="server-info-item">
                        <i class="fas fa-microchip server-info-icon"></i>
                        <span>CPU: ${server.cpu_usage || 0}%</span>
                    </div>
                    <div class="server-info-item">
                        <i class="fas fa-memory server-info-icon"></i>
                        <span>RAM: ${server.memory_usage || 0}%</span>
                    </div>
                    <div class="server-info-item">
                        <i class="fas fa-hdd server-info-icon"></i>
                        <span>Диск: ${server.disk_usage || 0}%</span>
                    </div>
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

        if (serversGrid) serversGrid.innerHTML = serverHTML;
        if (serversList) serversList.innerHTML = serverHTML;

        // Animate server cards
        this.animateServerCards();
    }

    displayEmptyServers() {
        const emptyHTML = `
            <div class="empty-state">
                <div class="empty-icon">
                    <i class="fas fa-server"></i>
                </div>
                <h3 class="empty-title">Нет подключенных серверов</h3>
                <p class="empty-description">Добавьте свой первый сервер для начала работы</p>
                <button class="btn btn-primary" onclick="dashboard.showAddServerModal()">
                    <i class="fas fa-plus"></i>
                    Добавить сервер
                </button>
            </div>
        `;

        const serversGrid = document.getElementById('servers-grid');
        const serversList = document.getElementById('servers-list');
        
        if (serversGrid) serversGrid.innerHTML = emptyHTML;
        if (serversList) serversList.innerHTML = emptyHTML;
    }

    animateServerCards() {
        const cards = document.querySelectorAll('.server-card');
        cards.forEach((card, index) => {
            card.style.opacity = '0';
            card.style.transform = 'translateY(20px)';
            
            setTimeout(() => {
                card.style.transition = 'all 0.5s ease-out';
                card.style.opacity = '1';
                card.style.transform = 'translateY(0)';
            }, index * 100);
        });
    }

    updateServerCounts() {
        const serverCards = document.querySelectorAll('.server-card');
        const serversCountBadge = document.getElementById('servers-count');
        
        if (serversCountBadge) {
            serversCountBadge.textContent = serverCards.length;
        }
    }

    loadSectionData(sectionName) {
        switch (sectionName) {
            case 'servers':
                this.loadServers();
                break;
            case 'monitoring':
                this.initializeCharts();
                break;
            case 'terminal':
                this.loadServerSelect();
                break;
        }
    }

    loadServerSelect() {
        // Load servers for terminal selection
        const serverSelect = document.getElementById('server-select');
        if (serverSelect) {
            // This would be populated with actual server data
            serverSelect.innerHTML = '<option value="">Выберите сервер</option>';
        }
    }

    initializeCharts() {
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
                        borderColor: '#6366f1',
                        backgroundColor: 'rgba(99, 102, 241, 0.1)',
                        tension: 0.4,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            labels: {
                                color: '#f1f5f9'
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            max: 100,
                            ticks: {
                                color: '#cbd5e1'
                            },
                            grid: {
                                color: 'rgba(203, 213, 225, 0.1)'
                            }
                        },
                        x: {
                            ticks: {
                                color: '#cbd5e1'
                            },
                            grid: {
                                color: 'rgba(203, 213, 225, 0.1)'
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
                        borderColor: '#06b6d4',
                        backgroundColor: 'rgba(6, 182, 212, 0.1)',
                        tension: 0.4,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            labels: {
                                color: '#f1f5f9'
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            max: 100,
                            ticks: {
                                color: '#cbd5e1'
                            },
                            grid: {
                                color: 'rgba(203, 213, 225, 0.1)'
                            }
                        },
                        x: {
                            ticks: {
                                color: '#cbd5e1'
                            },
                            grid: {
                                color: 'rgba(203, 213, 225, 0.1)'
                            }
                        }
                    }
                }
            });
        }
    }

    handleSearch(query) {
        console.log('Searching for:', query);
        // Implement search functionality
    }

    executeTerminalCommand(command) {
        const output = document.getElementById('terminal-output');
        if (output) {
            const line = document.createElement('div');
            line.style.color = '#00ff00';
            line.innerHTML = `admin@xpanel:~$ <span style="color: #fff;">${command}</span>`;
            output.appendChild(line);
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
            line.style.color = '#fff';
            line.textContent = output;
            terminalOutput.appendChild(line);
            terminalOutput.scrollTop = terminalOutput.scrollHeight;
        }
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: var(--radius-lg);
            padding: 1rem 1.5rem;
            box-shadow: var(--shadow-lg);
            z-index: 10000;
            display: flex;
            align-items: center;
            gap: 0.75rem;
            max-width: 400px;
            animation: slideInRight 0.3s ease-out;
        `;
        
        const iconMap = {
            'success': 'fas fa-check-circle',
            'error': 'fas fa-exclamation-circle',
            'warning': 'fas fa-exclamation-triangle',
            'info': 'fas fa-info-circle'
        };
        
        const colorMap = {
            'success': 'var(--success)',
            'error': 'var(--error)',
            'warning': 'var(--warning)',
            'info': 'var(--primary)'
        };
        
        notification.innerHTML = `
            <i class="${iconMap[type] || iconMap.info}" style="color: ${colorMap[type] || colorMap.info};"></i>
            <span style="color: var(--text-primary); flex: 1;">${message}</span>
            <button onclick="this.parentElement.remove()" style="background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 0.25rem;">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        document.body.appendChild(notification);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.animation = 'slideOutRight 0.3s ease-out';
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                }, 300);
            }
        }, 5000);
    }

    // Server management functions
    connectToServer(serverId) {
        this.navigateToSection('terminal');
        console.log('Connecting to server:', serverId);
    }

    manageServer(serverId) {
        console.log('Managing server:', serverId);
    }

    showAddServerModal() {
        this.showNotification('Функция добавления сервера в разработке', 'info');
    }

    refreshDashboard() {
        this.showNotification('Обновление данных...', 'info');
        
        try {
            this.loadDashboardData();
            this.updateSystemStats();
            this.showNotification('Данные обновлены', 'success');
        } catch (error) {
            console.error('Refresh error:', error);
            this.showNotification('Ошибка обновления данных', 'error');
        }
    }

    copyToClipboard(text) {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(text).then(() => {
                this.showNotification('Скопировано в буфер обмена', 'success');
            }).catch(() => {
                this.showNotification('Ошибка копирования', 'error');
            });
        } else {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            try {
                document.execCommand('copy');
                this.showNotification('Скопировано в буфер обмена', 'success');
            } catch (err) {
                this.showNotification('Ошибка копирования', 'error');
            }
            document.body.removeChild(textArea);
        }
    }

    downloadInstallScript() {
        const script = `#!/bin/bash
# Xpanel Agent Installation Script
echo "Installing Xpanel Agent..."
curl -sSL ${window.location.origin}/api/agent/install | bash`;
        
        const blob = new Blob([script], { type: 'text/plain' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = 'install-xpanel-agent.sh';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        this.showNotification('Скрипт установки загружен', 'success');
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
        
        Object.values(this.charts).forEach(chart => {
            if (chart) chart.destroy();
        });
    }
}

// Initialize dashboard
let dashboard;

document.addEventListener('DOMContentLoaded', () => {
    dashboard = new DashboardV2();
});

// Global functions for HTML onclick handlers
window.dashboard = {
    connectToServer: (id) => dashboard?.connectToServer(id),
    manageServer: (id) => dashboard?.manageServer(id),
    showAddServerModal: () => dashboard?.showAddServerModal(),
    logout: () => dashboard?.logout()
};
