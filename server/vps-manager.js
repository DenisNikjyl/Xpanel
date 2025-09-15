const axios = require('axios');
const EventEmitter = require('events');

/**
 * VPS Manager - управляет подключениями к агентам на VPS серверах
 * Инициирует подключения от сервера к агентам
 */
class VPSManager extends EventEmitter {
    constructor() {
        super();
        this.connectedVPS = new Map(); // Map<vpsId, connection>
        this.vpsConfigs = new Map(); // Map<vpsId, config>
        this.connectionAttempts = new Map(); // Map<vpsId, attemptCount>
        this.maxRetries = 3;
        this.connectionTimeout = 10000; // 10 секунд
        this.statsUpdateInterval = 30000; // 30 секунд
        this.intervalIds = new Map(); // Map<vpsId, intervalId>
        
        console.log('🔧 VPS Manager инициализирован');
    }

    /**
     * Добавляет VPS для мониторинга
     * @param {string} vpsId - ID VPS
     * @param {Object} config - Конфигурация подключения
     */
    addVPS(vpsId, config) {
        const vpsConfig = {
            id: vpsId,
            ip: config.ip,
            port: config.port || 8888,
            apiKey: config.apiKey,
            name: config.name || `VPS-${vpsId}`,
            userId: config.userId,
            ...config
        };

        this.vpsConfigs.set(vpsId, vpsConfig);
        this.connectionAttempts.set(vpsId, 0);

        console.log(`📡 Добавлен VPS: ${vpsConfig.name} (${vpsConfig.ip}:${vpsConfig.port})`);
        
        // Сразу пытаемся подключиться
        this.connectToVPS(vpsId);
    }

    /**
     * Удаляет VPS из мониторинга
     * @param {string} vpsId - ID VPS
     */
    removeVPS(vpsId) {
        this.disconnectVPS(vpsId);
        this.vpsConfigs.delete(vpsId);
        this.connectionAttempts.delete(vpsId);
        
        console.log(`🗑️ VPS ${vpsId} удален из мониторинга`);
    }

    /**
     * Подключается к VPS агенту
     * @param {string} vpsId - ID VPS
     */
    async connectToVPS(vpsId) {
        const config = this.vpsConfigs.get(vpsId);
        if (!config) {
            console.error(`❌ Конфигурация для VPS ${vpsId} не найдена`);
            return false;
        }

        const attempts = this.connectionAttempts.get(vpsId) || 0;
        if (attempts >= this.maxRetries) {
            console.error(`❌ Превышено максимальное количество попыток подключения к ${config.name}`);
            this.emit('vps_connection_failed', { vpsId, config, reason: 'max_retries' });
            return false;
        }

        try {
            console.log(`🔄 Попытка подключения к ${config.name} (${config.ip}:${config.port}) - попытка ${attempts + 1}`);
            
            // Проверяем доступность агента
            const response = await this.makeRequest(vpsId, 'GET', '/api/status');
            
            if (response && response.status === 'online') {
                // Успешное подключение
                this.connectedVPS.set(vpsId, {
                    config,
                    status: 'connected',
                    lastSeen: new Date(),
                    serverInfo: response
                });

                this.connectionAttempts.set(vpsId, 0); // Сбрасываем счетчик попыток
                
                console.log(`✅ Успешно подключен к ${config.name}`);
                console.log(`📊 Server ID: ${response.server_id}, Version: ${response.version}`);
                
                // Запускаем периодическое обновление статистики
                this.startStatsUpdates(vpsId);
                
                this.emit('vps_connected', { vpsId, config, serverInfo: response });
                return true;
            }
        } catch (error) {
            console.error(`❌ Ошибка подключения к ${config.name}: ${error.message}`);
            
            // Увеличиваем счетчик попыток
            this.connectionAttempts.set(vpsId, attempts + 1);
            
            // Планируем повторную попытку через 30 секунд
            setTimeout(() => {
                if (this.vpsConfigs.has(vpsId) && !this.connectedVPS.has(vpsId)) {
                    this.connectToVPS(vpsId);
                }
            }, 30000);
        }

        return false;
    }

    /**
     * Отключается от VPS
     * @param {string} vpsId - ID VPS
     */
    disconnectVPS(vpsId) {
        // Останавливаем обновления статистики
        const intervalId = this.intervalIds.get(vpsId);
        if (intervalId) {
            clearInterval(intervalId);
            this.intervalIds.delete(vpsId);
        }

        // Удаляем из подключенных
        const connection = this.connectedVPS.get(vpsId);
        if (connection) {
            this.connectedVPS.delete(vpsId);
            console.log(`🔌 Отключен от ${connection.config.name}`);
            this.emit('vps_disconnected', { vpsId, config: connection.config });
        }
    }

    /**
     * Запускает периодическое обновление статистики для VPS
     * @param {string} vpsId - ID VPS
     */
    startStatsUpdates(vpsId) {
        // Останавливаем предыдущий интервал, если есть
        const existingInterval = this.intervalIds.get(vpsId);
        if (existingInterval) {
            clearInterval(existingInterval);
        }

        // Запускаем новый интервал
        const intervalId = setInterval(async () => {
            await this.updateVPSStats(vpsId);
        }, this.statsUpdateInterval);

        this.intervalIds.set(vpsId, intervalId);
        
        // Сразу получаем первую статистику
        this.updateVPSStats(vpsId);
    }

    /**
     * Обновляет статистику VPS
     * @param {string} vpsId - ID VPS
     */
    async updateVPSStats(vpsId) {
        try {
            const stats = await this.getVPSStats(vpsId);
            if (stats) {
                const connection = this.connectedVPS.get(vpsId);
                if (connection) {
                    connection.lastStats = stats;
                    connection.lastSeen = new Date();
                    this.emit('vps_stats_updated', { vpsId, stats, config: connection.config });
                }
            }
        } catch (error) {
            console.error(`❌ Ошибка обновления статистики для VPS ${vpsId}: ${error.message}`);
            
            // Если ошибка подключения, пытаемся переподключиться
            if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
                console.log(`🔄 Потеряно соединение с VPS ${vpsId}, пытаемся переподключиться...`);
                this.disconnectVPS(vpsId);
                setTimeout(() => this.connectToVPS(vpsId), 5000);
            }
        }
    }

    /**
     * Получает статистику VPS
     * @param {string} vpsId - ID VPS
     * @returns {Object|null} Статистика или null при ошибке
     */
    async getVPSStats(vpsId) {
        try {
            const response = await this.makeRequest(vpsId, 'GET', '/api/stats');
            return response;
        } catch (error) {
            throw error;
        }
    }

    /**
     * Выполняет команду на VPS
     * @param {string} vpsId - ID VPS
     * @param {string} command - Команда для выполнения
     * @returns {Object|null} Результат выполнения команды
     */
    async executeCommand(vpsId, command) {
        try {
            const response = await this.makeRequest(vpsId, 'POST', '/api/execute', {
                command: command
            });
            
            console.log(`💻 Команда выполнена на VPS ${vpsId}: ${command}`);
            return response;
        } catch (error) {
            console.error(`❌ Ошибка выполнения команды на VPS ${vpsId}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Выполняет HTTP запрос к VPS агенту
     * @param {string} vpsId - ID VPS
     * @param {string} method - HTTP метод
     * @param {string} endpoint - Endpoint
     * @param {Object} data - Данные для POST запроса
     * @returns {Object} Ответ от агента
     */
    async makeRequest(vpsId, method, endpoint, data = null) {
        const config = this.vpsConfigs.get(vpsId);
        if (!config) {
            throw new Error(`VPS ${vpsId} не найден в конфигурации`);
        }

        const url = `http://${config.ip}:${config.port}${endpoint}`;
        const requestConfig = {
            method,
            url,
            headers: {
                'Authorization': `Bearer ${config.apiKey}`,
                'Content-Type': 'application/json'
            },
            timeout: this.connectionTimeout
        };

        if (data && (method === 'POST' || method === 'PUT')) {
            requestConfig.data = data;
        }

        const response = await axios(requestConfig);
        return response.data;
    }

    /**
     * Получает информацию о всех подключенных VPS
     * @returns {Array} Массив информации о VPS
     */
    getConnectedVPS() {
        const result = [];
        
        for (const [vpsId, connection] of this.connectedVPS) {
            result.push({
                id: vpsId,
                name: connection.config.name,
                ip: connection.config.ip,
                port: connection.config.port,
                status: connection.status,
                lastSeen: connection.lastSeen,
                serverInfo: connection.serverInfo,
                lastStats: connection.lastStats,
                userId: connection.config.userId
            });
        }
        
        return result;
    }

    /**
     * Получает информацию о конкретном VPS
     * @param {string} vpsId - ID VPS
     * @returns {Object|null} Информация о VPS или null
     */
    getVPSInfo(vpsId) {
        const connection = this.connectedVPS.get(vpsId);
        if (!connection) {
            return null;
        }

        return {
            id: vpsId,
            name: connection.config.name,
            ip: connection.config.ip,
            port: connection.config.port,
            status: connection.status,
            lastSeen: connection.lastSeen,
            serverInfo: connection.serverInfo,
            lastStats: connection.lastStats,
            userId: connection.config.userId
        };
    }

    /**
     * Проверяет, подключен ли VPS
     * @param {string} vpsId - ID VPS
     * @returns {boolean} true если подключен
     */
    isVPSConnected(vpsId) {
        return this.connectedVPS.has(vpsId);
    }

    /**
     * Получает VPS пользователя
     * @param {number} userId - ID пользователя
     * @returns {Array} Массив VPS пользователя
     */
    getUserVPS(userId) {
        const userVPS = [];
        
        for (const [vpsId, connection] of this.connectedVPS) {
            if (connection.config.userId === userId) {
                userVPS.push({
                    id: vpsId,
                    name: connection.config.name,
                    ip: connection.config.ip,
                    port: connection.config.port,
                    status: connection.status,
                    lastSeen: connection.lastSeen,
                    serverInfo: connection.serverInfo,
                    lastStats: connection.lastStats
                });
            }
        }
        
        return userVPS;
    }

    /**
     * Закрывает все подключения и останавливает менеджер
     */
    shutdown() {
        console.log('🛑 Остановка VPS Manager...');
        
        // Останавливаем все интервалы
        for (const intervalId of this.intervalIds.values()) {
            clearInterval(intervalId);
        }
        this.intervalIds.clear();

        // Отключаемся от всех VPS
        for (const vpsId of this.connectedVPS.keys()) {
            this.disconnectVPS(vpsId);
        }

        console.log('✅ VPS Manager остановлен');
    }
}

module.exports = VPSManager;
