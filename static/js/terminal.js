// Xpanel - Terminal JavaScript

class TerminalManager {
    constructor() {
        this.auth = new XpanelAuth();
        this.servers = [];
        this.currentServer = null;
        this.isConnected = false;
        this.sessionId = null;
        this.commandHistory = [];
        this.historyIndex = -1;
        this.sessionStartTime = null;
        this.init();
    }

    init() {
        this.setupEventHandlers();
        this.loadServers();
        this.updateConnectionStatus('disconnected');
    }

    setupEventHandlers() {
        // Server selection
        const serverSelect = document.getElementById('server-select');
        if (serverSelect) {
            serverSelect.addEventListener('change', (e) => {
                this.handleServerSelection(e.target.value);
            });
        }

        // Connection buttons
        const connectBtn = document.getElementById('connect-btn');
        const disconnectBtn = document.getElementById('disconnect-btn');
        const clearBtn = document.getElementById('clear-btn');

        if (connectBtn) {
            connectBtn.addEventListener('click', () => this.connectToServer());
        }
        if (disconnectBtn) {
            disconnectBtn.addEventListener('click', () => this.disconnectFromServer());
        }
        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.clearTerminal());
        }

        // Terminal input
        const terminalInput = document.getElementById('terminal-input');
        if (terminalInput) {
            terminalInput.addEventListener('keydown', (e) => {
                this.handleKeyDown(e);
            });
        }

        // Focus terminal input when clicking on terminal
        const terminalBody = document.querySelector('.terminal-body');
        if (terminalBody) {
            terminalBody.addEventListener('click', () => {
                if (terminalInput && !terminalInput.disabled) {
                    terminalInput.focus();
                }
            });
        }
    }

    async loadServers() {
        try {
            const response = await fetch('/api/servers', {
                headers: {
                    'Authorization': `Bearer ${this.auth.getToken()}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                this.servers = await response.json();
                this.updateServerSelect();
            } else if (response.status === 401) {
                this.auth.logout();
                window.location.href = '/login';
            }
        } catch (error) {
            console.error('Failed to load servers:', error);
            this.showNotification('Failed to load servers', 'error');
        }
    }

    updateServerSelect() {
        const serverSelect = document.getElementById('server-select');
        if (!serverSelect) return;

        serverSelect.innerHTML = '<option value="">Choose a server...</option>';
        
        this.servers.forEach(server => {
            const option = document.createElement('option');
            option.value = server.id;
            option.textContent = `${server.name} (${server.host})`;
            serverSelect.appendChild(option);
        });
    }

    handleServerSelection(serverId) {
        this.currentServer = serverId ? this.servers.find(s => s.id === serverId) : null;
        
        const connectBtn = document.getElementById('connect-btn');
        if (connectBtn) {
            connectBtn.disabled = !this.currentServer;
        }

        if (this.isConnected && this.currentServer) {
            this.disconnectFromServer();
        }
    }

    async connectToServer() {
        if (!this.currentServer) return;

        try {
            this.updateConnectionStatus('connecting');
            this.addTerminalLine(`Connecting to ${this.currentServer.name} (${this.currentServer.host})...`, 'info');

            // Simulate connection process
            await this.delay(1000);
            this.addTerminalLine('Establishing SSH connection...', 'info');
            await this.delay(1500);
            this.addTerminalLine('Authentication successful', 'success');
            await this.delay(500);

            // Set connected state
            this.isConnected = true;
            this.sessionId = this.generateSessionId();
            this.sessionStartTime = new Date();
            
            this.updateConnectionStatus('connected');
            this.enableTerminalInput();
            this.updateConnectionInfo();
            this.startSessionTimer();

            this.addTerminalLine(`Welcome to ${this.currentServer.name}`, 'success');
            this.addTerminalLine(`Last login: ${new Date().toLocaleString()}`, 'info');
            this.updatePrompt();

        } catch (error) {
            this.updateConnectionStatus('error');
            this.addTerminalLine(`Connection failed: ${error.message}`, 'error');
        }
    }

    disconnectFromServer() {
        if (!this.isConnected) return;

        this.isConnected = false;
        this.sessionId = null;
        this.sessionStartTime = null;
        
        this.updateConnectionStatus('disconnected');
        this.disableTerminalInput();
        this.hideConnectionInfo();
        this.stopSessionTimer();

        this.addTerminalLine('Connection closed', 'info');
        this.updatePrompt();
    }

    updatePrompt() {
        const promptElement = document.getElementById('terminal-prompt');
        if (promptElement) {
            if (this.isConnected && this.currentServer) {
                promptElement.textContent = `${this.currentServer.username}@${this.currentServer.name}:~$`;
            } else {
                promptElement.textContent = '$';
            }
        }
    }

    updateConnectionStatus(status) {
        const statusIndicator = document.getElementById('connection-status');
        const statusText = document.getElementById('status-text');
        const terminalTitle = document.getElementById('terminal-title');
        const connectBtn = document.getElementById('connect-btn');
        const disconnectBtn = document.getElementById('disconnect-btn');

        if (statusIndicator) {
            statusIndicator.className = `status-indicator ${status}`;
        }

        switch (status) {
            case 'connected':
                if (statusText) statusText.textContent = 'Connected';
                if (terminalTitle) terminalTitle.textContent = `Terminal - ${this.currentServer.name}`;
                if (connectBtn) connectBtn.disabled = true;
                if (disconnectBtn) disconnectBtn.disabled = false;
                break;
            case 'connecting':
                if (statusText) statusText.textContent = 'Connecting...';
                if (terminalTitle) terminalTitle.textContent = 'Terminal - Connecting';
                if (connectBtn) connectBtn.disabled = true;
                if (disconnectBtn) disconnectBtn.disabled = true;
                break;
            case 'disconnected':
                if (statusText) statusText.textContent = 'Disconnected';
                if (terminalTitle) terminalTitle.textContent = 'Terminal - Not Connected';
                if (connectBtn) connectBtn.disabled = !this.currentServer;
                if (disconnectBtn) disconnectBtn.disabled = true;
                break;
            case 'error':
                if (statusText) statusText.textContent = 'Connection Error';
                if (terminalTitle) terminalTitle.textContent = 'Terminal - Error';
                if (connectBtn) connectBtn.disabled = !this.currentServer;
                if (disconnectBtn) disconnectBtn.disabled = true;
                break;
        }
    }

    enableTerminalInput() {
        const terminalInput = document.getElementById('terminal-input');
        if (terminalInput) {
            terminalInput.disabled = false;
            terminalInput.placeholder = 'Type a command...';
            terminalInput.focus();
        }
    }

    disableTerminalInput() {
        const terminalInput = document.getElementById('terminal-input');
        if (terminalInput) {
            terminalInput.disabled = true;
            terminalInput.placeholder = 'Connect to a server to start...';
            terminalInput.value = '';
        }
    }

    updateConnectionInfo() {
        const connectionInfo = document.getElementById('connection-info');
        const connectedServer = document.getElementById('connected-server');
        const connectedUser = document.getElementById('connected-user');
        const sessionIdElement = document.getElementById('session-id');

        if (connectionInfo) connectionInfo.style.display = 'block';
        if (connectedServer) connectedServer.textContent = `${this.currentServer.name} (${this.currentServer.host})`;
        if (connectedUser) connectedUser.textContent = this.currentServer.username;
        if (sessionIdElement) sessionIdElement.textContent = this.sessionId;
    }

    hideConnectionInfo() {
        const connectionInfo = document.getElementById('connection-info');
        if (connectionInfo) connectionInfo.style.display = 'none';
    }

    startSessionTimer() {
        this.sessionTimer = setInterval(() => {
            this.updateSessionUptime();
        }, 1000);
    }

    stopSessionTimer() {
        if (this.sessionTimer) {
            clearInterval(this.sessionTimer);
            this.sessionTimer = null;
        }
    }

    updateSessionUptime() {
        if (!this.sessionStartTime) return;

        const now = new Date();
        const diff = now - this.sessionStartTime;
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        const uptimeElement = document.getElementById('session-uptime');
        if (uptimeElement) {
            uptimeElement.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
    }

    generateSessionId() {
        return 'sess_' + Math.random().toString(36).substr(2, 9);
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    handleKeyDown(e) {
        if (!this.isConnected) return;

        const input = e.target;

        switch (e.key) {
            case 'Enter':
                e.preventDefault();
                this.executeCommand(input.value);
                input.value = '';
                this.historyIndex = -1;
                break;

            case 'ArrowUp':
                e.preventDefault();
                this.navigateHistory(-1);
                break;

            case 'ArrowDown':
                e.preventDefault();
                this.navigateHistory(1);
                break;

            case 'Tab':
                e.preventDefault();
                // TODO: Implement tab completion
                break;

            case 'l':
                if (e.ctrlKey) {
                    e.preventDefault();
                    this.clearTerminal();
                }
                break;
        }
    }

    navigateHistory(direction) {
        if (this.commandHistory.length === 0) return;

        const input = document.getElementById('terminal-input');
        
        if (direction === -1) {
            // Up arrow - go back in history
            if (this.historyIndex < this.commandHistory.length - 1) {
                this.historyIndex++;
                input.value = this.commandHistory[this.commandHistory.length - 1 - this.historyIndex];
            }
        } else {
            // Down arrow - go forward in history
            if (this.historyIndex > 0) {
                this.historyIndex--;
                input.value = this.commandHistory[this.commandHistory.length - 1 - this.historyIndex];
            } else if (this.historyIndex === 0) {
                this.historyIndex = -1;
                input.value = '';
            }
        }
    }

    async executeCommand(command) {
        if (!command.trim() || !this.isConnected) return;

        // Add command to history
        this.commandHistory.push(command);
        if (this.commandHistory.length > 100) {
            this.commandHistory.shift();
        }

        // Display command with prompt
        const prompt = `${this.currentServer.username}@${this.currentServer.name}:~$`;
        this.addTerminalLine(`${prompt} ${command}`, 'command');

        // Handle local commands
        if (this.handleLocalCommand(command)) {
            return;
        }

        try {
            // Show loading indicator
            const loadingLine = this.addTerminalLine('Executing command...', 'info');
            
            // Simulate command execution
            await this.delay(500 + Math.random() * 1000);
            
            // Remove loading indicator
            this.removeLastLine();
            
            // Simulate command output based on command type
            this.simulateCommandOutput(command);

        } catch (error) {
            this.removeLastLine();
            this.addTerminalLine(`Error: ${error.message}`, 'error');
        }

        this.scrollToBottom();
    }

    simulateCommandOutput(command) {
        const cmd = command.toLowerCase().trim();

        if (cmd === 'ls' || cmd === 'ls -la' || cmd === 'dir') {
            this.addTerminalLine('total 24', 'output');
            this.addTerminalLine('drwxr-xr-x 2 user user 4096 Dec 15 23:29 .', 'output');
            this.addTerminalLine('drwxr-xr-x 3 user user 4096 Dec 15 23:28 ..', 'output');
            this.addTerminalLine('-rw-r--r-- 1 user user  220 Dec 15 23:28 .bash_logout', 'output');
            this.addTerminalLine('-rw-r--r-- 1 user user 3771 Dec 15 23:28 .bashrc', 'output');
            this.addTerminalLine('-rw-r--r-- 1 user user  807 Dec 15 23:28 .profile', 'output');
            this.addTerminalLine('drwxr-xr-x 2 user user 4096 Dec 15 23:29 documents', 'output');
        } else if (cmd === 'pwd') {
            this.addTerminalLine('/home/' + this.currentServer.username, 'output');
        } else if (cmd === 'whoami') {
            this.addTerminalLine(this.currentServer.username, 'output');
        } else if (cmd === 'date') {
            this.addTerminalLine(new Date().toString(), 'output');
        } else if (cmd === 'uptime') {
            this.addTerminalLine('23:29:53 up 5 days, 12:34, 1 user, load average: 0.15, 0.10, 0.05', 'output');
        } else if (cmd.startsWith('echo ')) {
            this.addTerminalLine(command.substring(5), 'output');
        } else if (cmd === 'ps aux' || cmd === 'ps') {
            this.addTerminalLine('USER       PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND', 'output');
            this.addTerminalLine('root         1  0.0  0.1  19356  1544 ?        Ss   Dec10   0:01 /sbin/init', 'output');
            this.addTerminalLine('root         2  0.0  0.0      0     0 ?        S    Dec10   0:00 [kthreadd]', 'output');
            this.addTerminalLine('user      1234  0.0  0.2  21532  2048 pts/0    Ss   23:29   0:00 -bash', 'output');
        } else if (cmd === 'df -h' || cmd === 'df') {
            this.addTerminalLine('Filesystem      Size  Used Avail Use% Mounted on', 'output');
            this.addTerminalLine('/dev/sda1        20G  8.5G   11G  45% /', 'output');
            this.addTerminalLine('tmpfs           2.0G     0  2.0G   0% /dev/shm', 'output');
        } else if (cmd === 'free -h' || cmd === 'free') {
            this.addTerminalLine('              total        used        free      shared  buff/cache   available', 'output');
            this.addTerminalLine('Mem:           4.0G        1.2G        1.8G         64M        1.0G        2.6G', 'output');
            this.addTerminalLine('Swap:          2.0G          0B        2.0G', 'output');
        } else if (cmd === 'top') {
            this.addTerminalLine('top - 23:29:53 up 5 days, 12:34,  1 user,  load average: 0.15, 0.10, 0.05', 'output');
            this.addTerminalLine('Tasks: 95 total,   1 running,  94 sleeping,   0 stopped,   0 zombie', 'output');
            this.addTerminalLine('%Cpu(s):  2.3 us,  1.0 sy,  0.0 ni, 96.7 id,  0.0 wa,  0.0 hi,  0.0 si,  0.0 st', 'output');
            this.addTerminalLine('Press q to quit...', 'info');
        } else {
            // Unknown command
            this.addTerminalLine(`bash: ${command}: command not found`, 'error');
        }
    }

    handleLocalCommand(command) {
        const cmd = command.toLowerCase().trim();

        switch (cmd) {
            case 'clear':
            case 'cls':
                this.clearTerminal();
                return true;

            case 'help':
                this.showHelp();
                return true;

            case 'exit':
            case 'logout':
                this.disconnectFromServer();
                return true;

            default:
                return false;
        }
    }

    showHelp() {
        const helpText = [
            'Available local commands:',
            '  clear, cls  - Clear terminal',
            '  help        - Show this help',
            '  exit        - Disconnect from server',
            '  Ctrl+L      - Clear terminal',
            '  ↑/↓         - Navigate command history',
            '',
            'All other commands are executed on the connected server.'
        ];
        
        helpText.forEach(line => {
            this.addTerminalLine(line, 'info');
        });
    }

    addTerminalLine(text, type = 'output') {
        const output = document.getElementById('terminal-output');
        if (!output) return;

        const line = document.createElement('div');
        line.className = `terminal-line ${type}`;
        
        // Handle multi-line text
        const lines = text.split('\n');
        if (lines.length > 1) {
            lines.forEach((lineText, index) => {
                if (index > 0) {
                    const br = document.createElement('br');
                    line.appendChild(br);
                }
                const span = document.createElement('span');
                span.textContent = lineText;
                line.appendChild(span);
            });
        } else {
            line.textContent = text;
        }
        
        output.appendChild(line);
        this.scrollToBottom();
        return line;
    }

    removeLastLine() {
        const output = document.getElementById('terminal-output');
        if (output && output.lastChild) {
            output.removeChild(output.lastChild);
        }
    }

    clearTerminal() {
        const output = document.getElementById('terminal-output');
        if (output) {
            output.innerHTML = '';
        }
    }

    scrollToBottom() {
        const output = document.getElementById('terminal-output');
        if (output) {
            output.scrollTop = output.scrollHeight;
        }
    }

    showNotification(message, type = 'info') {
        // Simple notification system
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 6px;
            color: white;
            font-weight: 500;
            z-index: 1000;
            animation: slideIn 0.3s ease;
        `;
        
        if (type === 'error') {
            notification.style.backgroundColor = '#ef4444';
        } else if (type === 'success') {
            notification.style.backgroundColor = '#10b981';
        } else {
            notification.style.backgroundColor = '#3b82f6';
        }
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
}

// Initialize terminal manager
document.addEventListener('DOMContentLoaded', () => {
    window.terminalManager = new TerminalManager();
});
