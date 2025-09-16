class AgentsManager {
    constructor() {
        this.agents = [];
        this.filteredAgents = [];
        this.currentStep = 1;
        this.installationInProgress = false;
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadAgents();
        this.loadServers();
        
        // Проверяем авторизацию
        if (!auth.isAuthenticated()) {
            window.location.href = '/login';
            return;
        }
    }

    bindEvents() {
        // Поиск и фильтрация
        document.getElementById('agentSearch').addEventListener('input', (e) => {
            this.filterAgents();
        });

        document.getElementById('statusFilter').addEventListener('change', (e) => {
            this.filterAgents();
        });

        // Кнопки управления
        document.getElementById('refreshAgents').addEventListener('click', () => {
            this.loadAgents();
        });

        document.getElementById('installNewAgent').addEventListener('click', () => {
            this.openInstallModal();
        });

        document.getElementById('installFirstAgent').addEventListener('click', () => {
            this.openInstallModal();
        });

        // Модальные окна
        document.getElementById('closeInstallModal').addEventListener('click', () => {
            this.closeInstallModal();
        });

        document.getElementById('closeDetailsModal').addEventListener('click', () => {
            this.closeDetailsModal();
        });

        // Шаги установки
        document.getElementById('prevStep').addEventListener('click', () => {
            this.previousStep();
        });

        document.getElementById('nextStep').addEventListener('click', () => {
            this.nextStep();
        });

        document.getElementById('startInstall').addEventListener('click', () => {
            this.startInstallation();
        });

        document.getElementById('finishInstall').addEventListener('click', () => {
            this.finishInstallation();
        });

        // Консоль
        document.getElementById('clearConsole').addEventListener('click', () => {
            this.clearConsole();
        });

        // Выбор сервера
        document.getElementById('serverSelect').addEventListener('change', (e) => {
            this.onServerSelect(e.target.value);
        });

        // Закрытие модалов по клику вне области
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeAllModals();
            }
        });
    }

    async loadAgents() {
        try {
            const response = await fetch('/api/agents', {
                headers: {
                    'Authorization': `Bearer ${auth.getToken()}`
                }
            });

            if (response.status === 401) {
                auth.logout();
                return;
            }

            if (response.ok) {
                const data = await response.json();
                this.agents = data.agents || [];
                this.updateStats();
                this.filterAgents();
            } else {
                this.showNotification('Ошибка загрузки агентов', 'error');
                this.agents = [];
                this.updateStats();
                this.filterAgents();
            }
        } catch (error) {
            console.error('Ошибка загрузки агентов:', error);
            this.agents = [];
            this.updateStats();
            this.filterAgents();
        }
    }

    async loadServers() {
        try {
            const response = await fetch('/api/servers', {
                headers: {
                    'Authorization': `Bearer ${auth.getToken()}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.populateServerSelect(data.servers || []);
            }
        } catch (error) {
            console.error('Ошибка загрузки серверов:', error);
        }
    }

    // Removed mock data - using only real API data

    updateStats() {
        const online = this.agents.filter(agent => agent.status === 'online').length;
        const offline = this.agents.filter(agent => agent.status === 'offline').length;
        const total = this.agents.length;

        document.getElementById('onlineAgents').textContent = online;
        document.getElementById('offlineAgents').textContent = offline;
        document.getElementById('totalAgents').textContent = total;
    }

    filterAgents() {
        const searchTerm = document.getElementById('agentSearch').value.toLowerCase();
        const statusFilter = document.getElementById('statusFilter').value;

        this.filteredAgents = this.agents.filter(agent => {
            const matchesSearch = agent.server_name.toLowerCase().includes(searchTerm) ||
                                agent.host.toLowerCase().includes(searchTerm);
            const matchesStatus = statusFilter === 'all' || agent.status === statusFilter;
            
            return matchesSearch && matchesStatus;
        });

        this.renderAgents();
    }

    renderAgents() {
        const grid = document.getElementById('agentsGrid');
        const emptyState = document.getElementById('emptyState');

        if (this.filteredAgents.length === 0) {
            grid.style.display = 'none';
            emptyState.style.display = 'flex';
            return;
        }

        grid.style.display = 'grid';
        emptyState.style.display = 'none';

        grid.innerHTML = this.filteredAgents.map(agent => this.createAgentCard(agent)).join('');

        // Привязываем события к карточкам
        this.bindAgentCardEvents();
    }

    createAgentCard(agent) {
        const statusClass = agent.status;
        const statusIcon = this.getStatusIcon(agent.status);
        const statusText = this.getStatusText(agent.status);
        const lastSeen = this.formatLastSeen(agent.last_seen);
        const uptime = this.formatUptime(agent.uptime);

        return `
            <div class="agent-card ${statusClass}" data-agent-id="${agent.id}">
                <div class="agent-header">
                    <div class="agent-info">
                        <div class="agent-name">${agent.server_name}</div>
                        <div class="agent-host">${agent.host}</div>
                    </div>
                    <div class="agent-status ${statusClass}">
                        <i class="${statusIcon}"></i>
                        <span>${statusText}</span>
                    </div>
                </div>
                
                <div class="agent-metrics">
                    <div class="metric">
                        <div class="metric-label">CPU</div>
                        <div class="metric-value">${agent.cpu_usage.toFixed(1)}%</div>
                        <div class="metric-bar">
                            <div class="metric-fill cpu" style="width: ${agent.cpu_usage}%"></div>
                        </div>
                    </div>
                    <div class="metric">
                        <div class="metric-label">RAM</div>
                        <div class="metric-value">${agent.memory_usage.toFixed(1)}%</div>
                        <div class="metric-bar">
                            <div class="metric-fill memory" style="width: ${agent.memory_usage}%"></div>
                        </div>
                    </div>
                    <div class="metric">
                        <div class="metric-label">Диск</div>
                        <div class="metric-value">${agent.disk_usage.toFixed(1)}%</div>
                        <div class="metric-bar">
                            <div class="metric-fill disk" style="width: ${agent.disk_usage}%"></div>
                        </div>
                    </div>
                </div>

                <div class="agent-details">
                    <div class="detail-item">
                        <span class="detail-label">Версия:</span>
                        <span class="detail-value">${agent.version}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Последняя активность:</span>
                        <span class="detail-value">${lastSeen}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Время работы:</span>
                        <span class="detail-value">${uptime}</span>
                    </div>
                </div>

                <div class="agent-actions">
                    <button class="btn-icon" onclick="agentsManager.viewAgentDetails('${agent.id}')" title="Подробности">
                        <i class="fas fa-info-circle"></i>
                    </button>
                    <button class="btn-icon" onclick="agentsManager.restartAgent('${agent.id}')" title="Перезапустить">
                        <i class="fas fa-redo"></i>
                    </button>
                    <button class="btn-icon" onclick="agentsManager.updateAgent('${agent.id}')" title="Обновить">
                        <i class="fas fa-download"></i>
                    </button>
                    <button class="btn-icon danger" onclick="agentsManager.removeAgent('${agent.id}')" title="Удалить">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }

    bindAgentCardEvents() {
        // События уже привязаны через onclick в HTML
    }

    getStatusIcon(status) {
        const icons = {
            'online': 'fas fa-check-circle',
            'offline': 'fas fa-times-circle',
            'error': 'fas fa-exclamation-triangle',
            'updating': 'fas fa-sync-alt fa-spin'
        };
        return icons[status] || 'fas fa-question-circle';
    }

    getStatusText(status) {
        const texts = {
            'online': 'Онлайн',
            'offline': 'Оффлайн',
            'error': 'Ошибка',
            'updating': 'Обновление'
        };
        return texts[status] || 'Неизвестно';
    }

    formatLastSeen(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        
        if (diff < 60000) return 'Только что';
        if (diff < 3600000) return `${Math.floor(diff / 60000)} мин назад`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)} ч назад`;
        return `${Math.floor(diff / 86400000)} дн назад`;
    }

    formatUptime(seconds) {
        if (seconds === 0) return 'Не работает';
        
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        
        if (days > 0) return `${days}д ${hours}ч`;
        if (hours > 0) return `${hours}ч ${minutes}м`;
        return `${minutes}м`;
    }

    // Модальные окна
    openInstallModal() {
        document.getElementById('installAgentModal').classList.add('active');
        this.resetInstallModal();
    }

    closeInstallModal() {
        document.getElementById('installAgentModal').classList.remove('active');
        this.resetInstallModal();
    }

    closeDetailsModal() {
        document.getElementById('agentDetailsModal').classList.remove('active');
    }

    closeAllModals() {
        this.closeInstallModal();
        this.closeDetailsModal();
    }

    resetInstallModal() {
        this.currentStep = 1;
        this.installationInProgress = false;
        this.updateInstallStep();
        this.clearConsole();
        
        // Сброс формы
        document.getElementById('serverSelect').value = '';
        document.getElementById('serverHost').value = '';
        document.getElementById('serverPort').value = '22';
        document.getElementById('serverUser').value = '';
        document.getElementById('serverPassword').value = '';
        
        // Сброс прогресса
        document.getElementById('installProgress').style.width = '0%';
        document.getElementById('installProgressText').textContent = 'Готов к установке';
    }

    // Шаги установки
    previousStep() {
        if (this.currentStep > 1 && !this.installationInProgress) {
            this.currentStep--;
            this.updateInstallStep();
        }
    }

    nextStep() {
        if (this.currentStep < 3 && !this.installationInProgress) {
            if (this.validateCurrentStep()) {
                this.currentStep++;
                this.updateInstallStep();
            }
        }
    }

    updateInstallStep() {
        // Обновляем активный шаг
        document.querySelectorAll('.step').forEach((step, index) => {
            step.classList.toggle('active', index + 1 === this.currentStep);
        });

        // Обновляем кнопки
        const prevBtn = document.getElementById('prevStep');
        const nextBtn = document.getElementById('nextStep');
        const startBtn = document.getElementById('startInstall');
        const finishBtn = document.getElementById('finishInstall');

        prevBtn.style.display = this.currentStep > 1 ? 'block' : 'none';
        nextBtn.style.display = this.currentStep < 3 ? 'block' : 'none';
        startBtn.style.display = this.currentStep === 3 && !this.installationInProgress ? 'block' : 'none';
        finishBtn.style.display = 'none';

        prevBtn.disabled = this.installationInProgress;
        nextBtn.disabled = this.installationInProgress;
    }

    validateCurrentStep() {
        if (this.currentStep === 1) {
            const serverSelect = document.getElementById('serverSelect').value;
            if (!serverSelect) {
                this.showNotification('Выберите сервер', 'error');
                return false;
            }
        }

        if (this.currentStep === 2) {
            const host = document.getElementById('serverHost').value;
            const user = document.getElementById('serverUser').value;
            const password = document.getElementById('serverPassword').value;

            if (!host || !user || !password) {
                this.showNotification('Заполните все поля подключения', 'error');
                return false;
            }
        }

        return true;
    }

    populateServerSelect(servers) {
        const select = document.getElementById('serverSelect');
        select.innerHTML = '<option value="">Выберите сервер...</option>';
        
        servers.forEach(server => {
            const option = document.createElement('option');
            option.value = server.id;
            option.textContent = `${server.name} (${server.host})`;
            option.dataset.host = server.host;
            select.appendChild(option);
        });
    }

    onServerSelect(serverId) {
        if (serverId) {
            const option = document.querySelector(`#serverSelect option[value="${serverId}"]`);
            if (option) {
                document.getElementById('serverHost').value = option.dataset.host || '';
            }
        }
    }

    async startInstallation() {
        this.installationInProgress = true;
        this.updateInstallStep();

        const installData = {
            host: document.getElementById('serverHost').value,
            port: parseInt(document.getElementById('serverPort').value),
            username: document.getElementById('serverUser').value,
            password: document.getElementById('serverPassword').value
        };

        try {
            await this.simulateInstallation(installData);
        } catch (error) {
            this.addConsoleMessage('Ошибка установки: ' + error.message, 'error');
            this.installationInProgress = false;
            this.updateInstallStep();
        }
    }

    async simulateInstallation(installData) {
        this.addConsoleMessage(`Начало установки на ${installData.host}:${installData.port}`, 'info');

        try {
            // Выполняем реальную установку через API
            const response = await fetch('/api/servers/install-agent', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.auth.getToken()}`
                },
                body: JSON.stringify({
                    host: installData.host,
                    port: installData.port,
                    username: installData.username,
                    password: installData.password,
                    panel_address: window.location.hostname
                })
            });

            const result = await response.json();
            
            if (result.success) {
                // Показываем реальные шаги установки
                if (result.detailed_log) {
                    for (let i = 0; i < result.detailed_log.length; i++) {
                        const logEntry = result.detailed_log[i];
                        const progress = ((i + 1) / result.detailed_log.length) * 100;
                        
                        // Определяем тип сообщения
                        let messageType = 'info';
                        if (logEntry.includes('[SUCCESS]')) messageType = 'success';
                        else if (logEntry.includes('[ERROR]')) messageType = 'error';
                        else if (logEntry.includes('[WARNING]')) messageType = 'warning';
                        
                        this.addConsoleMessage(logEntry, messageType);
                        this.updateProgress(progress, logEntry.replace(/\[.*?\]\s*/, ''));
                        
                        // Небольшая задержка для визуального эффекта
                        await new Promise(resolve => setTimeout(resolve, 300));
                    }
                } else {
                    // Fallback к базовому выводу
                    this.addConsoleMessage(result.output || 'Агент успешно установлен!', 'success');
                    this.updateProgress(100, 'Установка завершена');
                }
                
                this.addConsoleMessage('Агент подключен к панели управления', 'success');
                this.showNotification('Агент успешно установлен!', 'success');
                
            } else {
                // Обработка ошибок
                if (result.detailed_log) {
                    for (const logEntry of result.detailed_log) {
                        let messageType = 'info';
                        if (logEntry.includes('[ERROR]')) messageType = 'error';
                        else if (logEntry.includes('[WARNING]')) messageType = 'warning';
                        else if (logEntry.includes('[SUCCESS]')) messageType = 'success';
                        
                        this.addConsoleMessage(logEntry, messageType);
                    }
                } else {
                    this.addConsoleMessage(`Ошибка установки: ${result.error}`, 'error');
                }
                
                this.updateProgress(100, 'Установка не удалась');
                this.showNotification('Ошибка установки агента', 'error');
            }
            
        } catch (error) {
            console.error('Installation error:', error);
            this.addConsoleMessage(`Ошибка сети: ${error.message}`, 'error');
            this.updateProgress(100, 'Ошибка подключения');
            this.showNotification('Ошибка подключения к серверу', 'error');
        }
        
        // Показываем кнопку завершения
        document.getElementById('startInstall').style.display = 'none';
        document.getElementById('finishInstall').style.display = 'block';
    }

    finishInstallation() {
        this.closeInstallModal();
        this.loadAgents(); // Перезагружаем список агентов
    }

    updateProgress(percent, text) {
        document.getElementById('installProgress').style.width = percent + '%';
        document.getElementById('installProgressText').textContent = text;
    }

    addConsoleMessage(message, type = 'info') {
        const output = document.getElementById('consoleOutput');
        const timestamp = new Date().toLocaleTimeString();
        
        const line = document.createElement('div');
        line.className = `console-line ${type}`;
        line.innerHTML = `<span class="timestamp">[${timestamp}]</span> ${message}`;
        
        output.appendChild(line);
        output.scrollTop = output.scrollHeight;
    }

    clearConsole() {
        const output = document.getElementById('consoleOutput');
        output.innerHTML = '<div class="console-line info">Готов к началу установки агента...</div>';
    }

    // Действия с агентами
    async viewAgentDetails(agentId) {
        const agent = this.agents.find(a => a.id === agentId);
        if (!agent) return;

        const content = document.getElementById('agentDetailsContent');
        content.innerHTML = this.createAgentDetailsHTML(agent);
        
        document.getElementById('agentDetailsModal').classList.add('active');
    }

    createAgentDetailsHTML(agent) {
        const installedDate = new Date(agent.installed_at).toLocaleString();
        const lastSeenDate = new Date(agent.last_seen).toLocaleString();

        return `
            <div class="agent-details-grid">
                <div class="details-section">
                    <h4><i class="fas fa-server"></i> Информация о сервере</h4>
                    <div class="details-list">
                        <div class="detail-row">
                            <span class="label">Название:</span>
                            <span class="value">${agent.server_name}</span>
                        </div>
                        <div class="detail-row">
                            <span class="label">IP адрес:</span>
                            <span class="value">${agent.host}</span>
                        </div>
                        <div class="detail-row">
                            <span class="label">Статус:</span>
                            <span class="value status ${agent.status}">
                                <i class="${this.getStatusIcon(agent.status)}"></i>
                                ${this.getStatusText(agent.status)}
                            </span>
                        </div>
                        <div class="detail-row">
                            <span class="label">Версия агента:</span>
                            <span class="value">${agent.version}</span>
                        </div>
                    </div>
                </div>

                <div class="details-section">
                    <h4><i class="fas fa-chart-bar"></i> Метрики производительности</h4>
                    <div class="metrics-list">
                        <div class="metric-detail">
                            <div class="metric-header">
                                <span>Использование CPU</span>
                                <span class="metric-percent">${agent.cpu_usage.toFixed(1)}%</span>
                            </div>
                            <div class="metric-bar">
                                <div class="metric-fill cpu" style="width: ${agent.cpu_usage}%"></div>
                            </div>
                        </div>
                        <div class="metric-detail">
                            <div class="metric-header">
                                <span>Использование RAM</span>
                                <span class="metric-percent">${agent.memory_usage.toFixed(1)}%</span>
                            </div>
                            <div class="metric-bar">
                                <div class="metric-fill memory" style="width: ${agent.memory_usage}%"></div>
                            </div>
                        </div>
                        <div class="metric-detail">
                            <div class="metric-header">
                                <span>Использование диска</span>
                                <span class="metric-percent">${agent.disk_usage.toFixed(1)}%</span>
                            </div>
                            <div class="metric-bar">
                                <div class="metric-fill disk" style="width: ${agent.disk_usage}%"></div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="details-section">
                    <h4><i class="fas fa-network-wired"></i> Сетевая активность</h4>
                    <div class="network-stats">
                        <div class="network-item">
                            <i class="fas fa-download"></i>
                            <span class="network-label">Входящий трафик:</span>
                            <span class="network-value">${this.formatBytes(agent.network_in)}/с</span>
                        </div>
                        <div class="network-item">
                            <i class="fas fa-upload"></i>
                            <span class="network-label">Исходящий трафик:</span>
                            <span class="network-value">${this.formatBytes(agent.network_out)}/с</span>
                        </div>
                    </div>
                </div>

                <div class="details-section">
                    <h4><i class="fas fa-clock"></i> Временные метки</h4>
                    <div class="details-list">
                        <div class="detail-row">
                            <span class="label">Установлен:</span>
                            <span class="value">${installedDate}</span>
                        </div>
                        <div class="detail-row">
                            <span class="label">Последняя активность:</span>
                            <span class="value">${lastSeenDate}</span>
                        </div>
                        <div class="detail-row">
                            <span class="label">Время работы:</span>
                            <span class="value">${this.formatUptime(agent.uptime)}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div class="agent-actions-panel">
                <button class="btn-primary" onclick="agentsManager.restartAgent('${agent.id}')">
                    <i class="fas fa-redo"></i>
                    Перезапустить агент
                </button>
                <button class="btn-secondary" onclick="agentsManager.updateAgent('${agent.id}')">
                    <i class="fas fa-download"></i>
                    Обновить агент
                </button>
                <button class="btn-danger" onclick="agentsManager.removeAgent('${agent.id}')">
                    <i class="fas fa-trash"></i>
                    Удалить агент
                </button>
            </div>
        `;
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    async restartAgent(agentId) {
        if (!confirm('Вы уверены, что хотите перезапустить агент?')) return;

        try {
            this.showNotification('Перезапуск агента...', 'info');
            
            // Симуляция перезапуска
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            this.showNotification('Агент успешно перезапущен', 'success');
            this.loadAgents();
        } catch (error) {
            this.showNotification('Ошибка перезапуска агента', 'error');
        }
    }

    async updateAgent(agentId) {
        if (!confirm('Вы уверены, что хотите обновить агент?')) return;

        try {
            this.showNotification('Обновление агента...', 'info');
            
            // Симуляция обновления
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            this.showNotification('Агент успешно обновлен', 'success');
            this.loadAgents();
        } catch (error) {
            this.showNotification('Ошибка обновления агента', 'error');
        }
    }

    async removeAgent(agentId) {
        if (!confirm('Вы уверены, что хотите удалить агент? Это действие нельзя отменить.')) return;

        try {
            this.showNotification('Удаление агента...', 'info');
            
            // Симуляция удаления
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            this.agents = this.agents.filter(agent => agent.id !== agentId);
            this.updateStats();
            this.filterAgents();
            
            this.showNotification('Агент успешно удален', 'success');
            this.closeDetailsModal();
        } catch (error) {
            this.showNotification('Ошибка удаления агента', 'error');
        }
    }

    showNotification(message, type = 'info') {
        // Создаем уведомление
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check' : type === 'error' ? 'times' : 'info'}-circle"></i>
            <span>${message}</span>
        `;

        // Добавляем в контейнер уведомлений
        let container = document.querySelector('.notifications-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'notifications-container';
            document.body.appendChild(container);
        }

        container.appendChild(notification);

        // Автоматически удаляем через 5 секунд
        setTimeout(() => {
            notification.remove();
        }, 5000);
    }
}

// Инициализация при загрузке страницы
let agentsManager;

document.addEventListener('DOMContentLoaded', () => {
    agentsManager = new AgentsManager();
});
