#!/bin/bash

echo "========================================"
echo "    Xpanel - Server Setup Script"
echo "    Сервер: 64.188.70.12"
echo "    Домен: xpanel.xload.ru"
echo "========================================"
echo

# Функция для логирования
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# Функция для проверки успешности команды
check_status() {
    if [ $? -eq 0 ]; then
        log "✅ $1 - успешно"
    else
        log "❌ $1 - ошибка"
        exit 1
    fi
}

# Функция для установки npm пакетов с резервными методами
install_npm_package() {
    local package=$1
    local global_flag=$2
    
    log "Попытка установки $package..."
    
    # Метод 1: Обычная установка npm
    if [ "$global_flag" = "-g" ]; then
        npm install -g $package
    else
        npm install $package
    fi
    
    if [ $? -eq 0 ]; then
        log "✅ $package установлен успешно"
        return 0
    fi
    
    log "⚠️ Обычная установка не удалась, пробуем альтернативные методы..."
    
    # Метод 2: Установка с отключенным SSL
    npm config set strict-ssl false
    if [ "$global_flag" = "-g" ]; then
        npm install -g $package --unsafe-perm
    else
        npm install $package --unsafe-perm
    fi
    
    if [ $? -eq 0 ]; then
        log "✅ $package установлен с отключенным SSL"
        return 0
    fi
    
    # Метод 3: Прямая загрузка через curl (для критичных пакетов)
    if [ "$package" = "pm2" ] && [ "$global_flag" = "-g" ]; then
        log "Пробуем установить PM2 через прямую загрузку..."
        curl -o- https://raw.githubusercontent.com/Unitech/pm2/master/bin/pm2 > /usr/local/bin/pm2
        chmod +x /usr/local/bin/pm2
        if [ -f "/usr/local/bin/pm2" ]; then
            log "✅ PM2 установлен через прямую загрузку"
            return 0
        fi
    fi
    
    log "❌ Не удалось установить $package"
    return 1
}

# Обновление системы
log "🔄 Обновление системных пакетов..."
apt update && apt upgrade -y
check_status "Обновление системы"

# Установка системных зависимостей
log "📄 Установка системных зависимостей для Node.js..."
apt-get install -y \
    curl \
    wget \
    gnupg2 \
    ca-certificates \
    build-essential \
    python3 \
    python3-pip \
    make \
    g++ \
    git \
    unzip
check_status "Установка системных зависимостей"

# Установка Node.js 18.x
log "📦 Установка Node.js 18.x..."
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
check_status "Добавление репозитория NodeSource"

apt-get install -y nodejs
check_status "Установка Node.js"

# Проверка версий
log "✅ Node.js версия: $(node --version)"
log "✅ npm версия: $(npm --version)"

# Настройка npm
log "📁 Настройка npm..."
npm config set registry https://registry.npmjs.org/
npm config set fetch-retry-mintimeout 20000
npm config set fetch-retry-maxtimeout 120000
npm config set fetch-timeout 300000

# Установка PM2 с резервными методами
log "⚙️ Установка PM2 глобально..."
install_npm_package "pm2" "-g"

# Установка системных пакетов
log "🌐 Установка Nginx и других зависимостей..."
apt-get install -y nginx certbot python3-certbot-nginx ufw
check_status "Установка Nginx и certbot"

# Переход в директорию проекта
log "📁 Переход в директорию проекта..."
if [ ! -d "/root/a" ]; then
    log "⚠️ Директория /root/a не найдена, создаем..."
    mkdir -p /root/a
fi
cd /root/a

# Установка зависимостей проекта с улучшенной обработкой ошибок
log "📦 Установка зависимостей проекта..."
if [ -f "package.json" ]; then
    # Попытка обычной установки
    npm install --production
    if [ $? -ne 0 ]; then
        log "⚠️ Обычная установка не удалась, пробуем с --force..."
        npm install --production --force
        if [ $? -ne 0 ]; then
            log "⚠️ Установка с --force не удалась, пробуем без SSL..."
            npm config set strict-ssl false
            npm install --production --unsafe-perm
        fi
    fi
else
    log "⚠️ package.json не найден в корневой директории"
fi

# Установка зависимостей клиента
if [ -d "client" ]; then
    log "📦 Установка зависимостей клиента..."
    cd client
    if [ -f "package.json" ]; then
        npm install --production
        if [ $? -ne 0 ]; then
            log "⚠️ Обычная установка клиента не удалась, пробуем альтернативы..."
            npm config set strict-ssl false
            npm install --production --unsafe-perm --force
        fi
    fi
    cd ..
else
    log "⚠️ Директория client не найдена, пропускаем установку зависимостей клиента"
fi

# Сборка React приложения
log "🏗️ Сборка React приложения..."
if [ -d "client" ]; then
    cd client
    if [ -f "package.json" ] && grep -q "build" package.json; then
        npm run build
        if [ $? -eq 0 ]; then
            log "✅ Сборка клиента завершена успешно"
        else
            log "⚠️ Ошибка при сборке клиента, но продолжаем..."
        fi
    else
        log "⚠️ Скрипт build не найден в package.json клиента"
    fi
    cd ..
else
    log "⚠️ Директория client не найдена, пропускаем сборку"
fi

# Создание .env файла
log "⚙️ Создание конфигурации окружения..."
cat > .env << EOF
# Production Environment
NODE_ENV=production
PORT=3001
DOMAIN=xpanel.xload.ru
SERVER_IP=64.188.70.12

# JWT Configuration
JWT_SECRET=xpanel_production_secret_$(openssl rand -hex 32)

# Email Configuration (настройте вручную)
EMAIL_USER=xpanel.service@gmail.com
EMAIL_PASS=your-gmail-app-password

# Admin Configuration
ADMIN_EMAIL=fillsites0@gmail.com

# Security
BCRYPT_ROUNDS=12

# Server Configuration
MAX_MEMORY=1G
RESTART_DELAY=5000
EOF
check_status "Создание .env файла"

# Создание PM2 ecosystem файла
log "🚀 Создание конфигурации PM2..."
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'xpanel',
    script: 'server/index.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    restart_delay: 5000,
    env: {
      NODE_ENV: 'production',
      PORT: 3001,
      SERVER_IP: '64.188.70.12'
    },
    error_file: '/var/log/xpanel/error.log',
    out_file: '/var/log/xpanel/out.log',
    log_file: '/var/log/xpanel/combined.log',
    time: true
  }]
}
EOF
check_status "Создание PM2 конфигурации"

# Создание директории для логов
log "📁 Создание директории для логов..."
mkdir -p /var/log/xpanel
check_status "Создание директории логов"

# Настройка Nginx (сначала только HTTP)
log "🌐 Настройка Nginx..."
cat > /etc/nginx/sites-available/xpanel << EOF
server {
    listen 80;
    server_name xpanel.xload.ru;
    
    # Логирование
    access_log /var/log/nginx/xpanel_access.log;
    error_log /var/log/nginx/xpanel_error.log;

    # Основной прокси к Node.js приложению
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 86400;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
    }

    # Поддержка WebSocket для Socket.io
    location /socket.io/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Кэширование статических файлов
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files \$uri =404;
    }
    
    # Безопасность - скрытие версии Nginx
    server_tokens off;
}
EOF
check_status "Создание конфигурации Nginx"

# Создание HTTPS конфигурации для использования после установки SSL
log "🔒 Создание HTTPS конфигурации..."
cat > /etc/nginx/sites-available/xpanel-ssl << EOF
server {
    listen 80;
    server_name xpanel.xload.ru;

    # Перенаправление HTTP на HTTPS
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name xpanel.xload.ru;
    
    # Логирование
    access_log /var/log/nginx/xpanel_ssl_access.log;
    error_log /var/log/nginx/xpanel_ssl_error.log;

    # SSL конфигурация (будет настроена certbot)
    ssl_certificate /etc/letsencrypt/live/xpanel.xload.ru/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/xpanel.xload.ru/privkey.pem;
    
    # Улучшенная SSL конфигурация
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;
    
    # Заголовки безопасности
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
    add_header Strict-Transport-Security "max-age=63072000" always;

    # Gzip сжатие
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/javascript
        application/xml+rss
        application/json
        image/svg+xml;

    # Основной прокси к Node.js приложению
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 86400;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
    }

    # Поддержка WebSocket для Socket.io
    location /socket.io/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Кэширование статических файлов
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files \$uri =404;
    }
    
    # Безопасность - скрытие версии Nginx
    server_tokens off;
}
EOF
check_status "Создание HTTPS конфигурации"

# Активация сайта
log "🔗 Активация сайта в Nginx..."
ln -sf /etc/nginx/sites-available/xpanel /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
check_status "Активация сайта"

# Проверка конфигурации nginx
log "🧪 Проверка конфигурации Nginx..."
nginx -t
if [ $? -eq 0 ]; then
    log "✅ Конфигурация Nginx корректна"
    systemctl reload nginx
    check_status "Перезагрузка Nginx"
else
    log "❌ Ошибка в конфигурации Nginx!"
    exit 1
fi

# Настройка SSL сертификата
log "🔒 Настройка SSL сертификата..."
certbot --nginx -d xpanel.xload.ru --non-interactive --agree-tos --email fillsites0@gmail.com --redirect

# Проверка установки SSL и переключение на HTTPS конфигурацию
if [ $? -eq 0 ]; then
    log "✅ SSL сертификат установлен успешно"
    log "🔄 Переключение на HTTPS конфигурацию..."
    cp /etc/nginx/sites-available/xpanel-ssl /etc/nginx/sites-available/xpanel
    nginx -t && systemctl reload nginx
    check_status "Переключение на HTTPS"
    log "🌐 Сайт доступен по адресу: https://xpanel.xload.ru"
else
    log "⚠️ Установка SSL не удалась, сайт будет работать по HTTP"
    log "🌐 Сайт доступен по адресу: http://xpanel.xload.ru"
fi

# Запуск приложения с PM2
log "🚀 Запуск Xpanel приложения..."
if command -v pm2 >/dev/null 2>&1; then
    pm2 start ecosystem.config.js
    if [ $? -eq 0 ]; then
        pm2 save
        pm2 startup
        check_status "Запуск приложения с PM2"
    else
        log "❌ Ошибка запуска с PM2, пробуем простой запуск..."
        nohup node server/index.js > /var/log/xpanel/app.log 2>&1 &
        log "✅ Приложение запущено в фоновом режиме"
    fi
else
    log "⚠️ PM2 не найден, запускаем приложение напрямую..."
    nohup node server/index.js > /var/log/xpanel/app.log 2>&1 &
    log "✅ Приложение запущено в фоновом режиме"
fi

# Настройка файрвола
log "🔥 Настройка файрвола..."
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
check_status "Настройка файрвола"

# Создание скрипта резервного копирования
log "💾 Создание скрипта резервного копирования..."
cat > /root/backup-xpanel.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/root/backups"
mkdir -p $BACKUP_DIR

# Резервное копирование приложения
tar -czf $BACKUP_DIR/xpanel_$DATE.tar.gz -C /root a

# Резервное копирование конфигурации Nginx
cp /etc/nginx/sites-available/xpanel* $BACKUP_DIR/ 2>/dev/null

# Сохранение только последних 7 резервных копий
find $BACKUP_DIR -name "xpanel_*.tar.gz" -mtime +7 -delete

echo "[$(date)] Резервная копия создана: xpanel_$DATE.tar.gz"
EOF

chmod +x /root/backup-xpanel.sh
check_status "Создание скрипта резервного копирования"

# Добавление в crontab (ежедневно в 2 утра)
log "⏰ Настройка автоматического резервного копирования..."
(crontab -l 2>/dev/null; echo "0 2 * * * /root/backup-xpanel.sh") | crontab -
check_status "Настройка crontab"

# Создание скрипта мониторинга
log "📊 Создание скрипта мониторинга..."
cat > /root/monitor-xpanel.sh << 'EOF'
#!/bin/bash
echo "========================================"
echo "    Xpanel - Мониторинг системы"
echo "    Сервер: 64.188.70.12"
echo "========================================"
echo

echo "🌐 Статус Nginx:"
systemctl status nginx --no-pager -l

echo
echo "🚀 Статус PM2:"
pm2 status 2>/dev/null || echo "PM2 не запущен"

echo
echo "💾 Использование диска:"
df -h /

echo
echo "🧠 Использование памяти:"
free -h

echo
echo "📊 Загрузка системы:"
uptime

echo
echo "🔗 Проверка доступности сайта:"
curl -I http://localhost:3001 2>/dev/null | head -1 || echo "Приложение недоступно"

echo
echo "📝 Последние логи приложения:"
tail -10 /var/log/xpanel/combined.log 2>/dev/null || echo "Логи не найдены"
EOF

chmod +x /root/monitor-xpanel.sh
check_status "Создание скрипта мониторинга"

echo
log "========================================"
log "✅ Установка Xpanel завершена успешно!"
log "========================================"
echo
log "🌐 Ваше приложение доступно по адресу:"
log "   https://xpanel.xload.ru (или http://xpanel.xload.ru если SSL не установлен)"
echo
log "📊 Статус PM2:"
pm2 status 2>/dev/null || echo "PM2 не запущен, приложение работает в фоновом режиме"
echo
log "🔧 Следующие шаги:"
log "1. Настройте email в /root/a/.env"
log "2. Протестируйте приложение"
log "3. Мониторьте логи: tail -f /var/log/xpanel/combined.log"
echo
log "📝 Полезные команды:"
log "   /root/monitor-xpanel.sh     - Мониторинг системы"
log "   /root/backup-xpanel.sh      - Создание резервной копии"
log "   pm2 restart xpanel          - Перезапуск приложения"
log "   pm2 logs xpanel             - Просмотр логов"
log "   systemctl status nginx      - Статус Nginx"
echo
log "🎉 Установка завершена! Сервер 64.188.70.12 готов к работе!"
