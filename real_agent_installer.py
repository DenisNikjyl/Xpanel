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
        
        def send_progress(step: str, progress: int, message: str):
            """Отправить прогресс установки"""
            if progress_callback:
                progress_callback({
                    'step': step,
                    'progress': progress,
                    'message': message,
                    'timestamp': datetime.now().isoformat()
                })
            self.logger.info(f"[{progress}%] {step}: {message}")
        
        try:
            # Шаг 1: Тестирование соединения
            send_progress("Подключение к серверу", 10, f"Подключение к {username}@{host}:{port}")
            
            connection_test = ssh_manager.test_connection(host, port, username, password, key_file)
            if not connection_test['success']:
                return {
                    'success': False,
                    'error': f"Ошибка подключения: {connection_test['message']}"
                }
            
            send_progress("Подключение к серверу", 15, "SSH соединение установлено")
            
            # Получаем SSH соединение
            conn = ssh_manager.get_connection(f"install-{host}", host, port, username, password, key_file)
            if not conn:
                return {
                    'success': False,
                    'error': 'Не удалось установить SSH соединение'
                }
            
            # Шаг 2: Проверка системных требований
            send_progress("Проверка системы", 20, "Проверка операционной системы и зависимостей")
            
            system_check = conn.execute_command("uname -s && which python3 && which systemctl")
            if not system_check['success']:
                return {
                    'success': False,
                    'error': 'Система не поддерживается (требуется Linux с Python3 и systemd)'
                }
            
            os_info = system_check['output'].split('\n')[0]
            send_progress("Проверка системы", 25, f"Система: {os_info}")
            
            # Шаг 3: Создание директории агента
            send_progress("Создание директорий", 30, "Создание /opt/xpanel-agent")
            
            create_dir = conn.execute_command("sudo mkdir -p /opt/xpanel-agent && sudo chmod 755 /opt/xpanel-agent")
            if not create_dir['success']:
                return {
                    'success': False,
                    'error': f"Ошибка создания директории: {create_dir['error']}"
                }
            
            # Шаг 4: Установка зависимостей
            send_progress("Установка зависимостей", 40, "Установка Python пакетов")
            
            # Определяем пакетный менеджер
            pkg_manager_check = conn.execute_command("which apt-get || which yum || which dnf")
            if pkg_manager_check['success']:
                pkg_manager = pkg_manager_check['output'].strip().split('/')[-1]
                
                if pkg_manager == 'apt-get':
                    install_deps = conn.execute_command(
                        "sudo apt-get update -qq && sudo apt-get install -y python3-pip python3-requests python3-psutil",
                        timeout=300
                    )
                elif pkg_manager in ['yum', 'dnf']:
                    install_deps = conn.execute_command(
                        f"sudo {pkg_manager} install -y python3-pip python3-requests python3-psutil",
                        timeout=300
                    )
                else:
                    return {
                        'success': False,
                        'error': 'Неподдерживаемый пакетный менеджер'
                    }
                
                if not install_deps['success']:
                    # Пробуем через pip
                    pip_install = conn.execute_command(
                        "sudo python3 -m pip install requests psutil",
                        timeout=180
                    )
                    if not pip_install['success']:
                        send_progress("Установка зависимостей", 45, "Предупреждение: некоторые зависимости могут отсутствовать")
            
            send_progress("Установка зависимостей", 50, "Зависимости установлены")
            
            # Шаг 5: Создание агента
            send_progress("Создание агента", 60, "Создание скрипта агента")
            
            agent_script = self._generate_agent_script()
            
            # Создаем временный файл для агента
            temp_script = f"/tmp/xpanel_agent_{int(time.time())}.py"
            
            # Записываем агент через echo (избегаем проблем с SFTP)
            agent_lines = agent_script.split('\n')
            
            # Очищаем файл
            conn.execute_command(f"sudo rm -f {temp_script}")
            
            # Записываем агент по частям
            for i, line in enumerate(agent_lines):
                escaped_line = line.replace('"', '\\"').replace('$', '\\$').replace('`', '\\`')
                if i == 0:
                    conn.execute_command(f'echo "{escaped_line}" | sudo tee {temp_script} > /dev/null')
                else:
                    conn.execute_command(f'echo "{escaped_line}" | sudo tee -a {temp_script} > /dev/null')
            
            # Перемещаем агент в целевую директорию
            move_agent = conn.execute_command(f"sudo mv {temp_script} /opt/xpanel-agent/xpanel_agent.py")
            if not move_agent['success']:
                return {
                    'success': False,
                    'error': f"Ошибка создания агента: {move_agent['error']}"
                }
            
            # Делаем исполняемым
            conn.execute_command("sudo chmod +x /opt/xpanel-agent/xpanel_agent.py")
            
            send_progress("Создание агента", 70, "Агент создан")
            
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
            install_service = conn.execute_command(f"sudo mv {service_file} /etc/systemd/system/xpanel-agent.service")
            if not install_service['success']:
                return {
                    'success': False,
                    'error': f"Ошибка установки сервиса: {install_service['error']}"
                }
            
            # Перезагружаем systemd
            conn.execute_command("sudo systemctl daemon-reload")
            
            send_progress("Настройка сервиса", 80, "Сервис создан")
            
            # Шаг 7: Запуск агента
            send_progress("Запуск агента", 85, "Включение и запуск сервиса")
            
            # Включаем автозапуск
            enable_service = conn.execute_command("sudo systemctl enable xpanel-agent")
            if not enable_service['success']:
                self.logger.warning(f"Не удалось включить автозапуск: {enable_service['error']}")
            
            # Запускаем сервис
            start_service = conn.execute_command("sudo systemctl start xpanel-agent")
            if not start_service['success']:
                return {
                    'success': False,
                    'error': f"Ошибка запуска агента: {start_service['error']}"
                }
            
            send_progress("Запуск агента", 90, "Агент запущен")
            
            # Шаг 8: Проверка статуса
            send_progress("Проверка установки", 95, "Проверка работы агента")
            
            # Ждем немного для запуска
            time.sleep(3)
            
            status_check = conn.execute_command("sudo systemctl is-active xpanel-agent")
            if status_check['success'] and 'active' in status_check['output']:
                send_progress("Проверка установки", 100, "Агент успешно установлен и запущен")
                
                # Получаем дополнительную информацию
                info_check = conn.execute_command("sudo systemctl status xpanel-agent --no-pager -l")
                
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
        """Генерировать скрипт агента"""
        # Используем обычную строку с .format() вместо f-string чтобы избежать конфликтов
        agent_template = '''#!/usr/bin/env python3
"""
Xpanel Agent - Агент для мониторинга сервера
Версия: 2.0.0 (Реальная)
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
import logging
from datetime import datetime

class XpanelAgent:
    def __init__(self):
        self.panel_address = "{panel_address}"
        self.panel_port = {panel_port}
        self.server_id = self.generate_server_id()
        self.running = False
        self.heartbeat_interval = 30
        
        # Настройка логирования
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler('/opt/xpanel-agent/agent.log'),
                logging.StreamHandler()
            ]
        )
        self.logger = logging.getLogger(__name__)
        
    def generate_server_id(self):
        """Генерировать уникальный ID сервера"""
        hostname = socket.gethostname()
        try:
            import uuid
            mac = ':'.join(['{{:02x}}'.format((uuid.getnode() >> elements) & 0xff) 
                           for elements in range(0,2*6,2)][::-1])
            return f"{{hostname}}-{{mac}}"
        except:
            return hostname
    
    def get_system_stats(self):
        """Получить статистику системы"""
        try:
            # CPU
            cpu_percent = psutil.cpu_percent(interval=1)
            cpu_count = psutil.cpu_count()
            
            # Память
            memory = psutil.virtual_memory()
            
            # Диск
            disk = psutil.disk_usage('/')
            
            # Сеть
            network = psutil.net_io_counters()
            
            # Загрузка системы
            try:
                load_avg = os.getloadavg()
            except:
                load_avg = [0, 0, 0]
            
            # Время работы
            boot_time = psutil.boot_time()
            uptime = time.time() - boot_time
            
            # Процессы
            process_count = len(psutil.pids())
            
            stats = {{
                'server_id': self.server_id,
                'timestamp': datetime.now().isoformat(),
                'hostname': socket.gethostname(),
                'ip_address': self.get_local_ip(),
                'cpu': {{
                    'usage': round(cpu_percent, 1),
                    'cores': cpu_count
                }},
                'memory': {{
                    'total': memory.total,
                    'available': memory.available,
                    'used': memory.used,
                    'percent': round(memory.percent, 1)
                }},
                'disk': {{
                    'total': disk.total,
                    'used': disk.used,
                    'free': disk.free,
                    'percent': round((disk.used / disk.total) * 100, 1)
                }},
                'network': {{
                    'bytes_sent': network.bytes_sent,
                    'bytes_recv': network.bytes_recv,
                    'packets_sent': network.packets_sent,
                    'packets_recv': network.packets_recv
                }},
                'load_average': load_avg,
                'uptime': int(uptime),
                'processes': process_count,
                'agent_version': '2.0.0'
            }}
            
            return stats
        except Exception as e:
            self.logger.error(f"Ошибка сбора статистики: {{e}}")
            return None
    
    def get_local_ip(self):
        """Получить локальный IP адрес"""
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            ip = s.getsockname()[0]
            s.close()
            return ip
        except:
            return "127.0.0.1"
    
    def send_heartbeat(self):
        """Отправить heartbeat на панель"""
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
                self.logger.debug("Heartbeat отправлен успешно")
                return True
            else:
                self.logger.warning(f"Ошибка heartbeat: {{response.status_code}}")
                return False
                
        except requests.exceptions.RequestException as e:
            self.logger.error(f"Ошибка сети при отправке heartbeat: {{e}}")
            return False
        except Exception as e:
            self.logger.error(f"Ошибка отправки heartbeat: {{e}}")
            return False
    
    def register_with_panel(self):
        """Регистрация агента на панели"""
        try:
            server_info = {{
                'server_id': self.server_id,
                'hostname': socket.gethostname(),
                'ip_address': self.get_local_ip(),
                'agent_version': '2.0.0',
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
                self.logger.info("Успешная регистрация на панели")
                return True
            else:
                self.logger.error(f"Ошибка регистрации: {{response.status_code}}")
                return False
                
        except Exception as e:
            self.logger.error(f"Ошибка регистрации: {{e}}")
            return False
    
    def heartbeat_loop(self):
        """Основной цикл heartbeat"""
        while self.running:
            self.send_heartbeat()
            time.sleep(self.heartbeat_interval)
    
    def start(self):
        """Запустить агент"""
        self.logger.info(f"Запуск Xpanel Agent (ID: {{self.server_id}})")
        self.logger.info(f"Панель: {{self.panel_address}}:{{self.panel_port}}")
        
        # Регистрация
        if not self.register_with_panel():
            self.logger.warning("Не удалось зарегистрироваться на панели, продолжаем...")
        
        self.running = True
        
        # Запуск потока heartbeat
        heartbeat_thread = threading.Thread(target=self.heartbeat_loop, daemon=True)
        heartbeat_thread.start()
        
        self.logger.info("Агент запущен успешно")
        
        try:
            while self.running:
                time.sleep(1)
        except KeyboardInterrupt:
            self.logger.info("Получен сигнал остановки...")
            self.stop()
    
    def stop(self):
        """Остановить агент"""
        self.running = False
        self.logger.info("Агент остановлен")

if __name__ == '__main__':
    agent = XpanelAgent()
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
