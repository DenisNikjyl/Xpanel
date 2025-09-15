#!/bin/bash

# Xpanel VPS Management System - Installation Script
# This script installs Xpanel on a Linux VPS server

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
XPANEL_USER="xpanel"
XPANEL_DIR="/opt/xpanel"
AGENT_PORT=8888
LOG_FILE="/var/log/xpanel-install.log"

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
    exit 1
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

info() {
    echo -e "${BLUE}[INFO]${NC} $1" | tee -a "$LOG_FILE"
}

# Check if running as root
check_root() {
    if [[ $EUID -ne 0 ]]; then
        error "This script must be run as root (use sudo)"
    fi
}

# Detect OS and package manager
detect_os() {
    if [[ -f /etc/os-release ]]; then
        . /etc/os-release
        OS=$NAME
        VER=$VERSION_ID
    else
        error "Cannot detect operating system"
    fi
    
    log "Detected OS: $OS $VER"
    
    # Set package manager
    if command -v apt-get &> /dev/null; then
        PKG_MANAGER="apt"
        PKG_UPDATE="apt update"
        PKG_INSTALL="apt install -y"
    elif command -v yum &> /dev/null; then
        PKG_MANAGER="yum"
        PKG_UPDATE="yum update -y"
        PKG_INSTALL="yum install -y"
    elif command -v dnf &> /dev/null; then
        PKG_MANAGER="dnf"
        PKG_UPDATE="dnf update -y"
        PKG_INSTALL="dnf install -y"
    else
        error "Unsupported package manager. This script supports apt, yum, and dnf."
    fi
    
    log "Using package manager: $PKG_MANAGER"
}

# Update system packages
update_system() {
    log "Updating system packages..."
    $PKG_UPDATE || warning "Failed to update package lists"
}

# Install required packages
install_dependencies() {
    log "Installing required packages..."
    
    local packages=""
    
    if [[ $PKG_MANAGER == "apt" ]]; then
        packages="python3 python3-pip python3-venv curl wget git htop"
    elif [[ $PKG_MANAGER == "yum" ]] || [[ $PKG_MANAGER == "dnf" ]]; then
        packages="python3 python3-pip curl wget git htop"
    fi
    
    $PKG_INSTALL $packages || error "Failed to install required packages"
    
    # Install Python packages
    log "Installing Python packages..."
    pip3 install psutil websockets asyncio || error "Failed to install Python packages"
}

# Create xpanel user
create_user() {
    if id "$XPANEL_USER" &>/dev/null; then
        log "User $XPANEL_USER already exists"
    else
        log "Creating user $XPANEL_USER..."
        useradd -r -s /bin/false -d "$XPANEL_DIR" "$XPANEL_USER" || error "Failed to create user"
    fi
}

# Create directories
create_directories() {
    log "Creating directories..."
    mkdir -p "$XPANEL_DIR"
    mkdir -p "/var/log/xpanel"
    mkdir -p "/etc/xpanel"
    
    chown -R "$XPANEL_USER:$XPANEL_USER" "$XPANEL_DIR"
    chown -R "$XPANEL_USER:$XPANEL_USER" "/var/log/xpanel"
}

# Download and install agent
install_agent() {
    log "Installing Xpanel agent..."
    
    # Create agent script (embedded in this installer)
    cat > "$XPANEL_DIR/agent.py" << 'EOF'
#!/usr/bin/env python3
"""
Xpanel Agent - VPS Monitoring and Management Agent
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
        logging.FileHandler('/var/log/xpanel/agent.log'),
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
        """Collect system information"""
        try:
            uname = platform.uname()
            boot_time = datetime.fromtimestamp(psutil.boot_time())
            
            cpu_percent = psutil.cpu_percent(interval=1)
            memory = psutil.virtual_memory()
            disk_usage = psutil.disk_usage('/')
            
            system_info = {
                'timestamp': datetime.now().isoformat(),
                'hostname': uname.node,
                'os': f"{uname.system} {uname.release}",
                'uptime_seconds': time.time() - psutil.boot_time(),
                'cpu_percent': cpu_percent,
                'memory_percent': memory.percent,
                'disk_percent': (disk_usage.used / disk_usage.total) * 100,
                'load_average': os.getloadavg() if hasattr(os, 'getloadavg') else [0, 0, 0]
            }
            
            return system_info
            
        except Exception as e:
            logger.error(f"Error collecting system info: {e}")
            return None
    
    async def start_server(self):
        """Start WebSocket server"""
        async def handler(websocket, path):
            logger.info(f"Client connected: {websocket.remote_address}")
            try:
                async for message in websocket:
                    # Handle incoming messages
                    pass
            except websockets.exceptions.ConnectionClosed:
                logger.info("Client disconnected")
        
        logger.info(f"Starting Xpanel agent on port {AGENT_PORT}")
        start_server = websockets.serve(handler, "0.0.0.0", AGENT_PORT)
        await start_server
        
        # Send periodic updates
        while True:
            system_info = await self.get_system_info()
            if system_info:
                logger.debug(f"System info: {system_info}")
            await asyncio.sleep(UPDATE_INTERVAL)

def main():
    agent = XpanelAgent()
    try:
        asyncio.run(agent.start_server())
    except KeyboardInterrupt:
        logger.info("Agent stopped")

if __name__ == "__main__":
    main()
EOF

    chmod +x "$XPANEL_DIR/agent.py"
    chown "$XPANEL_USER:$XPANEL_USER" "$XPANEL_DIR/agent.py"
}

# Create systemd service
create_service() {
    log "Creating systemd service..."
    
    cat > /etc/systemd/system/xpanel-agent.service << EOF
[Unit]
Description=Xpanel Agent
After=network.target

[Service]
Type=simple
User=$XPANEL_USER
Group=$XPANEL_USER
WorkingDirectory=$XPANEL_DIR
ExecStart=/usr/bin/python3 $XPANEL_DIR/agent.py
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload
    systemctl enable xpanel-agent
}

# Configure firewall
configure_firewall() {
    log "Configuring firewall..."
    
    if command -v ufw &> /dev/null; then
        ufw allow $AGENT_PORT/tcp || warning "Failed to configure UFW"
    elif command -v firewall-cmd &> /dev/null; then
        firewall-cmd --permanent --add-port=$AGENT_PORT/tcp || warning "Failed to configure firewalld"
        firewall-cmd --reload || warning "Failed to reload firewalld"
    else
        warning "No supported firewall found. Please manually open port $AGENT_PORT"
    fi
}

# Start services
start_services() {
    log "Starting Xpanel agent..."
    systemctl start xpanel-agent || error "Failed to start Xpanel agent"
    
    # Check if service is running
    if systemctl is-active --quiet xpanel-agent; then
        log "Xpanel agent started successfully"
    else
        error "Xpanel agent failed to start"
    fi
}

# Show installation summary
show_summary() {
    log "Installation completed successfully!"
    echo
    echo -e "${GREEN}=== Xpanel Installation Summary ===${NC}"
    echo -e "${BLUE}Agent Directory:${NC} $XPANEL_DIR"
    echo -e "${BLUE}Agent Port:${NC} $AGENT_PORT"
    echo -e "${BLUE}Log File:${NC} /var/log/xpanel/agent.log"
    echo -e "${BLUE}Service Status:${NC} $(systemctl is-active xpanel-agent)"
    echo
    echo -e "${YELLOW}Next steps:${NC}"
    echo "1. Add this server to your Xpanel dashboard"
    echo "2. Use the following connection details:"
    echo "   - Host: $(hostname -I | awk '{print $1}')"
    echo "   - Port: $AGENT_PORT"
    echo
    echo -e "${GREEN}Installation log saved to: $LOG_FILE${NC}"
}

# Uninstall function
uninstall() {
    log "Uninstalling Xpanel agent..."
    
    systemctl stop xpanel-agent 2>/dev/null || true
    systemctl disable xpanel-agent 2>/dev/null || true
    rm -f /etc/systemd/system/xpanel-agent.service
    systemctl daemon-reload
    
    rm -rf "$XPANEL_DIR"
    rm -rf "/var/log/xpanel"
    rm -rf "/etc/xpanel"
    
    userdel "$XPANEL_USER" 2>/dev/null || true
    
    log "Xpanel agent uninstalled successfully"
}

# Main installation function
main() {
    echo -e "${BLUE}"
    echo "=================================="
    echo "   Xpanel Agent Installation"
    echo "=================================="
    echo -e "${NC}"
    
    if [[ "$1" == "--uninstall" ]]; then
        uninstall
        exit 0
    fi
    
    check_root
    detect_os
    update_system
    install_dependencies
    create_user
    create_directories
    install_agent
    create_service
    configure_firewall
    start_services
    show_summary
}

# Run main function
main "$@"
