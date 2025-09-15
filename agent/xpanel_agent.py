#!/usr/bin/env python3
"""
Xpanel Agent - VPS Server Agent
This agent runs on VPS servers and communicates with the Xpanel control panel
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
from datetime import datetime
import argparse
import logging

class XpanelAgent:
    def __init__(self, panel_address="64.188.70.12", panel_port=5000, server_id=None):
        self.panel_address = panel_address
        self.panel_port = panel_port
        self.server_id = server_id or self.generate_server_id()
        self.running = False
        self.heartbeat_interval = 30  # seconds
        
        # Setup logging
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler('/var/log/xpanel-agent.log'),
                logging.StreamHandler()
            ]
        )
        self.logger = logging.getLogger(__name__)
        
    def generate_server_id(self):
        """Generate unique server ID based on hostname and MAC address"""
        hostname = socket.gethostname()
        try:
            # Get MAC address of first network interface
            import uuid
            mac = ':'.join(['{:02x}'.format((uuid.getnode() >> elements) & 0xff) 
                           for elements in range(0,2*6,2)][::-1])
            return f"{hostname}-{mac}"
        except:
            return hostname
    
    def get_system_stats(self):
        """Collect system statistics"""
        try:
            # CPU usage
            cpu_percent = psutil.cpu_percent(interval=1)
            cpu_count = psutil.cpu_count()
            
            # Memory usage
            memory = psutil.virtual_memory()
            
            # Disk usage
            disk = psutil.disk_usage('/')
            
            # Network stats
            network = psutil.net_io_counters()
            
            # Load average
            load_avg = os.getloadavg() if hasattr(os, 'getloadavg') else [0, 0, 0]
            
            # Uptime
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
    
    def execute_command(self, command):
        """Execute shell command and return result"""
        try:
            result = subprocess.run(
                command,
                shell=True,
                capture_output=True,
                text=True,
                timeout=30
            )
            
            return {
                'success': True,
                'output': result.stdout,
                'error': result.stderr,
                'exit_code': result.returncode,
                'timestamp': datetime.now().isoformat()
            }
        except subprocess.TimeoutExpired:
            return {
                'success': False,
                'error': 'Command timed out',
                'exit_code': -1,
                'timestamp': datetime.now().isoformat()
            }
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'exit_code': -1,
                'timestamp': datetime.now().isoformat()
            }
    
    def send_heartbeat(self):
        """Send heartbeat with system stats to panel"""
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
        """Register this agent with the control panel"""
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
        """Get local IP address"""
        try:
            # Connect to a remote address to determine local IP
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            ip = s.getsockname()[0]
            s.close()
            return ip
        except:
            return "127.0.0.1"
    
    def get_os_info(self):
        """Get operating system information"""
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
        """Main heartbeat loop"""
        while self.running:
            self.send_heartbeat()
            time.sleep(self.heartbeat_interval)
    
    def start(self):
        """Start the agent"""
        self.logger.info(f"Starting Xpanel Agent (ID: {self.server_id})")
        self.logger.info(f"Panel address: {self.panel_address}:{self.panel_port}")
        
        # Register with panel
        if not self.register_with_panel():
            self.logger.error("Failed to register with panel, continuing anyway...")
        
        self.running = True
        
        # Start heartbeat thread
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

def main():
    parser = argparse.ArgumentParser(description='Xpanel VPS Agent')
    parser.add_argument('--panel-address', default='64.188.70.12',
                       help='Control panel IP address')
    parser.add_argument('--panel-port', type=int, default=5000,
                       help='Control panel port')
    parser.add_argument('--server-id', 
                       help='Custom server ID (auto-generated if not provided)')
    parser.add_argument('--daemon', action='store_true',
                       help='Run as daemon')
    
    args = parser.parse_args()
    
    # Create agent instance
    agent = XpanelAgent(
        panel_address=args.panel_address,
        panel_port=args.panel_port,
        server_id=args.server_id
    )
    
    if args.daemon:
        # Run as daemon (simplified version)
        import daemon
        with daemon.DaemonContext():
            agent.start()
    else:
        agent.start()

if __name__ == '__main__':
    main()
