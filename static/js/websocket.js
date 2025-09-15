// Xpanel - WebSocket Client

class XpanelWebSocket {
    constructor() {
        this.socket = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000;
        this.eventHandlers = {};
        this.isConnected = false;
    }

    // Connect to WebSocket server
    connect() {
        try {
            this.socket = io();
            this.setupEventHandlers();
        } catch (error) {
            console.error('WebSocket connection failed:', error);
            this.handleReconnect();
        }
    }

    // Setup WebSocket event handlers
    setupEventHandlers() {
        this.socket.on('connect', () => {
            console.log('WebSocket connected');
            this.isConnected = true;
            this.reconnectAttempts = 0;
            this.updateConnectionStatus(true);
            this.emit('connected');
        });

        this.socket.on('disconnect', () => {
            console.log('WebSocket disconnected');
            this.isConnected = false;
            this.updateConnectionStatus(false);
            this.emit('disconnected');
            this.handleReconnect();
        });

        this.socket.on('system_stats', (data) => {
            this.emit('system_stats', data);
        });

        this.socket.on('server_stats', (data) => {
            this.emit('server_stats', data);
        });

        this.socket.on('terminal_output', (data) => {
            this.emit('terminal_output', data);
        });

        this.socket.on('file_update', (data) => {
            this.emit('file_update', data);
        });

        this.socket.on('notification', (data) => {
            XpanelUtils.showNotification(data.title, data.message, data.type);
        });

        this.socket.on('connect_error', (error) => {
            console.error('WebSocket connection error:', error);
            this.handleReconnect();
        });
    }

    // Handle reconnection
    handleReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
            
            setTimeout(() => {
                this.connect();
            }, this.reconnectDelay * this.reconnectAttempts);
        } else {
            console.error('Max reconnection attempts reached');
            XpanelUtils.showNotification(
                'Ошибка подключения',
                'Не удалось подключиться к серверу. Обновите страницу.',
                'error'
            );
        }
    }

    // Update connection status indicator
    updateConnectionStatus(connected) {
        const statusElement = document.getElementById('connection-status');
        if (statusElement) {
            const icon = statusElement.querySelector('i');
            const text = statusElement.querySelector('span');
            
            if (connected) {
                icon.style.color = 'var(--success-color)';
                text.textContent = 'Подключено';
                statusElement.classList.remove('disconnected');
            } else {
                icon.style.color = 'var(--error-color)';
                text.textContent = 'Отключено';
                statusElement.classList.add('disconnected');
            }
        }
    }

    // Join server room for updates
    joinServerRoom(serverId) {
        if (this.socket && this.isConnected) {
            this.socket.emit('join_server_room', { server_id: serverId });
        }
    }

    // Leave server room
    leaveServerRoom(serverId) {
        if (this.socket && this.isConnected) {
            this.socket.emit('leave_server_room', { server_id: serverId });
        }
    }

    // Send terminal command
    sendTerminalCommand(serverId, command) {
        if (this.socket && this.isConnected) {
            this.socket.emit('terminal_command', {
                server_id: serverId,
                command: command
            });
        }
    }

    // Event handler management
    on(event, handler) {
        if (!this.eventHandlers[event]) {
            this.eventHandlers[event] = [];
        }
        this.eventHandlers[event].push(handler);
    }

    off(event, handler) {
        if (this.eventHandlers[event]) {
            const index = this.eventHandlers[event].indexOf(handler);
            if (index > -1) {
                this.eventHandlers[event].splice(index, 1);
            }
        }
    }

    emit(event, data) {
        if (this.eventHandlers[event]) {
            this.eventHandlers[event].forEach(handler => {
                try {
                    handler(data);
                } catch (error) {
                    console.error(`Error in event handler for ${event}:`, error);
                }
            });
        }
    }

    // Disconnect
    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
            this.isConnected = false;
        }
    }
}

// Create global WebSocket instance
window.ws = new XpanelWebSocket();

// Auto-connect when page loads
document.addEventListener('DOMContentLoaded', () => {
    if (XpanelUtils.isAuthenticated()) {
        ws.connect();
    }
});
