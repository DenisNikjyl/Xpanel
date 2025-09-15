// Xpanel - Terminal JavaScript

class TerminalManager {
    constructor() {
        this.currentServer = null;
        this.commandHistory = [];
        this.historyIndex = -1;
        this.init();
    }

    init() {
        this.setupEventHandlers();
        this.loadServers();
    }

    setupEventHandlers() {
        const serverSelect = document.getElementById('terminal-server-select');
        const terminalInput = document.getElementById('terminal-input');

        if (serverSelect) {
            serverSelect.addEventListener('change', (e) => {
                this.selectServer(e.target.value);
            });
        }

        if (terminalInput) {
            terminalInput.addEventListener('keydown', (e) => {
                this.handleKeyDown(e);
            });
        }

        // WebSocket handler for terminal output
        ws.on('terminal_output', (data) => {
            this.handleTerminalOutput(data);
        });
    }

    loadServers() {
        // This will be populated by the servers manager
        const serverSelect = document.getElementById('terminal-server-select');
        if (serverSelect && window.serversManager) {
            // Servers will be updated by serversManager.updateServerSelects()
        }
    }

    selectServer(serverId) {
        if (!serverId) {
            this.currentServer = null;
            this.updatePrompt();
            return;
        }

        this.currentServer = serverId;
        this.updatePrompt();
        this.clearTerminal();
        this.addTerminalLine(`Подключение к серверу ${serverId}...`, 'info');
        
        // Join server room for real-time updates
        ws.joinServerRoom(serverId);
    }

    updatePrompt() {
        const promptElement = document.getElementById('terminal-prompt');
        if (promptElement) {
            if (this.currentServer) {
                const server = window.serversManager?.servers.find(s => s.id === this.currentServer);
                promptElement.textContent = server ? `${server.username}@${server.name}:~$` : '$';
            } else {
                promptElement.textContent = '$';
            }
        }
    }

    handleKeyDown(e) {
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
        if (!command.trim()) return;

        if (!this.currentServer) {
            this.addTerminalLine('Выберите сервер для выполнения команд', 'error');
            return;
        }

        // Add command to history
        this.commandHistory.push(command);
        if (this.commandHistory.length > 100) {
            this.commandHistory.shift();
        }

        // Display command
        const server = window.serversManager?.servers.find(s => s.id === this.currentServer);
        const prompt = server ? `${server.username}@${server.name}:~$` : '$';
        this.addTerminalLine(`${prompt} ${command}`, 'command');

        // Handle local commands
        if (this.handleLocalCommand(command)) {
            return;
        }

        try {
            // Show loading indicator
            this.addTerminalLine('Выполнение команды...', 'info');
            
            const result = await api.executeCommand(this.currentServer, command);
            
            // Remove loading indicator
            this.removeLastLine();
            
            if (result.success) {
                if (result.output) {
                    this.addTerminalLine(result.output, 'output');
                }
                if (result.error) {
                    this.addTerminalLine(result.error, 'error');
                }
            } else {
                this.addTerminalLine(result.error || 'Ошибка выполнения команды', 'error');
            }
        } catch (error) {
            this.removeLastLine();
            this.addTerminalLine(`Ошибка: ${error.message}`, 'error');
        }

        this.scrollToBottom();
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
                this.selectServer(null);
                this.addTerminalLine('Отключен от сервера', 'info');
                return true;

            default:
                return false;
        }
    }

    showHelp() {
        const helpText = `
Доступные команды:
  clear, cls  - Очистить терминал
  help        - Показать эту справку
  exit        - Отключиться от сервера
  Ctrl+L      - Очистить терминал
  ↑/↓         - Навигация по истории команд

Все остальные команды будут выполнены на выбранном сервере.
        `;
        this.addTerminalLine(helpText, 'info');
    }

    addTerminalLine(text, type = 'output') {
        const output = document.getElementById('terminal-output');
        if (!output) return;

        const line = document.createElement('div');
        line.className = `terminal-line ${type}`;
        line.textContent = text;
        
        output.appendChild(line);
        this.scrollToBottom();
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

    handleTerminalOutput(data) {
        if (data.server_id === this.currentServer) {
            this.addTerminalLine(data.output, data.type || 'output');
        }
    }
}

// Initialize terminal manager
document.addEventListener('DOMContentLoaded', () => {
    window.terminalManager = new TerminalManager();
});
