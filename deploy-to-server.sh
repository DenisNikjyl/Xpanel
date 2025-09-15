#!/bin/bash

# Xpanel Deployment Script
# Скрипт для развертывания на удаленный сервер

set -e

# Цвета
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Конфигурация (измените под ваш сервер)
SERVER_IP="64.188.70.12"
SERVER_USER="root"
PROJECT_NAME="xpanel"

echo -e "${BLUE}╔══════════════════════════════════════╗${NC}"
echo -e "${BLUE}║        Xpanel Deployment Tool        ║${NC}"
echo -e "${BLUE}║     Развертывание на сервер Linux    ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════╝${NC}"
echo

# Проверка подключения к серверу
check_server_connection() {
    echo -e "${YELLOW}🔍 Проверка подключения к серверу...${NC}"
    
    if ssh -o ConnectTimeout=10 ${SERVER_USER}@${SERVER_IP} "echo 'Connection OK'" >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Подключение к серверу установлено${NC}"
    else
        echo -e "${RED}❌ Не удается подключиться к серверу${NC}"
        echo -e "${YELLOW}Проверьте:${NC}"
        echo -e "${YELLOW}  - IP адрес: ${SERVER_IP}${NC}"
        echo -e "${YELLOW}  - SSH ключи${NC}"
        echo -e "${YELLOW}  - Доступность сервера${NC}"
        exit 1
    fi
}

# Создание архива проекта
create_project_archive() {
    echo -e "${YELLOW}📦 Создание архива проекта...${NC}"
    
    # Исключаем ненужные файлы и папки
    tar --exclude='node_modules' \
        --exclude='client/node_modules' \
        --exclude='client/build' \
        --exclude='.git' \
        --exclude='*.log' \
        --exclude='*.tmp' \
        --exclude='deploy-to-server.sh' \
        -czf ${PROJECT_NAME}.tar.gz .
    
    echo -e "${GREEN}✅ Архив создан: ${PROJECT_NAME}.tar.gz${NC}"
}

# Загрузка на сервер
upload_to_server() {
    echo -e "${YELLOW}⬆️  Загрузка на сервер...${NC}"
    
    # Загружаем архив
    scp ${PROJECT_NAME}.tar.gz ${SERVER_USER}@${SERVER_IP}:/tmp/
    
    # Загружаем скрипт сборки
    scp build-linux.sh ${SERVER_USER}@${SERVER_IP}:/tmp/
    
    echo -e "${GREEN}✅ Файлы загружены на сервер${NC}"
}

# Развертывание на сервере
deploy_on_server() {
    echo -e "${YELLOW}🚀 Развертывание на сервере...${NC}"
    
    ssh ${SERVER_USER}@${SERVER_IP} << 'ENDSSH'
        set -e
        
        echo "📁 Создание рабочей директории..."
        mkdir -p /tmp/xpanel-deploy
        cd /tmp/xpanel-deploy
        
        echo "📦 Распаковка архива..."
        tar -xzf /tmp/xpanel.tar.gz
        
        echo "🔧 Запуск сборки..."
        chmod +x /tmp/build-linux.sh
        /tmp/build-linux.sh
        
        echo "🧹 Очистка временных файлов..."
        rm -rf /tmp/xpanel-deploy
        rm -f /tmp/xpanel.tar.gz
        rm -f /tmp/build-linux.sh
        
        echo "✅ Развертывание завершено!"
ENDSSH
    
    echo -e "${GREEN}✅ Развертывание на сервере завершено${NC}"
}

# Проверка статуса после развертывания
check_deployment_status() {
    echo -e "${YELLOW}🔍 Проверка статуса развертывания...${NC}"
    
    sleep 5
    
    # Проверяем статус сервиса
    if ssh ${SERVER_USER}@${SERVER_IP} "systemctl is-active --quiet xpanel"; then
        echo -e "${GREEN}✅ Сервис Xpanel запущен${NC}"
    else
        echo -e "${RED}❌ Сервис Xpanel не запущен${NC}"
        echo -e "${YELLOW}Логи сервиса:${NC}"
        ssh ${SERVER_USER}@${SERVER_IP} "journalctl -u xpanel -n 10 --no-pager"
        exit 1
    fi
    
    # Проверяем Nginx
    if ssh ${SERVER_USER}@${SERVER_IP} "systemctl is-active --quiet nginx"; then
        echo -e "${GREEN}✅ Nginx запущен${NC}"
    else
        echo -e "${RED}❌ Nginx не запущен${NC}"
        exit 1
    fi
    
    # Проверяем доступность сайта
    if ssh ${SERVER_USER}@${SERVER_IP} "curl -s -o /dev/null -w '%{http_code}' http://localhost:3001" | grep -q "200"; then
        echo -e "${GREEN}✅ Сайт доступен${NC}"
    else
        echo -e "${YELLOW}⚠️  Сайт может быть недоступен${NC}"
    fi
}

# Показать финальную информацию
show_final_info() {
    echo
    echo -e "${GREEN}╔══════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║       Развертывание завершено!       ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════╝${NC}"
    echo
    echo -e "${BLUE}🌐 Доступ к панели:${NC}"
    echo -e "${YELLOW}  https://xpanel.xload.ru${NC}"
    echo -e "${YELLOW}  http://${SERVER_IP}:3001${NC}"
    echo
    echo -e "${BLUE}🔧 Полезные команды на сервере:${NC}"
    echo -e "${YELLOW}  ssh ${SERVER_USER}@${SERVER_IP}${NC}"
    echo -e "${YELLOW}  systemctl status xpanel${NC}"
    echo -e "${YELLOW}  journalctl -u xpanel -f${NC}"
    echo -e "${YELLOW}  /root/monitor-xpanel.sh${NC}"
    echo
}

# Очистка локальных файлов
cleanup() {
    echo -e "${YELLOW}🧹 Очистка временных файлов...${NC}"
    rm -f ${PROJECT_NAME}.tar.gz
    echo -e "${GREEN}✅ Очистка завершена${NC}"
}

# Основная функция
main() {
    check_server_connection
    create_project_archive
    upload_to_server
    deploy_on_server
    check_deployment_status
    show_final_info
    cleanup
}

# Обработка прерывания
trap cleanup EXIT

# Запуск развертывания
main
