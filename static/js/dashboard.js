// Xpanel - Dashboard JavaScript

class Dashboard {
    constructor() {
        this.systemStats = null;
        this.servers = [];
        this.updateInterval = null;
        this.init();
    }

    init() {
        this.setupNavigation();
        this.setupWebSocketHandlers();
        this.loadDashboard();
        this.startAutoUpdate();
    }

    setupNavigation() {
        const navItems = document.querySelectorAll('.nav-item');
        const sections = document.querySelectorAll('.content-section');

        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                
                const sectionId = item.dataset.section;
                
                // Update active nav item
                navItems.forEach(nav => nav.classList.remove('active'));
                item.classList.add('active');
                
                // Show corresponding section
                sections.forEach(section => section.classList.remove('active'));
                const targetSection = document.getElementById(`${sectionId}-section`);
                if (targetSection) {
                    targetSection.classList.add('active');
                }
                
                // Load section-specific data
                this.loadSectionData(sectionId);
            });
        });
    }

    setupWebSocketHandlers() {
        ws.on('system_stats', (data) => {
            this.updateSystemStats(data);
        });

        ws.on('server_stats', (data) => {
            this.updateServerStats(data);
        });
    }

    async loadDashboard() {
        try {
            // Load system stats
            await this.loadSystemStats();
            
            // Load servers
            await this.loadServers();
            
        } catch (error) {
            console.error('Failed to load dashboard:', error);
            XpanelUtils.showNotification('Ошибка', 'Не удалось загрузить данные панели', 'error');
        }
    }

    async loadSystemStats() {
        try {
            const stats = await api.getSystemStats();
            this.updateSystemStats(stats);
        } catch (error) {
            console.error('Failed to load system stats:', error);
        }
    }

    async loadServers() {
        try {
            const servers = await api.getServers();
            this.servers = servers;
            this.renderServersOverview();
        } catch (error) {
            console.error('Failed to load servers:', error);
        }
    }

    updateSystemStats(stats) {
        this.systemStats = stats;
        
        // Update CPU usage
        const cpuElement = document.getElementById('cpu-usage');
        if (cpuElement && stats.cpu) {
            cpuElement.textContent = `${stats.cpu.usage.toFixed(1)}%`;
            cpuElement.style.color = XpanelUtils.getCPUColor(stats.cpu.usage);
        }
        
        // Update memory usage
        const memoryElement = document.getElementById('memory-usage');
        if (memoryElement && stats.memory) {
            memoryElement.textContent = `${stats.memory.percent.toFixed(1)}%`;
            memoryElement.style.color = XpanelUtils.getMemoryColor(stats.memory.percent);
        }
        
        // Update disk usage
        const diskElement = document.getElementById('disk-usage');
        if (diskElement && stats.disk) {
            diskElement.textContent = `${stats.disk.percent.toFixed(1)}%`;
            diskElement.style.color = XpanelUtils.getDiskColor(stats.disk.percent);
        }
        
        // Update network usage
        const networkElement = document.getElementById('network-usage');
        if (networkElement && stats.network) {
            const totalBytes = stats.network.bytes_sent + stats.network.bytes_recv;
            networkElement.textContent = XpanelUtils.formatBytes(totalBytes);
        }
    }

    updateServerStats(data) {
        const serverCard = document.querySelector(`[data-server-id="${data.server_id}"]`);
        if (serverCard && data.stats) {
            // Update server status
            const statusElement = serverCard.querySelector('.server-status');
            if (statusElement) {
                statusElement.textContent = data.stats.status;
                statusElement.className = `server-status ${data.stats.status}`;
            }
            
            // Update metrics
            const cpuMetric = serverCard.querySelector('.cpu-metric');
            if (cpuMetric && data.stats.cpu !== 'N/A') {
                cpuMetric.textContent = `${data.stats.cpu}%`;
            }
            
            const memoryMetric = serverCard.querySelector('.memory-metric');
            if (memoryMetric && data.stats.memory !== 'N/A') {
                memoryMetric.textContent = `${data.stats.memory}%`;
            }
        }
    }

    renderServersOverview() {
        const serversGrid = document.getElementById('servers-grid');
        if (!serversGrid) return;
        
        if (this.servers.length === 0) {
            serversGrid.innerHTML = `
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
        
        serversGrid.innerHTML = this.servers.map(server => `
            <div class="server-card" data-server-id="${server.id}">
                <div class="server-header">
                    <div class="server-name">${server.name}</div>
                    <div class="server-status ${server.status}">${server.status}</div>
                </div>
                <div class="server-info">
                    <div class="server-metric">
                        <div class="server-metric-label">CPU</div>
                        <div class="server-metric-value cpu-metric">--</div>
                    </div>
                    <div class="server-metric">
                        <div class="server-metric-label">RAM</div>
                        <div class="server-metric-value memory-metric">--</div>
                    </div>
                    <div class="server-metric">
                        <div class="server-metric-label">Диск</div>
                        <div class="server-metric-value disk-metric">--</div>
                    </div>
                    <div class="server-metric">
                        <div class="server-metric-label">Uptime</div>
                        <div class="server-metric-value uptime-metric">--</div>
                    </div>
                </div>
                <div class="server-actions">
                    <button class="btn btn-secondary" onclick="connectToServer('${server.id}')">
                        <i class="fas fa-plug"></i>
                    </button>
                    <button class="btn btn-primary" onclick="openServerTerminal('${server.id}')">
                        <i class="fas fa-terminal"></i>
                    </button>
                    <button class="btn btn-secondary" onclick="openServerFiles('${server.id}')">
                        <i class="fas fa-folder"></i>
                    </button>
                </div>
            </div>
        `).join('');
        
        // Join WebSocket rooms for each server
        this.servers.forEach(server => {
            ws.joinServerRoom(server.id);
        });
    }

    loadSectionData(sectionId) {
        switch (sectionId) {
            case 'servers':
                if (window.serversManager) {
                    window.serversManager.loadServers();
                }
                break;
            case 'terminal':
                if (window.terminalManager) {
                    window.terminalManager.loadServers();
                }
                break;
            case 'files':
                if (window.filesManager) {
                    window.filesManager.loadServers();
                }
                break;
            case 'monitoring':
                if (window.monitoringManager) {
                    window.monitoringManager.initCharts();
                }
                break;
        }
    }

    startAutoUpdate() {
        this.updateInterval = setInterval(() => {
            this.loadSystemStats();
        }, 5000); // Update every 5 seconds
    }

    stopAutoUpdate() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    refreshDashboard() {
        this.loadDashboard();
        XpanelUtils.showNotification('Обновлено', 'Данные панели обновлены', 'success');
    }
}

// Global functions
window.refreshDashboard = function() {
    if (window.dashboard) {
        window.dashboard.refreshDashboard();
    }
};

window.connectToServer = async function(serverId) {
    try {
        // This would trigger server connection
        XpanelUtils.showNotification('Подключение', 'Подключение к серверу...', 'info');
        // Implementation depends on server manager
    } catch (error) {
        XpanelUtils.showNotification('Ошибка', 'Не удалось подключиться к серверу', 'error');
    }
};

window.openServerTerminal = function(serverId) {
    // Switch to terminal section and select server
    document.querySelector('[data-section="terminal"]').click();
    setTimeout(() => {
        const serverSelect = document.getElementById('terminal-server-select');
        if (serverSelect) {
            serverSelect.value = serverId;
            serverSelect.dispatchEvent(new Event('change'));
        }
    }, 100);
};

window.openServerFiles = function(serverId) {
    // Switch to files section and select server
    document.querySelector('[data-section="files"]').click();
    setTimeout(() => {
        const serverSelect = document.getElementById('files-server-select');
        if (serverSelect) {
            serverSelect.value = serverId;
            serverSelect.dispatchEvent(new Event('change'));
        }
    }, 100);
};

// Initialize dashboard when page loads
document.addEventListener('DOMContentLoaded', () => {
    if (XpanelUtils.isAuthenticated()) {
        window.dashboard = new Dashboard();
    } else {
        window.location.href = '/login';
    }
});
