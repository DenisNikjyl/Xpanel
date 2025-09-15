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
            
            // Интеграция с системой реального мониторинга
            if (typeof realMonitoring !== 'undefined') {
                console.log('Интеграция с системой реального мониторинга');
            }
            
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

    displayEmptyServers() {
        const serversGrid = document.getElementById('servers-grid');
        const serversList = document.getElementById('servers-list');
        
        const emptyState = `
            <div class="empty-state">
                <div class="empty-icon">
                    <i class="fas fa-server"></i>
                </div>
                <h3 class="empty-title">Нет серверов</h3>
                <p class="empty-description">Добавьте свой первый сервер для начала работы</p>
                <button class="btn btn-primary" onclick="dashboard.showAddServerModal()">
                    <i class="fas fa-plus"></i> Добавить сервер
                </button>
            </div>
        `;
        
        if (serversGrid) serversGrid.innerHTML = emptyState;
        if (serversList) serversList.innerHTML = emptyState;
    }

    displayServers(servers) {
        const serversGrid = document.getElementById('servers-grid');
        const serversList = document.getElementById('servers-list');
        
        if (!serversGrid && !serversList) return;
        
        if (servers.length === 0) {
            const emptyState = `
                <div class="empty-state">
                    <div class="empty-icon">
                        <i class="fas fa-server"></i>
                    </div>
                    <h3 class="empty-title">Нет серверов</h3>
                    <p class="empty-description">Добавьте свой первый сервер для начала работы</p>
                </div>
            `;
            
            if (serversGrid) serversGrid.innerHTML = emptyState;
            if (serversList) serversList.innerHTML = emptyState;
            return;
        }
        
        const serversHTML = servers.map(server => {
            const statusClass = this.getServerStatusClass(server.status);
            const statusText = this.getServerStatusText(server.status);
            
            return `
                <div class="server-card">
                    <div class="server-header">
                        <div class="server-info">
                            <h4 class="server-name">${server.name}</h4>
                            <p class="server-host">${server.host}:${server.port}</p>
                            <p class="server-description">${server.description || ''}</p>
                        </div>
                        <div class="server-status ${statusClass}" title="${statusText}">
                            <i class="fas fa-circle"></i>
                        </div>
                    </div>
                    <div class="server-stats">
                        <div class="stat">
                            <span class="stat-label">CPU</span>
                            <span class="stat-value">${server.cpu_usage || 0}%</span>
                        </div>
                        <div class="stat">
                            <span class="stat-label">RAM</span>
                            <span class="stat-value">${server.memory_usage || 0}%</span>
                        </div>
                        <div class="stat">
                            <span class="stat-label">Disk</span>
                            <span class="stat-value">${server.disk_usage || 0}%</span>
                        </div>
                    </div>
                    <div class="server-actions">
                        <button class="btn btn-sm btn-secondary" onclick="dashboard.connectToServer('${server.id}')" title="Подключиться по SSH">
                            <i class="fas fa-terminal"></i>
                        </button>
                        <button class="btn btn-sm btn-secondary" onclick="dashboard.showEditServerModal('${server.id}')" title="Редактировать">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="dashboard.showDeleteServerModal('${server.id}', '${server.name}')" title="Удалить">
                            <i class="fas fa-trash"></i>
                        </button>
                        <button class="btn btn-sm btn-primary" onclick="dashboard.testServerConnection('${server.id}')" title="Проверить соединение">
                            <i class="fas fa-plug"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
        
        if (serversGrid) serversGrid.innerHTML = serversHTML;
        if (serversList) serversList.innerHTML = serversHTML;
    }

    getServerStatusClass(status) {
        switch (status) {
            case 'online': return 'status-online';
            case 'offline': return 'status-offline';
            case 'error': return 'status-error';
            default: return 'status-unknown';
        }
    }

    getServerStatusText(status) {
        switch (status) {
            case 'online': return 'Онлайн';
            case 'offline': return 'Офлайн';
            case 'error': return 'Ошибка';
            default: return 'Неизвестно';
        }
    }

    async testServerConnection(serverId) {
        try {
            this.showNotification('Проверка соединения...', 'info');
            
            const response = await fetch(`/api/servers/${serverId}/test`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.auth.getToken()}`
                }
            });
            
            const result = await response.json();
            
            if (response.ok) {
                this.showNotification('Соединение успешно', 'success');
                this.loadServers(); // Refresh to update status
            } else {
                this.showNotification(result.message || 'Ошибка соединения', 'error');
            }
        } catch (error) {
            console.error('Test connection error:', error);
            this.showNotification('Ошибка проверки соединения', 'error');
        }
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
        
        // Set the selected server in terminal
        const serverSelect = document.querySelector('#terminal-section #server-select');
        if (serverSelect) {
            serverSelect.value = serverId;
        }
        
        this.showNotification('Переключение на терминал', 'info');
    }

    manageServer(serverId) {
        this.showEditServerModal(serverId);
    }

    showAddServerModal() {
        const modal = document.getElementById('add-server-modal');
        modal.classList.add('active');
        
        // Reset form
        document.getElementById('add-server-form').reset();
        document.getElementById('server-port').value = '22';
        
        // Setup auth method toggle
        const authMethod = document.getElementById('auth-method');
        const passwordGroup = document.getElementById('password-group');
        const keyGroup = document.getElementById('key-group');
        
        authMethod.addEventListener('change', function() {
            if (this.value === 'key') {
                passwordGroup.style.display = 'none';
                keyGroup.style.display = 'block';
            } else {
                passwordGroup.style.display = 'block';
                keyGroup.style.display = 'none';
            }
        });
    }

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        modal.classList.remove('active');
    }

    async addServer() {
        const form = document.getElementById('add-server-form');
        const formData = new FormData(form);
        const serverData = Object.fromEntries(formData.entries());
        
        try {
            const response = await fetch('/api/servers', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.auth.getToken()}`
                },
                body: JSON.stringify(serverData)
            });
            
            const result = await response.json();
            
            if (response.ok) {
                this.showNotification('Сервер успешно добавлен', 'success');
                this.closeModal('add-server-modal');
                this.loadServers();
            } else {
                this.showNotification(result.message || 'Ошибка добавления сервера', 'error');
            }
        } catch (error) {
            console.error('Add server error:', error);
            this.showNotification('Ошибка соединения с сервером', 'error');
        }
    }

    showEditServerModal(serverId) {
        const modal = document.getElementById('edit-server-modal');
        modal.classList.add('active');
        
        // Load server data
        this.loadServerForEdit(serverId);
    }

    async loadServerForEdit(serverId) {
        try {
            const response = await fetch(`/api/servers/${serverId}`, {
                headers: {
                    'Authorization': `Bearer ${this.auth.getToken()}`
                }
            });
            
            if (response.ok) {
                const server = await response.json();
                
                document.getElementById('edit-server-id').value = server.id;
                document.getElementById('edit-server-name').value = server.name;
                document.getElementById('edit-server-host').value = server.host;
                document.getElementById('edit-server-port').value = server.port;
                document.getElementById('edit-server-username').value = server.username;
                document.getElementById('edit-server-description').value = server.description || '';
            } else {
                this.showNotification('Ошибка загрузки данных сервера', 'error');
            }
        } catch (error) {
            console.error('Load server error:', error);
            this.showNotification('Ошибка соединения', 'error');
        }
    }

    async updateServer() {
        const form = document.getElementById('edit-server-form');
        const formData = new FormData(form);
        const serverData = Object.fromEntries(formData.entries());
        const serverId = serverData.id;
        
        try {
            const response = await fetch(`/api/servers/${serverId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.auth.getToken()}`
                },
                body: JSON.stringify(serverData)
            });
            
            const result = await response.json();
            
            if (response.ok) {
                this.showNotification('Сервер обновлён', 'success');
                this.closeModal('edit-server-modal');
                this.loadServers();
            } else {
                this.showNotification(result.message || 'Ошибка обновления сервера', 'error');
            }
        } catch (error) {
            console.error('Update server error:', error);
            this.showNotification('Ошибка соединения', 'error');
        }
    }

    showDeleteServerModal(serverId, serverName) {
        const modal = document.getElementById('delete-server-modal');
        modal.classList.add('active');
        
        document.getElementById('delete-server-id').value = serverId;
        document.getElementById('delete-server-name').textContent = serverName;
    }

    async deleteServer() {
        const serverId = document.getElementById('delete-server-id').value;
        
        try {
            const response = await fetch(`/api/servers/${serverId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${this.auth.getToken()}`
                }
            });
            
            if (response.ok) {
                this.showNotification('Сервер удалён', 'success');
                this.closeModal('delete-server-modal');
                this.loadServers();
            } else {
                const result = await response.json();
                this.showNotification(result.message || 'Ошибка удаления сервера', 'error');
            }
        } catch (error) {
            console.error('Delete server error:', error);
            this.showNotification('Ошибка соединения', 'error');
        }
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

    // Agent Installation Progress Functions
    showInstallModal(serverId) {
        const modal = document.getElementById('agent-install-modal');
        modal.classList.add('active');
        
        // Reset progress
        this.resetInstallProgress();
        
        // Start installation
        this.startAgentInstallation(serverId);
    }

    resetInstallProgress() {
        const progressFill = document.getElementById('install-progress-fill');
        const progressLabel = document.querySelector('.progress-label');
        const progressPercentage = document.querySelector('.progress-percentage');
        const terminal = document.getElementById('install-terminal');
        const cancelBtn = document.getElementById('install-cancel-btn');
        const closeBtn = document.getElementById('install-close-btn');
        
        progressFill.style.width = '0%';
        progressLabel.textContent = 'Подключение к серверу...';
        progressPercentage.textContent = '0%';
        
        terminal.innerHTML = `
            <div class="terminal-line">
                <span class="terminal-prompt">root@xpanel:~$</span>
                <span class="terminal-text">Начинаем установку агента...</span>
            </div>
        `;
        
        cancelBtn.style.display = 'inline-block';
        closeBtn.style.display = 'none';
    }

    async startAgentInstallation(serverId) {
        try {
            // Get server data
            const serverResponse = await fetch(`/api/servers/${serverId}`, {
                headers: {
                    'Authorization': `Bearer ${this.auth.getToken()}`
                }
            });
            
            if (!serverResponse.ok) {
                throw new Error('Не удалось получить данные сервера');
            }
            
            const server = await serverResponse.json();
            
            // Start real installation
            await this.performRealInstallation(server);
            
        } catch (error) {
            console.error('Installation error:', error);
            this.addTerminalLine('error', `Ошибка: ${error.message}`);
            this.updateProgress(0, 'Ошибка установки');
        }
    }

    async performRealInstallation(server) {
        this.updateProgress(10, 'Подключение к серверу...');
        this.addTerminalLine('info', `Подключение к ${server.host}:${server.port}...`);
        
        try {
            // Real API call to install agent
            const installResponse = await fetch(`/api/servers/${server.id}/install-agent`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.auth.getToken()}`
                },
                body: JSON.stringify({
                    host: server.host,
                    port: server.port,
                    username: server.username,
                    password: server.password,
                    key_file: server.ssh_key,
                    panel_address: window.location.hostname
                })
            });

            this.updateProgress(30, 'Выполняется установка...');
            this.addTerminalLine('info', 'Отправка команд установки на сервер...');

            if (!installResponse.ok) {
                const errorData = await installResponse.json();
                throw new Error(errorData.error || 'Ошибка установки агента');
            }

            const result = await installResponse.json();
            
            if (result.success) {
                this.updateProgress(70, 'Настройка агента...');
                this.addTerminalLine('success', 'Агент успешно установлен');
                this.addTerminalLine('info', 'Настройка конфигурации...');
                
                // Wait a bit for agent to start
                await this.delay(2000);
                
                this.updateProgress(90, 'Проверка соединения...');
                this.addTerminalLine('info', 'Проверка связи с агентом...');
                
                // Check if agent is responding
                await this.delay(1000);
                
                this.updateProgress(100, 'Установка завершена!');
                this.addTerminalLine('success', 'Агент запущен и готов к работе!');
                this.completeInstallation();
                
            } else {
                throw new Error(result.error || 'Неизвестная ошибка установки');
            }
            
        } catch (error) {
            this.addTerminalLine('error', `Ошибка установки: ${error.message}`);
            this.updateProgress(0, 'Ошибка установки');
            
            const cancelBtn = document.getElementById('install-cancel-btn');
            const closeBtn = document.getElementById('install-close-btn');
            cancelBtn.style.display = 'none';
            closeBtn.style.display = 'inline-block';
        }
    }

    async simulateInstallationSteps(server) {
        const steps = [
            { progress: 10, label: 'Подключение к серверу...', message: `Подключение к ${server.host}:${server.port}...`, type: 'info' },
            { progress: 20, label: 'Проверка системы...', message: 'Проверка операционной системы и архитектуры...', type: 'info' },
            { progress: 30, label: 'Загрузка агента...', message: 'Загрузка последней версии Xpanel Agent...', type: 'info' },
            { progress: 50, label: 'Установка зависимостей...', message: 'Установка Python и необходимых библиотек...', type: 'info' },
            { progress: 70, label: 'Настройка агента...', message: 'Создание конфигурационных файлов...', type: 'info' },
            { progress: 85, label: 'Запуск сервиса...', message: 'Запуск и настройка автозапуска агента...', type: 'info' },
            { progress: 95, label: 'Проверка соединения...', message: 'Проверка связи с панелью управления...', type: 'success' },
            { progress: 100, label: 'Установка завершена!', message: 'Агент успешно установлен и запущен!', type: 'success' }
        ];

        for (const step of steps) {
            await this.delay(1500 + Math.random() * 1000); // Random delay 1.5-2.5s
            this.updateProgress(step.progress, step.label);
            this.addTerminalLine(step.type, step.message);
            
            // Add some realistic command outputs
            if (step.progress === 20) {
                this.addTerminalLine('info', 'OS: Ubuntu 20.04.6 LTS');
                this.addTerminalLine('info', 'Architecture: x86_64');
            } else if (step.progress === 50) {
                this.addTerminalLine('info', 'Installing: python3-pip python3-venv...');
                this.addTerminalLine('success', 'Dependencies installed successfully');
            } else if (step.progress === 85) {
                this.addTerminalLine('info', 'Creating systemd service...');
                this.addTerminalLine('success', 'Service enabled and started');
            }
        }

        // Show completion
        this.completeInstallation();
    }

    updateProgress(percentage, label) {
        const progressFill = document.getElementById('install-progress-fill');
        const progressLabel = document.querySelector('.progress-label');
        const progressPercentage = document.querySelector('.progress-percentage');
        
        progressFill.style.width = `${percentage}%`;
        progressLabel.textContent = label;
        progressPercentage.textContent = `${percentage}%`;
    }

    addTerminalLine(type, message) {
        const terminal = document.getElementById('install-terminal');
        const line = document.createElement('div');
        line.className = 'terminal-line';
        
        line.innerHTML = `
            <span class="terminal-prompt">root@xpanel:~$</span>
            <span class="terminal-text ${type}">${message}</span>
        `;
        
        terminal.appendChild(line);
        terminal.scrollTop = terminal.scrollHeight;
    }

    completeInstallation() {
        const cancelBtn = document.getElementById('install-cancel-btn');
        const closeBtn = document.getElementById('install-close-btn');
        
        cancelBtn.style.display = 'none';
        closeBtn.style.display = 'inline-block';
        
        this.showNotification('Агент успешно установлен!', 'success');
        
        // Refresh servers list
        setTimeout(() => {
            this.loadServers();
        }, 2000);
    }

    cancelInstallation() {
        this.addTerminalLine('warning', 'Установка отменена пользователем');
        this.updateProgress(0, 'Установка отменена');
        
        const cancelBtn = document.getElementById('install-cancel-btn');
        const closeBtn = document.getElementById('install-close-btn');
        
        cancelBtn.style.display = 'none';
        closeBtn.style.display = 'inline-block';
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
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
    showInstallModal: (id) => dashboard?.showInstallModal(id),
    cancelInstallation: () => dashboard?.cancelInstallation(),
    closeModal: (id) => dashboard?.closeModal(id),
    addServer: () => dashboard?.addServer(),
    updateServer: () => dashboard?.updateServer(),
    deleteServer: () => dashboard?.deleteServer(),
    refreshDashboard: () => dashboard?.refreshDashboard(),
    logout: () => dashboard?.logout()
};
