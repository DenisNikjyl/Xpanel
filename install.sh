#!/bin/bash

# Xpanel Installation Script for Linux
# This script will install and configure Xpanel on a Linux server

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
VENV_DIR="$XPANEL_DIR/venv"
SERVICE_NAME="xpanel"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}    Xpanel Installation Script${NC}"
echo -e "${BLUE}========================================${NC}"

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   echo -e "${RED}This script should not be run as root${NC}"
   echo "Please run as a regular user with sudo privileges"
   exit 1
fi

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

# Check OS
if [[ "$OSTYPE" != "linux-gnu"* ]]; then
    print_error "This script is designed for Linux systems only"
    exit 1
fi

# Detect package manager
if command -v apt-get &> /dev/null; then
    PKG_MANAGER="apt"
    PKG_UPDATE="sudo apt-get update"
    PKG_INSTALL="sudo apt-get install -y"
elif command -v yum &> /dev/null; then
    PKG_MANAGER="yum"
    PKG_UPDATE="sudo yum update -y"
    PKG_INSTALL="sudo yum install -y"
elif command -v dnf &> /dev/null; then
    PKG_MANAGER="dnf"
    PKG_UPDATE="sudo dnf update -y"
    PKG_INSTALL="sudo dnf install -y"
else
    print_error "Unsupported package manager. Please install manually."
    exit 1
fi

print_status "Detected package manager: $PKG_MANAGER"

# Update system packages
print_status "Updating system packages..."
$PKG_UPDATE

# Install required system packages
print_status "Installing required system packages..."
if [[ "$PKG_MANAGER" == "apt" ]]; then
    $PKG_INSTALL python3 python3-pip python3-venv git nginx supervisor
elif [[ "$PKG_MANAGER" == "yum" ]] || [[ "$PKG_MANAGER" == "dnf" ]]; then
    $PKG_INSTALL python3 python3-pip git nginx supervisor
fi

# Create xpanel user
print_status "Creating xpanel user..."
if ! id "$XPANEL_USER" &>/dev/null; then
    sudo useradd -r -s /bin/false -d "$XPANEL_DIR" "$XPANEL_USER"
    print_status "User $XPANEL_USER created"
else
    print_warning "User $XPANEL_USER already exists"
fi

# Create application directory
print_status "Creating application directory..."
sudo mkdir -p "$XPANEL_DIR"
sudo chown "$XPANEL_USER:$XPANEL_USER" "$XPANEL_DIR"

# Copy application files
print_status "Copying application files..."
sudo cp -r . "$XPANEL_DIR/"
sudo chown -R "$XPANEL_USER:$XPANEL_USER" "$XPANEL_DIR"

# Create virtual environment
print_status "Creating Python virtual environment..."
sudo -u "$XPANEL_USER" python3 -m venv "$VENV_DIR"

# Install Python dependencies
print_status "Installing Python dependencies..."
sudo -u "$XPANEL_USER" "$VENV_DIR/bin/pip" install --upgrade pip
sudo -u "$XPANEL_USER" "$VENV_DIR/bin/pip" install -r "$XPANEL_DIR/requirements.txt"
sudo -u "$XPANEL_USER" "$VENV_DIR/bin/pip" install gunicorn

# Create environment file
print_status "Creating environment configuration..."
if [[ ! -f "$XPANEL_DIR/.env" ]]; then
    sudo -u "$XPANEL_USER" cp "$XPANEL_DIR/.env.example" "$XPANEL_DIR/.env"
    
    # Generate random secrets
    SECRET_KEY=$(openssl rand -hex 32)
    JWT_SECRET=$(openssl rand -hex 32)
    
    sudo -u "$XPANEL_USER" sed -i "s/your-secret-key-here-change-in-production/$SECRET_KEY/" "$XPANEL_DIR/.env"
    sudo -u "$XPANEL_USER" sed -i "s/your-jwt-secret-key-here-change-in-production/$JWT_SECRET/" "$XPANEL_DIR/.env"
    sudo -u "$XPANEL_USER" sed -i "s/FLASK_ENV=development/FLASK_ENV=production/" "$XPANEL_DIR/.env"
    
    print_status "Environment file created with random secrets"
else
    print_warning "Environment file already exists"
fi

# Create systemd service
print_status "Creating systemd service..."
sudo tee /etc/systemd/system/$SERVICE_NAME.service > /dev/null <<EOF
[Unit]
Description=Xpanel VPS Management Panel
After=network.target

[Service]
Type=simple
User=$XPANEL_USER
Group=$XPANEL_USER
WorkingDirectory=$XPANEL_DIR
Environment=PATH=$VENV_DIR/bin
ExecStart=$VENV_DIR/bin/gunicorn --worker-class eventlet -w 1 --bind 127.0.0.1:5000 app:app
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

# Create Nginx configuration
print_status "Creating Nginx configuration..."
sudo tee /etc/nginx/sites-available/xpanel > /dev/null <<EOF
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /socket.io/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

# Enable Nginx site
if [[ -d "/etc/nginx/sites-enabled" ]]; then
    sudo ln -sf /etc/nginx/sites-available/xpanel /etc/nginx/sites-enabled/
    sudo rm -f /etc/nginx/sites-enabled/default
fi

# Test Nginx configuration
print_status "Testing Nginx configuration..."
sudo nginx -t

# Create log directory
print_status "Creating log directory..."
sudo mkdir -p /var/log/xpanel
sudo chown "$XPANEL_USER:$XPANEL_USER" /var/log/xpanel

# Set up firewall (if ufw is available)
if command -v ufw &> /dev/null; then
    print_status "Configuring firewall..."
    sudo ufw allow 22/tcp
    sudo ufw allow 80/tcp
    sudo ufw allow 443/tcp
    print_warning "Firewall rules added. Enable with: sudo ufw enable"
fi

# Reload systemd and start services
print_status "Starting services..."
sudo systemctl daemon-reload
sudo systemctl enable $SERVICE_NAME
sudo systemctl start $SERVICE_NAME
sudo systemctl enable nginx
sudo systemctl restart nginx

# Check service status
sleep 3
if sudo systemctl is-active --quiet $SERVICE_NAME; then
    print_status "Xpanel service is running"
else
    print_error "Xpanel service failed to start"
    sudo systemctl status $SERVICE_NAME
    exit 1
fi

if sudo systemctl is-active --quiet nginx; then
    print_status "Nginx service is running"
else
    print_error "Nginx service failed to start"
    sudo systemctl status nginx
    exit 1
fi

# Get server IP
SERVER_IP=$(curl -s ifconfig.me || hostname -I | awk '{print $1}')

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}    Installation Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}Access your Xpanel at:${NC}"
echo -e "${YELLOW}http://$SERVER_IP${NC}"
echo ""
echo -e "${BLUE}Default credentials:${NC}"
echo -e "${YELLOW}Username: admin${NC}"
echo -e "${YELLOW}Password: admin123${NC}"
echo ""
echo -e "${RED}⚠️  IMPORTANT: Change the default password after first login!${NC}"
echo ""
echo -e "${BLUE}Useful commands:${NC}"
echo -e "${YELLOW}sudo systemctl status xpanel${NC}    - Check service status"
echo -e "${YELLOW}sudo systemctl restart xpanel${NC}   - Restart service"
echo -e "${YELLOW}sudo journalctl -u xpanel -f${NC}    - View logs"
echo -e "${YELLOW}sudo nano $XPANEL_DIR/.env${NC}      - Edit configuration"
echo ""
echo -e "${GREEN}Installation completed successfully!${NC}"
