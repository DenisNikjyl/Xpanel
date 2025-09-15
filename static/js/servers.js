// Xpanel - Servers Management JavaScript

class ServersManager {
    constructor() {
        this.servers = [];
        this.init();
    }

    init() {
        this.setupEventHandlers();
        this.loadServers();
    }

    setupEventHandlers() {
        // Add server form
        const addServerForm = document.getElementById('add-server-form');
        if (addServerForm) {
            addServerForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleAddServer();
            });
        }
    }

    async loadServers() {
        try {
            this.servers = await api.getServers();
            this.renderServersList();
            this.updateServerSelects();
        } catch (error) {
            console.error('Failed to load servers:', error);
            XpanelUtils.showNotification('Ошибка', 'Не удалось загрузить список серверов', 'error');
        }
    }

    renderServersList() {
        const serversList = document.getElementById('servers-list');
        if (!serversList) return;

        if (this.servers.length === 0) {
            serversList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-server" style="font-size: 3rem; color: var(--text-muted); margin-bottom: 1rem;"></i>
                    <h3>Нет серверов</h3>
                    <p>Добавьте первый сервер для начала работы</p>
                    <button class="btn btn-primary" onclick="showAddServerModal()">
                        <i class="fas fa-plus"></i> Добавить сервер
                    </button>
                </div>
            `;
            return;
        }

        serversList.innerHTML = this.servers.map(server => `
            <div class="server-card" data-server-id="${server.id}">
                <div class="server-header">
                    <div class="server-name">${server.name}</div>
                    <div class="server-status ${server.status}">${server.status}</div>
                </div>
                <div class="server-details">
                    <div class="server-detail">
                        <i class="fas fa-globe"></i>
                        <span>${server.host}:${server.port}</span>
                    </div>
                    <div class="server-detail">
                        <i class="fas fa-user"></i>
                        <span>${server.username}</span>
                    </div>
                    <div class="server-detail">
                        <i class="fas fa-clock"></i>
                        <span>Добавлен: ${XpanelUtils.formatDate(server.added_at)}</span>
                    </div>
                    ${server.last_seen ? `
                        <div class="server-detail">
                            <i class="fas fa-eye"></i>
                            <span>Последний раз: ${XpanelUtils.formatDate(server.last_seen)}</span>
                        </div>
                    ` : ''}
                </div>
                <div class="server-stats">
                    <div class="stat-item">
                        <div class="stat-label">CPU</div>
                        <div class="stat-value cpu-stat">--</div>
                        <div class="progress-bar">
                            <div class="progress-fill cpu-progress" style="width: 0%"></div>
                        </div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-label">RAM</div>
                        <div class="stat-value memory-stat">--</div>
                        <div class="progress-bar">
                            <div class="progress-fill memory-progress" style="width: 0%"></div>
                        </div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-label">Диск</div>
                        <div class="stat-value disk-stat">--</div>
                        <div class="progress-bar">
                            <div class="progress-fill disk-progress" style="width: 0%"></div>
                        </div>
                    </div>
                </div>
                <div class="server-actions">
                    <button class="btn btn-success" onclick="connectServer('${server.id}')" title="Подключиться">
                        <i class="fas fa-plug"></i>
                    </button>
                    <button class="btn btn-primary" onclick="openTerminal('${server.id}')" title="Терминал">
                        <i class="fas fa-terminal"></i>
                    </button>
                    <button class="btn btn-secondary" onclick="openFiles('${server.id}')" title="Файлы">
                        <i class="fas fa-folder"></i>
                    </button>
                    <button class="btn btn-warning" onclick="editServer('${server.id}')" title="Редактировать">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-error" onclick="removeServer('${server.id}')" title="Удалить">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
    }

    updateServerSelects() {
        const selects = document.querySelectorAll('.server-select');
        selects.forEach(select => {
            const currentValue = select.value;
            select.innerHTML = '<option value="">Выберите сервер</option>' +
                this.servers.map(server => 
                    `<option value="${server.id}">${server.name} (${server.host})</option>`
                ).join('');
            
            // Restore previous selection if still valid
            if (currentValue && this.servers.find(s => s.id === currentValue)) {
                select.value = currentValue;
            }
        });
    }

    async handleAddServer() {
        const form = document.getElementById('add-server-form');
        const formData = new FormData(form);
        
        const serverData = {
            name: document.getElementById('server-name').value,
            host: document.getElementById('server-host').value,
            port: parseInt(document.getElementById('server-port').value),
            username: document.getElementById('server-username').value,
            password: document.getElementById('server-password').value
        };

        // Validate input
        if (!serverData.name || !serverData.host || !serverData.username) {
            XpanelUtils.showNotification('Ошибка', 'Заполните все обязательные поля', 'error');
            return;
        }

        if (!XpanelUtils.isValidIP(serverData.host) && !XpanelUtils.isValidHostname(serverData.host)) {
            XpanelUtils.showNotification('Ошибка', 'Введите корректный IP адрес или домен', 'error');
            return;
        }

        try {
            const response = await api.addServer(serverData);
            
            if (response.success) {
                XpanelUtils.showNotification('Успех', 'Сервер успешно добавлен', 'success');
                this.loadServers();
                closeAddServerModal();
                form.reset();
            }
        } catch (error) {
            console.error('Failed to add server:', error);
            XpanelUtils.showNotification('Ошибка', 'Не удалось добавить сервер', 'error');
        }
    }

    updateServerStats(serverId, stats) {
        const serverCard = document.querySelector(`[data-server-id="${serverId}"]`);
        if (!serverCard || !stats) return;

        // Update status
        const statusElement = serverCard.querySelector('.server-status');
        if (statusElement) {
            statusElement.textContent = stats.status;
            statusElement.className = `server-status ${stats.status}`;
        }

        // Update CPU
        if (stats.cpu && stats.cpu !== 'N/A') {
            const cpuValue = parseFloat(stats.cpu);
            const cpuStat = serverCard.querySelector('.cpu-stat');
            const cpuProgress = serverCard.querySelector('.cpu-progress');
            
            if (cpuStat) cpuStat.textContent = `${cpuValue}%`;
            if (cpuProgress) {
                cpuProgress.style.width = `${cpuValue}%`;
                cpuProgress.className = `progress-fill cpu-progress ${cpuValue > 80 ? 'danger' : cpuValue > 60 ? 'warning' : ''}`;
            }
        }

        // Update Memory
        if (stats.memory && stats.memory !== 'N/A') {
            const memoryValue = parseFloat(stats.memory);
            const memoryStat = serverCard.querySelector('.memory-stat');
            const memoryProgress = serverCard.querySelector('.memory-progress');
            
            if (memoryStat) memoryStat.textContent = `${memoryValue}%`;
            if (memoryProgress) {
                memoryProgress.style.width = `${memoryValue}%`;
                memoryProgress.className = `progress-fill memory-progress ${memoryValue > 85 ? 'danger' : memoryValue > 70 ? 'warning' : ''}`;
            }
        }

        // Update Disk
        if (stats.disk && stats.disk !== 'N/A') {
            const diskValue = parseFloat(stats.disk);
            const diskStat = serverCard.querySelector('.disk-stat');
            const diskProgress = serverCard.querySelector('.disk-progress');
            
            if (diskStat) diskStat.textContent = `${diskValue}%`;
            if (diskProgress) {
                diskProgress.style.width = `${diskValue}%`;
                diskProgress.className = `progress-fill disk-progress ${diskValue > 90 ? 'danger' : diskValue > 75 ? 'warning' : ''}`;
            }
        }
    }
}

// Modal functions
window.showAddServerModal = function() {
    const modal = document.getElementById('add-server-modal');
    if (modal) {
        modal.classList.add('active');
        document.getElementById('server-name').focus();
    }
};

window.closeAddServerModal = function() {
    const modal = document.getElementById('add-server-modal');
    if (modal) {
        modal.classList.remove('active');
        document.getElementById('add-server-form').reset();
    }
};

// Server action functions
window.connectServer = async function(serverId) {
    try {
        XpanelUtils.showNotification('Подключение', 'Подключение к серверу...', 'info');
        // Implementation would depend on server manager API
    } catch (error) {
        XpanelUtils.showNotification('Ошибка', 'Не удалось подключиться к серверу', 'error');
    }
};

window.openTerminal = function(serverId) {
    document.querySelector('[data-section="terminal"]').click();
    setTimeout(() => {
        const serverSelect = document.getElementById('terminal-server-select');
        if (serverSelect) {
            serverSelect.value = serverId;
            serverSelect.dispatchEvent(new Event('change'));
        }
    }, 100);
};

window.openFiles = function(serverId) {
    document.querySelector('[data-section="files"]').click();
    setTimeout(() => {
        const serverSelect = document.getElementById('files-server-select');
        if (serverSelect) {
            serverSelect.value = serverId;
            serverSelect.dispatchEvent(new Event('change'));
        }
    }, 100);
};

window.editServer = function(serverId) {
    XpanelUtils.showNotification('Функция', 'Редактирование сервера будет доступно в следующей версии', 'info');
};

window.removeServer = async function(serverId) {
    if (!confirm('Вы уверены, что хотите удалить этот сервер?')) {
        return;
    }

    try {
        await api.removeServer(serverId);
        XpanelUtils.showNotification('Успех', 'Сервер удален', 'success');
        window.serversManager.loadServers();
    } catch (error) {
        console.error('Failed to remove server:', error);
        XpanelUtils.showNotification('Ошибка', 'Не удалось удалить сервер', 'error');
    }
};

// Initialize servers manager
document.addEventListener('DOMContentLoaded', () => {
    window.serversManager = new ServersManager();
    
    // Setup WebSocket handler for server stats
    ws.on('server_stats', (data) => {
        if (window.serversManager) {
            window.serversManager.updateServerStats(data.server_id, data.stats);
        }
    });
});
