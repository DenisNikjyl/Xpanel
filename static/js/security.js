class SecurityManager {
    constructor() {
        this.currentTab = 'threats';
        this.threats = [];
        this.firewallRules = [];
        this.logs = [];
        this.users = [];
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadSecurityData();
        
        if (!auth.isAuthenticated()) {
            window.location.href = '/login';
            return;
        }
    }

    bindEvents() {
        // Tab navigation
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });

        // Quick actions
        document.getElementById('scanSystem').addEventListener('click', () => this.scanSystem());
        document.getElementById('updateFirewall').addEventListener('click', () => this.updateFirewall());
        document.getElementById('generateReport').addEventListener('click', () => this.generateReport());

        // Refresh buttons
        document.getElementById('refreshThreats').addEventListener('click', () => this.loadThreats());
        document.getElementById('refreshFirewall').addEventListener('click', () => this.loadFirewallRules());
        document.getElementById('refreshLogs').addEventListener('click', () => this.loadLogs());
        document.getElementById('refreshUsers').addEventListener('click', () => this.loadUsers());

        // Modals
        document.getElementById('addFirewallRule').addEventListener('click', () => this.openFirewallModal());
        document.getElementById('closeFirewallModal').addEventListener('click', () => this.closeFirewallModal());
        document.getElementById('saveFirewallRule').addEventListener('click', () => this.saveFirewallRule());

        document.getElementById('addUser').addEventListener('click', () => this.openUserModal());
        document.getElementById('closeUserModal').addEventListener('click', () => this.closeUserModal());
        document.getElementById('saveUser').addEventListener('click', () => this.saveUser());

        // Filters
        document.getElementById('threatFilter').addEventListener('change', () => this.filterThreats());
        document.getElementById('logType').addEventListener('change', () => this.filterLogs());
        document.getElementById('logDate').addEventListener('change', () => this.filterLogs());
    }

    async loadSecurityData() {
        await Promise.all([
            this.loadThreats(),
            this.loadFirewallRules(),
            this.loadLogs(),
            this.loadUsers()
        ]);
        this.updateSecurityScore();
    }

    switchTab(tabName) {
        // Update active tab button
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });

        // Update active tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === `${tabName}-tab`);
        });

        this.currentTab = tabName;
    }

    async loadThreats() {
        try {
            // Simulate API call with mock data
            this.threats = [
                {
                    id: 1,
                    type: 'Malware',
                    severity: 'high',
                    source: '192.168.1.50',
                    description: 'Подозрительная активность обнаружена',
                    timestamp: new Date(Date.now() - 30 * 60 * 1000),
                    status: 'blocked'
                },
                {
                    id: 2,
                    type: 'Brute Force',
                    severity: 'medium',
                    source: '10.0.0.15',
                    description: 'Множественные попытки входа',
                    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
                    status: 'monitoring'
                }
            ];
            this.renderThreats();
        } catch (error) {
            console.error('Ошибка загрузки угроз:', error);
        }
    }

    renderThreats() {
        const container = document.getElementById('threatsList');
        if (this.threats.length === 0) {
            container.innerHTML = '<div class="empty-message">Угроз не обнаружено</div>';
            return;
        }

        container.innerHTML = this.threats.map(threat => `
            <div class="threat-item ${threat.severity}">
                <div class="threat-icon">
                    <i class="fas fa-${this.getThreatIcon(threat.type)}"></i>
                </div>
                <div class="threat-info">
                    <div class="threat-title">${threat.type}</div>
                    <div class="threat-description">${threat.description}</div>
                    <div class="threat-meta">
                        <span class="threat-source">Источник: ${threat.source}</span>
                        <span class="threat-time">${this.formatTime(threat.timestamp)}</span>
                    </div>
                </div>
                <div class="threat-status ${threat.status}">
                    ${this.getStatusText(threat.status)}
                </div>
                <div class="threat-actions">
                    <button class="btn-icon" onclick="securityManager.blockThreat(${threat.id})">
                        <i class="fas fa-ban"></i>
                    </button>
                    <button class="btn-icon" onclick="securityManager.investigateThreat(${threat.id})">
                        <i class="fas fa-search"></i>
                    </button>
                </div>
            </div>
        `).join('');
    }

    async loadFirewallRules() {
        try {
            this.firewallRules = [
                {
                    id: 1,
                    name: 'SSH Access',
                    action: 'allow',
                    protocol: 'tcp',
                    port: '22',
                    source: '192.168.1.0/24',
                    enabled: true
                },
                {
                    id: 2,
                    name: 'Block Suspicious IPs',
                    action: 'deny',
                    protocol: 'tcp',
                    port: 'any',
                    source: '10.0.0.0/8',
                    enabled: true
                }
            ];
            this.renderFirewallRules();
        } catch (error) {
            console.error('Ошибка загрузки правил фаервола:', error);
        }
    }

    renderFirewallRules() {
        const container = document.getElementById('firewallRules');
        container.innerHTML = this.firewallRules.map(rule => `
            <div class="firewall-rule ${rule.enabled ? 'enabled' : 'disabled'}">
                <div class="rule-info">
                    <div class="rule-name">${rule.name}</div>
                    <div class="rule-details">
                        ${rule.action.toUpperCase()} ${rule.protocol.toUpperCase()}:${rule.port} from ${rule.source}
                    </div>
                </div>
                <div class="rule-actions">
                    <button class="btn-toggle ${rule.enabled ? 'active' : ''}" 
                            onclick="securityManager.toggleFirewallRule(${rule.id})">
                        <i class="fas fa-${rule.enabled ? 'toggle-on' : 'toggle-off'}"></i>
                    </button>
                    <button class="btn-icon" onclick="securityManager.editFirewallRule(${rule.id})">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon danger" onclick="securityManager.deleteFirewallRule(${rule.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
    }

    async loadLogs() {
        try {
            this.logs = [
                {
                    id: 1,
                    type: 'auth',
                    level: 'info',
                    message: 'Успешный вход пользователя admin',
                    timestamp: new Date(Date.now() - 10 * 60 * 1000),
                    source: '192.168.1.100'
                },
                {
                    id: 2,
                    type: 'firewall',
                    level: 'warning',
                    message: 'Заблокировано подключение с подозрительного IP',
                    timestamp: new Date(Date.now() - 25 * 60 * 1000),
                    source: '10.0.0.15'
                }
            ];
            this.renderLogs();
        } catch (error) {
            console.error('Ошибка загрузки логов:', error);
        }
    }

    renderLogs() {
        const container = document.getElementById('logsList');
        container.innerHTML = this.logs.map(log => `
            <div class="log-item ${log.level}">
                <div class="log-time">${this.formatTime(log.timestamp)}</div>
                <div class="log-type">${log.type.toUpperCase()}</div>
                <div class="log-message">${log.message}</div>
                <div class="log-source">${log.source}</div>
            </div>
        `).join('');
    }

    async loadUsers() {
        try {
            this.users = [
                {
                    id: 1,
                    username: 'admin',
                    email: 'admin@xpanel.com',
                    role: 'admin',
                    active: true,
                    lastLogin: new Date(Date.now() - 30 * 60 * 1000)
                },
                {
                    id: 2,
                    username: 'user1',
                    email: 'user1@example.com',
                    role: 'user',
                    active: true,
                    lastLogin: new Date(Date.now() - 2 * 60 * 60 * 1000)
                }
            ];
            this.renderUsers();
        } catch (error) {
            console.error('Ошибка загрузки пользователей:', error);
        }
    }

    renderUsers() {
        const container = document.getElementById('usersList');
        container.innerHTML = this.users.map(user => `
            <div class="user-item ${user.active ? 'active' : 'inactive'}">
                <div class="user-avatar">
                    <i class="fas fa-user"></i>
                </div>
                <div class="user-info">
                    <div class="user-name">${user.username}</div>
                    <div class="user-email">${user.email}</div>
                    <div class="user-meta">
                        <span class="user-role">${this.getRoleText(user.role)}</span>
                        <span class="user-last-login">Последний вход: ${this.formatTime(user.lastLogin)}</span>
                    </div>
                </div>
                <div class="user-status ${user.active ? 'active' : 'inactive'}">
                    ${user.active ? 'Активен' : 'Неактивен'}
                </div>
                <div class="user-actions">
                    <button class="btn-icon" onclick="securityManager.editUser(${user.id})">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon" onclick="securityManager.toggleUser(${user.id})">
                        <i class="fas fa-${user.active ? 'user-slash' : 'user-check'}"></i>
                    </button>
                    <button class="btn-icon danger" onclick="securityManager.deleteUser(${user.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
    }

    updateSecurityScore() {
        const score = this.calculateSecurityScore();
        document.getElementById('scoreValue').textContent = score;
        
        const circle = document.getElementById('scoreCircle');
        const status = document.getElementById('securityLevel');
        
        if (score >= 80) {
            circle.className = 'score-circle high';
            status.textContent = 'Защищено';
            status.className = 'status-level secure';
        } else if (score >= 60) {
            circle.className = 'score-circle medium';
            status.textContent = 'Предупреждение';
            status.className = 'status-level warning';
        } else {
            circle.className = 'score-circle low';
            status.textContent = 'Уязвимо';
            status.className = 'status-level danger';
        }
    }

    calculateSecurityScore() {
        let score = 100;
        
        // Deduct points for threats
        const highThreats = this.threats.filter(t => t.severity === 'high').length;
        const mediumThreats = this.threats.filter(t => t.severity === 'medium').length;
        
        score -= (highThreats * 15) + (mediumThreats * 5);
        
        // Deduct points for disabled firewall rules
        const disabledRules = this.firewallRules.filter(r => !r.enabled).length;
        score -= disabledRules * 10;
        
        return Math.max(0, Math.min(100, score));
    }

    // Utility methods
    getThreatIcon(type) {
        const icons = {
            'Malware': 'virus',
            'Brute Force': 'user-secret',
            'DDoS': 'bomb',
            'Intrusion': 'user-ninja'
        };
        return icons[type] || 'exclamation-triangle';
    }

    getStatusText(status) {
        const texts = {
            'blocked': 'Заблокировано',
            'monitoring': 'Мониторинг',
            'investigating': 'Расследование'
        };
        return texts[status] || status;
    }

    getRoleText(role) {
        const texts = {
            'admin': 'Администратор',
            'user': 'Пользователь',
            'viewer': 'Наблюдатель'
        };
        return texts[role] || role;
    }

    formatTime(date) {
        const now = new Date();
        const diff = now - date;
        
        if (diff < 60000) return 'Только что';
        if (diff < 3600000) return `${Math.floor(diff / 60000)} мин назад`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)} ч назад`;
        return date.toLocaleDateString();
    }

    // Modal methods
    openFirewallModal() {
        document.getElementById('firewallRuleModal').classList.add('active');
    }

    closeFirewallModal() {
        document.getElementById('firewallRuleModal').classList.remove('active');
        this.resetFirewallForm();
    }

    openUserModal() {
        document.getElementById('addUserModal').classList.add('active');
    }

    closeUserModal() {
        document.getElementById('addUserModal').classList.remove('active');
        this.resetUserForm();
    }

    resetFirewallForm() {
        document.getElementById('ruleName').value = '';
        document.getElementById('ruleAction').value = 'allow';
        document.getElementById('ruleProtocol').value = 'tcp';
        document.getElementById('rulePort').value = '';
        document.getElementById('ruleIP').value = '';
        document.getElementById('ruleDescription').value = '';
    }

    resetUserForm() {
        document.getElementById('userName').value = '';
        document.getElementById('userEmail').value = '';
        document.getElementById('userPassword').value = '';
        document.getElementById('userRole').value = 'user';
        document.getElementById('userActive').checked = true;
    }

    // Action methods
    async scanSystem() {
        this.showNotification('Запуск сканирования системы...', 'info');
        // Simulate scan
        setTimeout(() => {
            this.showNotification('Сканирование завершено. Новых угроз не обнаружено.', 'success');
        }, 3000);
    }

    async updateFirewall() {
        this.showNotification('Обновление правил фаервола...', 'info');
        setTimeout(() => {
            this.showNotification('Правила фаервола успешно обновлены', 'success');
        }, 2000);
    }

    async generateReport() {
        this.showNotification('Генерация отчета безопасности...', 'info');
        setTimeout(() => {
            this.showNotification('Отчет сгенерирован и отправлен на email', 'success');
        }, 2500);
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check' : type === 'error' ? 'times' : 'info'}-circle"></i>
            <span>${message}</span>
        `;

        let container = document.querySelector('.notifications-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'notifications-container';
            document.body.appendChild(container);
        }

        container.appendChild(notification);
        setTimeout(() => notification.remove(), 5000);
    }
}

let securityManager;
document.addEventListener('DOMContentLoaded', () => {
    securityManager = new SecurityManager();
});
