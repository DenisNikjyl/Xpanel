#!/usr/bin/env python3
"""
Xpanel - VPS Management Panel
Main Flask application
"""

from flask import Flask, render_template, request, jsonify, session
from flask_socketio import SocketIO, emit, join_room, leave_room
from flask_jwt_extended import JWTManager, jwt_required, create_access_token, get_jwt_identity
from flask_cors import CORS
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

# Load environment variables
load_dotenv()

app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'xpanel-secret-key-change-in-production')
app.config['JWT_SECRET_KEY'] = os.getenv('JWT_SECRET_KEY', 'jwt-secret-change-in-production')
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=24)

# Initialize extensions
jwt = JWTManager(app)
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet')
CORS(app)

# Initialize managers
server_manager = ServerManager()
agent_client = AgentClient()

# In-memory user storage (replace with database in production)
users_db = {
    'admin': {
        'password': bcrypt.hashpw('admin123'.encode('utf-8'), bcrypt.gensalt()),
        'role': 'admin'
    }
}

@app.route('/')
def index():
    return render_template('landing.html')

@app.route('/ru')
def index_ru():
    return render_template('landing_ru.html')

@app.route('/dashboard')
def dashboard():
    return render_template('index.html')

@app.route('/login')
def login_page():
    return render_template('login.html')

@app.route('/login/ru')
def login_page_ru():
    return render_template('login_ru.html')

@app.route('/api/login', methods=['POST'])
def login():
    """User authentication endpoint"""
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    
    if username in users_db:
        stored_password = users_db[username]['password']
        if bcrypt.checkpw(password.encode('utf-8'), stored_password):
            access_token = create_access_token(identity=username)
            return jsonify({
                'success': True,
                'access_token': access_token,
                'user': {
                    'username': username,
                    'role': users_db[username]['role']
                }
            })
    
    return jsonify({'success': False, 'message': 'Invalid credentials'}), 401

@app.route('/api/servers', methods=['GET'])
@jwt_required()
def get_servers():
    """Get all servers with their status"""
    servers = server_manager.get_all_servers()
    return jsonify({'servers': servers})

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
def install_agent():
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
def get_local_stats():
    """Get local system statistics"""
    try:
        # CPU usage
        cpu_percent = psutil.cpu_percent(interval=1)
        
        # Memory usage
        memory = psutil.virtual_memory()
        
        # Disk usage
        disk = psutil.disk_usage('/')
        
        # Network stats
        network = psutil.net_io_counters()
        
        stats = {
            'cpu': {
                'usage': cpu_percent,
                'cores': psutil.cpu_count()
            },
            'memory': {
                'total': memory.total,
                'available': memory.available,
                'used': memory.used,
                'percent': memory.percent
            },
            'disk': {
                'total': disk.total,
                'used': disk.used,
                'free': disk.free,
                'percent': (disk.used / disk.total) * 100
            },
            'network': {
                'bytes_sent': network.bytes_sent,
                'bytes_recv': network.bytes_recv,
                'packets_sent': network.packets_sent,
                'packets_recv': network.packets_recv
            },
            'timestamp': datetime.now().isoformat()
        }
        
        return jsonify(stats)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# WebSocket events for real-time updates
@socketio.on('connect')
def handle_connect():
    """Handle client connection"""
    print(f'Client connected: {request.sid}')
    emit('connected', {'status': 'Connected to Xpanel'})

@socketio.on('disconnect')
def handle_disconnect():
    """Handle client disconnection"""
    print(f'Client disconnected: {request.sid}')

@socketio.on('join_server_room')
def handle_join_server_room(data):
    """Join server-specific room for updates"""
    server_id = data.get('server_id')
    join_room(f'server_{server_id}')
    emit('joined_room', {'server_id': server_id})

@socketio.on('leave_server_room')
def handle_leave_server_room(data):
    """Leave server-specific room"""
    server_id = data.get('server_id')
    leave_room(f'server_{server_id}')
    emit('left_room', {'server_id': server_id})

def broadcast_stats():
    """Background task to broadcast system stats"""
    while True:
        try:
            # Get local stats
            with app.app_context():
                response = get_local_stats()
                if response.status_code == 200:
                    stats = response.get_json()
                    socketio.emit('system_stats', stats)
            
            # Get stats for all servers
            for server_id in server_manager.get_server_ids():
                stats = server_manager.get_server_stats(server_id)
                socketio.emit('server_stats', {
                    'server_id': server_id,
                    'stats': stats
                }, room=f'server_{server_id}')
            
            time.sleep(5)  # Update every 5 seconds
        except Exception as e:
            print(f"Error in broadcast_stats: {e}")
            time.sleep(5)

if __name__ == '__main__':
    # Start background stats broadcasting
    stats_thread = threading.Thread(target=broadcast_stats, daemon=True)
    stats_thread.start()
    
    # Run the application
    port = int(os.getenv('PORT', 5000))
    socketio.run(app, host='0.0.0.0', port=port, debug=True)
