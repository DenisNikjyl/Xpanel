"""
Server Manager - Handles VPS server connections and operations
"""

import paramiko
import psutil
import json
import uuid
import os
import io
from datetime import datetime
import threading
import time

class ServerManager:
    def __init__(self):
        self.servers = {}
        self.connections = {}
        self.custom_actions = {}
        
    def add_server(self, name, host, port=22, username=None, password=None, key_file=None):
        """Add a new server to management"""
        server_id = str(uuid.uuid4())
        
        server_config = {
            'id': server_id,
            'name': name,
            'host': host,
            'port': port,
            'username': username,
            'password': password,
            'key_file': key_file,
            'status': 'disconnected',
            'added_at': datetime.now().isoformat(),
            'last_seen': None,
            'last_ping': None,
            'cpu_usage': 0,
            'memory_usage': 0,
            'disk_usage': 0,
            'network_usage': 0
        }
        
        self.servers[server_id] = server_config
        return server_id
    
    def get_all_servers(self):
        """Get list of all servers"""
        return list(self.servers.values())
    
    def get_server_ids(self):
        """Get list of server IDs"""
        return list(self.servers.keys())
    
    def remove_server(self, server_id):
        """Remove server from management"""
        if server_id in self.servers:
            # Close connection if exists
            if server_id in self.connections:
                try:
                    self.connections[server_id].close()
                except:
                    pass
                del self.connections[server_id]
            
            # Remove server
            del self.servers[server_id]
            return True
        return False
    
    def remove_agent_from_server(self, server_id):
        """Remove agent from remote server"""
        if server_id not in self.servers:
            raise Exception("Server not found")
        
        server = self.servers[server_id]
        
        try:
            # Connect to server
            ssh = paramiko.SSHClient()
            ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            
            if server['key_file']:
                ssh.connect(
                    hostname=server['host'],
                    port=server['port'],
                    username=server['username'],
                    key_filename=server['key_file']
                )
            else:
                ssh.connect(
                    hostname=server['host'],
                    port=server['port'],
                    username=server['username'],
                    password=server['password']
                )
            
            # Commands to remove agent
            remove_commands = [
                'sudo systemctl stop xpanel-agent || true',
                'sudo systemctl disable xpanel-agent || true',
                'sudo rm -f /etc/systemd/system/xpanel-agent.service',
                'sudo rm -rf /opt/xpanel-agent',
                'sudo systemctl daemon-reload',
                'echo "Agent removed successfully"'
            ]
            
            for cmd in remove_commands:
                stdin, stdout, stderr = ssh.exec_command(cmd)
                stdout.read()  # Wait for command to complete
            
            ssh.close()
            
            # Update server status
            self.servers[server_id]['status'] = 'agent_removed'
            self.servers[server_id]['last_ping'] = None
            
            return True
            
        except Exception as e:
            raise Exception(f"Failed to remove agent: {str(e)}")
    
    def reinstall_agent_on_server(self, server_id):
        """Reinstall agent on remote server"""
        if server_id not in self.servers:
            raise Exception("Server not found")
        
        try:
            # First remove existing agent
            self.remove_agent_from_server(server_id)
            
            # Then install new agent
            server = self.servers[server_id]
            result = self.install_agent_remote(
                host=server['host'],
                port=server['port'],
                username=server['username'],
                password=server['password'],
                key_file=server['key_file']
            )
            
            return result
            
        except Exception as e:
            raise Exception(f"Failed to reinstall agent: {str(e)}")
    
    # Custom Actions Management
    def get_custom_actions(self):
        """Get all custom actions"""
        return list(self.custom_actions.values())
    
    def create_custom_action(self, name, icon, color, command, confirm=True):
        """Create new custom action"""
        action_id = str(uuid.uuid4())
        
        action = {
            'id': action_id,
            'name': name,
            'icon': icon,
            'color': color,
            'command': command,
            'confirm': confirm,
            'created_at': datetime.now().isoformat()
        }
        
        self.custom_actions[action_id] = action
        return action_id
    
    def delete_custom_action(self, action_id):
        """Delete custom action"""
        if action_id in self.custom_actions:
            del self.custom_actions[action_id]
            return True
        return False
    
    def execute_custom_action(self, server_id, action_id, command):
        """Execute custom action on server"""
        if server_id not in self.servers:
            raise Exception("Server not found")
        
        if action_id not in self.custom_actions:
            raise Exception("Action not found")
        
        server = self.servers[server_id]
        
        try:
            # Connect to server
            ssh = paramiko.SSHClient()
            ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            
            if server['key_file']:
                ssh.connect(
                    hostname=server['host'],
                    port=server['port'],
                    username=server['username'],
                    key_filename=server['key_file']
                )
            else:
                ssh.connect(
                    hostname=server['host'],
                    port=server['port'],
                    username=server['username'],
                    password=server['password']
                )
            
            # Execute command
            stdin, stdout, stderr = ssh.exec_command(command)
            output = stdout.read().decode('utf-8')
            error = stderr.read().decode('utf-8')
            
            ssh.close()
            
            if error:
                raise Exception(f"Command failed: {error}")
            
            return output
            
        except Exception as e:
            raise Exception(f"Failed to execute action: {str(e)}")
    
    def connect_to_server(self, server_id):
        """Establish SSH connection to server"""
        if server_id not in self.servers:
            return False
            
        server = self.servers[server_id]
        
        try:
            ssh = paramiko.SSHClient()
            ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            
            if server.get('key_file'):
                # Use key file authentication
                ssh.connect(
                    hostname=server['host'],
                    port=server['port'],
                    username=server['username'],
                    key_filename=server['key_file']
                )
            else:
                # Use password authentication
                ssh.connect(
                    hostname=server['host'],
                    port=server['port'],
                    username=server['username'],
                    password=server['password']
                )
            
            self.connections[server_id] = ssh
            self.servers[server_id]['status'] = 'connected'
            self.servers[server_id]['last_seen'] = datetime.now().isoformat()
            return True
            
        except Exception as e:
            print(f"Failed to connect to server {server_id}: {e}")
            self.servers[server_id]['status'] = 'error'
            return False
    
    def disconnect_from_server(self, server_id):
        """Disconnect from server"""
        if server_id in self.connections:
            self.connections[server_id].close()
            del self.connections[server_id]
            self.servers[server_id]['status'] = 'disconnected'
    
    def execute_command(self, server_id, command):
        """Execute command on remote server"""
        if server_id not in self.connections:
            if not self.connect_to_server(server_id):
                return {'success': False, 'error': 'Failed to connect to server'}
        
        try:
            ssh = self.connections[server_id]
            stdin, stdout, stderr = ssh.exec_command(command)
            
            output = stdout.read().decode('utf-8')
            error = stderr.read().decode('utf-8')
            exit_code = stdout.channel.recv_exit_status()
            
            return {
                'success': True,
                'output': output,
                'error': error,
                'exit_code': exit_code,
                'timestamp': datetime.now().isoformat()
            }
            
        except Exception as e:
            return {'success': False, 'error': str(e)}
    
    def get_server_stats(self, server_id):
        """Get server system statistics"""
        if server_id not in self.servers:
            return {'error': 'Server not found'}
        
        # Try to get stats via SSH command
        commands = {
            'cpu': "top -bn1 | grep 'Cpu(s)' | awk '{print $2}' | cut -d'%' -f1",
            'memory': "free -m | awk 'NR==2{printf \"%.1f\", $3*100/$2}'",
            'disk': "df -h / | awk 'NR==2{print $5}' | cut -d'%' -f1",
            'uptime': "uptime -p",
            'load': "uptime | awk -F'load average:' '{print $2}'"
        }
        
        stats = {
            'server_id': server_id,
            'timestamp': datetime.now().isoformat(),
            'status': self.servers[server_id]['status']
        }
        
        if server_id in self.connections or self.connect_to_server(server_id):
            for stat_name, command in commands.items():
                result = self.execute_command(server_id, command)
                if result['success']:
                    stats[stat_name] = result['output'].strip()
                else:
                    stats[stat_name] = 'N/A'
        else:
            # Server not connected, return placeholder data
            stats.update({
                'cpu': 'N/A',
                'memory': 'N/A',
                'disk': 'N/A',
                'uptime': 'N/A',
                'load': 'N/A'
            })
        
        return stats
    
    def get_server_files(self, server_id, path='/'):
        """Get file listing from server"""
        command = f"ls -la {path}"
        result = self.execute_command(server_id, command)
        
        if result['success']:
            files = []
            lines = result['output'].strip().split('\n')[1:]  # Skip first line (total)
            
            for line in lines:
                if line.strip():
                    parts = line.split()
                    if len(parts) >= 9:
                        files.append({
                            'permissions': parts[0],
                            'size': parts[4],
                            'modified': ' '.join(parts[5:8]),
                            'name': ' '.join(parts[8:]),
                            'is_directory': parts[0].startswith('d')
                        })
            
            return {'success': True, 'files': files, 'path': path}
        
        return result
    
    def remove_server(self, server_id):
        """Remove server from management"""
        if server_id in self.connections:
            self.disconnect_from_server(server_id)
        
        if server_id in self.servers:
            del self.servers[server_id]
            return True
        
        return False

    def install_agent_remote(self, host, port=22, username=None, password=None, key_file=None, panel_address="64.188.70.12"):
        """Automatically install agent on remote server via SSH"""
        steps = []
        detailed_output = []
        
        try:
            steps.append("Connecting to server...")
            detailed_output.append(f"[INFO] Connecting to {username}@{host}:{port}")
            
            ssh = paramiko.SSHClient()
            ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            
            # Connect to server
            if key_file:
                ssh.connect(hostname=host, port=port, username=username, key_filename=key_file, timeout=30)
            else:
                ssh.connect(hostname=host, port=port, username=username, password=password, timeout=30)
            
            detailed_output.append("[SUCCESS] SSH connection established")
            
            # Step 1: Check system requirements
            steps.append("Checking system requirements...")
            detailed_output.append("[INFO] Checking system requirements...")
            
            stdin, stdout, stderr = ssh.exec_command("uname -a && python3 --version && systemctl --version")
            system_info = stdout.read().decode().strip()
            detailed_output.append(f"[INFO] System: {system_info.split()[0]} {system_info.split()[2]}")
            
            # Step 2: Create installation directory
            steps.append("Creating installation directory...")
            detailed_output.append("[INFO] Creating /opt/xpanel-agent directory...")
            
            stdin, stdout, stderr = ssh.exec_command("sudo mkdir -p /opt/xpanel-agent")
            stdout.read()
            detailed_output.append("[SUCCESS] Directory created")
            
            # Step 3: Download agent files
            steps.append("Downloading agent files...")
            detailed_output.append("[INFO] Downloading xpanel_agent.py...")
            
            # Generate installation script content
            install_script = self.generate_install_script(panel_address)
            
            # Create temporary script file
            stdin, stdout, stderr = ssh.exec_command("mktemp")
            script_path = stdout.read().decode().strip()
            
            if stderr.read():
                raise Exception("Failed to create temporary file")
            
            # Upload script content via SFTP
            sftp = ssh.open_sftp()
            with sftp.file(script_path, 'w') as f:
                f.write(install_script)
            sftp.close()
            detailed_output.append("[SUCCESS] Agent files downloaded")
            
            # Step 4: Install dependencies
            steps.append("Installing dependencies...")
            detailed_output.append("[INFO] Installing Python dependencies...")
            
            stdin, stdout, stderr = ssh.exec_command("sudo apt-get update -qq && sudo apt-get install -y python3-pip python3-requests")
            dep_output = stdout.read().decode()
            dep_error = stderr.read().decode()
            
            if "E:" in dep_error:
                detailed_output.append("[WARNING] Some packages may already be installed")
            else:
                detailed_output.append("[SUCCESS] Dependencies installed")
            
            # Step 5: Make script executable and run
            steps.append("Configuring agent service...")
            detailed_output.append("[INFO] Making installation script executable...")
            
            stdin, stdout, stderr = ssh.exec_command("chmod +x " + script_path)
            stdout.read()
            
            # Step 6: Execute installation script
            steps.append("Starting agent...")
            detailed_output.append("[INFO] Executing installation script...")
            
            # Use sudo -S to provide password non-interactively if needed
            if password:
                install_command = "sudo -S -p '' bash " + script_path + " --panel-address " + panel_address
                stdin, stdout, stderr = ssh.exec_command(install_command, get_pty=True)
                try:
                    stdin.write(password + "\n")
                    stdin.flush()
                except Exception:
                    pass
            else:
                install_command = "sudo bash " + script_path + " --panel-address " + panel_address
                stdin, stdout, stderr = ssh.exec_command(install_command, get_pty=True)
            
            output = stdout.read().decode()
            error = stderr.read().decode()
            exit_code = stdout.channel.recv_exit_status()
            
            if output:
                detailed_output.append(f"[OUTPUT] {output.strip()}")
            
            # Step 7: Verify installation
            steps.append("Verifying connection...")
            detailed_output.append("[INFO] Verifying agent installation...")
            
            stdin, stdout, stderr = ssh.exec_command("sudo systemctl status xpanel-agent --no-pager")
            status_output = stdout.read().decode()
            
            if "active (running)" in status_output:
                detailed_output.append("[SUCCESS] Agent is running and active")
            elif "inactive" in status_output:
                detailed_output.append("[WARNING] Agent installed but not running")
            else:
                detailed_output.append("[INFO] Agent status unknown")
            
            # Step 8: Cleanup
            steps.append("Cleaning up...")
            detailed_output.append("[INFO] Cleaning up temporary files...")
            
            ssh.exec_command("rm -f " + script_path)
            detailed_output.append("[SUCCESS] Cleanup completed")
            
            ssh.close()
            
            if exit_code == 0:
                detailed_output.append("[SUCCESS] Agent installation completed successfully!")
                return {
                    'success': True,
                    'message': 'Agent installed successfully',
                    'steps': steps,
                    'output': '\n'.join(detailed_output),
                    'detailed_log': detailed_output
                }
            else:
                detailed_output.append(f"[ERROR] Installation failed with exit code {exit_code}")
                if error:
                    detailed_output.append(f"[ERROR] {error.strip()}")
                return {
                    'success': False,
                    'error': f'Installation failed with exit code {exit_code}',
                    'output': '\n'.join(detailed_output),
                    'stderr': error,
                    'detailed_log': detailed_output
                }
                
        except paramiko.AuthenticationException as e:
            error_msg = f"Authentication failed: {str(e)}"
            detailed_output.append(f"[ERROR] {error_msg}")
            return {
                'success': False,
                'error': error_msg,
                'output': '\n'.join(detailed_output),
                'detailed_log': detailed_output
            }
        except paramiko.SSHException as e:
            error_msg = f"SSH connection error: {str(e)}"
            detailed_output.append(f"[ERROR] {error_msg}")
            return {
                'success': False,
                'error': error_msg,
                'output': '\n'.join(detailed_output),
                'detailed_log': detailed_output
            }
        except Exception as e:
            error_msg = f"Installation failed: {str(e)}"
            detailed_output.append(f"[ERROR] {error_msg}")
            return {
                'success': False,
                'error': error_msg,
                'output': '\n'.join(detailed_output),
                'detailed_log': detailed_output
            }
    
    def restart_agent(self, agent_id):
        """Restart agent on server"""
        try:
            # Find server by agent ID
            servers_file = 'servers.json'
            if os.path.exists(servers_file):
                with open(servers_file, 'r', encoding='utf-8') as f:
                    servers = json.load(f)
                
                server = next((s for s in servers if s['id'] == agent_id), None)
                if not server:
                    raise Exception('Server not found')
                
                # Connect via SSH and restart agent
                ssh = paramiko.SSHClient()
                ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
                
                if server.get('ssh_key'):
                    key = paramiko.RSAKey.from_private_key(io.StringIO(server['ssh_key']))
                    ssh.connect(
                        hostname=server['host'],
                        port=server['port'],
                        username=server['username'],
                        pkey=key
                    )
                else:
                    ssh.connect(
                        hostname=server['host'],
                        port=server['port'],
                        username=server['username'],
                        password=server.get('password', '')
                    )
                
                # Restart agent service
                stdin, stdout, stderr = ssh.exec_command('sudo systemctl restart xpanel-agent')
                stdout.read()
                ssh.close()
                
                return {'success': True, 'message': 'Agent restarted successfully'}
            else:
                raise Exception('No servers found')
                
        except Exception as e:
            raise Exception(f'Failed to restart agent: {str(e)}')
    
    def update_agent(self, agent_id):
        """Update agent on server"""
        try:
            servers_file = 'servers.json'
            if os.path.exists(servers_file):
                with open(servers_file, 'r', encoding='utf-8') as f:
                    servers = json.load(f)
                
                server = next((s for s in servers if s['id'] == agent_id), None)
                if not server:
                    raise Exception('Server not found')
                
                # Connect via SSH and update agent
                ssh = paramiko.SSHClient()
                ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
                
                if server.get('ssh_key'):
                    key = paramiko.RSAKey.from_private_key(io.StringIO(server['ssh_key']))
                    ssh.connect(
                        hostname=server['host'],
                        port=server['port'],
                        username=server['username'],
                        pkey=key
                    )
                else:
                    ssh.connect(
                        hostname=server['host'],
                        port=server['port'],
                        username=server['username'],
                        password=server.get('password', '')
                    )
                
                # Update agent
                update_commands = [
                    'cd /opt/xpanel-agent',
                    'sudo wget -O xpanel_agent.py https://raw.githubusercontent.com/xpanel/agent/main/xpanel_agent.py',
                    'sudo systemctl restart xpanel-agent'
                ]
                
                for cmd in update_commands:
                    stdin, stdout, stderr = ssh.exec_command(cmd)
                    stdout.read()
                
                ssh.close()
                
                return {'success': True, 'message': 'Agent updated successfully'}
            else:
                raise Exception('No servers found')
                
        except Exception as e:
            raise Exception(f'Failed to update agent: {str(e)}')
    
    def remove_agent(self, agent_id):
        """Remove agent from server"""
        try:
            servers_file = 'servers.json'
            if os.path.exists(servers_file):
                with open(servers_file, 'r', encoding='utf-8') as f:
                    servers = json.load(f)
                
                server = next((s for s in servers if s['id'] == agent_id), None)
                if not server:
                    raise Exception('Server not found')
                
                # Connect via SSH and remove agent
                ssh = paramiko.SSHClient()
                ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
                
                if server.get('ssh_key'):
                    key = paramiko.RSAKey.from_private_key(io.StringIO(server['ssh_key']))
                    ssh.connect(
                        hostname=server['host'],
                        port=server['port'],
                        username=server['username'],
                        pkey=key
                    )
                else:
                    ssh.connect(
                        hostname=server['host'],
                        port=server['port'],
                        username=server['username'],
                        password=server.get('password', '')
                    )
                
                # Remove agent
                remove_commands = [
                    'sudo systemctl stop xpanel-agent',
                    'sudo systemctl disable xpanel-agent',
                    'sudo rm -f /etc/systemd/system/xpanel-agent.service',
                    'sudo rm -rf /opt/xpanel-agent',
                    'sudo systemctl daemon-reload'
                ]
                
                for cmd in remove_commands:
                    stdin, stdout, stderr = ssh.exec_command(cmd)
                    stdout.read()
                
                ssh.close()
                
                return {'success': True, 'message': 'Agent removed successfully'}
            else:
                raise Exception('No servers found')
                
        except Exception as e:
            raise Exception(f'Failed to remove agent: {str(e)}')
    
    def get_server_stats(self, server_id):
        """Get server statistics"""
        if server_id not in self.servers:
            return {'error': 'Server not found'}
        
        # Return mock stats for now
        return {
            'cpu_usage': 25.5,
            'memory_usage': 67.2,
            'disk_usage': 45.8,
            'network_rx': 1024,
            'network_tx': 2048,
            'uptime': '5 days, 12:34:56'
        }
    
    def execute_command(self, server_id, command):
        """Execute command on server"""
        if server_id not in self.servers:
            return {'success': False, 'error': 'Server not found'}
        
        server = self.servers[server_id]
        
        try:
            # Connect to server
            ssh = paramiko.SSHClient()
            ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            
            if server['key_file']:
                ssh.connect(
                    hostname=server['host'],
                    port=server['port'],
                    username=server['username'],
                    key_filename=server['key_file']
                )
            else:
                ssh.connect(
                    hostname=server['host'],
                    port=server['port'],
                    username=server['username'],
                    password=server['password']
                )
            
            # Execute command
            stdin, stdout, stderr = ssh.exec_command(command)
            output = stdout.read().decode('utf-8')
            error = stderr.read().decode('utf-8')
            
            ssh.close()
            
            return {
                'success': True,
                'output': output,
                'error': error if error else None
            }
            
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def generate_install_script(self, panel_address):
        """Generate agent installation script"""
        script_template = '''#!/bin/bash

# Xpanel Agent Auto-Installation Script
# Generated automatically by Xpanel Control Panel

set -e

# Colors for output
RED='\\033[0;31m'
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
BLUE='\\033[0;34m'
NC='\\033[0m' # No Color

# Configuration
AGENT_USER="xpanel-agent"
AGENT_DIR="/opt/xpanel-agent"
SERVICE_NAME="xpanel-agent"
PANEL_ADDRESS="{panel_address}"
PANEL_PORT="5000"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}    Xpanel Agent Auto-Installation${NC}"
echo -e "${BLUE}========================================${NC}"

# Function to print status
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   print_error "This script must be run as root (use sudo)"
   exit 1
fi

# Detect package manager and install dependencies
print_status "Installing dependencies..."
if command -v apt-get &> /dev/null; then
    apt-get update -qq
    apt-get install -y python3 python3-pip python3-venv curl wget
elif command -v yum &> /dev/null; then
    yum install -y python3 python3-pip curl wget
elif command -v dnf &> /dev/null; then
    dnf install -y python3 python3-pip curl wget
else
    print_error "Unsupported package manager"
    exit 1
fi

# Create agent user
print_status "Creating agent user..."
if ! id "$AGENT_USER" &>/dev/null; then
    useradd -r -s /bin/false -d "$AGENT_DIR" "$AGENT_USER"
fi

# Create agent directory
print_status "Creating agent directory..."
mkdir -p "$AGENT_DIR"
cd "$AGENT_DIR"

# Download agent script
print_status "Downloading agent..."
cat > xpanel_agent.py << 'AGENT_SCRIPT_EOF'
#!/usr/bin/env python3
import os
import sys
import time
import json
import psutil
import socket
import requests
import subprocess
import threading
from datetime import datetime
import logging

class XpanelAgent:
    def __init__(self, panel_address="{panel_address}", panel_port=5000, server_id=None):
        self.panel_address = panel_address
        self.panel_port = panel_port
        self.server_id = server_id or self.generate_server_id()
        self.running = False
        self.heartbeat_interval = 30
        
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler('/opt/xpanel-agent/xpanel-agent.log'),
                logging.StreamHandler()
            ]
        )
        self.logger = logging.getLogger(__name__)
        
    def generate_server_id(self):
        hostname = socket.gethostname()
        try:
            import uuid
            mac = ':'.join(['{:02x}'.format((uuid.getnode() >> elements) & 0xff) 
                           for elements in range(0,2*6,2)][::-1])
            return f"{hostname}-{mac}"
        except:
            return hostname
    
    def get_system_stats(self):
        try:
            cpu_percent = psutil.cpu_percent(interval=1)
            cpu_count = psutil.cpu_count()
            memory = psutil.virtual_memory()
            disk = psutil.disk_usage('/')
            network = psutil.net_io_counters()
            load_avg = os.getloadavg() if hasattr(os, 'getloadavg') else [0, 0, 0]
            boot_time = psutil.boot_time()
            uptime = time.time() - boot_time
            
            stats = {
                'server_id': self.server_id,
                'timestamp': datetime.now().isoformat(),
                'cpu': {
                    'usage': cpu_percent,
                    'cores': cpu_count
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
                'load_average': load_avg,
                'uptime': uptime
            }
            
            return stats
        except Exception as e:
            self.logger.error(f"Error collecting system stats: {e}")
            return None
    
    def send_heartbeat(self):
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
        try:
            server_info = {
                'server_id': self.server_id,
                'hostname': socket.gethostname(),
                'ip_address': self.get_local_ip(),
                'os_info': self.get_os_info(),
                'agent_version': '1.0.0',
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
    
    def get_local_ip(self):
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            ip = s.getsockname()[0]
            s.close()
            return ip
        except:
            return "127.0.0.1"
    
    def get_os_info(self):
        try:
            import platform
            return {
                'system': platform.system(),
                'release': platform.release(),
                'version': platform.version(),
                'machine': platform.machine(),
                'processor': platform.processor()
            }
        except:
            return {'system': 'Unknown'}
    
    def heartbeat_loop(self):
        while self.running:
            self.send_heartbeat()
            time.sleep(self.heartbeat_interval)
    
    def start(self):
        self.logger.info(f"Starting Xpanel Agent (ID: {self.server_id})")
        self.logger.info(f"Panel address: {self.panel_address}:{self.panel_port}")
        
        if not self.register_with_panel():
            self.logger.error("Failed to register with panel, continuing anyway...")
        
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
        self.running = False
        self.logger.info("Agent stopped")

if __name__ == '__main__':
    agent = XpanelAgent()
    agent.start()
AGENT_SCRIPT_EOF

# Install Python dependencies
print_status "Installing Python dependencies..."
pip3 install psutil requests

# Make agent executable
chmod +x xpanel_agent.py
chown -R $AGENT_USER:$AGENT_USER "$AGENT_DIR"

# Create systemd service
print_status "Creating systemd service..."
cat > /etc/systemd/system/$SERVICE_NAME.service << SERVICE_EOF
[Unit]
Description=Xpanel Agent
After=network.target

[Service]
Type=simple
User=$AGENT_USER
WorkingDirectory=$AGENT_DIR
ExecStart=/usr/bin/python3 $AGENT_DIR/xpanel_agent.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
SERVICE_EOF

# Enable and start service
print_status "Starting agent service..."
systemctl daemon-reload
systemctl enable $SERVICE_NAME
systemctl start $SERVICE_NAME

# Check service status
if systemctl is-active --quiet $SERVICE_NAME; then
    print_status "Agent installed and started successfully!"
    print_status "Service status: $(systemctl is-active $SERVICE_NAME)"
else
    print_error "Failed to start agent service"
    systemctl status $SERVICE_NAME
    exit 1
fi

print_status "Installation completed successfully!"
echo -e "${GREEN}Agent is now running and sending data to panel${NC}"
'''

        # Read agent script content
        agent_script_path = "agent/xpanel_agent.py"
        try:
            with open(agent_script_path, 'r', encoding='utf-8') as f:
                agent_script = f.read()
        except FileNotFoundError:
            # Fallback agent script if file not found
            agent_script = self.get_fallback_agent_script()

        return script_template.format(
            panel_address=panel_address,
            agent_script=agent_script
        )

    def get_fallback_agent_script(self):
        """Fallback agent script content"""
        return '''#!/usr/bin/env python3
import os
import sys
import time
import json
import psutil
import socket
import requests
import subprocess
import threading
from datetime import datetime
import argparse
import logging

class XpanelAgent:
    def __init__(self, panel_address="64.188.70.12", panel_port=5000):
        self.panel_address = panel_address
        self.panel_port = panel_port
        self.server_id = self.generate_server_id()
        self.running = False
        self.heartbeat_interval = 30
        
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler('/opt/xpanel-agent/xpanel-agent.log'),
                logging.StreamHandler()
            ]
        )
        self.logger = logging.getLogger(__name__)
        
    def generate_server_id(self):
        hostname = socket.gethostname()
        try:
            import uuid
            mac = ':'.join(['{:02x}'.format((uuid.getnode() >> elements) & 0xff) 
                           for elements in range(0,2*6,2)][::-1])
            return f"{hostname}-{mac}"
        except:
            return hostname
    
    def get_system_stats(self):
        try:
            cpu_percent = psutil.cpu_percent(interval=1)
            memory = psutil.virtual_memory()
            disk = psutil.disk_usage('/')
            network = psutil.net_io_counters()
            
            return {
                'server_id': self.server_id,
                'timestamp': datetime.now().isoformat(),
                'cpu': {'usage': cpu_percent, 'cores': psutil.cpu_count()},
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
            }
        except Exception as e:
            self.logger.error(f"Error collecting stats: {e}")
            return None
    
    def send_heartbeat(self):
        try:
            stats = self.get_system_stats()
            if not stats:
                return False
                
            url = f"http://{self.panel_address}:{self.panel_port}/api/agent/heartbeat"
            response = requests.post(url, json=stats, timeout=10)
            return response.status_code == 200
        except Exception as e:
            self.logger.error(f"Heartbeat error: {e}")
            return False
    
    def heartbeat_loop(self):
        while self.running:
            self.send_heartbeat()
            time.sleep(self.heartbeat_interval)
    
    def start(self):
        self.logger.info(f"Starting Xpanel Agent (ID: {self.server_id})")
        self.running = True
        
        heartbeat_thread = threading.Thread(target=self.heartbeat_loop, daemon=True)
        heartbeat_thread.start()
        
        try:
            while self.running:
                time.sleep(1)
        except KeyboardInterrupt:
            self.stop()
    
    def stop(self):
        self.running = False
        self.logger.info("Agent stopped")

def main():
    parser = argparse.ArgumentParser(description='Xpanel VPS Agent')
    parser.add_argument('--panel-address', default='64.188.70.12')
    parser.add_argument('--panel-port', type=int, default=5000)
    args = parser.parse_args()
    
    agent = XpanelAgent(args.panel_address, args.panel_port)
    agent.start()

if __name__ == '__main__':
    main()
'''
