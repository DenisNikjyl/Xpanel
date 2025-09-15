// Xpanel - Agent Installer JavaScript

class AgentInstaller {
    constructor() {
        this.currentMethod = 'auto';
        this.init();
    }

    init() {
        this.setupEventHandlers();
        this.updateInstallCommand();
    }

    setupEventHandlers() {
        // Auto installation form
        const autoForm = document.getElementById('auto-install-form');
        if (autoForm) {
            autoForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleAutoInstall();
            });
        }
    }

    switchInstallMethod(method) {
        this.currentMethod = method;
        
        // Update tab states
        document.querySelectorAll('.method-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelector(`[onclick="switchInstallMethod('${method}')"]`).classList.add('active');
        
        // Update form visibility
        document.querySelectorAll('.install-form').forEach(form => {
            form.classList.remove('active');
        });
        
        if (method === 'auto') {
            document.getElementById('auto-install-form').classList.add('active');
        } else {
            document.getElementById('manual-install-form').classList.add('active');
            this.updateInstallCommand();
        }
    }

    updateInstallCommand() {
        const commandElement = document.getElementById('install-command');
        if (commandElement) {
            const panelAddress = window.location.hostname;
            const panelPort = window.location.port || '5000';
            commandElement.textContent = `curl -sSL http://${panelAddress}:${panelPort}/api/agent/install-script | sudo bash`;
        }
    }

    async handleAutoInstall() {
        const formData = {
            name: document.getElementById('auto-server-name').value,
            host: document.getElementById('auto-server-host').value,
            port: parseInt(document.getElementById('auto-server-port').value),
            username: document.getElementById('auto-server-username').value,
            password: document.getElementById('auto-server-password').value,
            panel_address: window.location.hostname
        };

        // Validate input
        if (!this.validateAutoInstallForm(formData)) {
            return;
        }

        // Show progress modal
        this.showInstallProgress();
        
        try {
            // Start installation
            const result = await api.request('/servers/install-agent', {
                method: 'POST',
                body: JSON.stringify(formData)
            });

            if (result.success) {
                this.handleInstallSuccess(result);
                
                // Add server to list after successful installation
                await this.addServerAfterInstall(formData);
            } else {
                this.handleInstallError(result.error);
            }
        } catch (error) {
            console.error('Installation failed:', error);
            this.handleInstallError(error.message);
        }
    }

    validateAutoInstallForm(data) {
        if (!data.name || !data.host || !data.username || !data.password) {
            XpanelUtils.showNotification('Ошибка', 'Заполните все обязательные поля', 'error');
            return false;
        }

        if (!XpanelUtils.isValidIP(data.host) && !XpanelUtils.isValidHostname(data.host)) {
            XpanelUtils.showNotification('Ошибка', 'Введите корректный IP адрес или домен', 'error');
            return false;
        }

        if (data.port < 1 || data.port > 65535) {
            XpanelUtils.showNotification('Ошибка', 'Порт должен быть от 1 до 65535', 'error');
            return false;
        }

        return true;
    }

    showInstallProgress() {
        // Close add server modal
        document.getElementById('add-server-modal').classList.remove('active');
        
        // Show progress modal
        document.getElementById('install-progress-modal').classList.add('active');
        
        // Reset progress steps
        document.querySelectorAll('.progress-step').forEach(step => {
            step.classList.remove('active', 'completed', 'error');
        });
        
        // Clear output
        document.getElementById('install-output').textContent = '';
        
        // Hide close button
        document.getElementById('close-install-btn').style.display = 'none';
        
        // Start progress simulation
        this.simulateProgress();
    }

    simulateProgress() {
        const steps = [
            'step-connecting',
            'step-uploading', 
            'step-installing',
            'step-starting'
        ];
        
        let currentStep = 0;
        
        const progressInterval = setInterval(() => {
            if (currentStep > 0) {
                const prevStep = document.getElementById(steps[currentStep - 1]);
                prevStep.classList.remove('active');
                prevStep.classList.add('completed');
            }
            
            if (currentStep < steps.length) {
                const step = document.getElementById(steps[currentStep]);
                step.classList.add('active');
                currentStep++;
            } else {
                clearInterval(progressInterval);
            }
        }, 2000);
    }

    handleInstallSuccess(result) {
        // Mark all steps as completed
        document.querySelectorAll('.progress-step').forEach(step => {
            step.classList.remove('active');
            step.classList.add('completed');
        });
        
        // Show completion step
        const completeStep = document.getElementById('step-complete');
        completeStep.classList.add('completed');
        
        // Update output
        const output = document.getElementById('install-output');
        output.textContent = result.output || 'Агент успешно установлен и запущен!';
        
        // Show close button
        document.getElementById('close-install-btn').style.display = 'block';
        
        XpanelUtils.showNotification('Успех', 'Агент успешно установлен на сервер!', 'success');
    }

    handleInstallError(error) {
        // Mark current step as error
        const activeStep = document.querySelector('.progress-step.active');
        if (activeStep) {
            activeStep.classList.remove('active');
            activeStep.classList.add('error');
        }
        
        // Update output
        const output = document.getElementById('install-output');
        output.textContent = `Ошибка установки: ${error}`;
        
        // Show close button
        document.getElementById('close-install-btn').style.display = 'block';
        
        XpanelUtils.showNotification('Ошибка', `Не удалось установить агент: ${error}`, 'error');
    }

    async addServerAfterInstall(serverData) {
        try {
            const result = await api.addServer({
                name: serverData.name,
                host: serverData.host,
                port: serverData.port,
                username: serverData.username,
                password: serverData.password
            });
            
            if (result.success) {
                // Refresh servers list
                if (window.serversManager) {
                    window.serversManager.loadServers();
                }
                if (window.dashboard) {
                    window.dashboard.loadServers();
                }
            }
        } catch (error) {
            console.error('Failed to add server after install:', error);
        }
    }

    closeInstallProgress() {
        document.getElementById('install-progress-modal').classList.remove('active');
    }

    copyInstallCommand() {
        const command = document.getElementById('install-command').textContent;
        XpanelUtils.copyToClipboard(command);
    }

    downloadInstallScript() {
        const link = document.createElement('a');
        link.href = '/api/agent/install-script';
        link.download = 'install_agent.sh';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        XpanelUtils.showNotification('Скачивание', 'Скрипт установки скачан', 'success');
    }

    addManualServer() {
        const serverName = document.getElementById('manual-server-name').value;
        
        if (!serverName) {
            XpanelUtils.showNotification('Ошибка', 'Введите название сервера', 'error');
            return;
        }

        // For manual installation, we add a placeholder server
        // The actual connection will be established when the agent starts
        const serverData = {
            name: serverName,
            host: 'pending', // Will be updated when agent connects
            port: 22,
            username: 'agent',
            password: 'auto-detected'
        };

        this.addServerManually(serverData);
    }

    async addServerManually(serverData) {
        try {
            const result = await api.addServer(serverData);
            
            if (result.success) {
                XpanelUtils.showNotification('Успех', 'Сервер добавлен. Ожидание подключения агента...', 'success');
                
                // Close modal
                this.closeAddServerModal();
                
                // Refresh servers list
                if (window.serversManager) {
                    window.serversManager.loadServers();
                }
                if (window.dashboard) {
                    window.dashboard.loadServers();
                }
            }
        } catch (error) {
            console.error('Failed to add manual server:', error);
            XpanelUtils.showNotification('Ошибка', 'Не удалось добавить сервер', 'error');
        }
    }

    closeAddServerModal() {
        document.getElementById('add-server-modal').classList.remove('active');
        
        // Reset forms
        document.getElementById('auto-install-form').reset();
        document.getElementById('manual-server-name').value = '';
        
        // Reset to auto method
        this.switchInstallMethod('auto');
    }
}

// Global functions for HTML onclick handlers
window.switchInstallMethod = function(method) {
    if (window.agentInstaller) {
        window.agentInstaller.switchInstallMethod(method);
    }
};

window.copyInstallCommand = function() {
    if (window.agentInstaller) {
        window.agentInstaller.copyInstallCommand();
    }
};

window.downloadInstallScript = function() {
    if (window.agentInstaller) {
        window.agentInstaller.downloadInstallScript();
    }
};

window.addManualServer = function() {
    if (window.agentInstaller) {
        window.agentInstaller.addManualServer();
    }
};

window.closeInstallProgress = function() {
    if (window.agentInstaller) {
        window.agentInstaller.closeInstallProgress();
    }
};

window.closeAddServerModal = function() {
    if (window.agentInstaller) {
        window.agentInstaller.closeAddServerModal();
    }
};

// Initialize agent installer
document.addEventListener('DOMContentLoaded', () => {
    window.agentInstaller = new AgentInstaller();
});
