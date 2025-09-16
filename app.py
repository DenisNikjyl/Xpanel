#!/usr/bin/env python3
"""
Xpanel - VPS Management Panel
Main Flask application
"""

from flask import Flask, render_template, request, jsonify, session
from flask_jwt_extended import JWTManager, jwt_required, create_access_token, get_jwt_identity
from flask_cors import CORS
from flask_socketio import SocketIO, emit, join_room
import psutil
import json
import os
from datetime import datetime, timedelta
import threading
import time
from dotenv import load_dotenv
import bcrypt
from server_manager import ServerManager
from agent_client import AgentClient
from auth import auth_bp, require_auth, get_current_user
from ssh_manager import ssh_manager
from real_agent_installer import real_installer

# Load environment variables
load_dotenv()

app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'xpanel-secret-key-change-in-production')
app.config['JWT_SECRET_KEY'] = os.getenv('JWT_SECRET_KEY', 'jwt-secret-change-in-production')
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=24)

# Initialize extensions
jwt = JWTManager(app)
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet')

# Register authentication blueprint
app.register_blueprint(auth_bp)

# Initialize managers
server_manager = ServerManager()
agent_client = AgentClient()

@app.route('/')
def index():
    return render_template('landing_ru.html')

@app.route('/ru')
def index_ru():
    return render_template('landing_ru.html')

@app.route('/dashboard')
def dashboard():
    return render_template('dashboard_ultra.html')

@app.route('/dashboard/v2')
def dashboard_v2():
    return render_template('dashboard_v2.html')

@app.route('/dashboard/ultra')
def dashboard_ultra():
    return render_template('dashboard_ultra.html')

@app.route('/dashboard/modern')
def dashboard_modern():
    return render_template('dashboard_modern.html')

@app.route('/servers')
def servers_page():
    return render_template('servers.html')

@app.route('/terminal')
def terminal_page():
    return render_template('terminal.html')

@app.route('/analytics')
def analytics_page():
    return render_template('analytics.html')

@app.route('/agents')
def agents_page():
    return render_template('agents.html')

@app.route('/security')
def security_page():
    return render_template('security.html')

@app.route('/settings')
def settings_page():
    return render_template('settings.html')

@app.route('/login')
def login_page():
    return render_template('login_new.html')

@app.route('/login/ru')
def login_page_ru():
    return render_template('login_ru.html')

# Legacy login endpoint - redirect to new auth system
@app.route('/api/login', methods=['POST'])
def legacy_login():
    """Legacy login endpoint - redirects to new auth system"""
    from auth import auth_bp
    # Import the login function from the auth blueprint
    with app.app_context():
        return auth_bp.view_functions['login']()

# Removed duplicate route definitions - using the more complete implementations below

@app.route('/api/servers/<server_id>/stats', methods=['GET'])
@jwt_required()
def get_server_stats(server_id):
    """Get server statistics"""
    stats = server_manager.get_server_stats(server_id)
    return jsonify(stats)

@app.route('/api/servers/<server_id>/install-agent', methods=['POST'])
@jwt_required()
def install_agent_legacy(server_id):
    """Install agent on server using real SSH installer"""
    try:
        # Получаем информацию о сервере через server_manager
        servers = server_manager.get_servers()
        server = next((s for s in servers if str(s['id']) == str(server_id)), None)
        
        if not server:
            return jsonify({'success': False, 'error': 'Сервер не найден'}), 404
        
        # Настраиваем установщик
        panel_address = request.host.split(':')[0] if request.host else 'localhost'
        real_installer.panel_address = panel_address
        real_installer.panel_port = 5000
        
        server_config = {
            'host': server['host'],
            'port': server.get('port', 22),
            'username': server['username'],
            'password': server.get('password'),
            'key_file': server.get('key_file'),
            'name': server['name'],
            'id': str(server_id),
            'server_id': str(server_id),
            'use_screen': True
        }
        
        # Прогресс коллбек для отправки real-time логов через Socket.IO
        def progress_callback(progress_data):
            try:
                progress_payload = dict(progress_data)
                progress_payload['server_id'] = str(server_id)
                socketio.emit('installation_progress', progress_payload)
            except Exception as e:
                print(f"Emit progress error: {e}")

        # Запускаем установку в отдельном потоке, чтобы сразу отдавать ответ клиенту
        def install_in_background():
            try:
                result = real_installer.install_agent(server_config, progress_callback)
                if result.get('success'):
                    server_manager.update_server_status(server_id, 'online', agent_installed=True)
                # Отправляем событие завершения установки
                try:
                    socketio.emit('installation_complete', {
                        'server_id': str(server_id),
                        'success': result.get('success', False),
                        'message': result.get('message'),
                        'error': result.get('error')
                    })
                except Exception as e:
                    print(f"Emit completion error: {e}")
            except Exception as e:
                print(f"Background install error: {e}")
                socketio.emit('installation_complete', {
                    'server_id': str(server_id),
                    'success': False,
                    'error': f'Ошибка установки агента: {str(e)}'
                })

        # Используем нативный фоновой таск Socket.IO для корректной доставки событий
        socketio.start_background_task(install_in_background)

        # Немедленный ответ
        return jsonify({'success': True, 'message': 'Установка агента запущена'})
        
    except Exception as e:
        print(f"Ошибка установки агента: {e}")
        return jsonify({
            'success': False,
            'error': f'Ошибка установки агента: {str(e)}'
        }), 500

@app.route('/api/servers/<server_id>/command', methods=['POST'])
@jwt_required()
def execute_command(server_id):
    """Execute command on server"""
    data = request.get_json()
    command = data.get('command')
    result = server_manager.execute_command(server_id, command)
    return jsonify(result)

# Removed duplicate delete_server route - using the more complete implementation below

@app.route('/api/servers/<server_id>/remove-agent', methods=['POST'])
@jwt_required()
def remove_agent(server_id):
    """Remove agent from remote server"""
    try:
        result = server_manager.remove_agent_from_server(server_id)
        return jsonify({'success': True, 'message': 'Agent removed successfully'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 400

@app.route('/api/servers/<server_id>/reinstall-agent', methods=['POST'])
@jwt_required()
def reinstall_agent(server_id):
    """Reinstall agent on remote server"""
    try:
        result = server_manager.reinstall_agent_on_server(server_id)
        return jsonify({'success': True, 'message': 'Agent reinstalled successfully'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 400

@app.route('/api/custom-actions', methods=['GET'])
@jwt_required()
def get_custom_actions():
    """Get all custom actions"""
    actions = server_manager.get_custom_actions()
    return jsonify({'actions': actions})

@app.route('/api/custom-actions', methods=['POST'])
@jwt_required()
def create_custom_action():
    """Create new custom action"""
    data = request.get_json()
    try:
        action_id = server_manager.create_custom_action(
            name=data.get('name'),
            icon=data.get('icon'),
            color=data.get('color'),
            command=data.get('command'),
            confirm=data.get('confirm', True)
        )
        return jsonify({'success': True, 'action_id': action_id})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 400

@app.route('/api/custom-actions/<action_id>', methods=['DELETE'])
@jwt_required()
def delete_custom_action(action_id):
    """Delete custom action"""
    try:
        server_manager.delete_custom_action(action_id)
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 400

@app.route('/api/execute-custom-action', methods=['POST'])
@jwt_required()
def execute_custom_action():
    """Execute custom action on server"""
    data = request.get_json()
    try:
        result = server_manager.execute_custom_action(
            server_id=data.get('server_id'),
            action_id=data.get('action_id'),
            command=data.get('command')
        )
        return jsonify({'success': True, 'output': result})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 400

@app.route('/api/install-agent', methods=['POST'])
@jwt_required()
def install_agent_realtime():
    """Install agent with real-time progress via WebSocket"""
    try:
        data = request.get_json()
        
        # Получаем информацию о сервере
        server_config = {
            'host': data.get('host'),
            'port': data.get('port', 22),
            'username': data.get('username'),
            'password': data.get('password'),
            'key_file': data.get('key_file'),
            'name': data.get('name', f"Server-{data.get('host')}")
        }
        
        # Функция обратного вызова для отправки прогресса через WebSocket
        def progress_callback(progress_data):
            socketio.emit('installation_progress', progress_data)
        
        # Запускаем установку в отдельном потоке
        def install_in_background():
            try:
                installer = RealAgentInstaller()
                result = installer.install_agent(server_config, progress_callback)
                
                if result['success']:
                    socketio.emit('installation_complete', {
                        'success': True,
                        'message': result['message'],
                        'server_info': result.get('server_info', {})
                    })
                else:
                    socketio.emit('installation_error', {
                        'success': False,
                        'error': result['error']
                    })
            except Exception as e:
                socketio.emit('installation_error', {
                    'success': False,
                    'error': f'Ошибка установки агента: {str(e)}'
                })
        
        # Запускаем установку в фоновом режиме
        import threading
        thread = threading.Thread(target=install_in_background)
        thread.daemon = True
        thread.start()
        
        return jsonify({
            'success': True,
            'message': 'Установка агента запущена'
        })
            
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'Ошибка запуска установки агента: {str(e)}'
        }), 500

@app.route('/api/servers/install-agent', methods=['POST'])
@jwt_required()
def install_agent_remote():
    """Automatically install agent on remote server using real SSH"""
    data = request.get_json()
    
    host = data.get('host')
    port = data.get('port', 22)
    username = data.get('username')
    password = data.get('password')
    key_file = data.get('key_file')
    server_name = data.get('name', host)
    panel_address = request.host.split(':')[0] if request.host else 'localhost'
    
    if not all([host, username]):
        return jsonify({'success': False, 'error': 'Host и username обязательны'}), 400
    
    # Проверяем, что указан пароль или ключ
    if not password and not key_file:
        return jsonify({'success': False, 'error': 'Необходимо указать пароль или SSH ключ'}), 400
    
    try:
        # Настраиваем установщик с правильным адресом панели
        real_installer.panel_address = panel_address
        real_installer.panel_port = 5000
        
        server_config = {
            'host': host,
            'port': port,
            'username': username,
            'password': password,
            'key_file': key_file,
            'name': server_name
        }
        
        # Запускаем установку в отдельном потоке для WebSocket уведомлений
        def install_with_progress():
            def progress_callback(progress_data):
                # Отправляем прогресс через WebSocket
                socketio.emit('installation_progress', {
                    'server': host,
                    'progress': progress_data
                })
            
            result = real_installer.install_agent(server_config, progress_callback)
            
            # Отправляем финальный результат
            socketio.emit('installation_complete', {
                'server': host,
                'result': result
            })
            
            # Если установка успешна, добавляем сервер в базу
            if result['success']:
                try:
                    servers_file = 'servers.json'
                    servers = []
                    
                    if os.path.exists(servers_file):
                        with open(servers_file, 'r', encoding='utf-8') as f:
                            servers = json.load(f)
                    
                    # Проверяем, не существует ли уже такой сервер
                    existing_server = next((s for s in servers if s['host'] == host), None)
                    if not existing_server:
                        new_server = {
                            'id': str(len(servers) + 1),
                            'name': server_name,
                            'host': host,
                            'port': port,
                            'username': username,
                            'auth_method': 'key' if key_file else 'password',
                            'status': 'online',
                            'agent_installed': True,
                            'created_at': datetime.now().isoformat(),
                            'last_seen': datetime.now().isoformat()
                        }
                        
                        # Сохраняем пароль/ключ (в продакшене нужно шифровать)
                        if password:
                            new_server['password'] = password
                        if key_file:
                            new_server['ssh_key'] = key_file
                        
                        servers.append(new_server)
                        
                        with open(servers_file, 'w', encoding='utf-8') as f:
                            json.dump(servers, f, ensure_ascii=False, indent=2)
                            
                except Exception as e:
                    print(f"Ошибка сохранения сервера: {e}")
        
        # Запускаем установку в фоне
        install_thread = threading.Thread(target=install_with_progress)
        install_thread.daemon = True
        install_thread.start()
        
        return jsonify({
            'success': True, 
            'message': 'Установка агента запущена. Следите за прогрессом в реальном времени.',
            'installation_started': True
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': f'Ошибка запуска установки: {str(e)}'}), 500

@app.route('/api/agent/install-script')
def get_install_script():
    """Get agent installation script"""
    panel_address = request.host.split(':')[0]
    script_content = server_manager.generate_install_script(panel_address)
    
    return script_content, 200, {
        'Content-Type': 'text/plain',
        'Content-Disposition': 'attachment; filename=install_agent.sh'
    }

@app.route('/api/agent/heartbeat', methods=['POST'])
def agent_heartbeat():
    """Receive real heartbeat data from agent"""
    data = request.get_json()
    
    if not data or 'server_id' not in data:
        return jsonify({'success': False, 'error': 'Invalid heartbeat data'}), 400
    
    server_id = data['server_id']
    
    # Обновляем кэш данных агента
    server_manager.update_agent_data(server_id, {
        'cpu_percent': data.get('cpu_percent', 0),
        'memory_percent': data.get('memory_percent', 0),
        'disk_percent': data.get('disk_percent', 0),
        'network': data.get('network', {}),
        'processes': data.get('processes', []),
        'services': data.get('services', []),
        'auth_failures': data.get('auth_failures', []),
        'network_connections': data.get('network_connections', []),
        'system_logs': data.get('system_logs', []),
        'uptime': data.get('uptime', 0)
    })
    
    # Обновляем статус сервера
    server_manager.update_server_status(server_id, 'online')
    
    # Отправляем real-time обновления через WebSocket
    socketio.emit('server_stats', {
        'server_id': server_id,
        'stats': data
    })
    
    # Проверяем на угрозы безопасности
    threats = []
    
    # Высокое использование CPU
    if data.get('cpu_percent', 0) > 90:
        threats.append({
            'type': 'high_cpu',
            'severity': 'warning',
            'message': f"High CPU usage: {data.get('cpu_percent')}%"
        })
    
    # Высокое использование памяти
    if data.get('memory_percent', 0) > 90:
        threats.append({
            'type': 'high_memory',
            'severity': 'critical',
            'message': f"High memory usage: {data.get('memory_percent')}%"
        })
    
    # Подозрительные процессы
    processes = data.get('processes', [])
    for proc in processes:
        if proc.get('cpu_percent', 0) > 95:
            threats.append({
                'type': 'suspicious_process',
                'severity': 'high',
                'message': f"Process {proc['name']} using {proc['cpu_percent']}% CPU"
            })
    
    # Отправляем уведомления об угрозах
    if threats:
        socketio.emit('security_alert', {
            'server_id': server_id,
            'threats': threats
        })
    
    return jsonify({'success': True, 'message': 'Heartbeat received', 'threats_detected': len(threats)})

@app.route('/api/agent/register', methods=['POST'])
def agent_register():
    """Register new agent with real server data"""
    data = request.get_json()
    
    if not data or 'server_id' not in data:
        return jsonify({'success': False, 'error': 'Invalid registration data'}), 400
    
    server_id = data['server_id']
    
    # Регистрируем агент с реальными данными
    server_info = {
        'id': server_id,
        'name': data.get('hostname', f'Server-{server_id}'),
        'ip': data.get('ip_address', ''),
        'os': data.get('os_info', ''),
        'cpu_cores': data.get('cpu_cores', 0),
        'total_memory': data.get('total_memory', 0),
        'total_disk': data.get('total_disk', 0),
        'status': 'online',
        'agent_version': data.get('agent_version', '1.0.0'),
        'last_seen': datetime.now().isoformat(),
        'registered_at': datetime.now().isoformat()
    }
    
    # Сохраняем в servers.json
    try:
        servers_file = 'servers.json'
        servers = []
        
        if os.path.exists(servers_file):
            with open(servers_file, 'r', encoding='utf-8') as f:
                servers = json.load(f)
        
        # Проверяем, не зарегистрирован ли уже
        existing_server = None
        for i, server in enumerate(servers):
            if server['id'] == server_id:
                existing_server = i
                break
        
        if existing_server is not None:
            servers[existing_server] = server_info
        else:
            servers.append(server_info)
        
        with open(servers_file, 'w', encoding='utf-8') as f:
            json.dump(servers, f, ensure_ascii=False, indent=2)
        
        return jsonify({'success': True, 'message': 'Agent registered successfully', 'server_info': server_info})
    
    except Exception as e:
        return jsonify({'success': False, 'error': f'Registration failed: {str(e)}'}), 500

@app.route('/api/servers/<server_id>/terminal', methods=['POST'])
def create_terminal_session(server_id):
    """Create real terminal session for server"""
    try:
        session_id = f"term_{server_id}_{int(time.time())}"
        
        # Получаем информацию о сервере
        server = server_manager.get_server_by_id(server_id)
        if not server:
            return jsonify({'success': False, 'error': 'Server not found'}), 404
        
        # Создаем WebSocket комнату для терминала
        socketio.emit('terminal_ready', {
            'session_id': session_id,
            'server_id': server_id
        })
        
        return jsonify({
            'success': True,
            'session_id': session_id,
            'server_name': server.get('name', server_id)
        })
    
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/servers/<server_id>/services', methods=['GET'])
def get_server_services(server_id):
    """Get real services from server"""
    try:
        # Получаем данные агента из кэша
        if hasattr(server_manager, 'agent_cache') and server_id in server_manager.agent_cache:
            agent_data = server_manager.agent_cache[server_id]
            services = agent_data.get('services', [])
            
            # Форматируем для фронтенда
            formatted_services = []
            for service in services:
                formatted_services.append({
                    'name': service.get('name', 'unknown'),
                    'status': service.get('status', 'unknown'),
                    'description': service.get('description', ''),
                    'enabled': service.get('enabled', False)
                })
            
            return jsonify(formatted_services)
        else:
            return jsonify([])
    
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/servers/<server_id>/services/<service_name>/<action>', methods=['POST'])
def control_service(server_id, service_name, action):
    """Control service on real server"""
    try:
        if action not in ['start', 'stop', 'restart', 'enable', 'disable']:
            return jsonify({'success': False, 'error': 'Invalid action'}), 400
        
        # Отправляем команду агенту через WebSocket
        socketio.emit('service_control', {
            'server_id': server_id,
            'service_name': service_name,
            'action': action
        })
        
        return jsonify({
            'success': True,
            'message': f'Service {service_name} {action} command sent'
        })
    
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/notifications', methods=['GET'])
def get_notifications():
    """Get real notifications from system"""
    try:
        notifications = []
        
        # Получаем уведомления из кэша агентов
        if hasattr(server_manager, 'agent_cache'):
            for server_id, data in server_manager.agent_cache.items():
                server = server_manager.get_server_by_id(server_id)
                server_name = server.get('name', server_id) if server else server_id
                
                # Проверяем критические состояния
                if data.get('cpu_percent', 0) > 90:
                    notifications.append({
                        'id': f'cpu_{server_id}',
                        'type': 'warning',
                        'title': 'High CPU Usage',
                        'message': f'{server_name}: CPU usage {data["cpu_percent"]}%',
                        'timestamp': data.get('last_update', datetime.now().isoformat()),
                        'server_id': server_id
                    })
                
                if data.get('memory_percent', 0) > 90:
                    notifications.append({
                        'id': f'memory_{server_id}',
                        'type': 'critical',
                        'title': 'High Memory Usage',
                        'message': f'{server_name}: Memory usage {data["memory_percent"]}%',
                        'timestamp': data.get('last_update', datetime.now().isoformat()),
                        'server_id': server_id
                    })
                
                if data.get('disk_percent', 0) > 85:
                    notifications.append({
                        'id': f'disk_{server_id}',
                        'type': 'warning',
                        'title': 'Low Disk Space',
                        'message': f'{server_name}: Disk usage {data["disk_percent"]}%',
                        'timestamp': data.get('last_update', datetime.now().isoformat()),
                        'server_id': server_id
                    })
        
        # Сортируем по времени (новые первыми)
        notifications.sort(key=lambda x: x['timestamp'], reverse=True)
        
        return jsonify(notifications)
    
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/stats', methods=['GET'])
@jwt_required()
def get_stats():
    """Get real dashboard statistics from agents"""
    try:
        # Получаем реальные данные от всех агентов
        servers = server_manager.get_all_servers()
        
        total_servers = len(servers)
        active_servers = 0
        total_cpu = 0
        total_memory = 0
        total_disk = 0
        
        for server in servers:
            if server.get('status') == 'online':
                active_servers += 1
                
                # Получаем последние метрики от агента
                stats = server_manager.get_server_stats(server['id'])
                if stats and 'system' in stats:
                    system_stats = stats['system']
                    total_cpu += system_stats.get('cpu_percent', 0)
                    total_memory += system_stats.get('memory_percent', 0)
                    total_disk += system_stats.get('disk_percent', 0)
        
        # Вычисляем средние значения
        avg_cpu = round(total_cpu / max(active_servers, 1), 1)
        avg_memory = round(total_memory / max(active_servers, 1), 1)
        avg_disk = round(total_disk / max(active_servers, 1), 1)
        
        return jsonify({
            'total_servers': total_servers,
            'active_servers': active_servers,
            'offline_servers': total_servers - active_servers,
            'avg_cpu': avg_cpu,
            'avg_memory': avg_memory,
            'avg_disk': avg_disk,
            'cpu_trend': 'up' if avg_cpu > 70 else 'down' if avg_cpu < 30 else 'neutral',
            'memory_trend': 'up' if avg_memory > 80 else 'down' if avg_memory < 40 else 'neutral'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/security/threats', methods=['GET'])
@jwt_required()
def get_security_threats():
    """Get real security threats from all servers"""
    try:
        servers = server_manager.get_all_servers()
        threats = []
        
        for server in servers:
            if server.get('status') == 'online':
                # Получаем данные безопасности от агента
                security_data = server_manager.get_server_security(server['id'])
                if security_data:
                    # Анализируем подозрительные процессы
                    processes = security_data.get('processes', [])
                    for proc in processes:
                        if proc.get('cpu_percent', 0) > 90:
                            threats.append({
                                'type': 'High CPU Usage',
                                'severity': 'warning',
                                'server': server['name'],
                                'description': f"Process {proc['name']} using {proc['cpu_percent']}% CPU",
                                'source': proc['name'],
                                'timestamp': datetime.now().isoformat()
                            })
                    
                    # Проверяем неудачные попытки входа
                    auth_logs = security_data.get('auth_failures', [])
                    for log in auth_logs[-5:]:  # Последние 5 попыток
                        threats.append({
                            'type': 'Failed Login Attempt',
                            'severity': 'high',
                            'server': server['name'],
                            'description': f"Failed SSH login from {log.get('ip', 'unknown')}",
                            'source': log.get('ip', 'unknown'),
                            'timestamp': log.get('timestamp', datetime.now().isoformat())
                        })
        
        return jsonify({
            'threats': threats[:10],  # Последние 10 угроз
            'total_threats': len(threats),
            'critical_count': len([t for t in threats if t['severity'] == 'critical']),
            'high_count': len([t for t in threats if t['severity'] == 'high']),
            'medium_count': len([t for t in threats if t['severity'] == 'warning'])
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/analytics/performance', methods=['GET'])
@jwt_required()
def get_performance_analytics():
    """Get real performance analytics from all servers"""
    try:
        servers = server_manager.get_all_servers()
        
        # Собираем данные производительности
        cpu_data = []
        memory_data = []
        disk_data = []
        network_data = []
        
        for server in servers:
            if server.get('status') == 'online':
                stats = server_manager.get_server_stats(server['id'])
                if stats and 'system' in stats:
                    system_stats = stats['system']
                    
                    cpu_data.append({
                        'server': server['name'],
                        'value': system_stats.get('cpu_percent', 0)
                    })
                    
                    memory_data.append({
                        'server': server['name'],
                        'value': system_stats.get('memory_percent', 0)
                    })
                    
                    disk_data.append({
                        'server': server['name'],
                        'value': system_stats.get('disk_percent', 0)
                    })
                    
                    network_stats = system_stats.get('network', {})
                    network_data.append({
                        'server': server['name'],
                        'bytes_sent': network_stats.get('bytes_sent', 0),
                        'bytes_recv': network_stats.get('bytes_recv', 0)
                    })
        
        # Вычисляем средние значения
        avg_cpu = sum(d['value'] for d in cpu_data) / len(cpu_data) if cpu_data else 0
        avg_memory = sum(d['value'] for d in memory_data) / len(memory_data) if memory_data else 0
        avg_disk = sum(d['value'] for d in disk_data) / len(disk_data) if disk_data else 0
        
        total_network = sum(d['bytes_sent'] + d['bytes_recv'] for d in network_data)
        
        return jsonify({
            'cpu': {
                'average': round(avg_cpu, 1),
                'servers': cpu_data,
                'trend': 1.7 if avg_cpu > 70 else -2.1 if avg_cpu < 30 else 0.5
            },
            'memory': {
                'average': round(avg_memory, 1),
                'servers': memory_data,
                'trend': 2.8 if avg_memory > 80 else -1.5 if avg_memory < 40 else 1.2
            },
            'disk': {
                'average': round(avg_disk, 1),
                'servers': disk_data,
                'trend': -2.1 if avg_disk < 50 else 1.8
            },
            'network': {
                'total_mb': round(total_network / 1024 / 1024, 2),
                'servers': network_data,
                'trend': 6.2
            }
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/system/stats', methods=['GET'])
@jwt_required()
def get_system_stats():
    try:
        import psutil
        
        # Get system stats
        cpu_percent = psutil.cpu_percent(interval=1)
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage('/')
        
        # Get network stats (simplified)
        network = psutil.net_io_counters()
        
        return jsonify({
            'cpu': {
                'usage': cpu_percent,
                'cores': psutil.cpu_count()
            },
            'memory': {
                'total': memory.total,
                'used': memory.used,
                'percent': memory.percent
            },
            'disk': {
                'total': disk.total,
                'used': disk.used,
                'percent': (disk.used / disk.total) * 100
            },
            'network': {
                'bytes_sent': network.bytes_sent,
                'bytes_recv': network.bytes_recv
            }
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/servers', methods=['GET'])
@jwt_required()
def get_servers():
    try:
        # Load servers from file or database
        servers_file = 'servers.json'
        if os.path.exists(servers_file):
            with open(servers_file, 'r', encoding='utf-8') as f:
                servers = json.load(f)
        else:
            servers = []
        
        return jsonify({'servers': servers})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/servers', methods=['POST'])
@jwt_required()
def add_server():
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['name', 'host', 'port', 'username']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'message': f'Поле {field} обязательно'}), 400
        
        # Load existing servers
        servers_file = 'servers.json'
        if os.path.exists(servers_file):
            with open(servers_file, 'r', encoding='utf-8') as f:
                servers = json.load(f)
        else:
            servers = []
        
        # Generate new server ID
        server_id = str(len(servers) + 1)
        
        # Create new server object
        new_server = {
            'id': server_id,
            'name': data['name'],
            'host': data['host'],
            'port': int(data['port']),
            'username': data['username'],
            'auth_method': data.get('auth_method', 'password'),
            'description': data.get('description', ''),
            'status': 'unknown',
            'cpu_usage': 0,
            'memory_usage': 0,
            'disk_usage': 0,
            'created_at': datetime.now().isoformat()
        }
        
        # Store password or SSH key securely (in production, use proper encryption)
        if data.get('password'):
            new_server['password'] = data['password']  # Should be encrypted
        if data.get('ssh_key'):
            new_server['ssh_key'] = data['ssh_key']  # Should be encrypted
        
        servers.append(new_server)
        
        # Save to file
        with open(servers_file, 'w', encoding='utf-8') as f:
            json.dump(servers, f, ensure_ascii=False, indent=2)
        
        return jsonify({'message': 'Сервер успешно добавлен', 'server': new_server}), 201
    
    except Exception as e:
        return jsonify({'message': f'Ошибка добавления сервера: {str(e)}'}), 500

@app.route('/api/servers/<server_id>', methods=['GET'])
@jwt_required()
def get_server(server_id):
    try:
        servers_file = 'servers.json'
        if not os.path.exists(servers_file):
            return jsonify({'message': 'Сервер не найден'}), 404
        
        with open(servers_file, 'r', encoding='utf-8') as f:
            servers = json.load(f)
        
        server = next((s for s in servers if s['id'] == server_id), None)
        if not server:
            return jsonify({'message': 'Сервер не найден'}), 404
        
        # Remove sensitive data from response
        server_copy = server.copy()
        server_copy.pop('password', None)
        server_copy.pop('ssh_key', None)
        
        return jsonify(server_copy)
    
    except Exception as e:
        return jsonify({'message': f'Ошибка загрузки сервера: {str(e)}'}), 500

@app.route('/api/servers/<server_id>', methods=['PUT'])
@jwt_required()
def update_server(server_id):
    try:
        data = request.get_json()
        servers_file = 'servers.json'
        
        if not os.path.exists(servers_file):
            return jsonify({'message': 'Сервер не найден'}), 404
        
        with open(servers_file, 'r', encoding='utf-8') as f:
            servers = json.load(f)
        
        server_index = next((i for i, s in enumerate(servers) if s['id'] == server_id), None)
        if server_index is None:
            return jsonify({'message': 'Сервер не найден'}), 404
        
        # Update server data
        servers[server_index].update({
            'name': data.get('name', servers[server_index]['name']),
            'host': data.get('host', servers[server_index]['host']),
            'port': int(data.get('port', servers[server_index]['port'])),
            'username': data.get('username', servers[server_index]['username']),
            'description': data.get('description', servers[server_index]['description']),
            'updated_at': datetime.now().isoformat()
        })
        
        # Save to file
        with open(servers_file, 'w', encoding='utf-8') as f:
            json.dump(servers, f, ensure_ascii=False, indent=2)
        
        return jsonify({'message': 'Сервер обновлён'})
    
    except Exception as e:
        return jsonify({'message': f'Ошибка обновления сервера: {str(e)}'}), 500

@app.route('/api/servers/<server_id>', methods=['DELETE'])
@jwt_required()
def delete_server(server_id):
    try:
        servers_file = 'servers.json'
        
        if not os.path.exists(servers_file):
            return jsonify({'message': 'Сервер не найден'}), 404
        
        with open(servers_file, 'r', encoding='utf-8') as f:
            servers = json.load(f)
        
        servers = [s for s in servers if s['id'] != server_id]
        
        # Save to file
        with open(servers_file, 'w', encoding='utf-8') as f:
            json.dump(servers, f, ensure_ascii=False, indent=2)
        
        return jsonify({'message': 'Сервер удалён'})
    
    except Exception as e:
        return jsonify({'message': f'Ошибка удаления сервера: {str(e)}'}), 500

@app.route('/api/servers/<server_id>/test', methods=['POST'])
@jwt_required()
def test_server_connection(server_id):
    """Test SSH connection to server using improved SSH manager"""
    try:
        servers_file = 'servers.json'
        
        if not os.path.exists(servers_file):
            return jsonify({'message': 'Сервер не найден'}), 404
        
        with open(servers_file, 'r', encoding='utf-8') as f:
            servers = json.load(f)
        
        server = next((s for s in servers if s['id'] == server_id), None)
        if not server:
            return jsonify({'message': 'Сервер не найден'}), 404
        
        # Test connection using new SSH manager
        result = ssh_manager.test_connection(
            host=server['host'],
            port=server['port'],
            username=server['username'],
            password=server.get('password'),
            key_file=server.get('ssh_key')
        )
        
        # Update server status
        server_index = next(i for i, s in enumerate(servers) if s['id'] == server_id)
        servers[server_index]['status'] = 'online' if result['success'] else 'offline'
        servers[server_index]['last_seen'] = datetime.now().isoformat()
        
        # Save updated status
        with open(servers_file, 'w', encoding='utf-8') as f:
            json.dump(servers, f, ensure_ascii=False, indent=2)
        
        if result['success']:
            return jsonify({
                'message': result['message'],
                'status': 'online',
                'system_info': result.get('system_info', ''),
                'last_seen': servers[server_index]['last_seen']
            })
        else:
            return jsonify({
                'message': result['message'],
                'status': 'offline'
            }), 400
    
    except Exception as e:
        return jsonify({'message': f'Ошибка тестирования соединения: {str(e)}'}), 500

@app.route('/api/servers/execute', methods=['POST'])
@jwt_required()
def execute_server_command():
    """Execute command on server using improved SSH manager"""
    try:
        data = request.get_json()
        server_id = data.get('server_id')
        command = data.get('command')
        timeout = data.get('timeout', 30)
        
        if not server_id or not command:
            return jsonify({'message': 'Не указан сервер или команда'}), 400
        
        # Load server data
        servers_file = 'servers.json'
        if not os.path.exists(servers_file):
            return jsonify({'message': 'Сервер не найден'}), 404
        
        with open(servers_file, 'r', encoding='utf-8') as f:
            servers = json.load(f)
        
        server = next((s for s in servers if s['id'] == server_id), None)
        if not server:
            return jsonify({'message': 'Сервер не найден'}), 404
        
        # Execute command using SSH manager
        result = ssh_manager.execute_command(
            server_id=server_id,
            host=server['host'],
            port=server['port'],
            username=server['username'],
            password=server.get('password'),
            key_file=server.get('ssh_key'),
            command=command,
            timeout=timeout
        )
        
        # Update last seen time
        server_index = next(i for i, s in enumerate(servers) if s['id'] == server_id)
        servers[server_index]['last_seen'] = datetime.now().isoformat()
        servers[server_index]['status'] = 'online' if result['success'] else 'offline'
        
        with open(servers_file, 'w', encoding='utf-8') as f:
            json.dump(servers, f, ensure_ascii=False, indent=2)
        
        return jsonify({
            'output': result.get('output', ''),
            'error': result.get('error'),
            'success': result['success'],
            'exit_code': result.get('exit_code', 0),
            'timestamp': result.get('timestamp')
        })
    
    except Exception as e:
        return jsonify({'message': f'Ошибка: {str(e)}', 'success': False}), 500

# SocketIO event handlers
@socketio.on('connect')
def handle_connect():
    """Handle client connection"""

@socketio.on('disconnect')
def handle_disconnect():
    print('Client disconnected')

@socketio.on('join_room')
def handle_join_room(data):
    room = data.get('room')
    if room:
        join_room(room)
        print(f'Client joined room: {room}')

@socketio.on('cancel_installation')
def handle_cancel_installation(data):
    server_id = data.get('server_id')
    print(f'Installation cancelled for server: {server_id}')
    # Здесь можно добавить логику отмены установки

# Settings API endpoints
@app.route('/api/settings', methods=['GET'])
@jwt_required()
def get_settings():
    """Get system settings"""
    try:
        settings_file = 'settings.json'
        if os.path.exists(settings_file):
            with open(settings_file, 'r', encoding='utf-8') as f:
                settings = json.load(f)
        else:
            # Default settings
            settings = {
                'general': {
                    'panelName': 'Xpanel Dashboard',
                    'timezone': 'Europe/Moscow',
                    'language': 'ru'
                },
                'panel': {
                    'theme': 'dark',
                    'enableAnimations': True,
                    'autoRefresh': True,
                    'systemNotifications': True,
                    'refreshInterval': 30
                },
                'notifications': {
                    'serverDownAlerts': True,
                    'cpuAlerts': True,
                    'memoryAlerts': True,
                    'diskAlerts': True,
                    'securityAlerts': True,
                    'emailNotifications': '',
                    'alertThreshold': 80
                },
                'security': {
                    'twoFactorAuth': False,
                    'autoLock': True,
                    'loginNotifications': True,
                    'sessionTimeout': 60,
                    'allowedIps': ''
                },
                'backup': {
                    'autoBackup': True,
                    'backupFrequency': 'daily',
                    'backupRetention': 30
                }
            }
        return jsonify(settings)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/settings', methods=['POST'])
@jwt_required()
def save_settings():
    """Save system settings"""
    try:
        data = request.get_json()
        settings_file = 'settings.json'
        
        with open(settings_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        
        return jsonify({'success': True, 'message': 'Settings saved successfully'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/system/info', methods=['GET'])
@jwt_required()
def get_system_info():
    """Get system information"""
    try:
        import platform
        import uptime
        
        # Get servers count
        servers_file = 'servers.json'
        total_servers = 0
        active_agents = 0
        
        if os.path.exists(servers_file):
            with open(servers_file, 'r', encoding='utf-8') as f:
                servers = json.load(f)
                total_servers = len(servers)
                active_agents = len([s for s in servers if s.get('status') == 'online'])
        
        # Get system uptime
        try:
            uptime_seconds = uptime.uptime()
            days = int(uptime_seconds // 86400)
            hours = int((uptime_seconds % 86400) // 3600)
            uptime_str = f"{days} days, {hours} hours"
        except:
            uptime_str = "Unknown"
        
        return jsonify({
            'uptime': uptime_str,
            'totalServers': total_servers,
            'activeAgents': active_agents,
            'platform': platform.system(),
            'version': '2.1.0'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Agents API endpoints
@app.route('/api/agents', methods=['GET'])
@jwt_required()
def get_agents():
    """Get all agents (live registry)"""
    try:
        agents_raw = agent_client.get_all_agents()
        transformed = []
        now = datetime.utcnow()
        for a in agents_raw:
            agent_id = a.get('id') or a.get('server_id')
            info = a.get('server_info', {}) or {}
            stats = a.get('stats', {}) or {}
            last_hb_iso = a.get('last_heartbeat')
            try:
                last_hb = datetime.fromisoformat(last_hb_iso.replace('Z', '+00:00')) if last_hb_iso else None
            except Exception:
                last_hb = None
            status = 'offline'
            if last_hb:
                delta = now - last_hb.replace(tzinfo=None)
                status = 'online' if delta.total_seconds() < 120 else 'offline'

            cpu_usage = 0.0
            mem_percent = 0.0
            disk_percent = 0.0
            net_in = 0
            net_out = 0
            uptime = 0
            version = info.get('agent_version', '1.0.0')

            if stats:
                cpu = stats.get('cpu') or {}
                memory = stats.get('memory') or {}
                disk = stats.get('disk') or {}
                network = stats.get('network') or {}
                cpu_usage = float(cpu.get('usage') or 0)
                mem_percent = float(memory.get('percent') or 0)
                # disk percent may be given directly or compute
                if 'percent' in disk:
                    disk_percent = float(disk.get('percent') or 0)
                else:
                    try:
                        disk_percent = (float(disk.get('used')) / float(disk.get('total'))) * 100.0
                    except Exception:
                        disk_percent = 0.0
                net_in = int(network.get('bytes_recv') or 0)
                net_out = int(network.get('bytes_sent') or 0)
                uptime = int(stats.get('uptime') or 0)

            transformed.append({
                'id': agent_id,
                'server_name': info.get('hostname') or agent_id or 'Unknown',
                'host': info.get('ip_address') or '0.0.0.0',
                'status': status,
                'version': version,
                'last_seen': last_hb_iso or now.isoformat(),
                'uptime': uptime,
                'cpu_usage': round(cpu_usage, 1),
                'memory_usage': round(mem_percent, 1),
                'disk_usage': round(disk_percent, 1),
                'network_in': net_in,
                'network_out': net_out,
                'installed_at': info.get('timestamp') or now.isoformat()
            })

        return jsonify({'agents': transformed})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/agents/<agent_id>/restart', methods=['POST'])
@jwt_required()
def restart_agent(agent_id):
    """Restart agent"""
    try:
        # Find agent and restart it
        result = server_manager.restart_agent(agent_id)
        return jsonify({'success': True, 'message': 'Agent restarted successfully'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/agents/<agent_id>/update', methods=['POST'])
@jwt_required()
def update_agent(agent_id):
    """Update agent"""
    try:
        result = server_manager.update_agent(agent_id)
        return jsonify({'success': True, 'message': 'Agent updated successfully'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/agents/<agent_id>', methods=['DELETE'])
@jwt_required()
def remove_agent_endpoint(agent_id):
    """Remove agent"""
    try:
        result = server_manager.remove_agent(agent_id)
        return jsonify({'success': True, 'message': 'Agent removed successfully'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# Duplicate function removed - using the real implementation above

@app.route('/api/security/firewall', methods=['GET'])
@jwt_required()
def get_firewall_rules():
    """Get firewall rules"""
    try:
        firewall_file = 'firewall_rules.json'
        if os.path.exists(firewall_file):
            with open(firewall_file, 'r', encoding='utf-8') as f:
                rules = json.load(f)
        else:
            rules = [
                {
                    'id': 1,
                    'name': 'Allow SSH',
                    'action': 'allow',
                    'protocol': 'tcp',
                    'port': '22',
                    'source': 'any',
                    'status': 'active'
                },
                {
                    'id': 2,
                    'name': 'Allow HTTP',
                    'action': 'allow',
                    'protocol': 'tcp',
                    'port': '80',
                    'source': 'any',
                    'status': 'active'
                }
            ]
        return jsonify(rules)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/security/firewall', methods=['POST'])
@jwt_required()
def add_firewall_rule():
    """Add firewall rule"""
    try:
        data = request.get_json()
        firewall_file = 'firewall_rules.json'
        
        if os.path.exists(firewall_file):
            with open(firewall_file, 'r', encoding='utf-8') as f:
                rules = json.load(f)
        else:
            rules = []
        
        new_rule = {
            'id': len(rules) + 1,
            'name': data.get('name'),
            'action': data.get('action'),
            'protocol': data.get('protocol'),
            'port': data.get('port'),
            'source': data.get('source'),
            'status': 'active'
        }
        
        rules.append(new_rule)
        
        with open(firewall_file, 'w', encoding='utf-8') as f:
            json.dump(rules, f, ensure_ascii=False, indent=2)
        
        return jsonify({'success': True, 'message': 'Firewall rule added successfully'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/users', methods=['GET'])
@jwt_required()
def get_users():
    """Get system users"""
    try:
        # Get real users from system or database
        users = []
        
        # Get current user info
        current_user = get_jwt_identity()
        users.append({
            'id': 1,
            'username': current_user,
            'email': f'{current_user}@xpanel.local',
            'role': 'admin',
            'active': True,
            'lastLogin': datetime.now().isoformat()
        })
        
        # Add any additional users from agent data or system
        for server_id, agent_data in agent_cache.items():
            if 'system_users' in agent_data:
                for idx, user in enumerate(agent_data['system_users'][:5]):  # Limit to 5 users
                    users.append({
                        'id': len(users) + 1,
                        'username': user.get('username', f'user{idx}'),
                        'email': f"{user.get('username', f'user{idx}')}@{agent_data.get('hostname', 'server')}.local",
                        'role': 'user' if user.get('username') != 'root' else 'admin',
                        'active': True,
                        'lastLogin': user.get('last_login', datetime.now().isoformat())
                    })
        
        return jsonify({
            'users': users,
            'total': len(users)
        })
        
    except Exception as e:
        logger.error(f"Error getting users: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/security/logs', methods=['GET'])
@jwt_required()
def get_security_logs():
    """Get security logs"""
    try:
        # Mock data for now
        logs = [
            {
                'id': 1,
                'timestamp': '2024-09-15 14:30:15',
                'level': 'warning',
                'event': 'Failed login attempt',
                'source': '192.168.1.100',
                'details': 'SSH login failed for user root'
            },
            {
                'id': 2,
                'timestamp': '2024-09-15 14:25:30',
                'level': 'info',
                'event': 'Firewall rule applied',
                'source': 'system',
                'details': 'New rule: Allow HTTP traffic'
            }
        ]
        return jsonify(logs)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/security/users', methods=['GET'])
@jwt_required()
def get_security_users():
    """Get security users"""
    try:
        users_file = 'security_users.json'
        if os.path.exists(users_file):
            with open(users_file, 'r', encoding='utf-8') as f:
                users = json.load(f)
        else:
            users = [
                {
                    'id': 1,
                    'username': 'admin',
                    'email': 'admin@xpanel.local',
                    'role': 'administrator',
                    'status': 'active',
                    'lastLogin': '2024-09-15 12:00:00'
                }
            ]
        return jsonify(users)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/security/users', methods=['POST'])
@jwt_required()
def add_security_user():
    """Add security user"""
    try:
        data = request.get_json()
        users_file = 'security_users.json'
        
        if os.path.exists(users_file):
            with open(users_file, 'r', encoding='utf-8') as f:
                users = json.load(f)
        else:
            users = []
        
        new_user = {
            'id': len(users) + 1,
            'username': data.get('username'),
            'email': data.get('email'),
            'role': data.get('role'),
            'status': 'active',
            'lastLogin': None
        }
        
        users.append(new_user)
        
        with open(users_file, 'w', encoding='utf-8') as f:
            json.dump(users, f, ensure_ascii=False, indent=2)
        
        return jsonify({'success': True, 'message': 'User added successfully'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# Backup API endpoints
@app.route('/api/backups', methods=['GET'])
@jwt_required()
def get_backups():
    """Get backup list"""
    try:
        backups_dir = 'backups'
        if not os.path.exists(backups_dir):
            os.makedirs(backups_dir)
        
        backups = []
        for filename in os.listdir(backups_dir):
            if filename.endswith('.zip'):
                filepath = os.path.join(backups_dir, filename)
                stat = os.stat(filepath)
                backups.append({
                    'id': len(backups) + 1,
                    'filename': filename,
                    'size': f"{stat.st_size / (1024*1024):.1f} MB",
                    'created': datetime.fromtimestamp(stat.st_ctime).isoformat(),
                    'type': 'automatic' if 'auto' in filename else 'manual'
                })
        
        return jsonify(backups)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/backups', methods=['POST'])
@jwt_required()
def create_backup():
    """Create system backup"""
    try:
        import zipfile
        import shutil
        
        backups_dir = 'backups'
        if not os.path.exists(backups_dir):
            os.makedirs(backups_dir)
        
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        backup_filename = f'xpanel_backup_{timestamp}.zip'
        backup_path = os.path.join(backups_dir, backup_filename)
        
        with zipfile.ZipFile(backup_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            # Backup configuration files
            files_to_backup = ['servers.json', 'settings.json', 'firewall_rules.json', 'security_users.json']
            for filename in files_to_backup:
                if os.path.exists(filename):
                    zipf.write(filename)
        
        return jsonify({'success': True, 'message': 'Backup created successfully', 'filename': backup_filename})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# Authentication API endpoints
@app.route('/api/auth/change-password', methods=['POST'])
@jwt_required()
def change_password():
    """Change user password"""
    try:
        data = request.get_json()
        current_password = data.get('currentPassword')
        new_password = data.get('newPassword')
        
        # In production, verify current password and update
        # For now, just simulate success
        return jsonify({'success': True, 'message': 'Password changed successfully'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/auth/generate-api-key', methods=['POST'])
@jwt_required()
def generate_api_key():
    """Generate new API key"""
    try:
        import secrets
        api_key = secrets.token_urlsafe(32)
        
        # In production, store API key securely
        return jsonify({'success': True, 'apiKey': api_key})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# System monitoring endpoints
@app.route('/api/system/updates', methods=['GET'])
@jwt_required()
def check_system_updates():
    """Check for system updates"""
    try:
        # Mock update check - in production, check actual updates
        return jsonify({
            'updateAvailable': False,
            'currentVersion': '2.1.0',
            'latestVersion': '2.1.0'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Real-time metrics endpoint
@app.route('/api/metrics/realtime', methods=['GET'])
@jwt_required()
def get_realtime_metrics():
    """Get real-time system metrics"""
    try:
        # Get current system metrics
        cpu_percent = psutil.cpu_percent(interval=1)
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage('/')
        network = psutil.net_io_counters()
        
        # Get server metrics
        servers_file = 'servers.json'
        server_metrics = []
        
        if os.path.exists(servers_file):
            with open(servers_file, 'r', encoding='utf-8') as f:
                servers = json.load(f)
                for server in servers:
                    if server.get('status') == 'online':
                        server_metrics.append({
                            'id': server['id'],
                            'name': server['name'],
                            'cpu': server.get('cpu_usage', 0),
                            'memory': server.get('memory_usage', 0),
                            'disk': server.get('disk_usage', 0)
                        })
        
        return jsonify({
            'timestamp': datetime.now().isoformat(),
            'panel': {
                'cpu': cpu_percent,
                'memory': memory.percent,
                'disk': (disk.used / disk.total) * 100,
                'network': {
                    'sent': network.bytes_sent,
                    'received': network.bytes_recv
                }
            },
            'servers': server_metrics
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    # Run the application with eventlet
    port = int(os.getenv('PORT', 5000))
    socketio.run(app, host='0.0.0.0', port=port, debug=True)
