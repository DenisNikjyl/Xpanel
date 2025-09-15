#!/usr/bin/env python3
"""
SSH Manager - Улучшенный менеджер SSH подключений для Xpanel
Обеспечивает надежные SSH соединения с серверами
"""

import paramiko
import socket
import threading
import time
import json
import os
import logging
from datetime import datetime
from typing import Dict, Optional, Tuple, List
import queue
import subprocess

class SSHConnection:
    """Класс для управления одним SSH соединением"""
    
    def __init__(self, host: str, port: int = 22, username: str = None, 
                 password: str = None, key_file: str = None, timeout: int = 30):
        self.host = host
        self.port = port
        self.username = username
        self.password = password
        self.key_file = key_file
        self.timeout = timeout
        self.ssh_client = None
        self.sftp_client = None
        self.connected = False
        self.last_activity = None
        self.connection_lock = threading.Lock()
        
        # Настройка логирования
        self.logger = logging.getLogger(f"SSH-{host}")
        
    def connect(self) -> bool:
        """Установить SSH соединение"""
        with self.connection_lock:
            try:
                if self.connected and self.ssh_client:
                    # Проверяем активность соединения
                    try:
                        transport = self.ssh_client.get_transport()
                        if transport and transport.is_active():
                            return True
                    except:
                        pass
                    
                # Закрываем старое соединение если есть
                self.disconnect()
                
                self.ssh_client = paramiko.SSHClient()
                self.ssh_client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
                
                # Настройки подключения
                connect_kwargs = {
                    'hostname': self.host,
                    'port': self.port,
                    'username': self.username,
                    'timeout': self.timeout,
                    'allow_agent': False,
                    'look_for_keys': False
                }
                
                # Аутентификация
                if self.key_file and os.path.exists(self.key_file):
                    # SSH ключ
                    try:
                        key = paramiko.RSAKey.from_private_key_file(self.key_file)
                        connect_kwargs['pkey'] = key
                    except:
                        try:
                            key = paramiko.Ed25519Key.from_private_key_file(self.key_file)
                            connect_kwargs['pkey'] = key
                        except:
                            # Если ключ не загружается, используем пароль
                            if self.password:
                                connect_kwargs['password'] = self.password
                elif self.password:
                    # Пароль
                    connect_kwargs['password'] = self.password
                else:
                    self.logger.error("Не указан пароль или SSH ключ")
                    return False
                
                self.ssh_client.connect(**connect_kwargs)
                self.connected = True
                self.last_activity = datetime.now()
                
                self.logger.info(f"SSH соединение установлено с {self.host}:{self.port}")
                return True
                
            except paramiko.AuthenticationException as e:
                self.logger.error(f"Ошибка аутентификации SSH: {e}")
                return False
            except paramiko.SSHException as e:
                self.logger.error(f"Ошибка SSH: {e}")
                return False
            except socket.timeout as e:
                self.logger.error(f"Таймаут подключения SSH: {e}")
                return False
            except Exception as e:
                self.logger.error(f"Неожиданная ошибка SSH: {e}")
                return False
    
    def disconnect(self):
        """Закрыть SSH соединение"""
        with self.connection_lock:
            try:
                if self.sftp_client:
                    self.sftp_client.close()
                    self.sftp_client = None
                    
                if self.ssh_client:
                    self.ssh_client.close()
                    self.ssh_client = None
                    
                self.connected = False
                self.logger.info(f"SSH соединение с {self.host} закрыто")
                
            except Exception as e:
                self.logger.error(f"Ошибка при закрытии SSH соединения: {e}")
    
    def execute_command(self, command: str, timeout: int = 30) -> Dict:
        """Выполнить команду на удаленном сервере"""
        if not self.connected or not self.ssh_client:
            if not self.connect():
                return {
                    'success': False,
                    'error': 'Не удалось установить SSH соединение',
                    'exit_code': -1
                }
        
        try:
            self.last_activity = datetime.now()
            
            stdin, stdout, stderr = self.ssh_client.exec_command(
                command, 
                timeout=timeout,
                get_pty=True
            )
            
            # Читаем вывод
            output = stdout.read().decode('utf-8', errors='ignore')
            error = stderr.read().decode('utf-8', errors='ignore')
            exit_code = stdout.channel.recv_exit_status()
            
            return {
                'success': exit_code == 0,
                'output': output.strip(),
                'error': error.strip() if error else None,
                'exit_code': exit_code,
                'timestamp': datetime.now().isoformat()
            }
            
        except socket.timeout:
            return {
                'success': False,
                'error': f'Команда превысила таймаут {timeout} секунд',
                'exit_code': -1,
                'timestamp': datetime.now().isoformat()
            }
        except Exception as e:
            return {
                'success': False,
                'error': f'Ошибка выполнения команды: {str(e)}',
                'exit_code': -1,
                'timestamp': datetime.now().isoformat()
            }
    
    def get_sftp(self):
        """Получить SFTP клиент"""
        if not self.connected or not self.ssh_client:
            if not self.connect():
                return None
                
        if not self.sftp_client:
            try:
                self.sftp_client = self.ssh_client.open_sftp()
            except Exception as e:
                self.logger.error(f"Ошибка создания SFTP клиента: {e}")
                return None
                
        return self.sftp_client
    
    def upload_file(self, local_path: str, remote_path: str) -> bool:
        """Загрузить файл на сервер"""
        sftp = self.get_sftp()
        if not sftp:
            return False
            
        try:
            sftp.put(local_path, remote_path)
            self.logger.info(f"Файл {local_path} загружен как {remote_path}")
            return True
        except Exception as e:
            self.logger.error(f"Ошибка загрузки файла: {e}")
            return False
    
    def download_file(self, remote_path: str, local_path: str) -> bool:
        """Скачать файл с сервера"""
        sftp = self.get_sftp()
        if not sftp:
            return False
            
        try:
            sftp.get(remote_path, local_path)
            self.logger.info(f"Файл {remote_path} скачан как {local_path}")
            return True
        except Exception as e:
            self.logger.error(f"Ошибка скачивания файла: {e}")
            return False
    
    def is_alive(self) -> bool:
        """Проверить активность соединения"""
        if not self.connected or not self.ssh_client:
            return False
            
        try:
            transport = self.ssh_client.get_transport()
            return transport and transport.is_active()
        except:
            return False


class SSHManager:
    """Менеджер SSH соединений"""
    
    def __init__(self):
        self.connections: Dict[str, SSHConnection] = {}
        self.connection_pool_lock = threading.Lock()
        self.logger = logging.getLogger("SSHManager")
        
        # Запускаем поток для очистки неактивных соединений
        self.cleanup_thread = threading.Thread(target=self._cleanup_connections, daemon=True)
        self.cleanup_thread.start()
    
    def get_connection(self, server_id: str, host: str, port: int = 22, 
                      username: str = None, password: str = None, 
                      key_file: str = None) -> Optional[SSHConnection]:
        """Получить SSH соединение для сервера"""
        with self.connection_pool_lock:
            # Проверяем существующее соединение
            if server_id in self.connections:
                conn = self.connections[server_id]
                if conn.is_alive():
                    return conn
                else:
                    # Удаляем мертвое соединение
                    conn.disconnect()
                    del self.connections[server_id]
            
            # Создаем новое соединение
            conn = SSHConnection(host, port, username, password, key_file)
            if conn.connect():
                self.connections[server_id] = conn
                return conn
            else:
                return None
    
    def execute_command(self, server_id: str, host: str, port: int, username: str,
                       password: str, key_file: str, command: str, timeout: int = 30) -> Dict:
        """Выполнить команду на сервере"""
        conn = self.get_connection(server_id, host, port, username, password, key_file)
        if not conn:
            return {
                'success': False,
                'error': 'Не удалось установить SSH соединение',
                'exit_code': -1
            }
        
        return conn.execute_command(command, timeout)
    
    def test_connection(self, host: str, port: int = 22, username: str = None,
                       password: str = None, key_file: str = None) -> Dict:
        """Тестировать SSH соединение"""
        try:
            conn = SSHConnection(host, port, username, password, key_file, timeout=10)
            if conn.connect():
                # Получаем информацию о системе
                result = conn.execute_command("uname -a && uptime", timeout=10)
                conn.disconnect()
                
                if result['success']:
                    return {
                        'success': True,
                        'message': 'Соединение успешно',
                        'system_info': result['output']
                    }
                else:
                    return {
                        'success': True,
                        'message': 'Соединение установлено, но команда не выполнена',
                        'error': result.get('error')
                    }
            else:
                return {
                    'success': False,
                    'message': 'Не удалось установить SSH соединение'
                }
        except Exception as e:
            return {
                'success': False,
                'message': f'Ошибка тестирования соединения: {str(e)}'
            }
    
    def close_connection(self, server_id: str):
        """Закрыть соединение с сервером"""
        with self.connection_pool_lock:
            if server_id in self.connections:
                self.connections[server_id].disconnect()
                del self.connections[server_id]
    
    def close_all_connections(self):
        """Закрыть все соединения"""
        with self.connection_pool_lock:
            for conn in self.connections.values():
                conn.disconnect()
            self.connections.clear()
    
    def _cleanup_connections(self):
        """Очистка неактивных соединений (фоновый поток)"""
        while True:
            try:
                time.sleep(60)  # Проверяем каждую минуту
                
                with self.connection_pool_lock:
                    dead_connections = []
                    
                    for server_id, conn in self.connections.items():
                        if not conn.is_alive():
                            dead_connections.append(server_id)
                        elif conn.last_activity:
                            # Закрываем соединения неактивные более 30 минут
                            inactive_time = datetime.now() - conn.last_activity
                            if inactive_time.total_seconds() > 1800:  # 30 минут
                                dead_connections.append(server_id)
                    
                    for server_id in dead_connections:
                        self.logger.info(f"Закрываем неактивное соединение: {server_id}")
                        self.connections[server_id].disconnect()
                        del self.connections[server_id]
                        
            except Exception as e:
                self.logger.error(f"Ошибка в cleanup_connections: {e}")
    
    def get_connection_stats(self) -> Dict:
        """Получить статистику соединений"""
        with self.connection_pool_lock:
            active_connections = sum(1 for conn in self.connections.values() if conn.is_alive())
            return {
                'total_connections': len(self.connections),
                'active_connections': active_connections,
                'servers': list(self.connections.keys())
            }


# Глобальный экземпляр SSH менеджера
ssh_manager = SSHManager()
