/**
 * Real Monitoring System - Реальный мониторинг серверов
 * Обрабатывает WebSocket события для установки агентов и мониторинга
 */

class RealMonitoring {
    constructor() {
        this.socket = null;
        this.installationProgress = new Map();
        this.serverStats = new Map();
        this.isConnected = false;
        
        this.initializeWebSocket();
        this.setupEventHandlers();
    }
    
    initializeWebSocket() {
        try {
            // Подключаемся к WebSocket серверу
            this.socket = io();
            
            this.socket.on('connect', () => {
                console.log('WebSocket подключен');
                this.isConnected = true;
                this.showNotification('Подключение к серверу установлено', 'success');
            });
            
            this.socket.on('disconnect', () => {
                console.log('WebSocket отключен');
                this.isConnected = false;
                this.showNotification('Соединение с сервером потеряно', 'warning');
            });
            
            // Обработка прогресса установки агента
            this.socket.on('installation_progress', (data) => {
                this.handleInstallationProgress(data);
            });
            
            // Обработка завершения установки
            this.socket.on('installation_complete', (data) => {
                this.handleInstallationComplete(data);
            });
            
            // Обработка статистики серверов в реальном времени
            this.socket.on('server_stats', (data) => {
                this.handleServerStats(data);
            });
            
            // Обработка уведомлений
            this.socket.on('notification', (data) => {
                this.showNotification(data.message, data.type);
            });
            
        } catch (error) {
            console.error('Ошибка инициализации WebSocket:', error);
        }
    }
    
    setupEventHandlers() {
        // Обработчик для кнопок установки агента
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('install-agent-btn')) {
                const serverData = JSON.parse(e.target.dataset.server);
                this.startAgentInstallation(serverData);
            }
        });
    }
    
    startAgentInstallation(serverData) {
        // Показываем модальное окно прогресса
        this.showInstallationModal(serverData.host);
        
        // Отправляем запрос на установку
        fetch('/api/servers/install-agent', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${auth.getToken()}`
            },
            body: JSON.stringify(serverData)
        })
        .then(response => response.json())
        .then(data => {
            if (!data.success) {
                this.hideInstallationModal();
                this.showNotification(`Ошибка запуска установки: ${data.error}`, 'error');
            }
        })
        .catch(error => {
            this.hideInstallationModal();
            this.showNotification(`Ошибка: ${error.message}`, 'error');
        });
    }
    
    handleInstallationProgress(data) {
        const { server, progress } = data;
        
        console.log(`Прогресс установки ${server}:`, progress);
        
        // Обновляем прогресс-бар
        this.updateInstallationProgress(server, progress);
        
        // Добавляем сообщение в терминал
        this.addTerminalMessage(server, progress);
    }
    
    handleInstallationComplete(data) {
        const { server, result } = data;
        
        console.log(`Установка завершена ${server}:`, result);
        
        if (result.success) {
            this.updateInstallationProgress(server, {
                step: 'Завершено',
                progress: 100,
                message: 'Агент успешно установлен и запущен!'
            });
            
            this.showNotification(`Агент на сервере ${server} успешно установлен`, 'success');
            
            // Обновляем список серверов
            setTimeout(() => {
                this.hideInstallationModal();
                if (typeof refreshDashboard === 'function') {
                    refreshDashboard();
                }
            }, 3000);
            
        } else {
            this.updateInstallationProgress(server, {
                step: 'Ошибка',
                progress: 100,
                message: `Ошибка установки: ${result.error}`
            });
            
            this.showNotification(`Ошибка установки агента на ${server}: ${result.error}`, 'error');
            
            setTimeout(() => {
                this.hideInstallationModal();
            }, 5000);
        }
    }
    
    handleServerStats(data) {
        const { server_id, stats } = data;
        
        // Сохраняем статистику
        this.serverStats.set(server_id, {
            ...stats,
            timestamp: new Date()
        });
        
        // Обновляем интерфейс
        this.updateServerStatsUI(server_id, stats);
    }
    
    showInstallationModal(serverHost) {
        const modalHtml = `
            <div id="installationModal" class="modal-overlay">
                <div class="modal-content installation-modal">
                    <div class="modal-header">
                        <h3>Установка агента на ${serverHost}</h3>
                        <button class="modal-close" onclick="realMonitoring.hideInstallationModal()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="installation-progress">
                            <div class="progress-bar-container">
                                <div class="progress-bar">
                                    <div class="progress-fill" id="progressFill"></div>
                                </div>
                                <div class="progress-text" id="progressText">0%</div>
                            </div>
                            <div class="current-step" id="currentStep">Подготовка к установке...</div>
                        </div>
                        <div class="terminal-container">
                            <div class="terminal-header">
                                <span class="terminal-title">Лог установки</span>
                            </div>
                            <div class="terminal-content" id="terminalContent">
                                <div class="terminal-line">
                                    <span class="terminal-prompt">$</span>
                                    <span class="terminal-text">Запуск установки агента...</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        // Добавляем стили если их нет
        this.addInstallationModalStyles();
    }
    
    hideInstallationModal() {
        const modal = document.getElementById('installationModal');
        if (modal) {
            modal.remove();
        }
    }
    
    updateInstallationProgress(server, progress) {
        const progressFill = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');
        const currentStep = document.getElementById('currentStep');
        
        if (progressFill) {
            progressFill.style.width = `${progress.progress}%`;
        }
        
        if (progressText) {
            progressText.textContent = `${progress.progress}%`;
        }
        
        if (currentStep) {
            currentStep.textContent = `${progress.step}: ${progress.message}`;
        }
    }
    
    addTerminalMessage(server, progress) {
        const terminalContent = document.getElementById('terminalContent');
        if (!terminalContent) return;
        
        const timestamp = new Date().toLocaleTimeString();
        const messageClass = progress.progress === 100 ? 
            (progress.step === 'Ошибка' ? 'error' : 'success') : 'info';
        
        const messageHtml = `
            <div class="terminal-line">
                <span class="terminal-timestamp">[${timestamp}]</span>
                <span class="terminal-text ${messageClass}">${progress.message}</span>
            </div>
        `;
        
        terminalContent.insertAdjacentHTML('beforeend', messageHtml);
        terminalContent.scrollTop = terminalContent.scrollHeight;
    }
    
    updateServerStatsUI(serverId, stats) {
        // Обновляем карточки серверов
        const serverCard = document.querySelector(`[data-server-id="${serverId}"]`);
        if (serverCard) {
            // Обновляем CPU
            const cpuElement = serverCard.querySelector('.cpu-usage');
            if (cpuElement && stats.cpu) {
                cpuElement.textContent = `${stats.cpu.usage}%`;
                cpuElement.className = `cpu-usage ${this.getUsageClass(stats.cpu.usage)}`;
            }
            
            // Обновляем память
            const memoryElement = serverCard.querySelector('.memory-usage');
            if (memoryElement && stats.memory) {
                memoryElement.textContent = `${stats.memory.percent}%`;
                memoryElement.className = `memory-usage ${this.getUsageClass(stats.memory.percent)}`;
            }
            
            // Обновляем диск
            const diskElement = serverCard.querySelector('.disk-usage');
            if (diskElement && stats.disk) {
                diskElement.textContent = `${stats.disk.percent}%`;
                diskElement.className = `disk-usage ${this.getUsageClass(stats.disk.percent)}`;
            }
            
            // Обновляем статус
            const statusElement = serverCard.querySelector('.server-status');
            if (statusElement) {
                statusElement.textContent = 'Online';
                statusElement.className = 'server-status online';
            }
            
            // Обновляем время последнего обновления
            const lastSeenElement = serverCard.querySelector('.last-seen');
            if (lastSeenElement) {
                lastSeenElement.textContent = `Обновлено: ${new Date().toLocaleTimeString()}`;
            }
        }
    }
    
    getUsageClass(usage) {
        if (usage >= 90) return 'critical';
        if (usage >= 75) return 'warning';
        if (usage >= 50) return 'medium';
        return 'low';
    }
    
    showNotification(message, type = 'info') {
        // Создаем уведомление
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-icon">${this.getNotificationIcon(type)}</span>
                <span class="notification-message">${message}</span>
                <button class="notification-close" onclick="this.parentElement.parentElement.remove()">&times;</button>
            </div>
        `;
        
        // Добавляем в контейнер уведомлений
        let container = document.getElementById('notificationContainer');
        if (!container) {
            container = document.createElement('div');
            container.id = 'notificationContainer';
            container.className = 'notification-container';
            document.body.appendChild(container);
        }
        
        container.appendChild(notification);
        
        // Автоматически удаляем через 5 секунд
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    }
    
    getNotificationIcon(type) {
        const icons = {
            success: '✓',
            error: '✗',
            warning: '⚠',
            info: 'ℹ'
        };
        return icons[type] || icons.info;
    }
    
    addInstallationModalStyles() {
        if (document.getElementById('installationModalStyles')) return;
        
        const styles = document.createElement('style');
        styles.id = 'installationModalStyles';
        styles.textContent = `
            .installation-modal {
                width: 90%;
                max-width: 800px;
                max-height: 90vh;
                overflow-y: auto;
            }
            
            .installation-progress {
                margin-bottom: 20px;
            }
            
            .progress-bar-container {
                display: flex;
                align-items: center;
                gap: 15px;
                margin-bottom: 10px;
            }
            
            .progress-bar {
                flex: 1;
                height: 20px;
                background: var(--bg-tertiary);
                border-radius: 10px;
                overflow: hidden;
                border: 1px solid var(--border);
            }
            
            .progress-fill {
                height: 100%;
                background: linear-gradient(90deg, var(--primary), var(--primary-light));
                transition: width 0.3s ease;
                width: 0%;
            }
            
            .progress-text {
                font-weight: bold;
                color: var(--text-primary);
                min-width: 50px;
            }
            
            .current-step {
                color: var(--text-secondary);
                font-size: 14px;
                margin-top: 5px;
            }
            
            .terminal-container {
                background: #1a1a1a;
                border-radius: var(--radius);
                overflow: hidden;
                border: 1px solid var(--border);
            }
            
            .terminal-header {
                background: #2d2d2d;
                padding: 10px 15px;
                border-bottom: 1px solid var(--border);
            }
            
            .terminal-title {
                color: var(--text-primary);
                font-size: 14px;
                font-weight: 500;
            }
            
            .terminal-content {
                padding: 15px;
                max-height: 300px;
                overflow-y: auto;
                font-family: 'Courier New', monospace;
                font-size: 13px;
                line-height: 1.4;
            }
            
            .terminal-line {
                margin-bottom: 5px;
                display: flex;
                align-items: flex-start;
                gap: 8px;
            }
            
            .terminal-prompt {
                color: #4ade80;
                font-weight: bold;
            }
            
            .terminal-timestamp {
                color: #6b7280;
                font-size: 12px;
                min-width: 80px;
            }
            
            .terminal-text {
                color: var(--text-primary);
                flex: 1;
            }
            
            .terminal-text.success {
                color: #4ade80;
            }
            
            .terminal-text.error {
                color: #ef4444;
            }
            
            .terminal-text.info {
                color: #06b6d4;
            }
            
            .notification-container {
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10000;
                display: flex;
                flex-direction: column;
                gap: 10px;
            }
            
            .notification {
                background: var(--bg-card);
                border: 1px solid var(--border);
                border-radius: var(--radius);
                padding: 15px;
                box-shadow: var(--shadow-lg);
                min-width: 300px;
                animation: slideInRight 0.3s ease;
            }
            
            .notification-success {
                border-left: 4px solid var(--success);
            }
            
            .notification-error {
                border-left: 4px solid var(--danger);
            }
            
            .notification-warning {
                border-left: 4px solid var(--warning);
            }
            
            .notification-info {
                border-left: 4px solid var(--info);
            }
            
            .notification-content {
                display: flex;
                align-items: center;
                gap: 10px;
            }
            
            .notification-icon {
                font-size: 18px;
                font-weight: bold;
            }
            
            .notification-message {
                flex: 1;
                color: var(--text-primary);
            }
            
            .notification-close {
                background: none;
                border: none;
                color: var(--text-secondary);
                font-size: 20px;
                cursor: pointer;
                padding: 0;
                width: 20px;
                height: 20px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .notification-close:hover {
                color: var(--text-primary);
            }
            
            @keyframes slideInRight {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
            
            .cpu-usage.low, .memory-usage.low, .disk-usage.low {
                color: var(--success);
            }
            
            .cpu-usage.medium, .memory-usage.medium, .disk-usage.medium {
                color: var(--info);
            }
            
            .cpu-usage.warning, .memory-usage.warning, .disk-usage.warning {
                color: var(--warning);
            }
            
            .cpu-usage.critical, .memory-usage.critical, .disk-usage.critical {
                color: var(--danger);
            }
        `;
        
        document.head.appendChild(styles);
    }
    
    // Публичные методы для интеграции с другими скриптами
    getServerStats(serverId) {
        return this.serverStats.get(serverId);
    }
    
    isServerOnline(serverId) {
        const stats = this.serverStats.get(serverId);
        if (!stats) return false;
        
        const now = new Date();
        const lastUpdate = stats.timestamp;
        const timeDiff = now - lastUpdate;
        
        // Считаем сервер онлайн если последнее обновление было менее 2 минут назад
        return timeDiff < 120000;
    }
}

// Инициализируем глобальный экземпляр
const realMonitoring = new RealMonitoring();

// Экспортируем для использования в других скриптах
window.realMonitoring = realMonitoring;
