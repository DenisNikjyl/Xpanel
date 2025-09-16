#!/bin/bash
# Xpanel Agent Quick Install Script
# Версия: 4.0.0 (Production Ready)

set -e

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Функция для вывода сообщений
log() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Проверка прав root
if [[ $EUID -ne 0 ]]; then
   error "Этот скрипт должен быть запущен с правами root (sudo)"
   exit 1
fi

# Параметры по умолчанию
PANEL_ADDRESS="localhost"
PANEL_PORT="5000"
AGENT_DIR="/opt/xpanel-agent"
SERVICE_NAME="xpanel-agent"

# Обработка аргументов командной строки
while [[ $# -gt 0 ]]; do
    case $1 in
        --panel-address)
            PANEL_ADDRESS="$2"
            shift 2
            ;;
        --panel-port)
            PANEL_PORT="$2"
            shift 2
            ;;
        --help)
            echo "Использование: $0 [опции]"
            echo "Опции:"
            echo "  --panel-address ADDRESS  Адрес панели управления (по умолчанию: localhost)"
            echo "  --panel-port PORT        Порт панели управления (по умолчанию: 5000)"
            echo "  --help                   Показать эту справку"
            exit 0
            ;;
        *)
            error "Неизвестная опция: $1"
            exit 1
            ;;
    esac
done

log "Начинаем установку Xpanel Agent v4.0.0"
log "Панель управления: $PANEL_ADDRESS:$PANEL_PORT"

# Шаг 1: Проверка системы
log "Проверка системных требований..."

# Проверка ОС
if ! command -v systemctl &> /dev/null; then
    error "systemd не найден. Этот агент требует systemd."
    exit 1
fi

# Проверка Python 3
if ! command -v python3 &> /dev/null; then
    error "Python 3 не найден. Устанавливаем..."
    
    # Определяем пакетный менеджер
    if command -v apt-get &> /dev/null; then
        apt-get update -qq
        apt-get install -y python3 python3-pip
    elif command -v yum &> /dev/null; then
        yum install -y python3 python3-pip
    elif command -v dnf &> /dev/null; then
        dnf install -y python3 python3-pip
    else
        error "Неподдерживаемый пакетный менеджер"
        exit 1
    fi
fi

log "Python 3 найден: $(python3 --version)"

# Шаг 2: Установка зависимостей
log "Установка зависимостей Python..."

# Устанавливаем зависимости через pip
python3 -m pip install --upgrade pip
python3 -m pip install requests psutil websocket-client

# Шаг 3: Создание директории агента
log "Создание директории агента..."
mkdir -p "$AGENT_DIR/logs"
chmod 755 "$AGENT_DIR"

# Шаг 4: Создание агента
log "Создание скрипта агента..."

cat > "$AGENT_DIR/xpanel_agent.py" << 'EOF'
#!/usr/bin/env python3
"""
Xpanel Production Agent - Полноценный агент для мониторинга серверов
Версия: 4.0.0 (Production Ready)
"""

import os
import sys
import time
import json
import psutil
import socket
import requests
import subprocess
import threading
import signal
import platform
import logging
from datetime import datetime, timedelta
import argparse
from logging.handlers import RotatingFileHandler
import hashlib
import uuid
import re
from typing import Dict, List, Optional, Any
import sqlite3
from pathlib import Path

class ProductionAgent:
    def __init__(self, panel_address="PANEL_ADDRESS_PLACEHOLDER", panel_port=PANEL_PORT_PLACEHOLDER):
        self.panel_address = panel_address
        self.panel_port = panel_port
        self.server_id = self.generate_server_id()
        self.running = False
        self.heartbeat_interval = 30
        
        # Создаем директории если их нет
        os.makedirs('/opt/xpanel-agent/logs', exist_ok=True)
        
        # Setup logging
        self.setup_logging()
        
        self.logger.info(f"Production Agent v4.0.0 initialized (ID: {self.server_id})")
        
    def generate_server_id(self):
        """Generate unique server ID based on hostname and MAC address"""
        hostname = socket.gethostname()
        try:
            mac = ':'.join(['{:02x}'.format((uuid.getnode() >> elements) & 0xff) 
                           for elements in range(0,2*6,2)][::-1])
            return f"{hostname}-{mac}"
        except:
            return hostname
    
    def setup_logging(self):
        """Setup logging with rotation"""
        log_dir = '/opt/xpanel-agent/logs'
        os.makedirs(log_dir, exist_ok=True)
        
        formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        
        file_handler = RotatingFileHandler(
            f'{log_dir}/agent.log',
            maxBytes=10*1024*1024,
            backupCount=5
        )
        file_handler.setFormatter(formatter)
        
        console_handler = logging.StreamHandler()
        console_handler.setFormatter(formatter)
        
        self.logger = logging.getLogger('ProductionAgent')
        self.logger.setLevel(logging.INFO)
        self.logger.addHandler(file_handler)
        self.logger.addHandler(console_handler)
    
    def get_system_stats(self):
        """Collect comprehensive system statistics"""
        try:
            cpu_percent = psutil.cpu_percent(interval=1, percpu=True)
            cpu_count_logical = psutil.cpu_count(logical=True)
            cpu_count_physical = psutil.cpu_count(logical=False)
            
            memory = psutil.virtual_memory()
            swap = psutil.swap_memory()
            
            disk_usage = {}
            for partition in psutil.disk_partitions():
                try:
                    usage = psutil.disk_usage(partition.mountpoint)
                    disk_usage[partition.mountpoint] = {
                        'device': partition.device,
                        'fstype': partition.fstype,
                        'total': usage.total,
                        'used': usage.used,
                        'free': usage.free,
                        'percent': round((usage.used / usage.total) * 100, 1)
                    }
                except (PermissionError, OSError):
                    continue
            
            network_interfaces = {}
            for interface, stats in psutil.net_io_counters(pernic=True).items():
                network_interfaces[interface] = {
                    'bytes_sent': stats.bytes_sent,
                    'bytes_recv': stats.bytes_recv,
                    'packets_sent': stats.packets_sent,
                    'packets_recv': stats.packets_recv
                }
            
            try:
                load_avg = os.getloadavg()
            except (OSError, AttributeError):
                load_avg = [0, 0, 0]
            
            boot_time = psutil.boot_time()
            uptime = time.time() - boot_time
            process_count = len(psutil.pids())
            
            stats = {
                'server_id': self.server_id,
                'timestamp': datetime.now().isoformat(),
                'hostname': socket.gethostname(),
                'ip_address': self.get_local_ip(),
                'agent_version': '4.0.0',
                'cpu': {
                    'usage': round(sum(cpu_percent) / len(cpu_percent), 1),
                    'usage_per_core': [round(x, 1) for x in cpu_percent],
                    'cores_logical': cpu_count_logical,
                    'cores_physical': cpu_count_physical
                },
                'memory': {
                    'total': memory.total,
                    'available': memory.available,
                    'used': memory.used,
                    'percent': round(memory.percent, 1)
                },
                'swap': {
                    'total': swap.total,
                    'used': swap.used,
                    'free': swap.free,
                    'percent': round(swap.percent, 1)
                },
                'disk': disk_usage,
                'network': {
                    'interfaces': network_interfaces
                },
                'load_average': load_avg,
                'uptime': int(uptime),
                'processes': {
                    'total': process_count
                },
                'system_info': {
                    'platform': platform.system(),
                    'platform_release': platform.release(),
                    'architecture': platform.machine()
                }
            }
            
            return stats
            
        except Exception as e:
            self.logger.error(f"Error collecting system stats: {e}")
            return None
    
    def get_local_ip(self):
        """Get local IP address"""
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            ip = s.getsockname()[0]
            s.close()
            return ip
        except:
            return "127.0.0.1"
    
    def send_heartbeat(self):
        """Send heartbeat with system stats to panel"""
        try:
            stats = self.get_system_stats()
            if not stats:
                return False
            
            url = f"http://{self.panel_address}:{self.panel_port}/api/agent/heartbeat"
            response = requests.post(
                url,
                json=stats,
                timeout=10,
                headers={'Content-Type': 'application/json'}
            )
            
            if response.status_code == 200:
                self.logger.debug("Heartbeat sent successfully")
                return True
            else:
                self.logger.warning(f"Heartbeat failed: {response.status_code}")
                return False
                
        except Exception as e:
            self.logger.error(f"Error sending heartbeat: {e}")
            return False
    
    def register_with_panel(self):
        """Register this agent with the control panel"""
        try:
            server_info = {
                'server_id': self.server_id,
                'hostname': socket.gethostname(),
                'ip_address': self.get_local_ip(),
                'os_info': {
                    'system': platform.system(),
                    'release': platform.release(),
                    'version': platform.version(),
                    'machine': platform.machine(),
                    'processor': platform.processor()
                },
                'agent_version': '4.0.0',
                'timestamp': datetime.now().isoformat()
            }
            
            url = f"http://{self.panel_address}:{self.panel_port}/api/agent/register"
            response = requests.post(
                url,
                json=server_info,
                timeout=10,
                headers={'Content-Type': 'application/json'}
            )
            
            if response.status_code == 200:
                self.logger.info("Successfully registered with control panel")
                return True
            else:
                self.logger.error(f"Registration failed: {response.status_code}")
                return False
                
        except Exception as e:
            self.logger.error(f"Error registering with panel: {e}")
            return False
    
    def heartbeat_loop(self):
        """Main heartbeat loop"""
        while self.running:
            self.send_heartbeat()
            time.sleep(self.heartbeat_interval)
    
    def signal_handler(self, signum, frame):
        """Handle system signals for graceful shutdown"""
        self.logger.info(f"Received signal {signum}, shutting down...")
        self.stop()
    
    def start(self):
        """Start the agent"""
        self.logger.info(f"Starting Production Agent v4.0.0 (ID: {self.server_id})")
        self.logger.info(f"Panel address: {self.panel_address}:{self.panel_port}")
        
        signal.signal(signal.SIGTERM, self.signal_handler)
        signal.signal(signal.SIGINT, self.signal_handler)
        
        if not self.register_with_panel():
            self.logger.warning("Failed to register with panel, continuing anyway...")
        
        self.running = True
        
        heartbeat_thread = threading.Thread(target=self.heartbeat_loop, daemon=True)
        heartbeat_thread.start()
        
        self.logger.info("Agent started successfully")
        
        try:
            while self.running:
                time.sleep(1)
        except KeyboardInterrupt:
            self.logger.info("Received interrupt signal, stopping agent...")
            self.stop()
    
    def stop(self):
        """Stop the agent"""
        self.running = False
        self.logger.info("Agent stopped")

if __name__ == '__main__':
    agent = ProductionAgent()
    agent.start()
EOF

# Заменяем плейсхолдеры на реальные значения
sed -i "s/PANEL_ADDRESS_PLACEHOLDER/$PANEL_ADDRESS/g" "$AGENT_DIR/xpanel_agent.py"
sed -i "s/PANEL_PORT_PLACEHOLDER/$PANEL_PORT/g" "$AGENT_DIR/xpanel_agent.py"

# Делаем исполняемым
chmod +x "$AGENT_DIR/xpanel_agent.py"

# Шаг 5: Создание systemd сервиса
log "Создание systemd сервиса..."

cat > "/etc/systemd/system/$SERVICE_NAME.service" << EOF
[Unit]
Description=Xpanel Server Agent v4.0.0
After=network.target
Wants=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$AGENT_DIR
ExecStart=/usr/bin/python3 $AGENT_DIR/xpanel_agent.py
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# Шаг 6: Запуск сервиса
log "Настройка и запуск сервиса..."

# Перезагружаем systemd
systemctl daemon-reload

# Включаем автозапуск
systemctl enable "$SERVICE_NAME"

# Запускаем сервис
systemctl start "$SERVICE_NAME"

# Проверяем статус
sleep 3
if systemctl is-active --quiet "$SERVICE_NAME"; then
    log "✅ Агент успешно установлен и запущен!"
    log "Статус сервиса: $(systemctl is-active $SERVICE_NAME)"
    log "Логи агента: journalctl -u $SERVICE_NAME -f"
    log "Логи файла: $AGENT_DIR/logs/agent.log"
else
    error "❌ Ошибка запуска агента"
    warn "Проверьте логи: journalctl -u $SERVICE_NAME"
    exit 1
fi

# Показываем информацию
log "Информация об агенте:"
echo "  - Директория: $AGENT_DIR"
echo "  - Сервис: $SERVICE_NAME"
echo "  - Панель: $PANEL_ADDRESS:$PANEL_PORT"
echo "  - Версия: 4.0.0"

log "Установка завершена успешно! 🎉"
