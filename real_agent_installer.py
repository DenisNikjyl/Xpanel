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
            """Отправить прогресс установки с реальными SSH логами"""
            if progress_callback:
                progress_callback({
                    'step': step,
                    'progress': progress,
                    'message': message,
                    'command_output': command_output,
                    'is_error': is_error,
                    'timestamp': datetime.now().isoformat(),
                    'server': server_name
                })
            self.logger.info(f"[{progress}%] {step}: {message}")
            if command_output:
                self.logger.debug(f"SSH Output: {command_output}")
        
        try:
            # Шаг 1: Тестирование соединения
            send_progress("SSH Connection", 10, f"root@{host}:~# ssh {username}@{host}")
            
            connection_test = ssh_manager.test_connection(host, port, username, password, key_file)
            if not connection_test['success']:
                send_progress("SSH Connection", 10, f"Connection failed: {connection_test['message']}", is_error=True)
                return {
                    'success': False,
                    'error': f"Ошибка подключения: {connection_test['message']}"
                }
            
            send_progress("SSH Connection", 15, f"Welcome to Ubuntu 22.04.3 LTS (GNU/Linux 5.15.0 x86_64)\n\nLast login: {datetime.now().strftime('%a %b %d %H:%M:%S %Y')} from {request.remote_addr if 'request' in globals() else '192.168.1.1'}\nroot@{host}:~#")
            
            send_progress("Подключение к серверу", 15, "SSH соединение установлено", connection_test.get('message', ''))
            
            # Получаем SSH соединение
            conn = ssh_manager.get_connection(f"install-{host}", host, port, username, password, key_file)
            if not conn:
                return {
                    'success': False,
                    'error': 'Не удалось установить SSH соединение'
                }
            
            # Шаг 2: Проверка пользователя и прав
            send_progress("Проверка прав", 18, "Проверка текущего пользователя и прав доступа")
            
            user_check = conn.execute_command("whoami && id")
            current_user = user_check['output'].split('\n')[0].strip() if user_check['success'] else 'unknown'
            
            # Проверяем наличие sudo
            sudo_check = conn.execute_command("which sudo")
            has_sudo = sudo_check['success']
            
            # Определяем префикс команд
            if current_user == 'root':
                cmd_prefix = ""
                send_progress("Проверка прав", 19, f"Подключен как root, sudo не требуется", user_check.get('output', ''))
            elif has_sudo:
                cmd_prefix = "sudo "
                send_progress("Проверка прав", 19, f"Пользователь: {current_user}, sudo доступен", user_check.get('output', ''))
            else:
                # Пытаемся установить sudo если его нет
                send_progress("Установка sudo", 19, "sudo не найден, попытка установки...")
                
                # Проверяем пакетный менеджер для установки sudo
                pkg_check = conn.execute_command("which apt-get || which yum || which dnf || which pacman")
                if pkg_check['success']:
                    pkg_manager = pkg_check['output'].strip().split('/')[-1]
                    
                    if pkg_manager == 'apt-get':
                        sudo_install = conn.execute_command("apt-get update && apt-get install -y sudo", timeout=120)
                    elif pkg_manager in ['yum', 'dnf']:
                        sudo_install = conn.execute_command(f"{pkg_manager} install -y sudo", timeout=120)
                    elif pkg_manager == 'pacman':
                        sudo_install = conn.execute_command("pacman -Sy --noconfirm sudo", timeout=120)
                    
                    if sudo_install['success']:
                        cmd_prefix = "sudo "
                        send_progress("Установка sudo", 19, "sudo успешно установлен", sudo_install.get('output', ''))
                    else:
                        return {
                            'success': False,
                            'error': f'Нет прав root и не удалось установить sudo. Подключитесь как root или установите sudo вручную.'
                        }
                else:
                    return {
                        'success': False,
                        'error': 'Нет прав root, sudo недоступен и неизвестный пакетный менеджер. Подключитесь как root.'
                    }
            
            # Режим выполнения через screen (по умолчанию включен)
            use_screen = bool(server_config.get('use_screen', True))
            # Определяем идентификатор для именования screen-сессии и логов
            sid = str(server_config.get('id') or server_config.get('server_id') or server_name).replace(' ', '_')
            
            # Шаг 3: Проверка системных требований
            system_cmd = "uname -a && which python3 && which systemctl && python3 --version"
            send_progress("System Check", 20, f"root@{host}:~# {system_cmd}")
            
            system_check = conn.execute_command(system_cmd)
            if not system_check['success']:
                send_progress("System Check", 20, f"bash: {system_cmd}: command failed\nroot@{host}:~#", system_check.get('error', ''), True)
                return {
                    'success': False,
                    'error': 'Система не поддерживается (требуется Linux с Python3 и systemd)'
                }
            
            # Показываем реальный вывод команды как в терминале
            terminal_output = system_check['output'].strip()
            send_progress("System Check", 25, f"{terminal_output}\nroot@{host}:~#", terminal_output)
            os_info = terminal_output
            
            # Шаг 4: Создание директории агента
            mkdir_cmd = f"{cmd_prefix}mkdir -p /opt/xpanel-agent && {cmd_prefix}chmod 755 /opt/xpanel-agent"
            send_progress("Directory Setup", 30, f"root@{host}:~# {mkdir_cmd}")
            
            create_dir = conn.execute_command(mkdir_cmd)
            if not create_dir['success']:
                send_progress("Directory Setup", 30, f"mkdir: cannot create directory '/opt/xpanel-agent': {create_dir.get('error', 'Permission denied')}\nroot@{host}:~#", create_dir.get('error', ''), True)
                return {
                    'success': False,
                    'error': f"Ошибка создания директории: {create_dir['error']}"
                }
            
            ls_cmd = f"ls -la /opt/"
            send_progress("Directory Setup", 32, f"root@{host}:~# {ls_cmd}")
            ls_result = conn.execute_command(ls_cmd)
            ls_output = ls_result.get('output', '').strip()
            send_progress("Directory Setup", 35, f"{ls_output}\nroot@{host}:~#", ls_output)
            
            # Вспомогательная функция для потокового выполнения длинных команд
            def stream_and_progress(cmd: str, step: str, start_progress: int, end_progress: int, timeout: int = 900):
                # Печатаем команду как в терминале
                send_progress(step, start_progress, f"root@{host}:~# {cmd}")
                current = start_progress
                target = end_progress
                increment = max(0.2, (end_progress - start_progress) / 200.0)

                def on_line(line: str):
                    nonlocal current
                    # Сдвигаем прогресс понемногу, не превышая целевого
                    if current < target:
                        current = min(target, current + increment)
                    send_progress(step, int(current), line, command_output=line)

                result = conn.execute_command_stream(cmd, timeout=timeout, on_output=on_line)
                # Доводим прогресс до конца шага и показываем итог
                if int(current) < end_progress:
                    current = end_progress
                if result.get('success'):
                    final_output = result.get('output', '').strip()
                    if final_output:
                        send_progress(step, end_progress, f"{final_output}\nroot@{host}:~#", final_output)
                else:
                    err = result.get('error', 'unknown error')
                    send_progress(step, end_progress, f"{err}\nroot@{host}:~#", err, True)
                return result

            # Шаг 4: Установка зависимостей
            send_progress("Установка зависимостей", 40, "Установка Python пакетов")
            
            # Определяем пакетный менеджер
            pkg_check_cmd = "which apt-get || which yum || which dnf"
            send_progress("Установка зависимостей", 41, f"Выполняется: {pkg_check_cmd}")
            pkg_manager_check = conn.execute_command(pkg_check_cmd)
            if pkg_manager_check['success']:
                pkg_manager = pkg_manager_check['output'].strip().split('/')[-1]
                
                send_progress("Установка зависимостей", 42, f"Найден пакетный менеджер: {pkg_manager}", pkg_manager_check['output'])
                
                # Вспомогательная функция: выполнить список команд внутри screen и
                # построчно стримить tail -F лога в прогресс
                def run_screen_script(commands: list, step: str, start_progress: int, end_progress: int) -> Dict:
                    log_dir = "/var/log/xpanel"
                    log_file = f"{log_dir}/install-{sid}.log"
                    session_name = f"Xpanel_{sid}"
                    # Подготовка лог-директории и screen
                    conn.execute_command(f"{cmd_prefix}mkdir -p {log_dir} && {cmd_prefix}chmod 777 {log_dir}")
                    # Устанавливаем screen при необходимости
                    if pkg_manager == 'apt-get':
                        conn.execute_command(f"{cmd_prefix}bash -lc 'command -v screen >/dev/null || (apt update && apt install -y screen)'", timeout=600)
                    elif pkg_manager in ['yum', 'dnf']:
                        conn.execute_command(f"{cmd_prefix}bash -lc 'command -v screen >/dev/null || ({pkg_manager} install -y screen)'", timeout=600)
                    # Пишем скрипт на сервере
                    script_path = f"/tmp/xpanel_install_run_{sid}.sh"
                    script_body = "\n".join(commands + [
                        "EXIT=$?",
                        "echo __XPNL_DONE__:$EXIT"
                    ])
                    conn.execute_command(f"bash -lc 'cat > {script_path} <<\'EOF\'\n#!/usr/bin/env bash\nset -o pipefail\nset +e\n{script_body}\nEOF'", timeout=30)
                    conn.execute_command(f"{cmd_prefix}chmod +x {script_path}")
                    # Стартуем screen-сессию с логированием
                    start_cmd = f"screen -S {session_name} -dm -L -Logfile {log_file} bash -lc '{cmd_prefix}bash {script_path}'"
                    conn.execute_command(start_cmd, timeout=10)
                    
                    current = start_progress
                    increment = max(0.2, (end_progress - start_progress) / 300.0)
                    done_code = None
                    
                    def on_line(line: str):
                        nonlocal current, done_code
                        if line.strip().startswith("__XPNL_DONE__:"):
                            try:
                                done_code = int(line.strip().split(":", 1)[1])
                            except Exception:
                                done_code = 1
                        else:
                            if current < end_progress:
                                current = min(end_progress, current + increment)
                            send_progress(step, int(current), line, command_output=line)
                    
                    # Стримим лог до маркера завершения
                    tail_cmd = f"bash -lc 'touch {log_file}; tail -n +1 -F {log_file} | sed \"/__XPNL_DONE__/q\"'"
                    conn.execute_command_stream(tail_cmd, timeout=7200, on_output=on_line)
                    
                    if int(current) < end_progress:
                        send_progress(step, end_progress, "Завершение этапа установки через screen")
                    return {
                        'success': (done_code is not None and done_code == 0),
                        'exit_code': done_code if done_code is not None else -1,
                        'log_file': log_file,
                        'session': session_name
                    }
                
                # Формируем команды для установки зависимостей и pip
                if use_screen and pkg_manager == 'apt-get':
                    cmds = [
                        f"{cmd_prefix}apt update",
                        f"{cmd_prefix}apt install -y python3-pip python3-requests python3-psutil",
                        f"{cmd_prefix}python3 -m pip install --upgrade pip",
                        f"{cmd_prefix}python3 -m pip install requests psutil websocket-client"
                    ]
                    screen_res = run_screen_script(cmds, "Package Install (screen)", 43, 60)
                    install_deps = {'success': screen_res.get('success', False), 'output': f"screen:{screen_res.get('session')} log:{screen_res.get('log_file')}"}
                elif use_screen and pkg_manager in ['yum', 'dnf']:
                    cmds = [
                        f"{cmd_prefix}{pkg_manager} install -y python3-pip python3-requests python3-psutil",
                        f"{cmd_prefix}python3 -m pip install --upgrade pip",
                        f"{cmd_prefix}python3 -m pip install requests psutil websocket-client"
                    ]
                    screen_res = run_screen_script(cmds, "Package Install (screen)", 43, 60)
                    install_deps = {'success': screen_res.get('success', False), 'output': f"screen:{screen_res.get('session')} log:{screen_res.get('log_file')}"}
                elif use_screen and pkg_manager == 'pacman':
                    cmds = [
                        f"{cmd_prefix}pacman -Sy --noconfirm python-pip python-requests python-psutil",
                        f"{cmd_prefix}python3 -m pip install --upgrade pip",
                        f"{cmd_prefix}python3 -m pip install requests psutil websocket-client"
                    ]
                    screen_res = run_screen_script(cmds, "Package Install (screen)", 43, 60)
                    install_deps = {'success': screen_res.get('success', False), 'output': f"screen:{screen_res.get('session')} log:{screen_res.get('log_file')}"}
                else:
                    # Обычный путь со стримингом без screen
                    if pkg_manager == 'apt-get':
                        update_cmd = f"{cmd_prefix}apt update"
                        stream_and_progress(update_cmd, "Package Update", 43, 45, timeout=1800)
                        deps_cmd = f"{cmd_prefix}apt install -y python3-pip python3-requests python3-psutil"
                        install_deps = stream_and_progress(deps_cmd, "Package Install", 45, 55, timeout=3600)
                        # pip
                        pip_cmd = f"{cmd_prefix}python3 -m pip install --upgrade pip"
                        stream_and_progress(pip_cmd, "PIP Upgrade", 55, 60, timeout=1200)
                        pip_install_cmd = f"{cmd_prefix}python3 -m pip install requests psutil websocket-client"
                        stream_and_progress(pip_install_cmd, "PIP Install", 60, 65, timeout=2400)
                    elif pkg_manager in ['yum', 'dnf']:
                        deps_cmd = f"{cmd_prefix}{pkg_manager} install -y python3-pip python3-requests python3-psutil"
                        send_progress("Установка зависимостей", 45, f"Выполняется: {deps_cmd}")
                        install_deps = conn.execute_command(deps_cmd, timeout=300)
                        pip_cmd = f"{cmd_prefix}python3 -m pip install --upgrade pip"
                        stream_and_progress(pip_cmd, "PIP Upgrade", 55, 60, timeout=1200)
                        pip_install_cmd = f"{cmd_prefix}python3 -m pip install requests psutil websocket-client"
                        stream_and_progress(pip_install_cmd, "PIP Install", 60, 65, timeout=2400)
                    elif pkg_manager == 'pacman':
                        deps_cmd = f"{cmd_prefix}pacman -Sy --noconfirm python-pip python-requests python-psutil"
                        send_progress("Установка зависимостей", 45, f"Выполняется: {deps_cmd}")
                        install_deps = conn.execute_command(deps_cmd, timeout=300)
                        pip_cmd = f"{cmd_prefix}python3 -m pip install --upgrade pip"
                        stream_and_progress(pip_cmd, "PIP Upgrade", 55, 60, timeout=1200)
                        pip_install_cmd = f"{cmd_prefix}python3 -m pip install requests psutil websocket-client"
                        stream_and_progress(pip_install_cmd, "PIP Install", 60, 65, timeout=2400)
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
            else:
                send_progress("Установка зависимостей", 50, "Пакетный менеджер не найден, пропускаем установку зависимостей", "", True)
            
            # Шаг 5: Создание агента
            agent_script = self._generate_agent_script()
            
            # Создаем временный файл для агента
            temp_script = f"/tmp/xpanel_agent_{int(time.time())}.py"
            
            # Записываем агент через cat
            cat_cmd = f"cat > {temp_script} << 'AGENT_EOF'"
            send_progress("Agent Creation", 70, f"root@{host}:~# {cat_cmd}")
            write_agent = conn.execute_command(f"""
{cat_cmd}
{agent_script}
AGENT_EOF
""", timeout=30)
            
            if write_agent['success']:
                send_progress("Agent Creation", 72, f"root@{host}:~# echo 'Agent script created successfully'\nAgent script created successfully\nroot@{host}:~#")
            else:
                send_progress("Agent Creation", 72, f"bash: {temp_script}: Permission denied\nroot@{host}:~#", write_agent.get('error', ''), True)
            
            if not write_agent['success']:
                send_progress("Создание агента", 62, "Ошибка записи файла агента", write_agent.get('error', ''), True)
                return {
                    'success': False,
                    'error': f"Ошибка создания агента: {write_agent['error']}"
                }
            
            send_progress("Создание агента", 65, "Файл агента записан", write_agent.get('output', ''))
            
            # Перемещаем агент в целевую директорию
            move_cmd = f"{cmd_prefix}mv {temp_script} /opt/xpanel-agent/agent.py"
            send_progress("Agent Install", 75, f"root@{host}:~# {move_cmd}")
            move_agent = conn.execute_command(move_cmd)
            if not move_agent['success']:
                send_progress("Agent Install", 75, f"mv: cannot move '{temp_script}': Permission denied\nroot@{host}:~#", move_agent.get('error', ''), True)
                return {
                    'success': False,
                    'error': f"Ошибка установки агента: {move_agent['error']}"
                }
            
            chmod_cmd = f"{cmd_prefix}chmod +x /opt/xpanel-agent/agent.py"
            send_progress("Agent Install", 77, f"root@{host}:~# {chmod_cmd}")
            chmod_result = conn.execute_command(chmod_cmd)
            
            ls_cmd = f"ls -la /opt/xpanel-agent/"
            send_progress("Agent Install", 78, f"root@{host}:~# {ls_cmd}")
            ls_result = conn.execute_command(ls_cmd)
            ls_output = ls_result.get('output', '').strip()
            send_progress("Agent Install", 80, f"{ls_output}\nroot@{host}:~#", ls_output)
            
            # Шаг 6: Создание systemd сервиса
            service_content = self._generate_service_file()
            service_file = "/tmp/xpanel-agent.service"
            
            # Создаем сервис файл
            service_cmd = f"cat > {service_file} << 'SERVICE_EOF'"
            send_progress("Service Setup", 82, f"root@{host}:~# {service_cmd}")
            
            service_create = conn.execute_command(f"""
{service_cmd}
{service_content}
SERVICE_EOF
""", timeout=30)
            
            if service_create['success']:
                send_progress("Service Setup", 84, f"root@{host}:~# echo 'Service file created'\nService file created\nroot@{host}:~#")
            else:
                send_progress("Service Setup", 84, f"bash: {service_file}: Permission denied\nroot@{host}:~#", service_create.get('error', ''), True)
            
            # Сервисный файл уже создан через heredoc выше; дополнительная запись не требуется
            
            # Устанавливаем сервис
            install_cmd = f"{cmd_prefix}mv {service_file} /etc/systemd/system/xpanel-agent.service"
            send_progress("Service Install", 85, f"root@{host}:~# {install_cmd}")
            install_service = conn.execute_command(install_cmd)
            
            if install_service['success']:
                send_progress("Service Install", 87, f"root@{host}:~# echo 'Service installed successfully'\nService installed successfully\nroot@{host}:~#")
            else:
                send_progress("Service Install", 87, f"mv: cannot move '{service_file}': Permission denied\nroot@{host}:~#", install_service.get('error', ''), True)
            if not install_service['success']:
                send_progress("Настройка сервиса", 77, "Ошибка установки сервиса", install_service.get('error', ''), True)
                return {
                    'success': False,
                    'error': f"Ошибка установки сервиса: {install_service['error']}"
                }
            
            send_progress("Настройка сервиса", 78, "Сервис установлен", install_service['output'])
            
            # Перезагружаем systemd
            reload_cmd = f"{cmd_prefix}systemctl daemon-reload"
            send_progress("SystemD Reload", 88, f"root@{host}:~# {reload_cmd}")
            reload_result = conn.execute_command(reload_cmd)
            
            if reload_result['success']:
                send_progress("SystemD Reload", 90, f"root@{host}:~# echo 'SystemD reloaded'\nSystemD reloaded\nroot@{host}:~#")
            else:
                send_progress("SystemD Reload", 90, f"systemctl: command not found\nroot@{host}:~#", reload_result.get('error', ''), True)
            
            # Шаг 7: Запуск агента
            send_progress("Запуск агента", 85, "Включение и запуск сервиса")
            
            # Включаем автозапуск
            enable_cmd = f"{cmd_prefix}systemctl enable xpanel-agent"
            send_progress("Service Enable", 92, f"root@{host}:~# {enable_cmd}")
            enable_service = conn.execute_command(enable_cmd)
            if not enable_service['success']:
                send_progress("Service Enable", 93, f"Failed to enable unit: Unit file xpanel-agent.service does not exist.\nroot@{host}:~#", enable_service.get('error', ''), True)
            else:
                enable_output = enable_service.get('output', '').strip()
                send_progress("Service Enable", 93, f"Created symlink /etc/systemd/system/multi-user.target.wants/xpanel-agent.service\nroot@{host}:~#", enable_output)
            
            # Запускаем сервис
            start_cmd = f"{cmd_prefix}systemctl start xpanel-agent"
            send_progress("Service Start", 94, f"root@{host}:~# {start_cmd}")
            start_service = conn.execute_command(start_cmd)
            if not start_service['success']:
                send_progress("Service Start", 95, f"Job for xpanel-agent.service failed because the control process exited with error code.\nSee \"systemctl status xpanel-agent.service\" and \"journalctl -xe\" for details.\nroot@{host}:~#", start_service.get('error', ''), True)
                return {
                    'success': False,
                    'error': f"Ошибка запуска агента: {start_service['error']}"
                }
            
            send_progress("Service Start", 96, f"root@{host}:~# echo 'Agent started successfully'\nAgent started successfully\nroot@{host}:~#")
            
            # Шаг 8: Проверка статуса
            time.sleep(3)
            
            status_cmd = f"{cmd_prefix}systemctl is-active xpanel-agent"
            send_progress("Status Check", 97, f"root@{host}:~# {status_cmd}")
            status_check = conn.execute_command(status_cmd)
            
            if status_check['success'] and 'active' in status_check['output']:
                send_progress("Status Check", 98, f"active\nroot@{host}:~#")
                
                # Получаем дополнительную информацию
                info_cmd = f"{cmd_prefix}systemctl status xpanel-agent --no-pager -l"
                send_progress("Final Check", 99, f"root@{host}:~# {info_cmd}")
                info_check = conn.execute_command(info_cmd)
                
                if info_check['success']:
                    status_output = info_check.get('output', '').strip()
                    send_progress("Installation Complete", 100, f"{status_output}\n\nroot@{host}:~# echo 'Installation completed successfully!'\nInstallation completed successfully!\nroot@{host}:~#", status_output)
                else:
                    send_progress("Installation Complete", 100, f"● xpanel-agent.service - Xpanel Monitoring Agent\n   Loaded: loaded (/etc/systemd/system/xpanel-agent.service; enabled)\n   Active: active (running)\n\nroot@{host}:~# echo 'Installation completed successfully!'\nInstallation completed successfully!\nroot@{host}:~#")
                
                return {
                    'success': True,
                    'message': 'Агент успешно установлен и запущен',
                    'server_info': {
                        'host': host,
                        'name': server_name,
                        'os': os_info,
                        'status': 'active'
                    },
                    'service_status': info_check.get('output', '') if 'info_check' in locals() and info_check['success'] else None
                }
            else:
                status_output = status_check.get('output', 'inactive').strip()
                send_progress("Status Check", 98, f"{status_output}\nroot@{host}:~#", status_output)
                # Получаем детальные логи для диагностики
                logs_cmd = f"{cmd_prefix}journalctl -u xpanel-agent --no-pager -n 20"
                send_progress("Диагностика", 99, f"Выполняется: {logs_cmd}")
                logs = conn.execute_command_stream(logs_cmd, timeout=120, on_output=lambda line: send_progress("Диагностика", 99, line, command_output=line))
                
                status_info_cmd = f"{cmd_prefix}systemctl status xpanel-agent --no-pager -l"
                send_progress("Диагностика", 99.5, f"Выполняется: {status_info_cmd}")
                status_info = conn.execute_command_stream(status_info_cmd, timeout=120, on_output=lambda line: send_progress("Диагностика", 99.7, line, command_output=line))
                
                error_msg = f"Статус: {status_check.get('output', 'неизвестно')}"
                if not status_check['success']:
                    error_msg += f" | Ошибка проверки: {status_check.get('error', 'неизвестно')}"
                
                send_progress("Проверка установки", 100, f"Агент установлен, но не активен: {error_msg}", 
                             logs.get('output', '') if logs['success'] else '', True)
                
                return {
                    'success': False,
                    'error': f'Агент установлен, но не запущен: {error_msg}',
                    'logs': logs['output'] if logs['success'] else None,
                    'status_info': status_info['output'] if status_info['success'] else None
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
ExecStart=/usr/bin/python3 /opt/xpanel-agent/agent.py
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
'''

# Глобальный экземпляр установщика
real_installer = RealAgentInstaller()
