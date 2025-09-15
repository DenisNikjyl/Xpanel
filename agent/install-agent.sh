#!/bin/bash

# Xpanel Agent Auto-Installer
# Автоматическая установка HTTP агента для мониторинга VPS

set -e

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Конфигурация
AGENT_DIR="/opt/xpanel-agent"
SERVICE_NAME="xpanel-agent"
LOG_FILE="/var/log/xpanel-agent.log"
AGENT_PORT="8888"

echo -e "${BLUE}╔══════════════════════════════════════╗${NC}"
echo -e "${BLUE}║        Xpanel Agent Installer        ║${NC}"
echo -e "${BLUE}║     HTTP агент для мониторинга VPS   ║${NC}"
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
    elif type lsb_release >/dev/null 2>&1; then
        OS=$(lsb_release -si)
        VER=$(lsb_release -sr)
    else
        OS=$(uname -s)
        VER=$(uname -r)
    fi
    
    echo -e "${BLUE}🖥️  Обнаружена система: ${OS} ${VER}${NC}"
}

# Установка зависимостей
install_dependencies() {
    echo -e "${YELLOW}📦 Установка зависимостей...${NC}"
    
    if command -v apt-get >/dev/null 2>&1; then
        # Debian/Ubuntu
        apt-get update
        apt-get install -y python3 python3-pip python3-venv curl wget ufw
        
        # Установка psutil через pip
        pip3 install psutil
        
    elif command -v yum >/dev/null 2>&1; then
        # CentOS/RHEL
        yum update -y
        yum install -y python3 python3-pip curl wget firewalld
        
        # Установка psutil через pip
        pip3 install psutil
        
    elif command -v dnf >/dev/null 2>&1; then
        # Fedora
        dnf update -y
        dnf install -y python3 python3-pip curl wget firewalld
        
        # Установка psutil через pip
        pip3 install psutil
        
    else
        echo -e "${RED}❌ Неподдерживаемый дистрибутив${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Зависимости установлены${NC}"
}

# Панель управления
PANEL_URL="http://64.188.70.12:3001/"
AGENT_VERSION="1.0.0"

echo "=== Xpanel Agent Installer v${AGENT_VERSION} ==="
echo "Panel URL: ${PANEL_URL}"
echo ""

detect_os
install_dependencies

# Создание директорий
create_directories() {
    echo -e "${YELLOW}📁 Создание директорий...${NC}"
    mkdir -p /etc/xpanel
    mkdir -p /opt/xpanel-agent
    mkdir -p /var/log
    echo -e "${GREEN}✅ Директории созданы${NC}"
}

# Настройка файрвола
configure_firewall() {
    echo -e "${YELLOW}🔥 Настройка файрвола...${NC}"
    
    if command -v ufw >/dev/null 2>&1; then
        # Ubuntu/Debian
        ufw allow ${AGENT_PORT}/tcp
        echo -e "${GREEN}✅ Порт ${AGENT_PORT} открыт в UFW${NC}"
    elif command -v firewall-cmd >/dev/null 2>&1; then
        # CentOS/RHEL/Fedora
        firewall-cmd --permanent --add-port=${AGENT_PORT}/tcp
        firewall-cmd --reload
        echo -e "${GREEN}✅ Порт ${AGENT_PORT} открыт в firewalld${NC}"
    else
        echo -e "${YELLOW}⚠️  Файрвол не обнаружен. Убедитесь, что порт ${AGENT_PORT} открыт${NC}"
    fi
}

# Загрузка агента
download_agent() {
    echo -e "${YELLOW}⬇️  Загрузка агента...${NC}"
    
    # Создаем временный файл агента (в реальности загружали бы с сервера)
    cat > ${AGENT_DIR}/xpanel-agent.py << 'AGENT_EOF'

# Создание systemd сервиса
cat > /etc/systemd/system/xpanel-agent.service << EOF
[Unit]
Description=Xpanel Agent
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/xpanel
ExecStart=/usr/bin/python3 /opt/xpanel/xpanel-agent.py
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# Запуск сервиса
echo "🚀 Запуск агента..."
systemctl daemon-reload
systemctl enable xpanel-agent
systemctl start xpanel-agent

# Проверка статуса
sleep 3
if systemctl is-active --quiet xpanel-agent; then
    echo "✅ Xpanel Agent успешно установлен и запущен!"
    echo ""
    echo "📊 Статус: systemctl status xpanel-agent"
    echo "📋 Логи: journalctl -u xpanel-agent -f"
    echo "🔄 Перезапуск: systemctl restart xpanel-agent"
    echo ""
    echo "Сервер появится в панели управления через 1-2 минуты"
else
    echo "❌ Ошибка запуска агента"
    echo "Проверьте логи: journalctl -u xpanel-agent"
    exit 1
fi
