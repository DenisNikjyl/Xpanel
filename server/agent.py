#!/usr/bin/env python3
"""
Xpanel Agent - VPS Monitoring and Management Agent
This agent runs on VPS servers and communicates with the main Xpanel server
"""

import asyncio
import websockets
import json
import psutil
import os
import sys
import time
import subprocess
import logging
from datetime import datetime
import socket
import platform

# Configuration
XPANEL_SERVER_URL = "ws://localhost:3001"
AGENT_PORT = 8888
RECONNECT_INTERVAL = 5
UPDATE_INTERVAL = 5

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/var/log/xpanel-agent.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class XpanelAgent:
    def __init__(self):
        self.server_url = XPANEL_SERVER_URL
        self.websocket = None
        self.running = False
        
    async def get_system_info(self):
        """Collect comprehensive system information"""
        try:
            # Basic system info
            uname = platform.uname()
            boot_time = datetime.fromtimestamp(psutil.boot_time())
            
            # CPU information
            cpu_percent = psutil.cpu_percent(interval=1)
            cpu_count = psutil.cpu_count()
            cpu_freq = psutil.cpu_freq()
            
            # Memory information
            memory = psutil.virtual_memory()
            swap = psutil.swap_memory()
            
            # Disk information
            disk_usage = psutil.disk_usage('/')
            disk_io = psutil.disk_io_counters()
            
            # Network information
            network_io = psutil.net_io_counters()
            network_connections = len(psutil.net_connections())
            
            # Process information
            processes = len(psutil.pids())
            
            # Load average (Linux/Unix only)
            try:
                load_avg = os.getloadavg()
            except (OSError, AttributeError):
                load_avg = [0, 0, 0]
            
            system_info = {
                'timestamp': datetime.now().isoformat(),
                'system': {
                    'hostname': uname.node,
                    'os': f"{uname.system} {uname.release}",
                    'architecture': uname.machine,
                    'boot_time': boot_time.isoformat(),
                    'uptime_seconds': time.time() - psutil.boot_time()
                },
                'cpu': {
                    'percent': cpu_percent,
                    'count': cpu_count,
                    'frequency': cpu_freq.current if cpu_freq else 0,
                    'load_average': load_avg
                },
                'memory': {
                    'total': memory.total,
                    'available': memory.available,
                    'percent': memory.percent,
                    'used': memory.used,
                    'free': memory.free,
                    'cached': getattr(memory, 'cached', 0),
                    'buffers': getattr(memory, 'buffers', 0)
                },
                'swap': {
                    'total': swap.total,
                    'used': swap.used,
                    'free': swap.free,
                    'percent': swap.percent
                },
                'disk': {
                    'total': disk_usage.total,
                    'used': disk_usage.used,
                    'free': disk_usage.free,
                    'percent': (disk_usage.used / disk_usage.total) * 100,
                    'read_bytes': disk_io.read_bytes if disk_io else 0,
                    'write_bytes': disk_io.write_bytes if disk_io else 0
                },
                'network': {
                    'bytes_sent': network_io.bytes_sent,
                    'bytes_recv': network_io.bytes_recv,
                    'packets_sent': network_io.packets_sent,
                    'packets_recv': network_io.packets_recv,
                    'connections': network_connections
                },
                'processes': {
                    'total': processes
                }
            }
            
            return system_info
            
        except Exception as e:
            logger.error(f"Error collecting system info: {e}")
            return None
    
    async def execute_command(self, command):
        """Execute shell command and return result"""
        try:
            logger.info(f"Executing command: {command}")
            
            # Security check - only allow safe commands
            safe_commands = [
                'ls', 'pwd', 'whoami', 'date', 'uptime', 'df', 'free',
                'ps', 'top', 'htop', 'netstat', 'ss', 'systemctl status'
            ]
            
            cmd_parts = command.strip().split()
            if not cmd_parts or cmd_parts[0] not in safe_commands:
                return {
                    'success': False,
                    'error': f'Command "{cmd_parts[0] if cmd_parts else command}" not allowed'
                }
            
            result = subprocess.run(
                command,
                shell=True,
                capture_output=True,
                text=True,
                timeout=30
            )
            
            return {
                'success': True,
                'stdout': result.stdout,
                'stderr': result.stderr,
                'return_code': result.returncode
            }
            
        except subprocess.TimeoutExpired:
            return {
                'success': False,
                'error': 'Command timed out'
            }
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }
    
    async def handle_message(self, message):
        """Handle incoming messages from Xpanel server"""
        try:
            data = json.loads(message)
            msg_type = data.get('type')
            
            if msg_type == 'get_system_info':
                system_info = await self.get_system_info()
                if system_info:
                    response = {
                        'type': 'system_info',
                        'data': system_info
                    }
                    await self.websocket.send(json.dumps(response))
            
            elif msg_type == 'execute_command':
                command = data.get('command', '')
                result = await self.execute_command(command)
                response = {
                    'type': 'command_result',
                    'command': command,
                    'result': result
                }
                await self.websocket.send(json.dumps(response))
            
            elif msg_type == 'ping':
                response = {
                    'type': 'pong',
                    'timestamp': datetime.now().isoformat()
                }
                await self.websocket.send(json.dumps(response))
                
        except Exception as e:
            logger.error(f"Error handling message: {e}")
    
    async def send_periodic_updates(self):
        """Send periodic system updates to Xpanel server"""
        while self.running:
            try:
                system_info = await self.get_system_info()
                if system_info and self.websocket:
                    message = {
                        'type': 'system_update',
                        'data': system_info
                    }
                    await self.websocket.send(json.dumps(message))
                
                await asyncio.sleep(UPDATE_INTERVAL)
                
            except Exception as e:
                logger.error(f"Error sending periodic update: {e}")
                break
    
    async def connect_to_server(self):
        """Connect to Xpanel server via WebSocket"""
        while True:
            try:
                logger.info(f"Connecting to Xpanel server at {self.server_url}")
                
                async with websockets.connect(self.server_url) as websocket:
                    self.websocket = websocket
                    self.running = True
                    
                    logger.info("Connected to Xpanel server")
                    
                    # Send initial registration
                    registration = {
                        'type': 'agent_register',
                        'hostname': socket.gethostname(),
                        'timestamp': datetime.now().isoformat()
                    }
                    await websocket.send(json.dumps(registration))
                    
                    # Start periodic updates task
                    update_task = asyncio.create_task(self.send_periodic_updates())
                    
                    # Listen for messages
                    async for message in websocket:
                        await self.handle_message(message)
                        
            except websockets.exceptions.ConnectionClosed:
                logger.warning("Connection to server closed")
            except Exception as e:
                logger.error(f"Connection error: {e}")
            
            self.running = False
            logger.info(f"Reconnecting in {RECONNECT_INTERVAL} seconds...")
            await asyncio.sleep(RECONNECT_INTERVAL)
    
    def start(self):
        """Start the agent"""
        logger.info("Starting Xpanel Agent")
        try:
            asyncio.run(self.connect_to_server())
        except KeyboardInterrupt:
            logger.info("Agent stopped by user")
        except Exception as e:
            logger.error(f"Agent error: {e}")

def main():
    """Main entry point"""
    if len(sys.argv) > 1:
        if sys.argv[1] == '--install':
            install_agent()
            return
        elif sys.argv[1] == '--uninstall':
            uninstall_agent()
            return
    
    agent = XpanelAgent()
    agent.start()

def install_agent():
    """Install agent as system service"""
    logger.info("Installing Xpanel Agent as system service")
    
    service_content = f"""[Unit]
Description=Xpanel Agent
After=network.target

[Service]
Type=simple
User=root
ExecStart=/usr/bin/python3 {os.path.abspath(__file__)}
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
"""
    
    try:
        with open('/etc/systemd/system/xpanel-agent.service', 'w') as f:
            f.write(service_content)
        
        subprocess.run(['systemctl', 'daemon-reload'], check=True)
        subprocess.run(['systemctl', 'enable', 'xpanel-agent'], check=True)
        subprocess.run(['systemctl', 'start', 'xpanel-agent'], check=True)
        
        logger.info("Xpanel Agent installed and started successfully")
        
    except Exception as e:
        logger.error(f"Failed to install agent: {e}")

def uninstall_agent():
    """Uninstall agent system service"""
    logger.info("Uninstalling Xpanel Agent")
    
    try:
        subprocess.run(['systemctl', 'stop', 'xpanel-agent'], check=False)
        subprocess.run(['systemctl', 'disable', 'xpanel-agent'], check=False)
        
        if os.path.exists('/etc/systemd/system/xpanel-agent.service'):
            os.remove('/etc/systemd/system/xpanel-agent.service')
        
        subprocess.run(['systemctl', 'daemon-reload'], check=True)
        
        logger.info("Xpanel Agent uninstalled successfully")
        
    except Exception as e:
        logger.error(f"Failed to uninstall agent: {e}")

if __name__ == "__main__":
    main()
