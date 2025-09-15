#!/bin/bash

# Xpanel Agent Auto-Installer v2.0
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
AGENT_VERSION="2.0.0"

echo -e "${BLUE}╔══════════════════════════════════════╗${NC}"
echo -e "${BLUE}║        Xpanel Agent Installer        ║${NC}"
echo -e "${BLUE}║     HTTP агент для мониторинга VPS   ║${NC}"
echo -e "${BLUE}║            Версия 2.0.0              ║${NC}"
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

# Создание директорий
create_directories() {
    echo -e "${YELLOW}📁 Создание директорий...${NC}"
    mkdir -p /etc/xpanel
    mkdir -p ${AGENT_DIR}
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

# Создание агента
create_agent() {
    echo -e "${YELLOW}📝 Создание агента...${NC}"
    
    cat > ${AGENT_DIR}/xpanel-agent.py << 'AGENT_EOF'
#!/usr/bin/env python3
"""
Xpanel Agent v2.0 - HTTP сервер для мониторинга и управления VPS серверами
Работает как HTTP API сервер, принимает подключения от панели управления
"""

import os
import sys
import json
import time
import psutil
import subprocess
import threading
from datetime import datetime
import uuid
import socket
import hashlib
import logging
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

# Конфигурация
AGENT_VERSION = "2.0.0"
AGENT_PORT = 8888  # Порт для HTTP API
ALERT_CPU_THRESHOLD = 80  # %
ALERT_RAM_THRESHOLD = 80  # %
API_KEY_FILE = '/etc/xpanel/api_key'

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/var/log/xpanel-agent.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class XpanelAgentHandler(BaseHTTPRequestHandler):
    """HTTP обработчик для API агента"""
    
    def log_message(self, format, *args):
        """Переопределяем логирование"""
        logger.info(format % args)
    
    def do_GET(self):
        """Обработка GET запросов"""
        parsed_path = urlparse(self.path)
        path = parsed_path.path
        
        # Проверяем авторизацию
        if not self.check_auth():
            return
        
        if path == '/api/stats':
            self.handle_get_stats()
        elif path == '/api/status':
            self.handle_get_status()
        elif path == '/api/info':
            self.handle_get_info()
        else:
            self.send_error(404, 'Endpoint not found')
    
    def do_POST(self):
        """Обработка POST запросов"""
        parsed_path = urlparse(self.path)
        path = parsed_path.path
        
        # Проверяем авторизацию
        if not self.check_auth():
            return
        
        if path == '/api/execute':
            self.handle_execute_command()
        else:
            self.send_error(404, 'Endpoint not found')
    
    def check_auth(self):
        """Проверка API ключа"""
        auth_header = self.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            self.send_error(401, 'Authorization required')
            return False
        
        token = auth_header[7:]  # Убираем 'Bearer '
        expected_key = self.server.agent.api_key
        
        if token != expected_key:
            self.send_error(403, 'Invalid API key')
            return False
        
        return True
    
    def send_json_response(self, data, status=200):
        """Отправка JSON ответа"""
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode('utf-8'))
    
    def handle_get_stats(self):
        """Получение статистики системы"""
        stats = self.server.agent.get_system_stats()
        if stats:
            self.send_json_response(stats)
        else:
            self.send_error(500, 'Failed to collect stats')
    
    def handle_get_status(self):
        """Получение статуса агента"""
        status = {
            'status': 'online',
            'version': AGENT_VERSION,
            'server_id': self.server.agent.server_id,
            'uptime': time.time() - self.server.agent.start_time,
            'last_update': datetime.now().isoformat()
        }
        self.send_json_response(status)
    
    def handle_get_info(self):
        """Получение информации о сервере"""
        info = {
            'hostname': socket.gethostname(),
            'platform': os.name,
            'agent_version': AGENT_VERSION,
            'server_id': self.server.agent.server_id,
            'api_port': AGENT_PORT
        }
        self.send_json_response(info)
    
    def handle_execute_command(self):
        """Выполнение команды"""
        try:
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode('utf-8'))
            
            command = data.get('command')
            if not command:
                self.send_error(400, 'Command is required')
                return
            
            result = self.server.agent.execute_command(command)
            self.send_json_response(result)
            
        except Exception as e:
            logger.error(f"Error executing command: {e}")
            self.send_error(500, f'Command execution failed: {str(e)}')

class XpanelAgent:
    def __init__(self):
        self.server_id = self.get_server_id()
        self.api_key = self.load_api_key()
        self.running = True
        self.start_time = time.time()
        self.last_stats = {}
        self.httpd = None
        
    def get_server_id(self):
        """Генерирует уникальный ID сервера"""
        hostname = socket.gethostname()
        mac = ':'.join(['{:02x}'.format((uuid.getnode() >> elements) & 0xff) 
                       for elements in range(0,2*6,2)][::-1])
        server_id = hashlib.md5(f"{hostname}-{mac}".encode()).hexdigest()[:16]
        return server_id
    
    def load_api_key(self):
        """Загружает API ключ из файла"""
        try:
            with open(API_KEY_FILE, 'r') as f:
                return f.read().strip()
        except FileNotFoundError:
            logger.error("API ключ не найден. Запустите установку агента.")
            sys.exit(1)
    
    def get_system_stats(self):
        """Собирает статистику системы"""
        try:
            # CPU
            cpu_percent = psutil.cpu_percent(interval=1)
            cpu_count = psutil.cpu_count()
            
            # Memory
            memory = psutil.virtual_memory()
            memory_percent = memory.percent
            memory_total = memory.total
            memory_used = memory.used
            
            # Disk
            disk = psutil.disk_usage('/')
            disk_percent = disk.percent
            disk_total = disk.total
            disk_used = disk.used
            
            # Network
            net_io = psutil.net_io_counters()
            
            # Load average
            load_avg = os.getloadavg() if hasattr(os, 'getloadavg') else [0, 0, 0]
            
            # Uptime
            uptime = time.time() - psutil.boot_time()
            
            stats = {
                'timestamp': datetime.now().isoformat(),
                'server_id': self.server_id,
                'cpu': {
                    'percent': cpu_percent,
                    'count': cpu_count,
                    'load_avg': load_avg
                },
                'memory': {
                    'percent': memory_percent,
                    'total': memory_total,
                    'used': memory_used,
                    'available': memory.available
                },
                'disk': {
                    'percent': disk_percent,
                    'total': disk_total,
                    'used': disk_used,
                    'free': disk.free
                },
                'network': {
                    'bytes_sent': net_io.bytes_sent,
                    'bytes_recv': net_io.bytes_recv,
                    'packets_sent': net_io.packets_sent,
                    'packets_recv': net_io.packets_recv
                },
                'uptime': uptime,
                'agent_version': AGENT_VERSION
            }
            
            return stats
            
        except Exception as e:
            logger.error(f"Ошибка сбора статистики: {e}")
            return None
    
    def start_http_server(self):
        """Запуск HTTP сервера"""
        try:
            self.httpd = HTTPServer(('0.0.0.0', AGENT_PORT), XpanelAgentHandler)
            self.httpd.agent = self  # Передаем ссылку на агент
            
            logger.info(f"🚀 Xpanel Agent HTTP Server запущен на порту {AGENT_PORT}")
            logger.info(f"📡 API доступен по адресу: http://0.0.0.0:{AGENT_PORT}/api/")
            
            # Запускаем сервер в отдельном потоке
            server_thread = threading.Thread(target=self.httpd.serve_forever)
            server_thread.daemon = True
            server_thread.start()
            
            return True
            
        except Exception as e:
            logger.error(f"Ошибка запуска HTTP сервера: {e}")
            return False
    
    def stop_http_server(self):
        """Остановка HTTP сервера"""
        if self.httpd:
            logger.info("Остановка HTTP сервера...")
            self.httpd.shutdown()
            self.httpd.server_close()
            self.httpd = None
    
    def execute_command(self, command):
        """Выполняет команду от панели управления"""
        try:
            result = subprocess.run(
                command,
                shell=True,
                capture_output=True,
                text=True,
                timeout=300
            )
            
            return {
                'success': result.returncode == 0,
                'stdout': result.stdout,
                'stderr': result.stderr,
                'returncode': result.returncode
            }
            
        except subprocess.TimeoutExpired:
            return {
                'success': False,
                'stdout': '',
                'stderr': 'Command timeout',
                'returncode': -1
            }
        except Exception as e:
            return {
                'success': False,
                'stdout': '',
                'stderr': str(e),
                'returncode': -1
            }
    
    def run(self):
        """Основной цикл агента"""
        logger.info(f"🚀 Запуск Xpanel Agent v{AGENT_VERSION}")
        logger.info(f"🆔 Server ID: {self.server_id}")
        logger.info(f"🔑 API Key: {'*' * (len(self.api_key) - 4) + self.api_key[-4:]}")
        
        # Запускаем HTTP сервер
        if not self.start_http_server():
            logger.error("Не удалось запустить HTTP сервер")
            return
        
        # Основной цикл для обновления статистики
        while self.running:
            try:
                # Собираем статистику
                stats = self.get_system_stats()
                if stats:
                    self.last_stats = stats
                    logger.debug(f"Статистика обновлена: CPU {stats['cpu']['percent']:.1f}%, RAM {stats['memory']['percent']:.1f}%")
                
                # Ждем следующую итерацию
                time.sleep(30)  # Обновляем статистику каждые 30 секунд
                
            except KeyboardInterrupt:
                logger.info("Получен сигнал остановки")
                self.running = False
            except Exception as e:
                logger.error(f"Ошибка в основном цикле: {e}")
                time.sleep(30)
        
        # Останавливаем HTTP сервер
        self.stop_http_server()
        logger.info("✅ Агент остановлен")

if __name__ == "__main__":
    agent = XpanelAgent()
    agent.run()
AGENT_EOF

    chmod +x ${AGENT_DIR}/xpanel-agent.py
    echo -e "${GREEN}✅ Агент создан${NC}"
}

# Создание systemd сервиса
create_service() {
    echo -e "${YELLOW}⚙️  Создание systemd сервиса...${NC}"
    
    cat > /etc/systemd/system/${SERVICE_NAME}.service << EOF
[Unit]
Description=Xpanel Agent v2.0 - HTTP API Server
After=network.target
Wants=network.target

[Service]
Type=simple
User=root
WorkingDirectory=${AGENT_DIR}
ExecStart=/usr/bin/python3 ${AGENT_DIR}/xpanel-agent.py
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

# Security settings
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ReadWritePaths=${AGENT_DIR} /var/log /etc/xpanel

[Install]
WantedBy=multi-user.target
EOF

    echo -e "${GREEN}✅ Systemd сервис создан${NC}"
}

# Запрос API ключа
request_api_key() {
    echo -e "${BLUE}🔑 Настройка API ключа${NC}"
    echo -e "${YELLOW}Для подключения к панели управления нужен уникальный API ключ${NC}"
    echo -e "${YELLOW}Этот ключ будет использоваться для аутентификации запросов от панели${NC}"
    echo ""
    
    # Генерируем случайный API ключ по умолчанию
    DEFAULT_KEY=$(openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | xxd -p -c 32)
    
    echo -e "${GREEN}Сгенерирован API ключ: ${DEFAULT_KEY}${NC}"
    read -p "Использовать сгенерированный ключ? [Y/n]: " USE_GENERATED
    
    if [[ "$USE_GENERATED" =~ ^[Nn]$ ]]; then
        read -p "Введите свой API ключ: " API_KEY
        if [ -z "$API_KEY" ]; then
            echo -e "${RED}❌ API ключ не может быть пустым${NC}"
            exit 1
        fi
    else
        API_KEY="$DEFAULT_KEY"
    fi
    
    # Сохраняем API ключ
    echo "$API_KEY" > /etc/xpanel/api_key
    chmod 600 /etc/xpanel/api_key
    
    echo -e "${GREEN}✅ API ключ сохранен${NC}"
    echo -e "${BLUE}📋 Скопируйте этот ключ для добавления VPS в панель управления:${NC}"
    echo -e "${YELLOW}${API_KEY}${NC}"
}

# Запуск сервиса
start_service() {
    echo -e "${YELLOW}🚀 Запуск агента...${NC}"
    
    systemctl daemon-reload
    systemctl enable ${SERVICE_NAME}
    systemctl start ${SERVICE_NAME}
    
    # Проверка статуса
    sleep 3
    if systemctl is-active --quiet ${SERVICE_NAME}; then
        echo -e "${GREEN}✅ Xpanel Agent успешно установлен и запущен!${NC}"
        echo ""
        echo -e "${BLUE}📊 Управление сервисом:${NC}"
        echo -e "${YELLOW}  Статус:     systemctl status ${SERVICE_NAME}${NC}"
        echo -e "${YELLOW}  Логи:       journalctl -u ${SERVICE_NAME} -f${NC}"
        echo -e "${YELLOW}  Перезапуск: systemctl restart ${SERVICE_NAME}${NC}"
        echo -e "${YELLOW}  Остановка:  systemctl stop ${SERVICE_NAME}${NC}"
        echo ""
        echo -e "${BLUE}🌐 HTTP API доступен на:${NC}"
        echo -e "${YELLOW}  http://$(hostname -I | awk '{print $1}'):${AGENT_PORT}/api/${NC}"
        echo -e "${YELLOW}  http://localhost:${AGENT_PORT}/api/${NC}"
        echo ""
        echo -e "${GREEN}🎉 Теперь добавьте этот VPS в панель управления используя API ключ выше${NC}"
    else
        echo -e "${RED}❌ Ошибка запуска агента${NC}"
        echo -e "${YELLOW}Проверьте логи: journalctl -u ${SERVICE_NAME}${NC}"
        exit 1
    fi
}

# Основная функция
main() {
    detect_os
    install_dependencies
    create_directories
    configure_firewall
    create_agent
    create_service
    request_api_key
    start_service
}

# Запуск установки
main
