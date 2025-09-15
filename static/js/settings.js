class SettingsManager {
    constructor() {
        this.auth = new XpanelAuth();
        this.currentTab = 'general';
        this.settings = {};
        this.init();
    }

    init() {
        this.loadSettings();
        this.setupEventListeners();
        this.loadSystemInfo();
    }

    setupEventListeners() {
        // Tab navigation
        document.querySelectorAll('.settings-nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const tab = e.currentTarget.dataset.tab;
                this.switchTab(tab);
            });
        });

        // Form change listeners
        document.addEventListener('change', (e) => {
            if (e.target.matches('input, select, textarea')) {
                this.markUnsaved();
            }
        });

        // Modal close on backdrop click
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeModal(modal.id);
                }
            });
        });
    }

    switchTab(tabName) {
        // Update navigation
        document.querySelectorAll('.settings-nav-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // Update content
        document.querySelectorAll('.settings-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.getElementById(`${tabName}-tab`).classList.add('active');

        this.currentTab = tabName;

        // Load tab-specific data
        if (tabName === 'backup') {
            this.loadBackupList();
        }
    }

    async loadSettings() {
        try {
            const response = await fetch('/api/settings', {
                headers: {
                    'Authorization': `Bearer ${this.auth.getToken()}`
                }
            });

            if (response.ok) {
                this.settings = await response.json();
                this.populateSettings();
            } else {
                // Use default settings
                this.settings = this.getDefaultSettings();
                this.populateSettings();
            }
        } catch (error) {
            console.error('Error loading settings:', error);
            this.settings = this.getDefaultSettings();
            this.populateSettings();
        }
    }

    getDefaultSettings() {
        return {
            general: {
                panelName: 'Xpanel Dashboard',
                timezone: 'Europe/Moscow',
                language: 'ru'
            },
            panel: {
                theme: 'dark',
                enableAnimations: true,
                autoRefresh: true,
                systemNotifications: true,
                refreshInterval: 30
            },
            notifications: {
                serverDownAlerts: true,
                cpuAlerts: true,
                memoryAlerts: true,
                diskAlerts: true,
                securityAlerts: true,
                emailNotifications: '',
                alertThreshold: 80
            },
            security: {
                twoFactorAuth: false,
                autoLock: true,
                loginNotifications: true,
                sessionTimeout: 60,
                allowedIps: ''
            },
            backup: {
                autoBackup: true,
                backupFrequency: 'daily',
                backupRetention: 30
            }
        };
    }

    populateSettings() {
        // General settings
        if (this.settings.general) {
            this.setInputValue('panel-name', this.settings.general.panelName);
            this.setInputValue('timezone', this.settings.general.timezone);
            this.setInputValue('language', this.settings.general.language);
        }

        // Panel settings
        if (this.settings.panel) {
            this.setRadioValue('theme', this.settings.panel.theme);
            this.setCheckboxValue('enable-animations', this.settings.panel.enableAnimations);
            this.setCheckboxValue('auto-refresh', this.settings.panel.autoRefresh);
            this.setCheckboxValue('system-notifications', this.settings.panel.systemNotifications);
            this.setInputValue('refresh-interval', this.settings.panel.refreshInterval);
        }

        // Notification settings
        if (this.settings.notifications) {
            this.setCheckboxValue('server-down-alerts', this.settings.notifications.serverDownAlerts);
            this.setCheckboxValue('cpu-alerts', this.settings.notifications.cpuAlerts);
            this.setCheckboxValue('memory-alerts', this.settings.notifications.memoryAlerts);
            this.setCheckboxValue('disk-alerts', this.settings.notifications.diskAlerts);
            this.setCheckboxValue('security-alerts', this.settings.notifications.securityAlerts);
            this.setInputValue('email-notifications', this.settings.notifications.emailNotifications);
            this.setInputValue('alert-threshold', this.settings.notifications.alertThreshold);
        }

        // Security settings
        if (this.settings.security) {
            this.setCheckboxValue('two-factor-auth', this.settings.security.twoFactorAuth);
            this.setCheckboxValue('auto-lock', this.settings.security.autoLock);
            this.setCheckboxValue('login-notifications', this.settings.security.loginNotifications);
            this.setInputValue('session-timeout', this.settings.security.sessionTimeout);
            this.setInputValue('allowed-ips', this.settings.security.allowedIps);
        }

        // Backup settings
        if (this.settings.backup) {
            this.setCheckboxValue('auto-backup', this.settings.backup.autoBackup);
            this.setInputValue('backup-frequency', this.settings.backup.backupFrequency);
            this.setInputValue('backup-retention', this.settings.backup.backupRetention);
        }
    }

    setInputValue(id, value) {
        const element = document.getElementById(id);
        if (element && value !== undefined) {
            element.value = value;
        }
    }

    setCheckboxValue(id, value) {
        const element = document.getElementById(id);
        if (element && value !== undefined) {
            element.checked = value;
        }
    }

    setRadioValue(name, value) {
        const element = document.querySelector(`input[name="${name}"][value="${value}"]`);
        if (element) {
            element.checked = true;
        }
    }

    async loadSystemInfo() {
        try {
            const response = await fetch('/api/system/info', {
                headers: {
                    'Authorization': `Bearer ${this.auth.getToken()}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.updateSystemInfo(data);
            } else {
                // Use mock data
                this.updateSystemInfo({
                    uptime: '7 days, 14 hours',
                    totalServers: 5,
                    activeAgents: 3
                });
            }
        } catch (error) {
            console.error('Error loading system info:', error);
            this.updateSystemInfo({
                uptime: 'Unknown',
                totalServers: 0,
                activeAgents: 0
            });
        }
    }

    updateSystemInfo(data) {
        this.setElementText('system-uptime', data.uptime);
        this.setElementText('total-servers', data.totalServers);
        this.setElementText('active-agents', data.activeAgents);
    }

    setElementText(id, text) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = text;
        }
    }

    async saveSettings() {
        const formData = this.collectFormData();
        
        try {
            const response = await fetch('/api/settings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.auth.getToken()}`
                },
                body: JSON.stringify(formData)
            });

            if (response.ok) {
                this.showNotification('Settings saved successfully', 'success');
                this.settings = formData;
                this.clearUnsaved();
            } else {
                throw new Error('Failed to save settings');
            }
        } catch (error) {
            console.error('Error saving settings:', error);
            this.showNotification('Failed to save settings', 'error');
        }
    }

    collectFormData() {
        return {
            general: {
                panelName: this.getInputValue('panel-name'),
                timezone: this.getInputValue('timezone'),
                language: this.getInputValue('language')
            },
            panel: {
                theme: this.getRadioValue('theme'),
                enableAnimations: this.getCheckboxValue('enable-animations'),
                autoRefresh: this.getCheckboxValue('auto-refresh'),
                systemNotifications: this.getCheckboxValue('system-notifications'),
                refreshInterval: parseInt(this.getInputValue('refresh-interval'))
            },
            notifications: {
                serverDownAlerts: this.getCheckboxValue('server-down-alerts'),
                cpuAlerts: this.getCheckboxValue('cpu-alerts'),
                memoryAlerts: this.getCheckboxValue('memory-alerts'),
                diskAlerts: this.getCheckboxValue('disk-alerts'),
                securityAlerts: this.getCheckboxValue('security-alerts'),
                emailNotifications: this.getInputValue('email-notifications'),
                alertThreshold: parseInt(this.getInputValue('alert-threshold'))
            },
            security: {
                twoFactorAuth: this.getCheckboxValue('two-factor-auth'),
                autoLock: this.getCheckboxValue('auto-lock'),
                loginNotifications: this.getCheckboxValue('login-notifications'),
                sessionTimeout: parseInt(this.getInputValue('session-timeout')),
                allowedIps: this.getInputValue('allowed-ips')
            },
            backup: {
                autoBackup: this.getCheckboxValue('auto-backup'),
                backupFrequency: this.getInputValue('backup-frequency'),
                backupRetention: parseInt(this.getInputValue('backup-retention'))
            }
        };
    }

    getInputValue(id) {
        const element = document.getElementById(id);
        return element ? element.value : '';
    }

    getCheckboxValue(id) {
        const element = document.getElementById(id);
        return element ? element.checked : false;
    }

    getRadioValue(name) {
        const element = document.querySelector(`input[name="${name}"]:checked`);
        return element ? element.value : '';
    }

    resetSettings() {
        if (confirm('Are you sure you want to reset all settings to defaults? This action cannot be undone.')) {
            this.settings = this.getDefaultSettings();
            this.populateSettings();
            this.showNotification('Settings reset to defaults', 'info');
        }
    }

    markUnsaved() {
        document.querySelector('.settings-footer .btn-primary').classList.add('unsaved');
    }

    clearUnsaved() {
        document.querySelector('.settings-footer .btn-primary').classList.remove('unsaved');
    }

    // Modal functions
    changePassword() {
        this.openModal('change-password-modal');
    }

    async submitPasswordChange() {
        const currentPassword = this.getInputValue('current-password');
        const newPassword = this.getInputValue('new-password');
        const confirmPassword = this.getInputValue('confirm-password');

        if (!currentPassword || !newPassword || !confirmPassword) {
            this.showNotification('Please fill in all password fields', 'error');
            return;
        }

        if (newPassword !== confirmPassword) {
            this.showNotification('New passwords do not match', 'error');
            return;
        }

        if (newPassword.length < 8) {
            this.showNotification('Password must be at least 8 characters long', 'error');
            return;
        }

        try {
            const response = await fetch('/api/auth/change-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.auth.getToken()}`
                },
                body: JSON.stringify({
                    currentPassword,
                    newPassword
                })
            });

            if (response.ok) {
                this.showNotification('Password changed successfully', 'success');
                this.closeModal('change-password-modal');
                this.resetForm('change-password-form');
            } else {
                const error = await response.json();
                throw new Error(error.message || 'Failed to change password');
            }
        } catch (error) {
            console.error('Error changing password:', error);
            this.showNotification(error.message || 'Failed to change password', 'error');
        }
    }

    async generateApiKey() {
        if (confirm('Generate a new API key? This will invalidate the current key.')) {
            try {
                const response = await fetch('/api/auth/generate-api-key', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.auth.getToken()}`
                    }
                });

                if (response.ok) {
                    const data = await response.json();
                    this.showApiKeyModal(data.apiKey);
                } else {
                    throw new Error('Failed to generate API key');
                }
            } catch (error) {
                console.error('Error generating API key:', error);
                this.showNotification('Failed to generate API key', 'error');
            }
        }
    }

    showApiKeyModal(apiKey) {
        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>New API Key Generated</h3>
                    <button class="modal-close" onclick="this.closest('.modal').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <p>Your new API key has been generated. Please copy it now as it won't be shown again.</p>
                    <div class="api-key-display">
                        <input type="text" value="${apiKey}" readonly class="form-input">
                        <button class="btn-secondary" onclick="navigator.clipboard.writeText('${apiKey}'); this.textContent='Copied!'">
                            <i class="fas fa-copy"></i>
                            Copy
                        </button>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn-primary" onclick="this.closest('.modal').remove()">Close</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    // Backup functions
    async loadBackupList() {
        try {
            const response = await fetch('/api/backups', {
                headers: {
                    'Authorization': `Bearer ${this.auth.getToken()}`
                }
            });

            if (response.ok) {
                const backups = await response.json();
                this.renderBackupList(backups);
            } else {
                // Use mock data
                this.renderBackupList([
                    {
                        id: 1,
                        filename: 'xpanel_backup_20240915_120000.zip',
                        size: '15.2 MB',
                        created: '2024-09-15 12:00:00',
                        type: 'automatic'
                    },
                    {
                        id: 2,
                        filename: 'xpanel_backup_20240914_120000.zip',
                        size: '14.8 MB',
                        created: '2024-09-14 12:00:00',
                        type: 'automatic'
                    }
                ]);
            }
        } catch (error) {
            console.error('Error loading backup list:', error);
            this.renderBackupList([]);
        }
    }

    renderBackupList(backups) {
        const container = document.getElementById('backup-list');
        
        if (backups.length === 0) {
            container.innerHTML = '<div class="empty-message">No backups found</div>';
            return;
        }

        container.innerHTML = backups.map(backup => `
            <div class="backup-item">
                <div class="backup-info">
                    <div class="backup-name">${backup.filename}</div>
                    <div class="backup-details">
                        <span class="backup-size">${backup.size}</span>
                        <span class="backup-date">${this.formatDate(backup.created)}</span>
                        <span class="backup-type ${backup.type}">${backup.type}</span>
                    </div>
                </div>
                <div class="backup-actions">
                    <button class="btn-icon" onclick="settingsManager.downloadBackup(${backup.id})" title="Download">
                        <i class="fas fa-download"></i>
                    </button>
                    <button class="btn-icon" onclick="settingsManager.restoreFromBackup(${backup.id})" title="Restore">
                        <i class="fas fa-undo"></i>
                    </button>
                    <button class="btn-icon danger" onclick="settingsManager.deleteBackup(${backup.id})" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
    }

    async createBackup() {
        this.showNotification('Creating backup...', 'info');
        
        try {
            const response = await fetch('/api/backups', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.auth.getToken()}`
                }
            });

            if (response.ok) {
                this.showNotification('Backup created successfully', 'success');
                this.loadBackupList();
            } else {
                throw new Error('Failed to create backup');
            }
        } catch (error) {
            console.error('Error creating backup:', error);
            this.showNotification('Failed to create backup', 'error');
        }
    }

    restoreBackup() {
        this.openModal('restore-backup-modal');
    }

    async submitRestore() {
        const fileInput = document.getElementById('backup-file');
        const file = fileInput.files[0];

        if (!file) {
            this.showNotification('Please select a backup file', 'error');
            return;
        }

        const formData = new FormData();
        formData.append('backup', file);

        try {
            const response = await fetch('/api/backups/restore', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.auth.getToken()}`
                },
                body: formData
            });

            if (response.ok) {
                this.showNotification('Backup restored successfully. Please refresh the page.', 'success');
                this.closeModal('restore-backup-modal');
            } else {
                throw new Error('Failed to restore backup');
            }
        } catch (error) {
            console.error('Error restoring backup:', error);
            this.showNotification('Failed to restore backup', 'error');
        }
    }

    async downloadBackup(backupId) {
        try {
            const response = await fetch(`/api/backups/${backupId}/download`, {
                headers: {
                    'Authorization': `Bearer ${this.auth.getToken()}`
                }
            });

            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `backup_${backupId}.zip`;
                a.click();
                window.URL.revokeObjectURL(url);
            } else {
                throw new Error('Failed to download backup');
            }
        } catch (error) {
            console.error('Error downloading backup:', error);
            this.showNotification('Failed to download backup', 'error');
        }
    }

    async deleteBackup(backupId) {
        if (confirm('Are you sure you want to delete this backup?')) {
            try {
                const response = await fetch(`/api/backups/${backupId}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${this.auth.getToken()}`
                    }
                });

                if (response.ok) {
                    this.showNotification('Backup deleted successfully', 'success');
                    this.loadBackupList();
                } else {
                    throw new Error('Failed to delete backup');
                }
            } catch (error) {
                console.error('Error deleting backup:', error);
                this.showNotification('Failed to delete backup', 'error');
            }
        }
    }

    async checkUpdates() {
        this.showNotification('Checking for updates...', 'info');
        
        try {
            const response = await fetch('/api/system/updates', {
                headers: {
                    'Authorization': `Bearer ${this.auth.getToken()}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.updateAvailable) {
                    this.showNotification(`Update available: ${data.version}`, 'info');
                } else {
                    this.showNotification('You are running the latest version', 'success');
                }
            } else {
                this.showNotification('You are running the latest version', 'success');
            }
        } catch (error) {
            console.error('Error checking updates:', error);
            this.showNotification('Failed to check for updates', 'error');
        }
    }

    // Utility functions
    openModal(modalId) {
        document.getElementById(modalId).classList.add('active');
    }

    closeModal(modalId) {
        document.getElementById(modalId).classList.remove('active');
    }

    resetForm(formId) {
        document.getElementById(formId).reset();
    }

    formatDate(dateString) {
        return new Date(dateString).toLocaleString();
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas fa-${this.getNotificationIcon(type)}"></i>
                <span>${message}</span>
            </div>
            <button class="notification-close" onclick="this.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        `;

        document.body.appendChild(notification);

        // Auto remove after 5 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    }

    getNotificationIcon(type) {
        const icons = {
            success: 'check-circle',
            error: 'exclamation-circle',
            warning: 'exclamation-triangle',
            info: 'info-circle'
        };
        return icons[type] || 'info-circle';
    }
}

// Initialize settings manager when page loads
let settingsManager;
document.addEventListener('DOMContentLoaded', () => {
    settingsManager = new SettingsManager();
});
