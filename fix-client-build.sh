#!/bin/bash

# Быстрое исправление проблемы со статическими файлами React
# Скрипт для сборки клиентской части на Ubuntu сервере

set -e

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PROJECT_DIR="/root/Xpanel"
CLIENT_DIR="${PROJECT_DIR}/client"

echo -e "${BLUE}╔══════════════════════════════════════╗${NC}"
echo -e "${BLUE}║    Исправление статических файлов    ║${NC}"
echo -e "${BLUE}║         React приложения             ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════╝${NC}"
echo

# Проверка прав root
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}❌ Запустите скрипт с правами root: sudo $0${NC}"
   exit 1
fi

# Переход в директорию проекта
if [ ! -d "$PROJECT_DIR" ]; then
    echo -e "${RED}❌ Директория проекта не найдена: $PROJECT_DIR${NC}"
    echo -e "${YELLOW}💡 Убедитесь, что проект загружен в /root/Xpanel${NC}"
    exit 1
fi

cd $PROJECT_DIR
echo -e "${GREEN}✅ Перешли в директорию проекта: $PROJECT_DIR${NC}"

# Проверка наличия Node.js
if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}📦 Установка Node.js...${NC}"
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    apt-get install -y nodejs
    echo -e "${GREEN}✅ Node.js установлен${NC}"
fi

NODE_VERSION=$(node --version)
echo -e "${BLUE}📋 Node.js версия: $NODE_VERSION${NC}"

# Остановка сервиса перед обновлением
echo -e "${YELLOW}⏹️  Остановка сервиса Xpanel...${NC}"
systemctl stop xpanel 2>/dev/null || pm2 stop xpanel 2>/dev/null || true

# Установка зависимостей сервера
echo -e "${YELLOW}📦 Установка серверных зависимостей...${NC}"
npm install --production

# Переход в клиентскую директорию
if [ ! -d "$CLIENT_DIR" ]; then
    echo -e "${RED}❌ Клиентская директория не найдена: $CLIENT_DIR${NC}"
    exit 1
fi

cd $CLIENT_DIR
echo -e "${GREEN}✅ Перешли в клиентскую директорию${NC}"

# Установка клиентских зависимостей
echo -e "${YELLOW}📦 Установка клиентских зависимостей...${NC}"
npm install

# Создание .env файла для production
echo -e "${YELLOW}⚙️  Создание .env файла для production...${NC}"
cat > .env << EOF
REACT_APP_API_URL=http://64.188.70.12:3001
REACT_APP_WS_URL=ws://64.188.70.12:3001
GENERATE_SOURCEMAP=false
EOF

# Сборка клиентской части
echo -e "${YELLOW}🏗️  Сборка React приложения...${NC}"
npm run build

# Проверка успешности сборки
if [ -d "build" ]; then
    echo -e "${GREEN}✅ Клиентская часть успешно собрана${NC}"
    echo -e "${BLUE}📁 Статические файлы находятся в: $CLIENT_DIR/build${NC}"
    
    # Показываем содержимое build директории
    echo -e "${BLUE}📋 Содержимое build директории:${NC}"
    ls -la build/static/js/ | head -10
else
    echo -e "${RED}❌ Ошибка сборки клиентской части${NC}"
    exit 1
fi

# Возврат в корневую директорию проекта
cd $PROJECT_DIR

# Проверка настроек сервера для статических файлов
echo -e "${YELLOW}🔍 Проверка настроек сервера...${NC}"
if grep -q "express.static.*client/build" server/index.js; then
    echo -e "${GREEN}✅ Сервер настроен для обслуживания статических файлов${NC}"
else
    echo -e "${YELLOW}⚠️  Возможно, нужно проверить настройки сервера${NC}"
fi

# Запуск сервиса
echo -e "${YELLOW}🚀 Запуск сервиса Xpanel...${NC}"
if systemctl is-enabled xpanel &>/dev/null; then
    systemctl start xpanel
    sleep 3
    if systemctl is-active --quiet xpanel; then
        echo -e "${GREEN}✅ Сервис Xpanel запущен через systemd${NC}"
    else
        echo -e "${RED}❌ Ошибка запуска через systemd${NC}"
        echo -e "${YELLOW}📋 Логи: journalctl -u xpanel -n 20${NC}"
    fi
elif command -v pm2 &> /dev/null; then
    cd server
    pm2 start index.js --name xpanel
    echo -e "${GREEN}✅ Сервис Xpanel запущен через PM2${NC}"
else
    echo -e "${YELLOW}⚠️  Запустите сервер вручную:${NC}"
    echo -e "${YELLOW}cd $PROJECT_DIR/server && node index.js${NC}"
fi

# Проверка Nginx (если установлен)
if command -v nginx &> /dev/null; then
    echo -e "${YELLOW}🌐 Проверка Nginx...${NC}"
    if systemctl is-active --quiet nginx; then
        echo -e "${GREEN}✅ Nginx работает${NC}"
        
        # Проверка конфигурации для статических файлов
        if [ -f "/etc/nginx/sites-available/xpanel" ]; then
            echo -e "${GREEN}✅ Конфигурация Nginx для Xpanel найдена${NC}"
        else
            echo -e "${YELLOW}⚠️  Создайте конфигурацию Nginx для лучшей производительности${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️  Nginx не запущен${NC}"
    fi
fi

echo
echo -e "${GREEN}╔══════════════════════════════════════╗${NC}"
echo -e "${GREEN}║        Исправление завершено!        ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════╝${NC}"
echo
echo -e "${BLUE}🌐 Проверьте доступность:${NC}"
echo -e "${YELLOW}  http://64.188.70.12:3001${NC}"
echo -e "${YELLOW}  http://xpanel.xload.ru${NC}"
echo
echo -e "${BLUE}🔧 Полезные команды:${NC}"
echo -e "${YELLOW}  Статус сервиса: systemctl status xpanel${NC}"
echo -e "${YELLOW}  Логи сервиса:   journalctl -u xpanel -f${NC}"
echo -e "${YELLOW}  PM2 статус:     pm2 status${NC}"
echo -e "${YELLOW}  PM2 логи:       pm2 logs xpanel${NC}"
echo
echo -e "${GREEN}🎉 Статические файлы React теперь должны загружаться корректно!${NC}"
