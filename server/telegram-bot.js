const TelegramBot = require('node-telegram-bot-api');
const crypto = require('crypto');

// Telegram Bot Token
const BOT_TOKEN = '8303479475:AAEYew6T5nGKP-0OR_h_5yXPujzGPkBwjjk';

class XpanelTelegramBot {
    constructor() {
        this.bot = new TelegramBot(BOT_TOKEN, { polling: true });
        this.pendingCodes = new Map(); // Хранение кодов привязки
        this.userBindings = new Map(); // Привязки пользователей
        this.setupHandlers();
        console.log('🤖 Telegram Bot запущен');
    }

    setupHandlers() {
        // Команда /start
        this.bot.onText(/\/start/, (msg) => {
            const chatId = msg.chat.id;
            const welcomeMessage = `
🚀 *Добро пожаловать в Xpanel Bot!*

Этот бот уведомляет о состоянии ваших VPS серверов:
• 📊 Высокая нагрузка CPU/RAM
• 🔐 Попытки входа в систему
• ⚠️ Критические события

Для привязки аккаунта введите 6-значный код из панели управления.
            `;
            
            this.bot.sendMessage(chatId, welcomeMessage, { parse_mode: 'Markdown' });
        });

        // Обработка 6-значных кодов
        this.bot.on('message', (msg) => {
            const chatId = msg.chat.id;
            const text = msg.text;
            
            // Проверяем, является ли сообщение 6-значным кодом
            if (text && /^\d{6}$/.test(text.trim())) {
                console.log(`📱 Получен код привязки: ${text} от пользователя ${msg.from.username || msg.from.first_name}`);
                this.handleBindingCode(chatId, text.trim(), msg.from);
            }
        });

        // Команда /status
        this.bot.onText(/\/status/, (msg) => {
            const chatId = msg.chat.id;
            const binding = this.getUserBinding(chatId);
            
            if (binding) {
                this.bot.sendMessage(chatId, 
                    `✅ Аккаунт привязан к пользователю: *${binding.username}*\n` +
                    `📅 Дата привязки: ${binding.bindDate}`,
                    { parse_mode: 'Markdown' }
                );
            } else {
                this.bot.sendMessage(chatId, 
                    '❌ Аккаунт не привязан\n' +
                    'Получите код в панели управления и отправьте его сюда'
                );
            }
        });

        // Команда /unbind
        this.bot.onText(/\/unbind/, (msg) => {
            const chatId = msg.chat.id;
            this.unbindUser(chatId);
            this.bot.sendMessage(chatId, '✅ Аккаунт отвязан от уведомлений');
        });
    }

    // Генерация кода привязки
    generateBindingCode(userId, username) {
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const expiry = Date.now() + (20 * 60 * 1000); // 20 минут
        
        this.pendingCodes.set(code, {
            userId,
            username,
            expiry,
            attempts: 0
        });

        // Автоудаление через 20 минут
        setTimeout(() => {
            this.pendingCodes.delete(code);
        }, 20 * 60 * 1000);

        console.log(`📱 Код привязки ${code} создан для пользователя ${username}`);
        return code;
    }

    // Обработка кода привязки
    handleBindingCode(chatId, code, telegramUser) {
        const binding = this.pendingCodes.get(code);
        
        if (!binding) {
            this.bot.sendMessage(chatId, 
                '❌ Неверный или истекший код\n' +
                'Получите новый код в панели управления'
            );
            return false;
        }

        if (Date.now() > binding.expiry) {
            this.pendingCodes.delete(code);
            this.bot.sendMessage(chatId, 
                '⏰ Код истек (20 минут)\n' +
                'Получите новый код в панели управления'
            );
            return false;
        }

        // Привязываем пользователя
        this.userBindings.set(binding.userId, {
            chatId,
            username: binding.username,
            telegramUser: {
                id: telegramUser.id,
                username: telegramUser.username,
                first_name: telegramUser.first_name,
                last_name: telegramUser.last_name
            },
            bindDate: new Date().toISOString()
        });

        this.pendingCodes.delete(code);

        this.bot.sendMessage(chatId, 
            `✅ *Аккаунт успешно привязан!*\n\n` +
            `👤 Пользователь: ${binding.username}\n` +
            `📱 Telegram: @${telegramUser.username || telegramUser.first_name}\n` +
            `📅 Дата: ${new Date().toLocaleString('ru-RU')}\n\n` +
            `Теперь вы будете получать уведомления о ваших серверах.`,
            { parse_mode: 'Markdown' }
        );

        console.log(`✅ Пользователь ${binding.username} привязал Telegram @${telegramUser.username}`);
        return true;
    }

    // Получение привязки пользователя
    getUserBinding(chatId) {
        for (const [userId, binding] of this.userBindings) {
            if (binding.chatId === chatId) {
                return { userId, ...binding };
            }
        }
        return null;
    }

    // Отвязка пользователя
    unbindUser(chatId) {
        for (const [userId, binding] of this.userBindings) {
            if (binding.chatId === chatId) {
                this.userBindings.delete(userId);
                console.log(`🔓 Пользователь ${binding.username} отвязал Telegram`);
                return true;
            }
        }
        return false;
    }

    // Отправка уведомления о высокой нагрузке
    sendLoadAlert(userId, serverName, alertType, value, threshold) {
        const binding = this.userBindings.get(userId);
        if (!binding) return false;

        const icons = {
            cpu_high: '🔥',
            memory_high: '💾',
            disk_high: '💿'
        };

        const names = {
            cpu_high: 'CPU',
            memory_high: 'RAM',
            disk_high: 'Диск'
        };

        const message = `
${icons[alertType]} *Высокая нагрузка ${names[alertType]}*

🖥️ Сервер: \`${serverName}\`
📊 Значение: *${value.toFixed(1)}%*
⚠️ Порог: ${threshold}%
🕐 Время: ${new Date().toLocaleString('ru-RU')}

${value > 90 ? '🚨 Критическое значение!' : '⚠️ Требует внимания'}
        `;

        this.bot.sendMessage(binding.chatId, message, { parse_mode: 'Markdown' });
        return true;
    }

    // Уведомление о входе в систему
    sendLoginAlert(userId, serverName, loginType, details) {
        const binding = this.userBindings.get(userId);
        if (!binding) return false;

        const icons = {
            success: '✅',
            failed: '❌',
            suspicious: '🚨'
        };

        const message = `
${icons[loginType]} *Вход в систему*

🖥️ Сервер: \`${serverName}\`
👤 Пользователь: ${details.username || 'Неизвестно'}
🌐 IP: \`${details.ip || 'Неизвестно'}\`
🕐 Время: ${new Date().toLocaleString('ru-RU')}

${loginType === 'failed' ? '⚠️ Неудачная попытка входа' : ''}
${loginType === 'suspicious' ? '🚨 Подозрительная активность!' : ''}
        `;

        this.bot.sendMessage(binding.chatId, message, { parse_mode: 'Markdown' });
        return true;
    }

    // Уведомление о событиях сервера
    sendServerAlert(userId, serverName, eventType, message) {
        const binding = this.userBindings.get(userId);
        if (!binding) return false;

        const icons = {
            offline: '🔴',
            online: '🟢',
            restart: '🔄',
            error: '❌',
            warning: '⚠️'
        };

        const alertMessage = `
${icons[eventType]} *Событие сервера*

🖥️ Сервер: \`${serverName}\`
📝 Событие: ${message}
🕐 Время: ${new Date().toLocaleString('ru-RU')}
        `;

        this.bot.sendMessage(binding.chatId, alertMessage, { parse_mode: 'Markdown' });
        return true;
    }

    // Получение статистики бота
    getBotStats() {
        return {
            totalBindings: this.userBindings.size,
            pendingCodes: this.pendingCodes.size,
            uptime: process.uptime()
        };
    }

    // Получение всех привязок (для API)
    getAllBindings() {
        const bindings = {};
        for (const [userId, binding] of this.userBindings) {
            bindings[userId] = {
                username: binding.username,
                telegramUsername: binding.telegramUser.username,
                bindDate: binding.bindDate
            };
        }
        return bindings;
    }

    // Проверка привязки пользователя
    isUserBound(userId) {
        return this.userBindings.has(userId);
    }
}

module.exports = XpanelTelegramBot;
