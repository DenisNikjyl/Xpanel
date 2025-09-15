// Xpanel JavaScript - Простая панель управления VPS
class XpanelApp {
    constructor() {
        this.apiUrl = window.location.origin;
        this.token = localStorage.getItem('xpanel_token');
        this.currentUser = null;
        this.servers = [];
        this.socket = null;
        
        this.init();
    }

    async init() {
        // Показываем загрузчик
        this.showLoader();
        
        // Инициализируем обработчики событий
        this.initEventListeners();
        
        // Проверяем авторизацию
        await this.checkAuth();
        
        // Скрываем загрузчик
        this.hideLoader();
    }

    initEventListeners() {
        // Авторизация
        document.getElementById('loginBtn').addEventListener('click', () => this.login());
        document.getElementById('registerBtn').addEventListener('click', () => this.register());
        document.getElementById('showRegisterBtn').addEventListener('click', () => this.showRegister());
        document.getElementById('showLoginBtn').addEventListener('click', () => this.showLogin());
        document.getElementById('logoutBtn').addEventListener('click', () => this.logout());

        // Навигация
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });

        // Серверы
        document.getElementById('addServerBtn').addEventListener('click', () => this.showAddServerModal());
        document.getElementById('saveServer').addEventListener('click', () => this.addServer());
        document.getElementById('cancelAddServer').addEventListener('click', () => this.hideAddServerModal());
        document.getElementById('closeAddServerModal').addEventListener('click', () => this.hideAddServerModal());

        // Терминал
        document.getElementById('executeCommand').addEventListener('click', () => this.executeCommand());
        document.getElementById('clearTerminal').addEventListener('click', () => this.clearTerminal());
        document.getElementById('terminalInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.executeCommand();
        });

        // Файлы
        document.getElementById('refreshFiles').addEventListener('click', () => this.loadFiles());

        // Enter для логина
        document.getElementById('loginPassword').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.login();
        });
        document.getElementById('regPassword').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.register();
        });
    }

    showLoader() {
        document.getElementById('loader').classList.remove('hidden');
    }

    hideLoader() {
        document.getElementById('loader').classList.add('hidden');
    }

    async checkAuth() {
        if (!this.token) {
            this.showLogin();
            return;
        }

        try {
            const response = await fetch(`${this.apiUrl}/api/admin/users`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (response.ok) {
                this.showDashboard();
                await this.loadServers();
                this.initWebSocket();
            } else {
                this.token = null;
                localStorage.removeItem('xpanel_token');
                this.showLogin();
            }
        } catch (error) {
            console.error('Auth check failed:', error);
            this.showLogin();
        }
    }

    showLogin() {
        document.getElementById('loginScreen').classList.remove('hidden');
        document.getElementById('registerScreen').classList.add('hidden');
        document.getElementById('dashboard').classList.add('hidden');
    }

    showRegister() {
        document.getElementById('loginScreen').classList.add('hidden');
        document.getElementById('registerScreen').classList.remove('hidden');
        document.getElementById('dashboard').classList.add('hidden');
    }

    showDashboard() {
        document.getElementById('loginScreen').classList.add('hidden');
        document.getElementById('registerScreen').classList.add('hidden');
        document.getElementById('dashboard').classList.remove('hidden');
    }

    async login() {
        const username = document.getElementById('loginUsername').value;
        const password = document.getElementById('loginPassword').value;

        if (!username || !password) {
            this.showNotification('Заполните все поля', 'error');
            return;
        }

        try {
            const response = await fetch(`${this.apiUrl}/api/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (response.ok) {
                this.token = data.token;
                this.currentUser = data.user;
                localStorage.setItem('xpanel_token', this.token);
                
                document.getElementById('currentUser').textContent = this.currentUser.username;
                this.showDashboard();
                await this.loadServers();
                this.initWebSocket();
                this.showNotification('Успешный вход!', 'success');
            } else {
                this.showNotification(data.error || 'Ошибка входа', 'error');
            }
        } catch (error) {
            console.error('Login error:', error);
            this.showNotification('Ошибка подключения к серверу', 'error');
        }
    }

    async register() {
        const username = document.getElementById('regUsername').value;
        const email = document.getElementById('regEmail').value;
        const password = document.getElementById('regPassword').value;

        if (!username || !email || !password) {
            this.showNotification('Заполните все поля', 'error');
            return;
        }

        try {
            const response = await fetch(`${this.apiUrl}/api/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, email, password })
            });

            const data = await response.json();

            if (response.ok) {
                if (data.token) {
                    // Прямая регистрация (админ)
                    this.token = data.token;
                    this.currentUser = data.user;
                    localStorage.setItem('xpanel_token', this.token);
                    
                    document.getElementById('currentUser').textContent = this.currentUser.username;
                    this.showDashboard();
                    await this.loadServers();
                    this.initWebSocket();
                    this.showNotification('Регистрация успешна!', 'success');
                } else {
                    // Требуется подтверждение email
                    this.showNotification('Проверьте email для подтверждения', 'info');
                    this.showLogin();
                }
            } else {
                this.showNotification(data.error || 'Ошибка регистрации', 'error');
            }
        } catch (error) {
            console.error('Register error:', error);
            this.showNotification('Ошибка подключения к серверу', 'error');
        }
    }

    logout() {
        this.token = null;
        this.currentUser = null;
        localStorage.removeItem('xpanel_token');
        
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
        
        this.showLogin();
        this.showNotification('Вы вышли из системы', 'info');
    }

    switchTab(tabName) {
        // Обновляем навигацию
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // Показываем контент
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`${tabName}Tab`).classList.add('active');

        // Загружаем данные для вкладки
        switch (tabName) {
            case 'servers':
                this.loadServers();
                break;
            case 'files':
                this.loadFiles();
                break;
            case 'monitoring':
                this.loadMonitoring();
                break;
        }
    }

    async loadServers() {
        try {
            const response = await fetch(`${this.apiUrl}/api/servers`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (response.ok) {
                this.servers = await response.json();
                this.renderServers();
            } else {
                this.showNotification('Ошибка загрузки серверов', 'error');
            }
        } catch (error) {
            console.error('Load servers error:', error);
            this.showNotification('Ошибка подключения к серверу', 'error');
        }
    }

    renderServers() {
        const grid = document.getElementById('serversGrid');
        
        if (this.servers.length === 0) {
            grid.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 3rem;">
                    <h3>Серверы не найдены</h3>
                    <p>Добавьте первый сервер для начала работы</p>
                    <button class="btn btn-primary" onclick="app.showAddServerModal()">+ Добавить сервер</button>
                </div>
            `;
            return;
        }

        grid.innerHTML = this.servers.map(server => `
            <div class="server-card">
                <div class="server-header">
                    <div class="server-name">${server.name}</div>
                    <div class="server-status status-${server.status}">
                        ${this.getStatusText(server.status)}
                    </div>
                </div>
                <div class="server-info">
                    <p><strong>IP:</strong> ${server.host}:${server.port}</p>
                    <p><strong>Пользователь:</strong> ${server.username}</p>
                    <p><strong>Описание:</strong> ${server.description || 'Нет описания'}</p>
                </div>
                <div class="server-stats">
                    <div class="stat-item">
                        <span class="stat-label">CPU</span>
                        <span class="stat-value">${server.stats?.cpu || 0}%</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">RAM</span>
                        <span class="stat-value">${server.stats?.memory || 0}%</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Диск</span>
                        <span class="stat-value">${server.stats?.disk || 0}%</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Uptime</span>
                        <span class="stat-value">${this.formatUptime(server.stats?.uptime || 0)}</span>
                    </div>
                </div>
                <div class="server-actions">
                    <button class="btn btn-primary" onclick="app.connectToServer(${server.id})">
                        ${server.status === 'online' ? 'Подключен' : 'Подключить'}
                    </button>
                    <button class="btn btn-secondary" onclick="app.deleteServer(${server.id})">Удалить</button>
                </div>
            </div>
        `).join('');
    }

    getStatusText(status) {
        const statusMap = {
            'online': 'Онлайн',
            'offline': 'Офлайн',
            'connecting': 'Подключение...',
            'error': 'Ошибка'
        };
        return statusMap[status] || 'Неизвестно';
    }

    formatUptime(seconds) {
        if (seconds < 60) return `${seconds}с`;
        if (seconds < 3600) return `${Math.floor(seconds / 60)}м`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}ч`;
        return `${Math.floor(seconds / 86400)}д`;
    }

    showAddServerModal() {
        document.getElementById('addServerModal').classList.remove('hidden');
    }

    hideAddServerModal() {
        document.getElementById('addServerModal').classList.add('hidden');
        // Очищаем форму
        document.getElementById('serverName').value = '';
        document.getElementById('serverHost').value = '';
        document.getElementById('serverPort').value = '22';
        document.getElementById('serverUsername').value = '';
        document.getElementById('serverPassword').value = '';
        document.getElementById('serverDescription').value = '';
    }

    async addServer() {
        const serverData = {
            name: document.getElementById('serverName').value,
            host: document.getElementById('serverHost').value,
            port: parseInt(document.getElementById('serverPort').value),
            username: document.getElementById('serverUsername').value,
            password: document.getElementById('serverPassword').value,
            description: document.getElementById('serverDescription').value
        };

        if (!serverData.name || !serverData.host || !serverData.username || !serverData.password) {
            this.showNotification('Заполните обязательные поля', 'error');
            return;
        }

        try {
            const response = await fetch(`${this.apiUrl}/api/servers`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify(serverData)
            });

            if (response.ok) {
                const newServer = await response.json();
                this.servers.push(newServer);
                this.renderServers();
                this.hideAddServerModal();
                this.showNotification('Сервер добавлен успешно!', 'success');
            } else {
                const error = await response.json();
                this.showNotification(error.error || 'Ошибка добавления сервера', 'error');
            }
        } catch (error) {
            console.error('Add server error:', error);
            this.showNotification('Ошибка подключения к серверу', 'error');
        }
    }

    async deleteServer(serverId) {
        if (!confirm('Вы уверены, что хотите удалить этот сервер?')) {
            return;
        }

        try {
            const response = await fetch(`${this.apiUrl}/api/servers/${serverId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (response.ok) {
                this.servers = this.servers.filter(s => s.id !== serverId);
                this.renderServers();
                this.showNotification('Сервер удален', 'success');
            } else {
                this.showNotification('Ошибка удаления сервера', 'error');
            }
        } catch (error) {
            console.error('Delete server error:', error);
            this.showNotification('Ошибка подключения к серверу', 'error');
        }
    }

    async connectToServer(serverId) {
        this.showNotification('Подключение к серверу...', 'info');
        // Здесь можно добавить логику подключения
    }

    executeCommand() {
        const input = document.getElementById('terminalInput');
        const command = input.value.trim();
        
        if (!command) return;

        const terminal = document.getElementById('terminal');
        
        // Добавляем команду в терминал
        const commandLine = document.createElement('div');
        commandLine.className = 'terminal-line';
        commandLine.innerHTML = `root@xpanel:~$ ${command}`;
        terminal.appendChild(commandLine);

        // Симуляция выполнения команды
        const outputLine = document.createElement('div');
        outputLine.className = 'terminal-line';
        
        // Простые команды для демонстрации
        switch (command.toLowerCase()) {
            case 'ls':
                outputLine.textContent = 'Desktop  Documents  Downloads  Pictures  Videos';
                break;
            case 'pwd':
                outputLine.textContent = '/root';
                break;
            case 'whoami':
                outputLine.textContent = 'root';
                break;
            case 'date':
                outputLine.textContent = new Date().toString();
                break;
            case 'clear':
                terminal.innerHTML = '<div class="terminal-line">root@xpanel:~$ <span class="cursor">_</span></div>';
                input.value = '';
                return;
            default:
                outputLine.textContent = `bash: ${command}: command not found`;
        }
        
        terminal.appendChild(outputLine);
        
        // Добавляем новую строку ввода
        const newLine = document.createElement('div');
        newLine.className = 'terminal-line';
        newLine.innerHTML = 'root@xpanel:~$ <span class="cursor">_</span>';
        terminal.appendChild(newLine);
        
        // Прокручиваем вниз
        terminal.scrollTop = terminal.scrollHeight;
        
        // Очищаем ввод
        input.value = '';
    }

    clearTerminal() {
        const terminal = document.getElementById('terminal');
        terminal.innerHTML = '<div class="terminal-line">root@xpanel:~$ <span class="cursor">_</span></div>';
    }

    loadFiles() {
        const fileList = document.getElementById('fileList');
        
        // Демонстрационные файлы
        const files = [
            { name: '..', type: 'directory', size: '-', icon: '📁' },
            { name: 'Documents', type: 'directory', size: '-', icon: '📁' },
            { name: 'Downloads', type: 'directory', size: '-', icon: '📁' },
            { name: 'Pictures', type: 'directory', size: '-', icon: '📁' },
            { name: 'config.txt', type: 'file', size: '1.2 KB', icon: '📄' },
            { name: 'script.sh', type: 'file', size: '856 B', icon: '📜' },
            { name: 'log.txt', type: 'file', size: '45.3 KB', icon: '📄' }
        ];

        fileList.innerHTML = files.map(file => `
            <div class="file-item">
                <div class="file-info">
                    <span class="file-icon">${file.icon}</span>
                    <span class="file-name">${file.name}</span>
                </div>
                <span class="file-size">${file.size}</span>
            </div>
        `).join('');
    }

    loadMonitoring() {
        // Обновляем статистику мониторинга
        this.updateMonitoringStats();
        
        // Обновляем каждые 5 секунд
        setInterval(() => {
            this.updateMonitoringStats();
        }, 5000);
    }

    updateMonitoringStats() {
        // Генерируем случайные данные для демонстрации
        const cpu = Math.floor(Math.random() * 100);
        const ram = Math.floor(Math.random() * 100);
        const disk = Math.floor(Math.random() * 100);

        const stats = document.querySelectorAll('.monitoring-card .stat-item');
        if (stats.length >= 3) {
            stats[0].querySelector('.progress-fill').style.width = `${cpu}%`;
            stats[0].querySelector('.stat-value').textContent = `${cpu}%`;
            
            stats[1].querySelector('.progress-fill').style.width = `${ram}%`;
            stats[1].querySelector('.stat-value').textContent = `${ram}%`;
            
            stats[2].querySelector('.progress-fill').style.width = `${disk}%`;
            stats[2].querySelector('.stat-value').textContent = `${disk}%`;
        }
    }

    initWebSocket() {
        if (this.socket) return;

        try {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            this.socket = io(window.location.origin);
            
            this.socket.on('connect', () => {
                console.log('WebSocket connected');
            });

            this.socket.on('server-stats', (data) => {
                // Обновляем статистику сервера
                const server = this.servers.find(s => s.id === data.serverId);
                if (server) {
                    server.stats = data.stats;
                    this.renderServers();
                }
            });

            this.socket.on('disconnect', () => {
                console.log('WebSocket disconnected');
            });
        } catch (error) {
            console.error('WebSocket error:', error);
        }
    }

    showNotification(message, type = 'info') {
        const notifications = document.getElementById('notifications');
        
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        notifications.appendChild(notification);
        
        // Автоматически удаляем через 5 секунд
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 5000);
    }
}

// Инициализация приложения
const app = new XpanelApp();

// Глобальные функции для HTML
window.app = app;
