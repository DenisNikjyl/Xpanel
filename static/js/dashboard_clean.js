// Modern Dashboard JavaScript
document.addEventListener('DOMContentLoaded', async function() {
    console.log('Dashboard loading...');
    
    // Wait for auth system to be ready
    if (window.xpanelAuth) {
        await window.xpanelAuth.initAuth();
    }
    
    // Initialize dashboard
    initDashboard();
    
    // Load initial data
    await loadServers();
    await loadCustomActions();
    
    // Setup navigation
    setupNavigation();
    
    // Setup modals
    setupModals();
    
    // Initialize WebSocket connection
    if (window.WebSocketManager) {
        window.WebSocketManager.connect();
    }
    
    // Start system monitoring
    startSystemMonitoring();
});

function initDashboard() {
    // Use new auth system
    if (!window.xpanelAuth || !window.xpanelAuth.isAuthenticated()) {
        console.log('Not authenticated, redirecting to login');
        window.location.href = '/login';
        return;
    }
    
    // Set authorization header for all requests using new auth system
    window.authHeaders = window.xpanelAuth.getAuthHeaders();
    
    // Initialize servers array
    window.servers = [];
    window.customActions = [];
}

async function refreshDashboard() {
    console.log('Refreshing dashboard...');
    
    // Show refresh animation
    const refreshBtn = document.querySelector('.btn[onclick="refreshDashboard()"]');
    if (refreshBtn) {
        const icon = refreshBtn.querySelector('i');
        icon.classList.add('fa-spin');
        refreshBtn.disabled = true;
    }
    
    try {
        await Promise.all([
            loadServers(),
            loadCustomActions(),
            updateSystemStats()
        ]);
        
        console.log('Dashboard refreshed successfully');
    } catch (error) {
        console.error('Error refreshing dashboard:', error);
    } finally {
        // Remove refresh animation
        if (refreshBtn) {
            const icon = refreshBtn.querySelector('i');
            icon.classList.remove('fa-spin');
            refreshBtn.disabled = false;
        }
    }
}

// System monitoring functions
function startSystemMonitoring() {
    // Update system stats every 5 seconds
    updateSystemStats();
    setInterval(updateSystemStats, 5000);
}

async function updateSystemStats() {
    try {
        const response = await window.xpanelAuth.apiRequest('/api/system/stats');
        if (!response) return;
        
        const data = await response.json();
        
        // Update CPU usage
        const cpuElement = document.getElementById('cpu-usage');
        if (cpuElement && data.cpu !== undefined) {
            cpuElement.textContent = `${Math.round(data.cpu)}%`;
        }
        
        // Update Memory usage
        const memoryElement = document.getElementById('memory-usage');
        if (memoryElement && data.memory !== undefined) {
            memoryElement.textContent = `${Math.round(data.memory)}%`;
        }
        
        // Update Disk usage
        const diskElement = document.getElementById('disk-usage');
        if (diskElement && data.disk !== undefined) {
            diskElement.textContent = `${Math.round(data.disk)}%`;
        }
        
        // Update Network usage
        const networkElement = document.getElementById('network-usage');
        if (networkElement && data.network !== undefined) {
            networkElement.textContent = `${(data.network / 1024 / 1024).toFixed(1)} MB/s`;
        }
        
    } catch (error) {
        console.error('Error updating system stats:', error);
    }
}

function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const sections = document.querySelectorAll('.content-section');

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            
            const sectionName = item.dataset.section;
            const sectionId = sectionName + '-section';
            
            console.log('Switching to section:', sectionId);
            
            // Update active nav item
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            
            // Show corresponding section
            sections.forEach(section => section.classList.remove('active'));
            const targetSection = document.getElementById(sectionId);
            if (targetSection) {
                targetSection.classList.add('active');
                console.log('Section activated:', sectionId);
            } else {
                console.error('Section not found:', sectionId);
            }
        });
    });
    
    // Ensure dashboard section is visible by default
    const dashboardSection = document.getElementById('dashboard-section');
    if (dashboardSection) {
        dashboardSection.classList.add('active');
    }
}

function setupModals() {
    // Setup modal functionality
    const modals = document.querySelectorAll('.modal');
    
    // Close modal when clicking outside
    modals.forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
    });
    
    // Setup close buttons
    const closeButtons = document.querySelectorAll('.modal-close');
    closeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const modal = btn.closest('.modal');
            if (modal) {
                modal.classList.remove('active');
            }
        });
    });
}

async function loadServers() {
    try {
        const response = await window.xpanelAuth.apiRequest('/api/servers');
        if (!response) return; // Auth failed, already redirected
        
        const data = await response.json();
        window.servers = data.servers || [];
        updateServersDisplay();
        updateStatsDisplay();
    } catch (error) {
        console.error('Error loading servers:', error);
        window.servers = [];
        updateServersDisplay();
        updateStatsDisplay();
    }
}

function updateServersDisplay() {
    const serversGrid = document.getElementById('servers-grid');
    const serversList = document.getElementById('servers-list');
    
    // Update dashboard servers grid
    if (serversGrid) {
        if (window.servers.length === 0) {
            serversGrid.innerHTML = `
                <div class="empty-servers">
                    <i class="fas fa-server"></i>
                    <h4>Нет подключенных серверов</h4>
                    <p>Добавьте свой первый сервер для начала работы</p>
                    <button class="btn btn-primary" onclick="showAddServerModal()">
                        <i class="fas fa-plus"></i>
                        Добавить сервер
                    </button>
                </div>
            `;
        } else {
            serversGrid.innerHTML = window.servers.map(server => `
                <div class="server-card">
                    <div class="server-header">
                        <h5>${server.name}</h5>
                        <span class="server-status ${server.status}">${server.status === 'online' ? 'Онлайн' : 'Офлайн'}</span>
                    </div>
                    <div class="server-info">
                        <p><i class="fas fa-globe"></i> ${server.host}</p>
                        <p><i class="fas fa-microchip"></i> CPU: ${server.cpu || '0'}%</p>
                        <p><i class="fas fa-memory"></i> RAM: ${server.memory || '0'}%</p>
                    </div>
                </div>
            `).join('');
        }
    }
    
    // Update servers list page
    if (serversList) {
        if (window.servers.length === 0) {
            serversList.innerHTML = `
                <div class="empty-servers">
                    <i class="fas fa-server"></i>
                    <h4>Нет подключенных серверов</h4>
                    <p>Добавьте свой первый сервер для начала работы</p>
                    <button class="btn btn-primary" onclick="showAddServerModal()">
                        <i class="fas fa-plus"></i>
                        Добавить сервер
                    </button>
                </div>
            `;
        } else {
            serversList.innerHTML = window.servers.map(server => `
                <div class="server-card">
                    <div class="server-header">
                        <h5>${server.name}</h5>
                        <span class="server-status ${server.status || 'offline'}">${server.status === 'online' ? 'Онлайн' : 'Офлайн'}</span>
                    </div>
                    <div class="server-info">
                        <p><i class="fas fa-globe"></i> ${server.host}</p>
                        <p><i class="fas fa-microchip"></i> CPU: ${server.cpu || '0'}%</p>
                        <p><i class="fas fa-memory"></i> RAM: ${server.memory || '0'}%</p>
                    </div>
                    <div class="server-actions">
                        <button class="btn btn-secondary" onclick="connectToServer('${server.id}')">
                            <i class="fas fa-terminal"></i>
                            Терминал
                        </button>
                        <button class="btn btn-secondary" onclick="manageServer('${server.id}')">
                            <i class="fas fa-cog"></i>
                            Управление
                        </button>
                    </div>
                </div>
            `).join('');
        }
    }
}

function updateStatsDisplay() {
    // Update server count and stats
    const serverCount = window.servers ? window.servers.length : 0;
    const onlineServers = window.servers ? window.servers.filter(s => s.status === 'online').length : 0;
    
    console.log(`Stats: ${serverCount} total servers, ${onlineServers} online`);
}

async function loadCustomActions() {
    try {
        const response = await window.xpanelAuth.apiRequest('/api/custom-actions');
        if (!response) return; // Auth failed, already redirected
        
        const data = await response.json();
        window.customActions = data.actions || [];
        updateCustomActionsDisplay();
    } catch (error) {
        console.error('Error loading custom actions:', error);
        window.customActions = [];
        updateCustomActionsDisplay();
    }
}

function updateCustomActionsDisplay() {
    // Update custom actions display
    console.log('Custom actions loaded:', window.customActions.length);
}

// Modal functions
function showAddServerModal() {
    const modal = document.getElementById('add-server-modal');
    if (modal) {
        modal.classList.add('active');
    }
}

function closeAddServerModal() {
    const modal = document.getElementById('add-server-modal');
    if (modal) {
        modal.classList.remove('active');
    }
}

// Server management functions
function connectToServer(serverId) {
    console.log('Connecting to server:', serverId);
    // Switch to terminal section and connect to server
    const terminalNav = document.querySelector('[data-section="terminal"]');
    if (terminalNav) {
        terminalNav.click();
    }
}

function manageServer(serverId) {
    console.log('Managing server:', serverId);
    // Open server management modal or page
}

// Utility functions
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        console.log('Copied to clipboard:', text);
    }).catch(err => {
        console.error('Failed to copy:', err);
    });
}

function downloadInstallScript() {
    // Download the install script
    const link = document.createElement('a');
    link.href = '/api/agent/install-script';
    link.download = 'install_agent.sh';
    link.click();
}

// Logout function
function logout() {
    if (window.xpanelAuth) {
        window.xpanelAuth.logout();
    } else {
        localStorage.clear();
        window.location.href = '/login';
    }
}

// Global functions for compatibility
window.refreshDashboard = refreshDashboard;
window.showAddServerModal = showAddServerModal;
window.closeAddServerModal = closeAddServerModal;
window.connectToServer = connectToServer;
window.manageServer = manageServer;
window.copyToClipboard = copyToClipboard;
window.downloadInstallScript = downloadInstallScript;
window.logout = logout;
