#!/usr/bin/env python3
"""
Xpanel Production Agent - Полноценный агент для мониторинга серверов
Версия: 4.0.0 (Production Ready)
Собирает реальные данные системы и отправляет на панель управления
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
import websocket
import ssl
from urllib.parse import urlparse

class ProductionAgent:
    def __init__(self, panel_address="localhost", panel_port=5000, server_id=None, config_file=None):
        self.panel_address = panel_address
        self.panel_port = panel_port
        self.server_id = server_id or self.generate_server_id()
        self.running = False
        self.heartbeat_interval = 30  # seconds
        self.config_file = config_file or '/opt/xpanel-agent/config.json'
        self.db_file = '/opt/xpanel-agent/agent.db'
        
        # Создаем директории если их нет
        os.makedirs('/opt/xpanel-agent/logs', exist_ok=True)
        
        # Load configuration
        self.config = self.load_config()
        
        # Update settings from config
        self.panel_address = self.config.get('panel_address', self.panel_address)
        self.panel_port = self.config.get('panel_port', self.panel_port)
        self.heartbeat_interval = self.config.get('heartbeat_interval', self.heartbeat_interval)
        
        # Initialize database
        self.init_database()
        
        # Setup logging
        self.setup_logging()
        
        # Performance monitoring
        self.last_network_stats = None
        self.last_disk_stats = None
        self.performance_history = []
        
        # System alerts
        self.alert_thresholds = self.config.get('alert_thresholds', {
            'cpu': 80,
            'memory': 85,
            'disk': 90,
            'load': 5.0
        })
        
        # WebSocket connection
        self.ws = None
        self.ws_connected = False
        self.ws_thread = None
        
        self.logger.info(f"Production Agent v4.0.0 initialized (ID: {self.server_id})")
        
    def generate_server_id(self):
        """Generate unique server ID based on hostname and MAC address"""
        hostname = socket.gethostname()
        try:
            # Get MAC address of first network interface
            mac = ':'.join(['{:02x}'.format((uuid.getnode() >> elements) & 0xff) 
                           for elements in range(0,2*6,2)][::-1])
            return f"{hostname}-{mac}"
        except:
            return hostname
    
    def load_config(self) -> Dict[str, Any]:
        """Load configuration from file"""
        try:
            if os.path.exists(self.config_file):
                with open(self.config_file, 'r') as f:
                    return json.load(f)
        except Exception as e:
            print(f"Warning: Could not load config: {e}")
        
        # Default configuration
        return {
            'panel_address': 'localhost',
            'panel_port': 5000,
            'heartbeat_interval': 30,
            'alert_thresholds': {
                'cpu': 80,
                'memory': 85,
                'disk': 90,
                'load': 5.0
            },
            'log_level': 'INFO'
        }
    
    def save_config(self):
        """Save current configuration to file"""
        try:
            os.makedirs(os.path.dirname(self.config_file), exist_ok=True)
            with open(self.config_file, 'w') as f:
                json.dump(self.config, f, indent=2)
        except Exception as e:
            self.logger.error(f"Failed to save config: {e}")
    
    def setup_logging(self):
        """Setup logging with rotation"""
        log_dir = '/opt/xpanel-agent/logs'
        os.makedirs(log_dir, exist_ok=True)
        
        # Create formatter
        formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        
        # Setup rotating file handler
        file_handler = RotatingFileHandler(
            f'{log_dir}/agent.log',
            maxBytes=10*1024*1024,  # 10MB
            backupCount=5
        )
        file_handler.setFormatter(formatter)
        
        # Setup console handler
        console_handler = logging.StreamHandler()
        console_handler.setFormatter(formatter)
        
        # Configure logger
        self.logger = logging.getLogger('ProductionAgent')
        self.logger.setLevel(getattr(logging, self.config.get('log_level', 'INFO')))
        self.logger.addHandler(file_handler)
        self.logger.addHandler(console_handler)
    
    def init_database(self):
        """Initialize SQLite database for local data storage"""
        try:
            os.makedirs(os.path.dirname(self.db_file), exist_ok=True)
            conn = sqlite3.connect(self.db_file)
            cursor = conn.cursor()
            
            # Create tables
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS performance_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp TEXT NOT NULL,
                    cpu_usage REAL,
                    memory_usage REAL,
                    disk_usage REAL,
                    network_in INTEGER,
                    network_out INTEGER,
                    load_avg REAL
                )
            ''')
            
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS command_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp TEXT NOT NULL,
                    command TEXT NOT NULL,
                    output TEXT,
                    exit_code INTEGER,
                    execution_time REAL
                )
            ''')
            
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS alerts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp TEXT NOT NULL,
                    alert_type TEXT NOT NULL,
                    message TEXT,
                    severity TEXT,
                    resolved BOOLEAN DEFAULT FALSE
                )
            ''')
            
            conn.commit()
            conn.close()
            
        except Exception as e:
            print(f"Database initialization error: {e}")
    
    def get_system_stats(self):
        """Collect comprehensive system statistics"""
        try:
            # CPU usage and info
            cpu_percent = psutil.cpu_percent(interval=1, percpu=True)
            cpu_freq = psutil.cpu_freq()
            cpu_count_logical = psutil.cpu_count(logical=True)
            cpu_count_physical = psutil.cpu_count(logical=False)
            
            # Memory usage
            memory = psutil.virtual_memory()
            swap = psutil.swap_memory()
            
            # Disk usage for all mounted filesystems
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
            
            # Network stats with interface details
            network_interfaces = {}
            for interface, stats in psutil.net_io_counters(pernic=True).items():
                network_interfaces[interface] = {
                    'bytes_sent': stats.bytes_sent,
                    'bytes_recv': stats.bytes_recv,
                    'packets_sent': stats.packets_sent,
                    'packets_recv': stats.packets_recv,
                    'errin': stats.errin,
                    'errout': stats.errout,
                    'dropin': stats.dropin,
                    'dropout': stats.dropout
                }
            
            # Network connections
            connections = len(psutil.net_connections())
            
            # Load average
            try:
                load_avg = os.getloadavg()
            except (OSError, AttributeError):
                load_avg = [0, 0, 0]
            
            # Uptime
            boot_time = psutil.boot_time()
            uptime = time.time() - boot_time
            
            # Process information
            process_count = len(psutil.pids())
            
            # Top processes by CPU and memory
            top_processes = self.get_top_processes()
            
            # System temperatures (if available)
            temperatures = self.get_system_temperatures()
            
            # Disk I/O stats
            disk_io = psutil.disk_io_counters()
            
            # Calculate network speed if we have previous stats
            network_speed = self.calculate_network_speed(network_interfaces)
            
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
                    'cores_physical': cpu_count_physical,
                    'frequency': {
                        'current': cpu_freq.current if cpu_freq else 0,
                        'min': cpu_freq.min if cpu_freq else 0,
                        'max': cpu_freq.max if cpu_freq else 0
                    } if cpu_freq else None
                },
                'memory': {
                    'total': memory.total,
                    'available': memory.available,
                    'used': memory.used,
                    'percent': round(memory.percent, 1),
                    'cached': getattr(memory, 'cached', 0),
                    'buffers': getattr(memory, 'buffers', 0)
                },
                'swap': {
                    'total': swap.total,
                    'used': swap.used,
                    'free': swap.free,
                    'percent': round(swap.percent, 1)
                },
                'disk': disk_usage,
                'disk_io': {
                    'read_count': disk_io.read_count if disk_io else 0,
                    'write_count': disk_io.write_count if disk_io else 0,
                    'read_bytes': disk_io.read_bytes if disk_io else 0,
                    'write_bytes': disk_io.write_bytes if disk_io else 0
                },
                'network': {
                    'interfaces': network_interfaces,
                    'connections': connections,
                    'speed': network_speed
                },
                'load_average': load_avg,
                'uptime': int(uptime),
                'processes': {
                    'total': process_count,
                    'top_cpu': top_processes['cpu'],
                    'top_memory': top_processes['memory']
                },
                'temperatures': temperatures,
                'system_info': {
                    'platform': platform.system(),
                    'platform_release': platform.release(),
                    'platform_version': platform.version(),
                    'architecture': platform.machine(),
                    'processor': platform.processor()
                }
            }
            
            # Store performance data
            self.store_performance_data(stats)
            
            # Check for alerts
            self.check_system_alerts(stats)
            
            return stats
            
        except Exception as e:
            self.logger.error(f"Error collecting system stats: {e}")
            return None
    
    def get_top_processes(self, limit=5):
        """Get top processes by CPU and memory usage"""
        try:
            processes = []
            for proc in psutil.process_iter(['pid', 'name', 'cpu_percent', 'memory_percent', 'username']):
                try:
                    processes.append(proc.info)
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    continue
            
            # Sort by CPU usage
            top_cpu = sorted(processes, key=lambda x: x['cpu_percent'] or 0, reverse=True)[:limit]
            
            # Sort by memory usage
            top_memory = sorted(processes, key=lambda x: x['memory_percent'] or 0, reverse=True)[:limit]
            
            return {
                'cpu': top_cpu,
                'memory': top_memory
            }
        except Exception as e:
            self.logger.error(f"Error getting top processes: {e}")
            return {'cpu': [], 'memory': []}
    
    def get_system_temperatures(self):
        """Get system temperatures if available"""
        try:
            temps = psutil.sensors_temperatures()
            if temps:
                temp_data = {}
                for name, entries in temps.items():
                    temp_data[name] = []
                    for entry in entries:
                        temp_data[name].append({
                            'label': entry.label or 'Unknown',
                            'current': entry.current,
                            'high': entry.high,
                            'critical': entry.critical
                        })
                return temp_data
        except (AttributeError, OSError):
            pass
        return {}
    
    def calculate_network_speed(self, current_stats):
        """Calculate network speed based on previous stats"""
        if not self.last_network_stats:
            self.last_network_stats = {
                'stats': current_stats,
                'timestamp': time.time()
            }
            return {}
        
        current_time = time.time()
        time_diff = current_time - self.last_network_stats['timestamp']
        
        if time_diff < 1:  # Too soon to calculate
            return {}
        
        speeds = {}
        for interface, stats in current_stats.items():
            if interface in self.last_network_stats['stats']:
                old_stats = self.last_network_stats['stats'][interface]
                
                bytes_sent_diff = stats['bytes_sent'] - old_stats['bytes_sent']
                bytes_recv_diff = stats['bytes_recv'] - old_stats['bytes_recv']
                
                speeds[interface] = {
                    'upload_speed': bytes_sent_diff / time_diff,  # bytes per second
                    'download_speed': bytes_recv_diff / time_diff
                }
        
        # Update last stats
        self.last_network_stats = {
            'stats': current_stats,
            'timestamp': current_time
        }
        
        return speeds
    
    def store_performance_data(self, stats):
        """Store performance data in local database"""
        try:
            conn = sqlite3.connect(self.db_file)
            cursor = conn.cursor()
            
            cursor.execute('''
                INSERT INTO performance_history 
                (timestamp, cpu_usage, memory_usage, disk_usage, network_in, network_out, load_avg)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (
                stats['timestamp'],
                stats['cpu']['usage'],
                stats['memory']['percent'],
                stats['disk'].get('/', {}).get('percent', 0),
                sum(iface.get('bytes_recv', 0) for iface in stats['network']['interfaces'].values()),
                sum(iface.get('bytes_sent', 0) for iface in stats['network']['interfaces'].values()),
                stats['load_average'][0] if stats['load_average'] else 0
            ))
            
            conn.commit()
            
            # Clean old data (keep last 1000 records)
            cursor.execute('''
                DELETE FROM performance_history 
                WHERE id NOT IN (
                    SELECT id FROM performance_history 
                    ORDER BY timestamp DESC LIMIT 1000
                )
            ''')
            
            conn.commit()
            conn.close()
            
        except Exception as e:
            self.logger.error(f"Error storing performance data: {e}")
    
    def check_system_alerts(self, stats):
        """Check system stats against alert thresholds"""
        alerts = []
        
        # CPU alert
        if stats['cpu']['usage'] > self.alert_thresholds['cpu']:
            alerts.append({
                'type': 'cpu',
                'severity': 'warning',
                'message': f"High CPU usage: {stats['cpu']['usage']}%"
            })
        
        # Memory alert
        if stats['memory']['percent'] > self.alert_thresholds['memory']:
            alerts.append({
                'type': 'memory',
                'severity': 'warning',
                'message': f"High memory usage: {stats['memory']['percent']}%"
            })
        
        # Disk alerts
        for mount, disk_info in stats['disk'].items():
            if disk_info['percent'] > self.alert_thresholds['disk']:
                alerts.append({
                    'type': 'disk',
                    'severity': 'critical' if disk_info['percent'] > 95 else 'warning',
                    'message': f"High disk usage on {mount}: {disk_info['percent']}%"
                })
        
        # Load average alert
        if stats['load_average'][0] > self.alert_thresholds['load']:
            alerts.append({
                'type': 'load',
                'severity': 'warning',
                'message': f"High system load: {stats['load_average'][0]}"
            })
        
        # Store alerts in database
        if alerts:
            self.store_alerts(alerts)
    
    def store_alerts(self, alerts):
        """Store alerts in database"""
        try:
            conn = sqlite3.connect(self.db_file)
            cursor = conn.cursor()
            
            for alert in alerts:
                cursor.execute('''
                    INSERT INTO alerts (timestamp, alert_type, message, severity)
                    VALUES (?, ?, ?, ?)
                ''', (
                    datetime.now().isoformat(),
                    alert['type'],
                    alert['message'],
                    alert['severity']
                ))
            
            conn.commit()
            conn.close()
            
        except Exception as e:
            self.logger.error(f"Error storing alerts: {e}")
    
    def execute_command(self, command, timeout=30):
        """Execute shell command with security checks"""
        start_time = time.time()
        
        # Security check - block dangerous commands
        dangerous_patterns = [
            r'rm\s+-rf\s+/',
            r'dd\s+if=.*of=/dev/',
            r'mkfs\.',
            r'fdisk',
            r'parted'
        ]
        
        for pattern in dangerous_patterns:
            if re.search(pattern, command, re.IGNORECASE):
                result = {
                    'success': False,
                    'error': 'Command blocked for security reasons',
                    'exit_code': -1,
                    'timestamp': datetime.now().isoformat(),
                    'execution_time': 0
                }
                self.store_command_history(command, result)
                return result
        
        try:
            self.logger.info(f"Executing command: {command}")
            
            result = subprocess.run(
                command,
                shell=True,
                capture_output=True,
                text=True,
                timeout=timeout
            )
            
            execution_time = time.time() - start_time
            
            result_data = {
                'success': True,
                'output': result.stdout,
                'error': result.stderr,
                'exit_code': result.returncode,
                'timestamp': datetime.now().isoformat(),
                'execution_time': execution_time
            }
            
            self.store_command_history(command, result_data)
            return result_data
            
        except subprocess.TimeoutExpired:
            execution_time = time.time() - start_time
            result = {
                'success': False,
                'error': f'Command timed out after {timeout} seconds',
                'exit_code': -1,
                'timestamp': datetime.now().isoformat(),
                'execution_time': execution_time
            }
            self.store_command_history(command, result)
            return result
            
        except Exception as e:
            execution_time = time.time() - start_time
            result = {
                'success': False,
                'error': str(e),
                'exit_code': -1,
                'timestamp': datetime.now().isoformat(),
                'execution_time': execution_time
            }
            self.store_command_history(command, result)
            return result
    
    def store_command_history(self, command, result):
        """Store command execution history"""
        try:
            conn = sqlite3.connect(self.db_file)
            cursor = conn.cursor()
            
            cursor.execute('''
                INSERT INTO command_history (timestamp, command, output, exit_code, execution_time)
                VALUES (?, ?, ?, ?, ?)
            ''', (
                result['timestamp'],
                command,
                result.get('output', '') + result.get('error', ''),
                result['exit_code'],
                result['execution_time']
            ))
            
            conn.commit()
            
            # Keep only last 100 commands
            cursor.execute('''
                DELETE FROM command_history 
                WHERE id NOT IN (
                    SELECT id FROM command_history 
                    ORDER BY timestamp DESC LIMIT 100
                )
            ''')
            
            conn.commit()
            conn.close()
            
        except Exception as e:
            self.logger.error(f"Error storing command history: {e}")
    
    def get_detailed_processes(self):
        """Get detailed process information"""
        try:
            processes = []
            for proc in psutil.process_iter(['pid', 'name', 'cpu_percent', 'memory_percent', 
                                           'username', 'status', 'create_time', 'cmdline']):
                try:
                    pinfo = proc.info
                    pinfo['create_time'] = datetime.fromtimestamp(pinfo['create_time']).isoformat()
                    pinfo['cmdline'] = ' '.join(pinfo['cmdline']) if pinfo['cmdline'] else ''
                    processes.append(pinfo)
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    continue
            
            return {'processes': processes}
        except Exception as e:
            self.logger.error(f"Error getting detailed processes: {e}")
            return {'processes': []}
    
    def manage_service(self, service_name, action):
        """Manage system services"""
        try:
            valid_actions = ['start', 'stop', 'restart', 'enable', 'disable', 'status']
            if action not in valid_actions:
                return {'success': False, 'error': f'Invalid action: {action}'}
            
            cmd = f"systemctl {action} {service_name}"
            result = subprocess.run(
                cmd.split(),
                capture_output=True,
                text=True,
                timeout=30
            )
            
            return {
                'success': result.returncode == 0,
                'output': result.stdout,
                'error': result.stderr,
                'exit_code': result.returncode
            }
            
        except Exception as e:
            return {'success': False, 'error': str(e)}
    
    def get_system_services(self):
        """Get list of system services"""
        try:
            result = subprocess.run(
                ['systemctl', 'list-units', '--type=service', '--no-pager'],
                capture_output=True,
                text=True,
                timeout=30
            )
            
            if result.returncode == 0:
                services = []
                lines = result.stdout.split('\n')[1:]  # Skip header
                
                for line in lines:
                    if line.strip() and not line.startswith('●'):
                        parts = line.split()
                        if len(parts) >= 4:
                            services.append({
                                'name': parts[0].replace('.service', ''),
                                'load': parts[1],
                                'active': parts[2],
                                'sub': parts[3],
                                'description': ' '.join(parts[4:]) if len(parts) > 4 else ''
                            })
                
                return {'services': services}
            else:
                return {'services': [], 'error': result.stderr}
                
        except Exception as e:
            return {'services': [], 'error': str(e)}
    
    def get_system_logs(self, log_file='/var/log/syslog', lines=100):
        """Get system logs"""
        try:
            if not os.path.exists(log_file):
                return {'error': f'Log file {log_file} not found'}
            
            cmd = f"tail -n {lines} {log_file}"
            result = subprocess.run(
                cmd.split(),
                capture_output=True,
                text=True,
                timeout=10
            )
            
            if result.returncode == 0:
                return {'logs': result.stdout.split('\n')}
            else:
                return {'error': result.stderr}
                
        except Exception as e:
            return {'error': str(e)}
    
    def get_network_connections(self):
        """Get detailed network connections"""
        try:
            connections = []
            for conn in psutil.net_connections(kind='inet'):
                try:
                    connections.append({
                        'fd': conn.fd,
                        'family': conn.family.name if conn.family else 'unknown',
                        'type': conn.type.name if conn.type else 'unknown',
                        'local_address': f"{conn.laddr.ip}:{conn.laddr.port}" if conn.laddr else '',
                        'remote_address': f"{conn.raddr.ip}:{conn.raddr.port}" if conn.raddr else '',
                        'status': conn.status,
                        'pid': conn.pid
                    })
                except (psutil.AccessDenied, AttributeError):
                    continue
            
            return {'connections': connections}
        except Exception as e:
            self.logger.error(f"Error getting network connections: {e}")
            return {'connections': []}
    
    def get_disk_info(self):
        """Get detailed disk information"""
        try:
            disks = []
            for partition in psutil.disk_partitions():
                try:
                    usage = psutil.disk_usage(partition.mountpoint)
                    disks.append({
                        'device': partition.device,
                        'mountpoint': partition.mountpoint,
                        'fstype': partition.fstype,
                        'opts': partition.opts,
                        'total': usage.total,
                        'used': usage.used,
                        'free': usage.free,
                        'percent': round((usage.used / usage.total) * 100, 1)
                    })
                except (PermissionError, OSError):
                    continue
            
            return {'disks': disks}
        except Exception as e:
            self.logger.error(f"Error getting disk info: {e}")
            return {'disks': []}
    
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
            
            # Send via HTTP
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
    
    def setup_websocket(self):
        """Setup WebSocket connection for real-time communication"""
        try:
            ws_url = f"ws://{self.panel_address}:{self.panel_port}/socket.io/?EIO=4&transport=websocket"
            
            def on_message(ws, message):
                try:
                    self.logger.debug(f"WebSocket message received: {message}")
                    # Handle incoming commands from panel
                    if message.startswith('42'):  # Socket.IO message format
                        data = json.loads(message[2:])
                        if len(data) >= 2:
                            event = data[0]
                            payload = data[1] if len(data) > 1 else {}
                            self.handle_websocket_command(event, payload)
                except Exception as e:
                    self.logger.error(f"Error processing WebSocket message: {e}")
            
            def on_error(ws, error):
                self.logger.error(f"WebSocket error: {error}")
                self.ws_connected = False
            
            def on_close(ws, close_status_code, close_msg):
                self.logger.warning("WebSocket connection closed")
                self.ws_connected = False
            
            def on_open(ws):
                self.logger.info("WebSocket connection established")
                self.ws_connected = True
                # Join server room for targeted updates
                join_message = f'42["join_room", {{"room": "{self.server_id}"}}]'
                ws.send(join_message)
            
            self.ws = websocket.WebSocketApp(
                ws_url,
                on_open=on_open,
                on_message=on_message,
                on_error=on_error,
                on_close=on_close
            )
            
        except Exception as e:
            self.logger.error(f"Error setting up WebSocket: {e}")
    
    def handle_websocket_command(self, event, payload):
        """Handle commands received via WebSocket"""
        try:
            if event == "execute_command":
                command = payload.get('command')
                if command:
                    result = self.execute_command(command)
                    self.send_websocket_response("command_result", {
                        'command': command,
                        'result': result
                    })
            
            elif event == "get_processes":
                processes = self.get_detailed_processes()
                self.send_websocket_response("processes_data", processes)
            
            elif event == "manage_service":
                service = payload.get('service')
                action = payload.get('action')  # start, stop, restart, enable, disable
                if service and action:
                    result = self.manage_service(service, action)
                    self.send_websocket_response("service_result", {
                        'service': service,
                        'action': action,
                        'result': result
                    })
            
            elif event == "get_logs":
                log_file = payload.get('log_file', '/var/log/syslog')
                lines = payload.get('lines', 100)
                logs = self.get_system_logs(log_file, lines)
                self.send_websocket_response("logs_data", {
                    'log_file': log_file,
                    'logs': logs
                })
            
            elif event == "get_services":
                services = self.get_system_services()
                self.send_websocket_response("services_data", services)
            
            elif event == "get_network_connections":
                connections = self.get_network_connections()
                self.send_websocket_response("network_connections", connections)
            
            elif event == "get_disk_info":
                disk_info = self.get_disk_info()
                self.send_websocket_response("disk_info", disk_info)
                
        except Exception as e:
            self.logger.error(f"Error handling WebSocket command: {e}")
    
    def send_websocket_response(self, event, data):
        """Send response via WebSocket"""
        try:
            if self.ws and self.ws_connected:
                message = f'42["{event}", {json.dumps(data)}]'
                self.ws.send(message)
        except Exception as e:
            self.logger.error(f"Error sending WebSocket response: {e}")
    
    def websocket_loop(self):
        """WebSocket connection loop"""
        while self.running:
            try:
                if not self.ws_connected:
                    self.setup_websocket()
                    if self.ws:
                        self.ws.run_forever()
                time.sleep(5)  # Wait before reconnection attempt
            except Exception as e:
                self.logger.error(f"WebSocket loop error: {e}")
                time.sleep(10)
    
    def heartbeat_loop(self):
        """Main heartbeat loop"""
        while self.running:
            success = self.send_heartbeat()
            
            # Also send via WebSocket if connected
            if self.ws_connected and success:
                try:
                    stats = self.get_system_stats()
                    if stats:
                        self.send_websocket_response("server_stats", stats)
                except Exception as e:
                    self.logger.error(f"Error sending WebSocket stats: {e}")
            
            time.sleep(self.heartbeat_interval)
    
    def signal_handler(self, signum, frame):
        """Handle system signals for graceful shutdown"""
        self.logger.info(f"Received signal {signum}, shutting down...")
        self.stop()
    
    def start(self):
        """Start the agent"""
        self.logger.info(f"Starting Production Agent v4.0.0 (ID: {self.server_id})")
        self.logger.info(f"Panel address: {self.panel_address}:{self.panel_port}")
        
        # Setup signal handlers
        signal.signal(signal.SIGTERM, self.signal_handler)
        signal.signal(signal.SIGINT, self.signal_handler)
        
        # Register with panel
        if not self.register_with_panel():
            self.logger.warning("Failed to register with panel, continuing anyway...")
        
        self.running = True
        
        # Start heartbeat thread
        heartbeat_thread = threading.Thread(target=self.heartbeat_loop, daemon=True)
        heartbeat_thread.start()
        
        # Start WebSocket thread
        self.ws_thread = threading.Thread(target=self.websocket_loop, daemon=True)
        self.ws_thread.start()
        
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

def main():
    parser = argparse.ArgumentParser(description='Xpanel Production Agent v4.0.0')
    parser.add_argument('--panel-address', default='localhost',
                       help='Control panel IP address')
    parser.add_argument('--panel-port', type=int, default=5000,
                       help='Control panel port')
    parser.add_argument('--server-id', 
                       help='Custom server ID (auto-generated if not provided)')
    parser.add_argument('--config', 
                       help='Configuration file path')
    parser.add_argument('--daemon', action='store_true',
                       help='Run as daemon')
    parser.add_argument('--log-level', choices=['DEBUG', 'INFO', 'WARNING', 'ERROR'],
                       default='INFO', help='Logging level')
    
    args = parser.parse_args()
    
    # Create agent instance
    agent = ProductionAgent(
        panel_address=args.panel_address,
        panel_port=args.panel_port,
        server_id=args.server_id,
        config_file=args.config
    )
    
    # Set log level
    agent.logger.setLevel(getattr(logging, args.log_level))
    
    if args.daemon:
        # Run as daemon (simplified version)
        try:
            import daemon
            with daemon.DaemonContext():
                agent.start()
        except ImportError:
            agent.logger.error("python-daemon not installed, running in foreground")
            agent.start()
    else:
        agent.start()

if __name__ == '__main__':
    main()
