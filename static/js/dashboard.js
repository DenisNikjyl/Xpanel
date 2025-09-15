// Modern Dashboard JavaScript
document.addEventListener('DOMContentLoaded', function() {
    // Initialize dashboard
    initDashboard();
    
    // Setup navigation
    setupNavigation();
    
    // Setup WebSocket connection
    setupWebSocket();
    
    // Load initial data
    loadServers();
    loadCustomActions();
    
    // Setup modal functionality
    setupModals();
    
    // Setup sidebar toggle for mobile
    setupSidebarToggle();
    
    // Setup language switcher
    setupLanguageSwitcher();
});

function initDashboard() {
    // Check authentication
    const token = localStorage.getItem('token') || localStorage.getItem('xpanel_token');
    if (!token) {
        console.log('No token found, redirecting to login');
        window.location.href = '/login';
        return;
    }
    
    console.log('Token found:', token ? 'Yes' : 'No');
    
    // Set authorization header for all requests
    window.authHeaders = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };
    
    // Initialize servers array
    window.servers = [];
}

function setupSidebarToggle() {
    const sidebarToggle = document.querySelector('.sidebar-toggle');
    const sidebar = document.querySelector('.sidebar');
    
    if (sidebarToggle && sidebar) {
        sidebarToggle.addEventListener('click', function() {
            sidebar.classList.toggle('active');
        });
        
        // Close sidebar when clicking outside on mobile
        document.addEventListener('click', function(e) {
            if (window.innerWidth <= 768 && 
                !sidebar.contains(e.target) && 
                !sidebarToggle.contains(e.target)) {
                sidebar.classList.remove('active');
            }
        });
    }
}

function setupNavigation() {
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
            const targetSection = document.getElementById(sectionId);
            if (targetSection) {
                targetSection.classList.add('active');
            }
        });
    });
}

function setupModals() {
    // Setup tab switching
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const tabName = this.dataset.tab;
            
            // Remove active class from all tabs
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            
            // Add active class to clicked tab
            this.classList.add('active');
            const targetTab = document.getElementById(tabName + '-tab');
            if (targetTab) {
                targetTab.classList.add('active');
            }
        });
    });
    
    // Setup auto install form
    const autoInstallForm = document.getElementById('autoInstallForm');
    if (autoInstallForm) {
        autoInstallForm.addEventListener('submit', handleAutoInstall);
    }
    
    // Setup copy buttons
    setupCopyButtons();
}

function setupCopyButtons() {
    const copyBtns = document.querySelectorAll('.copy-btn');
    copyBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const codeBlock = this.parentElement.querySelector('code');
            if (codeBlock) {
                navigator.clipboard.writeText(codeBlock.textContent).then(() => {
                    const originalIcon = this.innerHTML;
                    this.innerHTML = '<i class="fas fa-check"></i>';
                    setTimeout(() => {
                        this.innerHTML = originalIcon;
                    }, 2000);
                });
            }
        });
    });
}

function setupLanguageSwitcher() {
    const langBtns = document.querySelectorAll('.lang-btn');
    langBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const lang = this.dataset.lang;
            switchLanguage(lang);
        });
    });
}

function switchLanguage(lang) {
    if (lang === 'ru') {
        window.location.href = '/dashboard/ru';
    } else {
        window.location.href = '/dashboard';
    }
}

function showAddServerModal() {
    const modal = document.getElementById('addServerModal');
    if (modal) {
        modal.classList.add('active');
    }
}

function closeAddServerModal() {
    const modal = document.getElementById('addServerModal');
    if (modal) {
        modal.classList.remove('active');
    }
}

async function handleAutoInstall(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const serverData = {
        name: formData.get('name'),
        host: formData.get('host'),
        port: parseInt(formData.get('port')),
        username: formData.get('username'),
        password: formData.get('password')
    };
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    
    try {
        // Show loading state
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Устанавливаем...';
        submitBtn.disabled = true;
        
        const response = await fetch('/api/install-agent', {
            method: 'POST',
            headers: window.authHeaders,
            body: JSON.stringify(serverData)
        });
        
        const result = await response.json();
        
        if (response.ok) {
            // Success
            submitBtn.innerHTML = '<i class="fas fa-check"></i> Установлено!';
            submitBtn.classList.add('success');
            
            setTimeout(() => {
                closeAddServerModal();
                loadServers(); // Reload servers list
                
                // Reset form
                e.target.reset();
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;
                submitBtn.classList.remove('success');
            }, 2000);
            
        } else {
            throw new Error(result.message || 'Ошибка установки агента');
        }
        
    } catch (error) {
        // Error handling
        submitBtn.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Ошибка';
        submitBtn.classList.add('error');
        
        // Show error message
        alert('Ошибка: ' + error.message);
        
        setTimeout(() => {
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
            submitBtn.classList.remove('error');
        }, 3000);
    }
}

function loadServers() {
    // Check if auth headers are available
    if (!window.authHeaders) {
        console.error('No auth headers available');
        return;
    }
    
    fetch('/api/servers', {
        headers: window.authHeaders
    })
    .then(response => {
        console.log('API Response status:', response.status);
        if (response.status === 422 || response.status === 401) {
            // Token expired or invalid, redirect to login
            console.log('Token invalid, clearing and redirecting to login');
            localStorage.removeItem('token');
            localStorage.removeItem('xpanel_token');
            window.location.href = '/login';
            return;
        }
        return response.json();
    })
    .then(data => {
        if (data) {
            window.servers = data.servers || [];
            updateServersDisplay();
            updateStatsDisplay();
        }
    })
    .catch(error => {
        console.error('Error loading servers:', error);
        window.servers = [];
        updateServersDisplay();
        updateStatsDisplay();
    });
}

function updateServersDisplay() {
    const emptyState = document.getElementById('empty-state');
    const serversList = document.getElementById('servers-list');
    const serversTableBody = document.getElementById('servers-table-body');
    const quickStats = document.getElementById('quick-stats');
    
    if (window.servers.length === 0) {
        // Show empty state
        if (emptyState) emptyState.style.display = 'block';
        if (serversList) serversList.style.display = 'none';
        if (quickStats) quickStats.style.display = 'none';
        
        // Show empty table
        if (serversTableBody) {
            serversTableBody.innerHTML = `
                <tr class="empty-row">
                    <td colspan="9">
                        <div class="empty-table">
                            <i class="fas fa-server"></i>
                            <p>Нет добавленных серверов</p>
                        </div>
                    </td>
                </tr>
            `;
        }
    } else {
        // Show servers
        if (emptyState) emptyState.style.display = 'none';
        if (serversList) serversList.style.display = 'block';
        if (quickStats) quickStats.style.display = 'grid';
        
        // Update servers table
        if (serversTableBody) {
            serversTableBody.innerHTML = window.servers.map(server => {
                const lastPing = server.last_ping ? formatLastPing(server.last_ping) : 'Никогда';
                const customActionsHtml = generateCustomActionsDropdown(server.id);
                
                return `
                    <tr>
                        <td><strong>${server.name}</strong></td>
                        <td>${server.host}</td>
                        <td>
                            <div class="connection-indicator">
                                <span class="status-badge ${getConnectionStatus(server)}">
                                    ${getConnectionStatusText(server)}
                                </span>
                            </div>
                        </td>
                        <td>
                            <span class="ping-time">${lastPing}</span>
                        </td>
                        <td>${server.cpu_usage || '0'}%</td>
                        <td>${server.memory_usage || '0'}%</td>
                        <td>${server.disk_usage || '0'}%</td>
                        <td>
                            ${customActionsHtml}
                        </td>
                        <td>
                            <div class="server-actions">
                                <button class="btn-small" onclick="connectToServer('${server.id}')" title="Подключиться">
                                    <i class="fas fa-terminal"></i>
                                </button>
                                <button class="btn-small success" onclick="reinstallAgent('${server.id}')" title="Переустановить агента">
                                    <i class="fas fa-sync"></i>
                                </button>
                                <button class="btn-small danger" onclick="removeAgent('${server.id}')" title="Удалить агента">
                                    <i class="fas fa-trash"></i>
                                </button>
                                <button class="btn-small danger" onclick="removeServer('${server.id}')" title="Удалить сервер">
                                    <i class="fas fa-times"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');
        }
    }
}

function updateStatsDisplay() {
    if (window.servers.length === 0) {
        return; // Don't show stats when no servers
    }
    
    // Calculate average stats from all servers
    let totalCpu = 0, totalMemory = 0, totalDisk = 0, totalNetwork = 0;
    let onlineServers = 0;
    
    window.servers.forEach(server => {
        if (server.status === 'online') {
            totalCpu += parseFloat(server.cpu_usage || 0);
            totalMemory += parseFloat(server.memory_usage || 0);
            totalDisk += parseFloat(server.disk_usage || 0);
            totalNetwork += parseFloat(server.network_usage || 0);
            onlineServers++;
        }
    });
    
    if (onlineServers > 0) {
        const avgCpu = (totalCpu / onlineServers).toFixed(1);
        const avgMemory = (totalMemory / onlineServers).toFixed(1);
        const avgDisk = (totalDisk / onlineServers).toFixed(1);
        const avgNetwork = (totalNetwork / onlineServers).toFixed(1);
        
        // Update stat cards
        const cpuElement = document.getElementById('cpu-usage');
        const memoryElement = document.getElementById('memory-usage');
        const diskElement = document.getElementById('disk-usage');
        const networkElement = document.getElementById('network-usage');
        
        if (cpuElement) cpuElement.textContent = avgCpu + '%';
        if (memoryElement) memoryElement.textContent = avgMemory + '%';
        if (diskElement) diskElement.textContent = avgDisk + '%';
        if (networkElement) networkElement.textContent = avgNetwork + ' MB/s';
    }
}

function setupWebSocket() {
    // WebSocket disabled for stability
    console.log('WebSocket disabled for stability');
}

function handleWebSocketMessage(data) {
    if (data.type === 'server_update') {
        // Update server data
        const serverIndex = window.servers.findIndex(s => s.id === data.server_id);
        if (serverIndex !== -1) {
            window.servers[serverIndex] = { ...window.servers[serverIndex], ...data.data };
            updateServersDisplay();
            updateStatsDisplay();
        }
    } else if (data.type === 'server_added') {
        // Add new server
        window.servers.push(data.server);
        updateServersDisplay();
        updateStatsDisplay();
    } else if (data.type === 'server_removed') {
        // Remove server
        window.servers = window.servers.filter(s => s.id !== data.server_id);
        updateServersDisplay();
        updateStatsDisplay();
    }
}

function connectToServer(serverId) {
    // Open terminal connection to server
    const server = window.servers.find(s => s.id === serverId);
    if (server) {
        // Switch to terminal section and connect
        document.querySelector('[data-section="terminal"]').click();
        // Implementation for terminal connection would go here
    }
}

function removeServer(serverId) {
    if (confirm('Вы уверены, что хотите удалить этот сервер?')) {
        fetch(`/api/servers/${serverId}`, {
            method: 'DELETE',
            headers: window.authHeaders
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                loadServers(); // Reload servers list
            } else {
                alert('Ошибка при удалении сервера');
            }
        })
        .catch(error => {
            console.error('Error removing server:', error);
            alert('Ошибка при удалении сервера');
        });
    }
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('xpanel_token');
    window.location.href = '/login';
}

// Helper functions for server display
function getConnectionStatus(server) {
    if (!server.last_ping) return 'offline';
    const lastPing = new Date(server.last_ping);
    const now = new Date();
    const timeDiff = now - lastPing;
    
    if (timeDiff < 60000) return 'online'; // Less than 1 minute
    if (timeDiff < 300000) return 'connecting'; // Less than 5 minutes
    return 'offline';
}

function getConnectionStatusText(server) {
    const status = getConnectionStatus(server);
    switch (status) {
        case 'online': return 'Онлайн';
        case 'connecting': return 'Подключается';
        case 'offline': return 'Офлайн';
        default: return 'Неизвестно';
    }
}

function formatLastPing(timestamp) {
    if (!timestamp) return 'Никогда';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'Только что';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} мин назад`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} ч назад`;
    return `${Math.floor(diff / 86400000)} дн назад`;
}

function generateCustomActionsDropdown(serverId) {
    const actions = window.customActions || [];
    if (actions.length === 0) {
        return '<span class="text-muted">Нет действий</span>';
    }
    
    return `
        <div class="custom-actions-dropdown">
            <button class="custom-actions-btn" onclick="toggleCustomActionsMenu('${serverId}')">
                <i class="fas fa-cogs"></i>
                Действия
                <i class="fas fa-chevron-down"></i>
            </button>
            <div class="custom-actions-menu" id="actions-menu-${serverId}">
                ${actions.map(action => `
                    <button class="custom-action-item" onclick="executeCustomAction('${action.id}', '${serverId}')">
                        <i class="${action.icon}"></i>
                        ${action.name}
                    </button>
                `).join('')}
            </div>
        </div>
    `;
}

function toggleCustomActionsMenu(serverId) {
    const menu = document.getElementById(`actions-menu-${serverId}`);
    if (menu) {
        menu.classList.toggle('active');
        
        // Close other menus
        document.querySelectorAll('.custom-actions-menu').forEach(m => {
            if (m !== menu) m.classList.remove('active');
        });
    }
}

async function executeCustomAction(actionId, serverId) {
    const action = window.customActions.find(a => a.id === actionId);
    const server = window.servers.find(s => s.id === serverId);
    
    if (!action || !server) return;
    
    // Close menu
    document.getElementById(`actions-menu-${serverId}`).classList.remove('active');
    
    // Show confirmation if required
    if (action.confirm) {
        const confirmed = confirm(`Выполнить действие "${action.name}" на сервере ${server.name}?\n\nКоманда: ${action.command}`);
        if (!confirmed) return;
    }
    
    try {
        const response = await fetch('/api/execute-custom-action', {
            method: 'POST',
            headers: window.authHeaders,
            body: JSON.stringify({
                server_id: serverId,
                action_id: actionId,
                command: action.command
            })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            alert(`Действие "${action.name}" выполнено успешно!\n\nРезультат:\n${result.output}`);
        } else {
            throw new Error(result.message || 'Ошибка выполнения действия');
        }
    } catch (error) {
        alert(`Ошибка выполнения действия: ${error.message}`);
    }
}

async function removeAgent(serverId) {
    const server = window.servers.find(s => s.id === serverId);
    if (!server) return;
    
    const confirmed = confirm(`Вы уверены, что хотите удалить агента с сервера ${server.name}?\n\nЭто действие удалит агента с удаленного сервера, но сохранит запись о сервере в панели.`);
    if (!confirmed) return;
    
    try {
        const response = await fetch(`/api/servers/${serverId}/remove-agent`, {
            method: 'POST',
            headers: window.authHeaders
        });
        
        const result = await response.json();
        
        if (response.ok) {
            alert('Агент успешно удален с сервера');
            loadServers(); // Reload servers list
        } else {
            throw new Error(result.message || 'Ошибка удаления агента');
        }
    } catch (error) {
        alert(`Ошибка удаления агента: ${error.message}`);
    }
}

async function reinstallAgent(serverId) {
    const server = window.servers.find(s => s.id === serverId);
    if (!server) return;
    
    const confirmed = confirm(`Переустановить агента на сервере ${server.name}?`);
    if (!confirmed) return;
    
    try {
        const response = await fetch(`/api/servers/${serverId}/reinstall-agent`, {
            method: 'POST',
            headers: window.authHeaders
        });
        
        const result = await response.json();
        
        if (response.ok) {
            alert('Агент успешно переустановлен');
            loadServers(); // Reload servers list
        } else {
            throw new Error(result.message || 'Ошибка переустановки агента');
        }
    } catch (error) {
        alert(`Ошибка переустановки агента: ${error.message}`);
    }
}

// Custom Actions Management
function showAddActionModal() {
    const modal = document.getElementById('addActionModal');
    if (modal) {
        modal.classList.add('active');
    }
}

function closeAddActionModal() {
    const modal = document.getElementById('addActionModal');
    if (modal) {
        modal.classList.remove('active');
    }
}

async function handleAddAction(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const actionData = {
        name: formData.get('name'),
        icon: formData.get('icon'),
        color: formData.get('color'),
        command: formData.get('command'),
        confirm: formData.get('confirm') === 'on'
    };
    
    try {
        const response = await fetch('/api/custom-actions', {
            method: 'POST',
            headers: window.authHeaders,
            body: JSON.stringify(actionData)
        });
        
        const result = await response.json();
        
        if (response.ok) {
            closeAddActionModal();
            loadCustomActions(); // Reload actions
            e.target.reset(); // Reset form
            alert('Кастомное действие создано успешно!');
        } else {
            throw new Error(result.message || 'Ошибка создания действия');
        }
    } catch (error) {
        alert(`Ошибка: ${error.message}`);
    }
}

function loadCustomActions() {
    // Check if auth headers are available
    if (!window.authHeaders) {
        console.error('No auth headers available');
        return;
    }
    
    fetch('/api/custom-actions', {
        headers: window.authHeaders
    })
    .then(response => {
        console.log('API Response status:', response.status);
        if (response.status === 422 || response.status === 401) {
            // Token expired or invalid, redirect to login
            console.log('Token invalid, clearing and redirecting to login');
            localStorage.removeItem('token');
            localStorage.removeItem('xpanel_token');
            window.location.href = '/login';
            return;
        }
        return response.json();
    })
    .then(data => {
        if (data) {
            window.customActions = data.actions || [];
            updateCustomActionsDisplay();
            updateServersDisplay(); // Update server table with new actions
        }
    })
    .catch(error => {
        console.error('Error loading custom actions:', error);
        window.customActions = [];
        updateCustomActionsDisplay();
    });
}

function updateCustomActionsDisplay() {
    const actionsGrid = document.getElementById('actions-grid');
    if (!actionsGrid) return;
    
    if (window.customActions.length === 0) {
        actionsGrid.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">
                    <i class="fas fa-cogs"></i>
                </div>
                <h3>Нет кастомных действий</h3>
                <p>Создайте первое действие для автоматизации задач</p>
                <button class="btn btn-primary" onclick="showAddActionModal()">
                    <i class="fas fa-plus"></i>
                    Добавить действие
                </button>
            </div>
        `;
    } else {
        actionsGrid.innerHTML = window.customActions.map(action => `
            <div class="action-card">
                <div class="action-header">
                    <div class="action-info">
                        <div class="action-icon ${action.color}">
                            <i class="${action.icon}"></i>
                        </div>
                        <div class="action-details">
                            <h4>${action.name}</h4>
                            <p>${action.confirm ? 'Требует подтверждения' : 'Выполняется сразу'}</p>
                        </div>
                    </div>
                    <div class="action-menu">
                        <button class="action-menu-btn" onclick="deleteCustomAction('${action.id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                <div class="action-command">
                    <code>${action.command}</code>
                </div>
                <div class="action-buttons">
                    <button class="btn-action ${action.color}" onclick="testCustomAction('${action.id}')">
                        <i class="${action.icon}"></i>
                        Тестировать
                    </button>
                    <button class="btn-edit" onclick="editCustomAction('${action.id}')">
                        <i class="fas fa-edit"></i>
                        Изменить
                    </button>
                </div>
            </div>
        `).join('');
    }
}

async function deleteCustomAction(actionId) {
    const action = window.customActions.find(a => a.id === actionId);
    if (!action) return;
    
    const confirmed = confirm(`Удалить действие "${action.name}"?`);
    if (!confirmed) return;
    
    try {
        const response = await fetch(`/api/custom-actions/${actionId}`, {
            method: 'DELETE',
            headers: window.authHeaders
        });
        
        if (response.ok) {
            loadCustomActions(); // Reload actions
            alert('Действие удалено');
        } else {
            throw new Error('Ошибка удаления действия');
        }
    } catch (error) {
        alert(`Ошибка: ${error.message}`);
    }
}

async function testCustomAction(actionId) {
    const action = window.customActions.find(a => a.id === actionId);
    if (!action) return;
    
    // For testing, we'll just show the command that would be executed
    alert(`Тестирование действия "${action.name}"\n\nКоманда: ${action.command}\n\nДля реального выполнения используйте кнопку действия в списке серверов.`);
}

function editCustomAction(actionId) {
    // This would open an edit modal - for now just show info
    const action = window.customActions.find(a => a.id === actionId);
    if (!action) return;
    
    alert(`Редактирование действия "${action.name}"\n\nФункция редактирования будет добавлена в следующем обновлении.`);
}

// Initialize custom actions on load
document.addEventListener('DOMContentLoaded', function() {
    // Load custom actions
    loadCustomActions();
    
    // Setup custom action form
    const addActionForm = document.getElementById('addActionForm');
    if (addActionForm) {
        addActionForm.addEventListener('submit', handleAddAction);
    }
});

// Global functions for HTML onclick handlers
window.showAddServerModal = showAddServerModal;
window.closeAddServerModal = closeAddServerModal;
window.connectToServer = connectToServer;
window.removeServer = removeServer;
window.removeAgent = removeAgent;
window.reinstallAgent = reinstallAgent;
window.showAddActionModal = showAddActionModal;
window.closeAddActionModal = closeAddActionModal;
window.toggleCustomActionsMenu = toggleCustomActionsMenu;
window.executeCustomAction = executeCustomAction;
window.deleteCustomAction = deleteCustomAction;
window.testCustomAction = testCustomAction;
window.editCustomAction = editCustomAction;
window.logout = logout;

// Add missing refreshDashboard function
function refreshDashboard() {
    loadServers();
    loadCustomActions();
    console.log('Dashboard refreshed');
}

window.refreshDashboard = refreshDashboard;

// Add missing functions for copy and download buttons
function copyToClipboard(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        const text = element.textContent || element.innerText;
        navigator.clipboard.writeText(text).then(() => {
            console.log('Copied to clipboard');
        }).catch(err => {
            console.error('Failed to copy: ', err);
        });
    }
}

function downloadInstallScript() {
    window.open('/api/agent/install-script', '_blank');
}

window.copyToClipboard = copyToClipboard;
window.downloadInstallScript = downloadInstallScript;
