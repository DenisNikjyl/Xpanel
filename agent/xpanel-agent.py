#!/usr/bin/env python3
"""
Xpanel Agent - HTTP сервер для мониторинга и управления VPS серверами
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
import ssl

# Конфигурация
AGENT_VERSION = "1.0.0"
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
    
    def check_alerts(self, stats):
        """Проверяет превышение пороговых значений"""
        alerts = []
        
        if stats['cpu']['percent'] > ALERT_CPU_THRESHOLD:
            alerts.append({
                'type': 'cpu_high',
                'value': stats['cpu']['percent'],
                'threshold': ALERT_CPU_THRESHOLD,
                'message': f"Высокая нагрузка CPU: {stats['cpu']['percent']:.1f}%"
            })
        
        if stats['memory']['percent'] > ALERT_RAM_THRESHOLD:
            alerts.append({
                'type': 'memory_high',
                'value': stats['memory']['percent'],
                'threshold': ALERT_RAM_THRESHOLD,
                'message': f"Высокое использование RAM: {stats['memory']['percent']:.1f}%"
            })
        
        if stats['disk']['percent'] > 90:
            alerts.append({
                'type': 'disk_high',
                'value': stats['disk']['percent'],
                'threshold': 90,
                'message': f"Заканчивается место на диске: {stats['disk']['percent']:.1f}%"
            })
        
        return alerts
    
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
    
    def get_server_info(self):
        """Получение информации о сервере"""
        return {
            'server_id': self.server_id,
            'hostname': socket.gethostname(),
            'platform': os.name,
            'agent_version': AGENT_VERSION,
            'api_port': AGENT_PORT,
            'uptime': time.time() - self.start_time
        }
    
    def get_current_stats(self):
        """Получение текущей статистики (кэшированной)"""
        return self.last_stats
    
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

def install_agent():
    """Установка агента на сервер"""
    print("=== Установка Xpanel Agent ===")
    
    # Создаем директории
    os.makedirs('/etc/xpanel', exist_ok=True)
    os.makedirs('/var/log', exist_ok=True)
    
    # Запрашиваем API ключ
    api_key = input("Введите API ключ от панели управления: ").strip()
    if not api_key:
        print("Ошибка: API ключ не может быть пустым")
        sys.exit(1)
    
    # Сохраняем API ключ
    with open(API_KEY_FILE, 'w') as f:
        f.write(api_key)
    
    os.chmod(API_KEY_FILE, 0o600)
    
    # Создаем systemd сервис
    service_content = f"""[Unit]
Description=Xpanel Agent
After=network.target

[Service]
Type=simple
User=root
ExecStart=/usr/bin/python3 {os.path.abspath(__file__)}
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
"""
    
    with open('/etc/systemd/system/xpanel-agent.service', 'w') as f:
        f.write(service_content)
    
    # Перезагружаем systemd и запускаем сервис
    subprocess.run(['systemctl', 'daemon-reload'])
    subprocess.run(['systemctl', 'enable', 'xpanel-agent'])
    subprocess.run(['systemctl', 'start', 'xpanel-agent'])
    
    print("✅ Xpanel Agent установлен и запущен!")
    print("Проверить статус: systemctl status xpanel-agent")
    print("Логи: journalctl -u xpanel-agent -f")

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "install":
        install_agent()
    else:
        import uuid
        agent = XpanelAgent()
        agent.run()
