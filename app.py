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
    return render_template('dashboard_v2.html')

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

@app.route('/api/servers', methods=['GET'])
@jwt_required()
def get_servers():
    """Get all servers with their status"""
    servers = server_manager.get_all_servers()
    return jsonify({'servers': servers})

@app.route('/api/system/stats', methods=['GET'])
@jwt_required()
def get_system_stats():
    """Get system statistics"""
    try:
        cpu_percent = psutil.cpu_percent(interval=1)
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage('/')
        network = psutil.net_io_counters()
        
        return jsonify({
            'cpu': cpu_percent,
            'memory': memory.percent,
            'disk': disk.percent,
            'network': network.bytes_sent + network.bytes_recv
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/servers', methods=['POST'])
@jwt_required()
def add_server():
    """Add new server"""
    data = request.get_json()
    server_id = server_manager.add_server(
        name=data.get('name'),
        host=data.get('host'),
        port=data.get('port', 22),
        username=data.get('username'),
        password=data.get('password'),
        key_file=data.get('key_file')
    )
    return jsonify({'success': True, 'server_id': server_id})

@app.route('/api/servers/<server_id>/stats', methods=['GET'])
@jwt_required()
def get_server_stats(server_id):
    """Get server statistics"""
    stats = server_manager.get_server_stats(server_id)
    return jsonify(stats)

@app.route('/api/servers/<server_id>/install-agent', methods=['POST'])
@jwt_required()
def install_agent(server_id):
    """Install agent on server"""
    data = request.get_json()
    result = server_manager.install_agent_remote(
        host=data.get('host'),
        port=data.get('port', 22),
        username=data.get('username'),
        password=data.get('password'),
        key_file=data.get('key_file')
    )
    return jsonify(result)

@app.route('/api/servers/<server_id>/command', methods=['POST'])
@jwt_required()
def execute_command(server_id):
    """Execute command on server"""
    data = request.get_json()
    command = data.get('command')
    result = server_manager.execute_command(server_id, command)
    return jsonify(result)

@app.route('/api/servers/<server_id>', methods=['DELETE'])
@jwt_required()
def delete_server(server_id):
    """Delete server from panel"""
    try:
        server_manager.remove_server(server_id)
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 400

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

@app.route('/api/servers/install-agent', methods=['POST'])
@jwt_required()
def install_agent_remote():
    """Automatically install agent on remote server"""
    data = request.get_json()
    
    host = data.get('host')
    port = data.get('port', 22)
    username = data.get('username')
    password = data.get('password')
    key_file = data.get('key_file')
    panel_address = data.get('panel_address', request.host.split(':')[0])
    
    if not all([host, username]):
        return jsonify({'success': False, 'error': 'Host and username are required'}), 400
    
    try:
        result = server_manager.install_agent_remote(
            host=host,
            port=port,
            username=username,
            password=password,
            key_file=key_file,
            panel_address=panel_address
        )
        return jsonify(result)
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

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
    """Receive heartbeat from agent"""
    data = request.get_json()
    
    if not data or 'server_id' not in data:
        return jsonify({'success': False, 'error': 'Invalid heartbeat data'}), 400
    
    # Process agent heartbeat
    result = agent_client.process_heartbeat(data)
    
    # Emit real-time update via WebSocket
    socketio.emit('server_stats', {
        'server_id': data['server_id'],
        'stats': data
    })
    
    return jsonify({'success': True, 'message': 'Heartbeat received'})

@app.route('/api/agent/register', methods=['POST'])
def agent_register():
    """Register new agent"""
    data = request.get_json()
    
    if not data or 'server_id' not in data:
        return jsonify({'success': False, 'error': 'Invalid registration data'}), 400
    
    # Register agent
    agent_client.register_agent(data['server_id'], data)
    
    return jsonify({'success': True, 'message': 'Agent registered successfully'})

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
        
        return jsonify(servers)
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
    try:
        servers_file = 'servers.json'
        
        if not os.path.exists(servers_file):
            return jsonify({'message': 'Сервер не найден'}), 404
        
        with open(servers_file, 'r', encoding='utf-8') as f:
            servers = json.load(f)
        
        server = next((s for s in servers if s['id'] == server_id), None)
        if not server:
            return jsonify({'message': 'Сервер не найден'}), 404
        
        # Test SSH connection
        import paramiko
        
        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        
        try:
            if server['auth_method'] == 'key' and server.get('ssh_key'):
                # Use SSH key authentication
                key = paramiko.RSAKey.from_private_key(io.StringIO(server['ssh_key']))
                ssh.connect(
                    hostname=server['host'],
                    port=server['port'],
                    username=server['username'],
                    pkey=key,
                    timeout=10
                )
            else:
                # Use password authentication
                ssh.connect(
                    hostname=server['host'],
                    port=server['port'],
                    username=server['username'],
                    password=server.get('password', ''),
                    timeout=10
                )
            
            # Update server status
            server_index = next(i for i, s in enumerate(servers) if s['id'] == server_id)
            servers[server_index]['status'] = 'online'
            
            # Get basic system info
            stdin, stdout, stderr = ssh.exec_command('uptime')
            uptime = stdout.read().decode().strip()
            
            ssh.close()
            
            # Save updated status
            with open(servers_file, 'w', encoding='utf-8') as f:
                json.dump(servers, f, ensure_ascii=False, indent=2)
            
            return jsonify({
                'message': 'Соединение успешно',
                'status': 'online',
                'uptime': uptime
            })
        
        except Exception as conn_error:
            # Update server status to offline
            server_index = next(i for i, s in enumerate(servers) if s['id'] == server_id)
            servers[server_index]['status'] = 'offline'
            
            with open(servers_file, 'w', encoding='utf-8') as f:
                json.dump(servers, f, ensure_ascii=False, indent=2)
            
            return jsonify({
                'message': f'Ошибка соединения: {str(conn_error)}',
                'status': 'offline'
            }), 400
    
    except Exception as e:
        return jsonify({'message': f'Ошибка тестирования соединения: {str(e)}'}), 500

@app.route('/api/servers/execute', methods=['POST'])
@jwt_required()
def execute_command():
    try:
        data = request.get_json()
        server_id = data.get('server_id')
        command = data.get('command')
        
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
        
        # Execute command via SSH
        import paramiko
        
        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        
        try:
            if server['auth_method'] == 'key' and server.get('ssh_key'):
                key = paramiko.RSAKey.from_private_key(io.StringIO(server['ssh_key']))
                ssh.connect(
                    hostname=server['host'],
                    port=server['port'],
                    username=server['username'],
                    pkey=key,
                    timeout=10
                )
            else:
                ssh.connect(
                    hostname=server['host'],
                    port=server['port'],
                    username=server['username'],
                    password=server.get('password', ''),
                    timeout=10
                )
            
            # Execute command
            stdin, stdout, stderr = ssh.exec_command(command)
            
            output = stdout.read().decode('utf-8', errors='ignore')
            error = stderr.read().decode('utf-8', errors='ignore')
            
            ssh.close()
            
            result = output if output else error
            
            return jsonify({
                'output': result,
                'success': True
            })
        
        except Exception as exec_error:
            return jsonify({
                'message': f'Ошибка выполнения команды: {str(exec_error)}',
                'success': False
            }), 400
    
    except Exception as e:
        return jsonify({'message': f'Ошибка: {str(e)}'}), 500

# SocketIO event handlers
@socketio.on('connect')
def handle_connect():
    """Handle client connection"""
    print(f'Client connected: {request.sid}')
    emit('connected', {'status': 'Connected to Xpanel'})

@socketio.on('disconnect')
def handle_disconnect():
    """Handle client disconnection"""
    print(f'Client disconnected: {request.sid}')

@socketio.on('join_room')
def handle_join_room(data):
    """Handle client joining a room for server-specific updates"""
    room = data.get('room')
    if room:
        join_room(room)
        emit('joined_room', {'room': room})

if __name__ == '__main__':
    # Run the application with eventlet
    port = int(os.getenv('PORT', 5000))
    socketio.run(app, host='0.0.0.0', port=port, debug=True)
