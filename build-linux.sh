#!/bin/bash

# Xpanel Linux Build Script
# Автоматическая сборка и развертывание на Linux сервере

set -e

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Конфигурация
PROJECT_DIR="/opt/xpanel"
SERVICE_NAME="xpanel"
DOMAIN="xpanel.xload.ru"
PORT="3001"

echo -e "${BLUE}╔══════════════════════════════════════╗${NC}"
echo -e "${BLUE}║         Xpanel Linux Builder         ║${NC}"
echo -e "${BLUE}║    Автоматическая сборка проекта     ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════╝${NC}"
echo

# Проверка прав root
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}❌ Этот скрипт должен запускаться с правами root${NC}"
   echo -e "${YELLOW}💡 Используйте: sudo $0${NC}"
   exit 1
fi

# Определение дистрибутива
detect_os() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS=$NAME
        VER=$VERSION_ID
    else
        OS=$(uname -s)
        VER=$(uname -r)
    fi
    
    echo -e "${BLUE}🖥️  Система: ${OS} ${VER}${NC}"
}

# Установка Node.js и npm
install_nodejs() {
    echo -e "${YELLOW}📦 Установка Node.js и npm...${NC}"
    
    if command -v node >/dev/null 2>&1; then
        NODE_VERSION=$(node --version)
        echo -e "${GREEN}✅ Node.js уже установлен: ${NODE_VERSION}${NC}"
    else
        if command -v apt-get >/dev/null 2>&1; then
            # Debian/Ubuntu
            curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
            apt-get install -y nodejs
        elif command -v yum >/dev/null 2>&1; then
            # CentOS/RHEL
            curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
            yum install -y nodejs npm
        elif command -v dnf >/dev/null 2>&1; then
            # Fedora
            dnf install -y nodejs npm
        else
            echo -e "${RED}❌ Неподдерживаемый дистрибутив для автоустановки Node.js${NC}"
            echo -e "${YELLOW}Установите Node.js 18+ вручную${NC}"
            exit 1
        fi
        
        echo -e "${GREEN}✅ Node.js установлен${NC}"
    fi
    
    # Проверка версии
    NODE_VERSION=$(node --version)
    NPM_VERSION=$(npm --version)
    echo -e "${BLUE}📋 Node.js: ${NODE_VERSION}, npm: ${NPM_VERSION}${NC}"
}

# Установка системных зависимостей
install_system_deps() {
    echo -e "${YELLOW}📦 Установка системных зависимостей...${NC}"
    
    if command -v apt-get >/dev/null 2>&1; then
        # Debian/Ubuntu
        apt-get update
        apt-get install -y curl wget git build-essential python3 python3-pip nginx certbot python3-certbot-nginx ufw
    elif command -v yum >/dev/null 2>&1; then
        # CentOS/RHEL
        yum update -y
        yum install -y curl wget git gcc gcc-c++ make python3 python3-pip nginx certbot python3-certbot-nginx firewalld
    elif command -v dnf >/dev/null 2>&1; then
        # Fedora
        dnf update -y
        dnf install -y curl wget git gcc gcc-c++ make python3 python3-pip nginx certbot python3-certbot-nginx firewalld
    fi
    
    echo -e "${GREEN}✅ Системные зависимости установлены${NC}"
}

# Создание директорий проекта
create_directories() {
    echo -e "${YELLOW}📁 Создание директорий...${NC}"
    
    mkdir -p ${PROJECT_DIR}
    mkdir -p /var/log/xpanel
    mkdir -p /etc/xpanel
    
    echo -e "${GREEN}✅ Директории созданы${NC}"
}

# Копирование файлов проекта
copy_project_files() {
    echo -e "${YELLOW}📋 Копирование файлов проекта...${NC}"
    
    # Копируем все файлы проекта
    cp -r ./* ${PROJECT_DIR}/
    
    # Устанавливаем права
    chown -R root:root ${PROJECT_DIR}
    chmod +x ${PROJECT_DIR}/*.sh
    chmod +x ${PROJECT_DIR}/agent/*.sh
    
    echo -e "${GREEN}✅ Файлы проекта скопированы${NC}"
}

# Установка зависимостей проекта
install_project_deps() {
    echo -e "${YELLOW}📦 Установка зависимостей проекта...${NC}"
    
    cd ${PROJECT_DIR}
    
    # Устанавливаем серверные зависимости
    echo -e "${BLUE}🔧 Установка серверных зависимостей...${NC}"
    npm install
    
    # Устанавливаем клиентские зависимости
    echo -e "${BLUE}🔧 Установка клиентских зависимостей...${NC}"
    cd client
    npm install
    
    echo -e "${GREEN}✅ Зависимости проекта установлены${NC}"
}

# Сборка клиентской части
build_client() {
    echo -e "${YELLOW}🏗️  Сборка клиентской части...${NC}"
    
    cd ${PROJECT_DIR}/client
    
    # Создаем .env файл для production
    cat > .env << EOF
REACT_APP_API_URL=https://${DOMAIN}
REACT_APP_WS_URL=wss://${DOMAIN}
GENERATE_SOURCEMAP=false
EOF
    
    # Собираем проект
    npm run build
    
    if [ -d "build" ]; then
        echo -e "${GREEN}✅ Клиентская часть собрана${NC}"
    else
        echo -e "${RED}❌ Ошибка сборки клиентской части${NC}"
        exit 1
    fi
}

# Настройка переменных окружения
setup_environment() {
    echo -e "${YELLOW}⚙️  Настройка переменных окружения...${NC}"
    
    cd ${PROJECT_DIR}
    
    # Создаем .env файл
    cat > .env << EOF
NODE_ENV=production
PORT=${PORT}
DOMAIN=${DOMAIN}
JWT_SECRET=$(openssl rand -hex 32)
EMAIL_USER=xpanel.service@gmail.com
EMAIL_PASS=your-app-password
TELEGRAM_BOT_TOKEN=8303479475:AAEYew6T5nGKP-0OR_h_5yXPujzGPkBwjjk
EOF
    
    chmod 600 .env
    echo -e "${GREEN}✅ Переменные окружения настроены${NC}"
}

# Создание systemd сервиса
create_systemd_service() {
    echo -e "${YELLOW}⚙️  Создание systemd сервиса...${NC}"
    
    cat > /etc/systemd/system/${SERVICE_NAME}.service << EOF
[Unit]
Description=Xpanel VPS Management System
After=network.target
Wants=network.target

[Service]
Type=simple
User=root
WorkingDirectory=${PROJECT_DIR}
ExecStart=/usr/bin/node server/index.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

# Environment
Environment=NODE_ENV=production
EnvironmentFile=${PROJECT_DIR}/.env

# Security settings
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ReadWritePaths=${PROJECT_DIR} /var/log/xpanel /etc/xpanel

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload
    systemctl enable ${SERVICE_NAME}
    
    echo -e "${GREEN}✅ Systemd сервис создан${NC}"
}

# Настройка Nginx
setup_nginx() {
    echo -e "${YELLOW}🌐 Настройка Nginx...${NC}"
    
    # Создаем конфигурацию для сайта
    cat > /etc/nginx/sites-available/${SERVICE_NAME} << EOF
server {
    listen 80;
    server_name ${DOMAIN} www.${DOMAIN};
    
    # Redirect HTTP to HTTPS
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name ${DOMAIN} www.${DOMAIN};
    
    # SSL Configuration (will be configured by certbot)
    ssl_certificate /etc/letsencrypt/live/${DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied expired no-cache no-store private must-revalidate auth;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/javascript application/json;
    
    # Static files
    location / {
        try_files \$uri \$uri/ @proxy;
    }
    
    # API and Socket.IO proxy
    location @proxy {
        proxy_pass http://127.0.0.1:${PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 86400;
    }
    
    # API routes
    location /api/ {
        proxy_pass http://127.0.0.1:${PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
    
    # Socket.IO
    location /socket.io/ {
        proxy_pass http://127.0.0.1:${PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    
    # Security
    location ~ /\. {
        deny all;
    }
}
EOF

    # Включаем сайт
    ln -sf /etc/nginx/sites-available/${SERVICE_NAME} /etc/nginx/sites-enabled/
    
    # Удаляем дефолтный сайт
    rm -f /etc/nginx/sites-enabled/default
    
    # Проверяем конфигурацию
    nginx -t
    
    echo -e "${GREEN}✅ Nginx настроен${NC}"
}

# Настройка файрвола
setup_firewall() {
    echo -e "${YELLOW}🔥 Настройка файрвола...${NC}"
    
    if command -v ufw >/dev/null 2>&1; then
        # Ubuntu/Debian
        ufw --force enable
        ufw allow ssh
        ufw allow 'Nginx Full'
        ufw allow ${PORT}
        echo -e "${GREEN}✅ UFW настроен${NC}"
    elif command -v firewall-cmd >/dev/null 2>&1; then
        # CentOS/RHEL/Fedora
        systemctl enable firewalld
        systemctl start firewalld
        firewall-cmd --permanent --add-service=ssh
        firewall-cmd --permanent --add-service=http
        firewall-cmd --permanent --add-service=https
        firewall-cmd --permanent --add-port=${PORT}/tcp
        firewall-cmd --reload
        echo -e "${GREEN}✅ Firewalld настроен${NC}"
    else
        echo -e "${YELLOW}⚠️  Файрвол не обнаружен${NC}"
    fi
}

# Получение SSL сертификата
setup_ssl() {
    echo -e "${YELLOW}🔒 Настройка SSL сертификата...${NC}"
    
    # Временно запускаем Nginx без SSL
    systemctl start nginx
    
    # Получаем сертификат
    certbot --nginx -d ${DOMAIN} -d www.${DOMAIN} --non-interactive --agree-tos --email admin@${DOMAIN}
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ SSL сертификат получен${NC}"
        
        # Настраиваем автообновление
        (crontab -l 2>/dev/null; echo "0 12 * * * /usr/bin/certbot renew --quiet") | crontab -
    else
        echo -e "${YELLOW}⚠️  Не удалось получить SSL сертификат${NC}"
        echo -e "${YELLOW}Проверьте DNS настройки для домена ${DOMAIN}${NC}"
    fi
}

# Запуск сервисов
start_services() {
    echo -e "${YELLOW}🚀 Запуск сервисов...${NC}"
    
    # Запускаем Xpanel
    systemctl start ${SERVICE_NAME}
    
    # Перезапускаем Nginx
    systemctl restart nginx
    
    # Проверяем статус
    sleep 3
    
    if systemctl is-active --quiet ${SERVICE_NAME}; then
        echo -e "${GREEN}✅ Xpanel запущен${NC}"
    else
        echo -e "${RED}❌ Ошибка запуска Xpanel${NC}"
        echo -e "${YELLOW}Логи: journalctl -u ${SERVICE_NAME} -f${NC}"
        exit 1
    fi
    
    if systemctl is-active --quiet nginx; then
        echo -e "${GREEN}✅ Nginx запущен${NC}"
    else
        echo -e "${RED}❌ Ошибка запуска Nginx${NC}"
        exit 1
    fi
}

# Создание скрипта мониторинга
create_monitoring_script() {
    echo -e "${YELLOW}📊 Создание скрипта мониторинга...${NC}"
    
    cat > /root/monitor-xpanel.sh << 'EOF'
#!/bin/bash

# Xpanel Monitoring Script

echo "=== Xpanel System Status ==="
echo "Date: $(date)"
echo

# Service status
echo "🔧 Services:"
systemctl is-active --quiet xpanel && echo "  ✅ Xpanel: Running" || echo "  ❌ Xpanel: Stopped"
systemctl is-active --quiet nginx && echo "  ✅ Nginx: Running" || echo "  ❌ Nginx: Stopped"
echo

# System resources
echo "💻 System Resources:"
echo "  CPU: $(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)% used"
echo "  RAM: $(free | grep Mem | awk '{printf("%.1f%%", $3/$2 * 100.0)}')"
echo "  Disk: $(df -h / | awk 'NR==2{printf "%s", $5}')"
echo

# Network
echo "🌐 Network:"
echo "  Active connections: $(netstat -an | grep :3001 | grep ESTABLISHED | wc -l)"
echo

# Logs (last 5 lines)
echo "📋 Recent logs:"
journalctl -u xpanel -n 5 --no-pager
EOF

    chmod +x /root/monitor-xpanel.sh
    echo -e "${GREEN}✅ Скрипт мониторинга создан: /root/monitor-xpanel.sh${NC}"
}

# Создание скрипта резервного копирования
create_backup_script() {
    echo -e "${YELLOW}💾 Создание скрипта резервного копирования...${NC}"
    
    cat > /root/backup-xpanel.sh << EOF
#!/bin/bash

# Xpanel Backup Script

BACKUP_DIR="/root/xpanel-backups"
DATE=\$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="xpanel_backup_\${DATE}.tar.gz"

mkdir -p \${BACKUP_DIR}

echo "Creating backup: \${BACKUP_FILE}"

tar -czf \${BACKUP_DIR}/\${BACKUP_FILE} \\
    ${PROJECT_DIR} \\
    /etc/nginx/sites-available/${SERVICE_NAME} \\
    /etc/systemd/system/${SERVICE_NAME}.service \\
    /etc/xpanel

echo "Backup created: \${BACKUP_DIR}/\${BACKUP_FILE}"

# Keep only last 7 backups
cd \${BACKUP_DIR}
ls -t xpanel_backup_*.tar.gz | tail -n +8 | xargs -r rm

echo "Backup completed successfully"
EOF

    chmod +x /root/backup-xpanel.sh
    
    # Добавляем в cron (ежедневно в 2:00)
    (crontab -l 2>/dev/null; echo "0 2 * * * /root/backup-xpanel.sh") | crontab -
    
    echo -e "${GREEN}✅ Скрипт резервного копирования создан${NC}"
}

# Финальная информация
show_final_info() {
    echo
    echo -e "${GREEN}╔══════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║          Установка завершена!        ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════╝${NC}"
    echo
    echo -e "${BLUE}🌐 Доступ к панели:${NC}"
    echo -e "${YELLOW}  https://${DOMAIN}${NC}"
    echo -e "${YELLOW}  http://${DOMAIN} (перенаправление на HTTPS)${NC}"
    echo
    echo -e "${BLUE}🔧 Управление сервисом:${NC}"
    echo -e "${YELLOW}  Статус:     systemctl status ${SERVICE_NAME}${NC}"
    echo -e "${YELLOW}  Перезапуск: systemctl restart ${SERVICE_NAME}${NC}"
    echo -e "${YELLOW}  Логи:       journalctl -u ${SERVICE_NAME} -f${NC}"
    echo
    echo -e "${BLUE}📊 Мониторинг:${NC}"
    echo -e "${YELLOW}  /root/monitor-xpanel.sh${NC}"
    echo
    echo -e "${BLUE}💾 Резервное копирование:${NC}"
    echo -e "${YELLOW}  /root/backup-xpanel.sh${NC}"
    echo -e "${YELLOW}  Автоматически: ежедневно в 2:00${NC}"
    echo
    echo -e "${GREEN}🎉 Xpanel готов к использованию!${NC}"
}

# Основная функция
main() {
    detect_os
    install_nodejs
    install_system_deps
    create_directories
    copy_project_files
    install_project_deps
    build_client
    setup_environment
    create_systemd_service
    setup_nginx
    setup_firewall
    setup_ssl
    start_services
    create_monitoring_script
    create_backup_script
    show_final_info
}

# Запуск сборки
main
