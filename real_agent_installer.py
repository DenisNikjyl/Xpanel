#!/usr/bin/env python3
"""
Real Agent Installer - Реальная установка агента на удаленные серверы
Использует SSH для настоящей установки и настройки агента
"""

import os
import json
import time
import threading
from datetime import datetime
from typing import Dict, List, Optional
import logging
from ssh_manager import ssh_manager

class RealAgentInstaller:
    """Класс для реальной установки агента на серверы"""
    
    def __init__(self, panel_address: str = "localhost", panel_port: int = 5000):
        self.panel_address = panel_address
        self.panel_port = panel_port
        self.logger = logging.getLogger("AgentInstaller")
        
        # Настройка логирования
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
    
    def install_agent(self, server_config: Dict, progress_callback=None) -> Dict:
        """
        Установить агент на сервер
        
        Args:
            server_config: Конфигурация сервера (host, port, username, password/key)
            progress_callback: Функция для отправки прогресса установки
        
        Returns:
            Dict с результатом установки
        """
        host = server_config.get('host')
        port = server_config.get('port', 22)
        username = server_config.get('username')
        password = server_config.get('password')
        key_file = server_config.get('key_file')
        server_name = server_config.get('name', host)
        
        if not all([host, username]):
            return {
                'success': False,
                'error': 'Не указаны обязательные параметры (host, username)'
            }
        
        def send_progress(step: str, progress: int, message: str, command_output: str = None, is_error: bool = False):
            """Отправить прогресс установки с реальными логами"""
            if progress_callback:
                progress_callback({
                    'step': step,
                    'progress': progress,
                    'message': message,
                    'command_output': command_output,
                    'is_error': is_error,
                    'timestamp': datetime.now().isoformat()
                })
            self.logger.info(f"[{progress}%] {step}: {message}")
            if command_output:
                self.logger.debug(f"Command output: {command_output}")
        
        try:
            # Шаг 1: Тестирование соединения
            send_progress("Подключение к серверу", 10, f"Подключение к {username}@{host}:{port}")
            
            connection_test = ssh_manager.test_connection(host, port, username, password, key_file)
            if not connection_test['success']:
                return {
                    'success': False,
                    'error': f"Ошибка подключения: {connection_test['message']}"
                }
            
            send_progress("Подключение к серверу", 15, "SSH соединение установлено", connection_test.get('message', ''))
            
            # Получаем SSH соединение
            conn = ssh_manager.get_connection(f"install-{host}", host, port, username, password, key_file)
            if not conn:
                return {
                    'success': False,
                    'error': 'Не удалось установить SSH соединение'
                }
            
            # Шаг 2: Проверка системных требований
            send_progress("Проверка системы", 20, "Проверка операционной системы и зависимостей")
            
            system_check = conn.execute_command("uname -a && which python3 && which systemctl && python3 --version")
            if not system_check['success']:
                send_progress("Проверка системы", 20, "Ошибка проверки системы", system_check.get('error', ''), True)
                return {
                    'success': False,
                    'error': 'Система не поддерживается (требуется Linux с Python3 и systemd)'
                }
            
            os_info = system_check['output'].split('\n')[0]
            send_progress("Проверка системы", 25, f"Система: {os_info}", system_check['output'])
            
            # Шаг 3: Создание директории агента
            send_progress("Создание директорий", 30, "Создание /opt/xpanel-agent")
            
            create_dir = conn.execute_command("sudo mkdir -p /opt/xpanel-agent && sudo chmod 755 /opt/xpanel-agent && ls -la /opt/")
            if not create_dir['success']:
                send_progress("Создание директорий", 30, "Ошибка создания директории", create_dir.get('error', ''), True)
                return {
                    'success': False,
                    'error': f"Ошибка создания директории: {create_dir['error']}"
                }
            
            send_progress("Создание директорий", 35, "Директория создана", create_dir['output'])
            
            # Шаг 4: Установка зависимостей
            send_progress("Установка зависимостей", 40, "Установка Python пакетов")
            
            # Определяем пакетный менеджер
            pkg_manager_check = conn.execute_command("which apt-get || which yum || which dnf")
            if pkg_manager_check['success']:
                pkg_manager = pkg_manager_check['output'].strip().split('/')[-1]
                
                send_progress("Установка зависимостей", 42, f"Найден пакетный менеджер: {pkg_manager}", pkg_manager_check['output'])
                
                if pkg_manager == 'apt-get':
                    send_progress("Установка зависимостей", 43, "Обновление списка пакетов...")
                    update_result = conn.execute_command("sudo apt-get update -qq", timeout=120)
                    send_progress("Установка зависимостей", 45, "Установка системных пакетов", update_result.get('output', ''))
                    
                    install_deps = conn.execute_command(
                        "sudo apt-get install -y python3-pip python3-requests python3-psutil",
                        timeout=300
                    )
                elif pkg_manager in ['yum', 'dnf']:
                    send_progress("Установка зависимостей", 45, f"Установка пакетов через {pkg_manager}")
                    install_deps = conn.execute_command(
                        f"sudo {pkg_manager} install -y python3-pip python3-requests python3-psutil",
                        timeout=300
                    )
                else:
                    send_progress("Установка зависимостей", 40, "Неподдерживаемый пакетный менеджер", pkg_manager_check['output'], True)
                    return {
                        'success': False,
                        'error': 'Неподдерживаемый пакетный менеджер'
                    }
                
                if install_deps['success']:
                    send_progress("Установка зависимостей", 47, "Системные пакеты установлены", install_deps['output'])
                else:
                    send_progress("Установка зависимостей", 47, "Ошибка установки системных пакетов", install_deps.get('error', ''), True)
                
                # Устанавливаем Python пакеты через pip
                send_progress("Установка зависимостей", 48, "Установка Python пакетов через pip")
                pip_install = conn.execute_command(
                    "sudo python3 -m pip install --upgrade pip && sudo python3 -m pip install requests psutil websocket-client",
                    timeout=180
                )
                
                if pip_install['success']:
                    send_progress("Установка зависимостей", 50, "Python пакеты установлены", pip_install['output'])
                else:
                    send_progress("Установка зависимостей", 50, "Предупреждение: ошибка установки Python пакетов", pip_install.get('error', ''), True)
            else:
                send_progress("Установка зависимостей", 50, "Пакетный менеджер не найден, пропускаем установку зависимостей", "", True)
            
            # Шаг 5: Создание агента
            send_progress("Создание агента", 60, "Создание скрипта агента")
            
            agent_script = self._generate_agent_script()
            
            # Создаем временный файл для агента
            temp_script = f"/tmp/xpanel_agent_{int(time.time())}.py"
            
            # Записываем агент через echo (избегаем проблем с SFTP)
            send_progress("Создание агента", 62, "Запись файла агента на сервер")
            write_agent = conn.execute_command(f"""
cat > {temp_script} << 'AGENT_EOF'
{agent_script}
AGENT_EOF
""", timeout=30)
            
            if not write_agent['success']:
                send_progress("Создание агента", 62, "Ошибка записи файла агента", write_agent.get('error', ''), True)
                return {
                    'success': False,
                    'error': f"Ошибка создания агента: {write_agent['error']}"
                }
            
            send_progress("Создание агента", 65, "Файл агента записан", write_agent.get('output', ''))
            
            # Перемещаем агент в целевую директорию
            send_progress("Создание агента", 67, "Установка агента в /opt/xpanel-agent/")
            move_agent = conn.execute_command(f"sudo mv {temp_script} /opt/xpanel-agent/agent.py && sudo chmod +x /opt/xpanel-agent/agent.py && ls -la /opt/xpanel-agent/")
            if not move_agent['success']:
                send_progress("Создание агента", 67, "Ошибка установки агента", move_agent.get('error', ''), True)
                return {
                    'success': False,
                    'error': f"Ошибка установки агента: {move_agent['error']}"
                }
            
            send_progress("Создание агента", 70, "Агент создан и установлен", move_agent['output'])
            
            # Шаг 6: Создание systemd сервиса
            send_progress("Настройка сервиса", 75, "Создание systemd сервиса")
            
            service_content = self._generate_service_file()
            service_lines = service_content.split('\n')
            
            # Создаем сервис
            service_file = "/tmp/xpanel-agent.service"
            conn.execute_command(f"sudo rm -f {service_file}")
            
            for i, line in enumerate(service_lines):
                escaped_line = line.replace('"', '\\"')
                if i == 0:
                    conn.execute_command(f'echo "{escaped_line}" | sudo tee {service_file} > /dev/null')
                else:
                    conn.execute_command(f'echo "{escaped_line}" | sudo tee -a {service_file} > /dev/null')
            
            # Устанавливаем сервис
            send_progress("Настройка сервиса", 77, "Установка systemd сервиса")
            install_service = conn.execute_command(f"sudo mv {service_file} /etc/systemd/system/xpanel-agent.service && ls -la /etc/systemd/system/xpanel-agent.service")
            if not install_service['success']:
                send_progress("Настройка сервиса", 77, "Ошибка установки сервиса", install_service.get('error', ''), True)
                return {
                    'success': False,
                    'error': f"Ошибка установки сервиса: {install_service['error']}"
                }
            
            send_progress("Настройка сервиса", 78, "Сервис установлен", install_service['output'])
            
            # Перезагружаем systemd
            send_progress("Настройка сервиса", 79, "Перезагрузка systemd daemon")
            reload_result = conn.execute_command("sudo systemctl daemon-reload")
            
            send_progress("Настройка сервиса", 80, "Сервис создан", reload_result.get('output', ''))
            
            # Шаг 7: Запуск агента
            send_progress("Запуск агента", 85, "Включение и запуск сервиса")
            
            # Включаем автозапуск
            enable_service = conn.execute_command("sudo systemctl enable xpanel-agent")
            if not enable_service['success']:
                send_progress("Запуск агента", 85, "Предупреждение: не удалось включить автозапуск", enable_service.get('error', ''), True)
            else:
                send_progress("Запуск агента", 87, "Автозапуск включен", enable_service['output'])
            
            # Запускаем сервис
            send_progress("Запуск агента", 88, "Запуск сервиса xpanel-agent")
            start_service = conn.execute_command("sudo systemctl start xpanel-agent")
            if not start_service['success']:
                send_progress("Запуск агента", 88, "Ошибка запуска агента", start_service.get('error', ''), True)
                return {
                    'success': False,
                    'error': f"Ошибка запуска агента: {start_service['error']}"
                }
            
            send_progress("Запуск агента", 90, "Агент запущен", start_service.get('output', ''))
            
            # Шаг 8: Проверка статуса
            send_progress("Проверка установки", 95, "Проверка работы агента")
            
            # Ждем немного для запуска
            time.sleep(3)
            
            status_check = conn.execute_command("sudo systemctl is-active xpanel-agent")
            if status_check['success'] and 'active' in status_check['output']:
                # Получаем дополнительную информацию
                info_check = conn.execute_command("sudo systemctl status xpanel-agent --no-pager -l && sudo journalctl -u xpanel-agent --no-pager -n 5")
                send_progress("Проверка установки", 100, "Агент успешно установлен и запущен", info_check.get('output', ''))
                
                return {
                    'success': True,
                    'message': 'Агент успешно установлен и запущен',
                    'server_info': {
                        'host': host,
                        'name': server_name,
                        'os': os_info,
                        'status': 'active'
                    },
                    'service_status': info_check['output'] if info_check['success'] else None
                }
            else:
                # Получаем логи для диагностики
                logs = conn.execute_command("sudo journalctl -u xpanel-agent --no-pager -n 20")
                
                return {
                    'success': False,
                    'error': 'Агент установлен, но не запущен',
                    'logs': logs['output'] if logs['success'] else None
                }
                
        except Exception as e:
            self.logger.error(f"Ошибка установки агента: {e}")
            return {
                'success': False,
                'error': f'Неожиданная ошибка: {str(e)}'
            }
        finally:
            # Закрываем соединение
            ssh_manager.close_connection(f"install-{host}")
    
    def _generate_agent_script(self) -> str:
        """Генерировать скрипт production агента"""
        # Читаем содержимое production агента
        try:
            production_agent_path = os.path.join(os.path.dirname(__file__), 'agent', 'production_agent.py')
            if os.path.exists(production_agent_path):
                with open(production_agent_path, 'r', encoding='utf-8') as f:
                    agent_content = f.read()
                
                # Заменяем адрес панели в коде
                agent_content = agent_content.replace(
                    'panel_address="localhost"', 
                    f'panel_address="{self.panel_address}"'
                )
                agent_content = agent_content.replace(
                    'panel_port=5000', 
                    f'panel_port={self.panel_port}'
                )
                
                return agent_content
        except Exception as e:
            self.logger.error(f"Ошибка чтения production агента: {e}")
        
        # Fallback к упрощенной версии агента
        agent_template = '''#!/usr/bin/env python3
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
    def __init__(self, panel_address="{panel_address}", panel_port={panel_port}):
        self.panel_address = panel_address
        self.panel_port = panel_port
        self.server_id = self.generate_server_id()
        self.running = False
        self.heartbeat_interval = 30
        
        # Создаем директории если их нет
        os.makedirs('/opt/xpanel-agent/logs', exist_ok=True)
        
        # Setup logging
        self.setup_logging()
        
        self.logger.info(f"Production Agent v4.0.0 initialized (ID: {{self.server_id}})")
        
    def generate_server_id(self):
        """Generate unique server ID based on hostname and MAC address"""
        hostname = socket.gethostname()
        try:
            mac = ':'.join(['{{:02x}}'.format((uuid.getnode() >> elements) & 0xff) 
                           for elements in range(0,2*6,2)][::-1])
            return f"{{hostname}}-{{mac}}"
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
            f'{{log_dir}}/agent.log',
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
            
            disk_usage = {{}}
            for partition in psutil.disk_partitions():
                try:
                    usage = psutil.disk_usage(partition.mountpoint)
                    disk_usage[partition.mountpoint] = {{
                        'device': partition.device,
                        'fstype': partition.fstype,
                        'total': usage.total,
                        'used': usage.used,
                        'free': usage.free,
                        'percent': round((usage.used / usage.total) * 100, 1)
                    }}
                except (PermissionError, OSError):
                    continue
            
            network_interfaces = {{}}
            for interface, stats in psutil.net_io_counters(pernic=True).items():
                network_interfaces[interface] = {{
                    'bytes_sent': stats.bytes_sent,
                    'bytes_recv': stats.bytes_recv,
                    'packets_sent': stats.packets_sent,
                    'packets_recv': stats.packets_recv
                }}
            
            try:
                load_avg = os.getloadavg()
            except (OSError, AttributeError):
                load_avg = [0, 0, 0]
            
            boot_time = psutil.boot_time()
            uptime = time.time() - boot_time
            process_count = len(psutil.pids())
            
            stats = {{
                'server_id': self.server_id,
                'timestamp': datetime.now().isoformat(),
                'hostname': socket.gethostname(),
                'ip_address': self.get_local_ip(),
                'agent_version': '4.0.0',
                'cpu': {{
                    'usage': round(sum(cpu_percent) / len(cpu_percent), 1),
                    'usage_per_core': [round(x, 1) for x in cpu_percent],
                    'cores_logical': cpu_count_logical,
                    'cores_physical': cpu_count_physical
                }},
                'memory': {{
                    'total': memory.total,
                    'available': memory.available,
                    'used': memory.used,
                    'percent': round(memory.percent, 1)
                }},
                'swap': {{
                    'total': swap.total,
                    'used': swap.used,
                    'free': swap.free,
                    'percent': round(swap.percent, 1)
                }},
                'disk': disk_usage,
                'network': {{
                    'interfaces': network_interfaces
                }},
                'load_average': load_avg,
                'uptime': int(uptime),
                'processes': {{
                    'total': process_count
                }},
                'system_info': {{
                    'platform': platform.system(),
                    'platform_release': platform.release(),
                    'architecture': platform.machine()
                }}
            }}
            
            return stats
            
        except Exception as e:
            self.logger.error(f"Error collecting system stats: {{e}}")
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
            
            url = f"http://{{self.panel_address}}:{{self.panel_port}}/api/agent/heartbeat"
            response = requests.post(
                url,
                json=stats,
                timeout=10,
                headers={{'Content-Type': 'application/json'}}
            )
            
            if response.status_code == 200:
                self.logger.debug("Heartbeat sent successfully")
                return True
            else:
                self.logger.warning(f"Heartbeat failed: {{response.status_code}}")
                return False
                
        except Exception as e:
            self.logger.error(f"Error sending heartbeat: {{e}}")
            return False
    
    def register_with_panel(self):
        """Register this agent with the control panel"""
        try:
            server_info = {{
                'server_id': self.server_id,
                'hostname': socket.gethostname(),
                'ip_address': self.get_local_ip(),
                'os_info': {{
                    'system': platform.system(),
                    'release': platform.release(),
                    'version': platform.version(),
                    'machine': platform.machine(),
                    'processor': platform.processor()
                }},
                'agent_version': '4.0.0',
                'timestamp': datetime.now().isoformat()
            }}
            
            url = f"http://{{self.panel_address}}:{{self.panel_port}}/api/agent/register"
            response = requests.post(
                url,
                json=server_info,
                timeout=10,
                headers={{'Content-Type': 'application/json'}}
            )
            
            if response.status_code == 200:
                self.logger.info("Successfully registered with control panel")
                return True
            else:
                self.logger.error(f"Registration failed: {{response.status_code}}")
                return False
                
        except Exception as e:
            self.logger.error(f"Error registering with panel: {{e}}")
            return False
    
    def heartbeat_loop(self):
        """Main heartbeat loop"""
        while self.running:
            self.send_heartbeat()
            time.sleep(self.heartbeat_interval)
    
    def signal_handler(self, signum, frame):
        """Handle system signals for graceful shutdown"""
        self.logger.info(f"Received signal {{signum}}, shutting down...")
        self.stop()
    
    def start(self):
        """Start the agent"""
        self.logger.info(f"Starting Production Agent v4.0.0 (ID: {{self.server_id}})")
        self.logger.info(f"Panel address: {{self.panel_address}}:{{self.panel_port}}")
        
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
'''
        
        return agent_template.format(
            panel_address=self.panel_address,
            panel_port=self.panel_port
        )
    
    def _generate_service_file(self) -> str:
        """Генерировать файл systemd сервиса"""
        return '''[Unit]
Description=Xpanel Server Agent
After=network.target
Wants=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/xpanel-agent
ExecStart=/usr/bin/python3 /opt/xpanel-agent/xpanel_agent.py
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
'''

# Глобальный экземпляр установщика
real_installer = RealAgentInstaller()
