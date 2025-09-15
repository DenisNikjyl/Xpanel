#!/bin/bash

# Xpanel Agent Installation Script
# This script installs the Xpanel agent on a VPS server

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
AGENT_USER="xpanel-agent"
AGENT_DIR="/opt/xpanel-agent"
SERVICE_NAME="xpanel-agent"
PANEL_ADDRESS="64.188.70.12"
PANEL_PORT="5000"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}    Xpanel Agent Installation${NC}"
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
   print_error "This script must be run as root"
   exit 1
fi

# Check OS
if [[ "$OSTYPE" != "linux-gnu"* ]]; then
    print_error "This script is designed for Linux systems only"
    exit 1
fi

# Detect package manager
if command -v apt-get &> /dev/null; then
    PKG_MANAGER="apt"
    PKG_UPDATE="apt-get update"
    PKG_INSTALL="apt-get install -y"
elif command -v yum &> /dev/null; then
    PKG_MANAGER="yum"
    PKG_UPDATE="yum update -y"
    PKG_INSTALL="yum install -y"
elif command -v dnf &> /dev/null; then
    PKG_MANAGER="dnf"
    PKG_UPDATE="dnf update -y"
    PKG_INSTALL="dnf install -y"
else
    print_error "Unsupported package manager"
    exit 1
fi

print_status "Detected package manager: $PKG_MANAGER"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --panel-address)
            PANEL_ADDRESS="$2"
            shift 2
            ;;
        --panel-port)
            PANEL_PORT="$2"
            shift 2
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: $0 [--panel-address ADDRESS] [--panel-port PORT]"
            exit 1
            ;;
    esac
done

print_status "Panel address: $PANEL_ADDRESS:$PANEL_PORT"

# Update system packages
print_status "Updating system packages..."
$PKG_UPDATE

# Install required packages
print_status "Installing required packages..."
if [[ "$PKG_MANAGER" == "apt" ]]; then
    $PKG_INSTALL python3 python3-pip curl wget
elif [[ "$PKG_MANAGER" == "yum" ]] || [[ "$PKG_MANAGER" == "dnf" ]]; then
    $PKG_INSTALL python3 python3-pip curl wget
fi

# Create agent user
print_status "Creating agent user..."
if ! id "$AGENT_USER" &>/dev/null; then
    useradd -r -s /bin/false -d "$AGENT_DIR" "$AGENT_USER"
    print_status "User $AGENT_USER created"
else
    print_warning "User $AGENT_USER already exists"
fi

# Create agent directory
print_status "Creating agent directory..."
mkdir -p "$AGENT_DIR"
chown "$AGENT_USER:$AGENT_USER" "$AGENT_DIR"

# Download agent script
print_status "Downloading agent script..."
cat > "$AGENT_DIR/xpanel_agent.py" << 'EOF'
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
    
    def heartbeat_loop(self):
        """Main heartbeat loop"""
        while self.running:
            self.send_heartbeat()
            time.sleep(self.heartbeat_interval)
    
    def start(self):
        """Start the agent"""
        self.logger.info(f"Starting Xpanel Agent (ID: {self.server_id})")
        self.logger.info(f"Panel address: {self.panel_address}:{self.panel_port}")
        
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
    import argparse
    parser = argparse.ArgumentParser(description='Xpanel VPS Agent')
    parser.add_argument('--panel-address', default='64.188.70.12',
                       help='Control panel IP address')
    parser.add_argument('--panel-port', type=int, default=5000,
                       help='Control panel port')
    
    args = parser.parse_args()
    
    # Create agent instance
    agent = XpanelAgent(
        panel_address=args.panel_address,
        panel_port=args.panel_port
    )
    
    agent.start()

if __name__ == '__main__':
    main()
EOF

chmod +x "$AGENT_DIR/xpanel_agent.py"
chown "$AGENT_USER:$AGENT_USER" "$AGENT_DIR/xpanel_agent.py"

# Install Python dependencies
print_status "Installing Python dependencies..."
pip3 install psutil requests

# Create systemd service
print_status "Creating systemd service..."
cat > /etc/systemd/system/$SERVICE_NAME.service << EOF
[Unit]
Description=Xpanel VPS Agent
After=network.target

[Service]
Type=simple
User=$AGENT_USER
Group=$AGENT_USER
WorkingDirectory=$AGENT_DIR
ExecStart=/usr/bin/python3 $AGENT_DIR/xpanel_agent.py --panel-address $PANEL_ADDRESS --panel-port $PANEL_PORT
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Create log file
print_status "Setting up logging..."
touch /var/log/xpanel-agent.log
chown "$AGENT_USER:$AGENT_USER" /var/log/xpanel-agent.log

# Enable and start service
print_status "Starting agent service..."
systemctl daemon-reload
systemctl enable $SERVICE_NAME
systemctl start $SERVICE_NAME

# Check service status
sleep 3
if systemctl is-active --quiet $SERVICE_NAME; then
    print_status "Xpanel agent is running"
else
    print_error "Agent service failed to start"
    systemctl status $SERVICE_NAME
    exit 1
fi

# Get server info
SERVER_IP=$(curl -s ifconfig.me || hostname -I | awk '{print $1}')
HOSTNAME=$(hostname)

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}    Agent Installation Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}Server Information:${NC}"
echo -e "${YELLOW}Hostname: $HOSTNAME${NC}"
echo -e "${YELLOW}IP Address: $SERVER_IP${NC}"
echo -e "${YELLOW}Panel Address: $PANEL_ADDRESS:$PANEL_PORT${NC}"
echo ""
echo -e "${BLUE}Useful commands:${NC}"
echo -e "${YELLOW}systemctl status $SERVICE_NAME${NC}     - Check agent status"
echo -e "${YELLOW}systemctl restart $SERVICE_NAME${NC}    - Restart agent"
echo -e "${YELLOW}journalctl -u $SERVICE_NAME -f${NC}     - View agent logs"
echo -e "${YELLOW}tail -f /var/log/xpanel-agent.log${NC}  - View agent logs"
echo ""
echo -e "${GREEN}Agent is now running and sending data to the control panel!${NC}"
