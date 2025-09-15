#!/bin/bash

echo "========================================="
echo "    Xpanel Production Server Setup"
echo "========================================="
echo

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    print_error "Please run as root (use sudo)"
    exit 1
fi

print_header "1. Stopping existing services..."
pm2 stop xpanel 2>/dev/null || true
pm2 delete xpanel 2>/dev/null || true

print_header "2. Installing Node.js dependencies..."
cd /root/Xpanels/server
npm install --production

print_header "3. Checking static files..."
if [ -d "/root/Xpanels/public" ]; then
    print_status "Static files found in /public directory"
    if [ -f "/root/Xpanels/public/index.html" ]; then
        print_status "index.html found"
    else
        print_error "index.html not found in /public"
        exit 1
    fi
else
    print_error "/public directory not found"
    exit 1
fi
cd /root/Xpanels/server

print_header "4. Setting up production environment..."
# Copy production env file
if [ -f "../.env.production" ]; then
    cp ../.env.production .env
    print_status "Production .env file copied"
else
    print_warning "No .env.production found, creating default..."
    cat > .env << EOF
PORT=3001
DOMAIN=xpanel.xload.ru
NODE_ENV=production
JWT_SECRET=xpanel_secret_key_2024_production_change_this
EMAIL_USER=xpanel.service@gmail.com
EMAIL_PASS=your-gmail-app-password
ADMIN_EMAIL=fillsites0@gmail.com
BCRYPT_ROUNDS=12
MAX_FILE_SIZE=100MB
UPLOAD_PATH=./uploads
SSH_TIMEOUT=30000
SSH_MAX_CONNECTIONS=10
AGENT_PORT=9001
AGENT_CHECK_INTERVAL=30000
EOF
fi

print_header "5. Creating uploads directory..."
mkdir -p uploads
chmod 755 uploads

print_header "6. Starting Xpanel with PM2..."
pm2 start simple-server.js --name "xpanel" --env production

print_header "7. Setting up PM2 startup..."
pm2 startup
pm2 save

print_header "8. Configuring Nginx (if exists)..."
if command -v nginx &> /dev/null; then
    # Create Nginx config for Xpanel
    cat > /etc/nginx/sites-available/xpanel << EOF
server {
    listen 80;
    server_name xpanel.xload.ru 64.188.70.12;
    
    # Корневая директория для статических файлов
    root /root/Xpanels/client/build;
    index index.html;
    
    # Gzip сжатие
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
    
    # Кэширование статических файлов
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files \$uri =404;
    }
    
    # API маршруты
    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    # Socket.IO
    location /socket.io/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    
    # React Router - все остальные запросы направляем на index.html
    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
EOF

    # Enable site
    ln -sf /etc/nginx/sites-available/xpanel /etc/nginx/sites-enabled/
    nginx -t && systemctl reload nginx
    print_status "Nginx configured for Xpanel"
else
    print_warning "Nginx not found, skipping web server configuration"
fi

print_header "9. Setting up firewall..."
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 3001/tcp
ufw --force enable

print_header "10. Checking service status..."
sleep 3
pm2 status
pm2 logs xpanel --lines 10

echo
print_status "========================================="
print_status "    Xpanel Production Setup Complete!"
print_status "========================================="
echo
print_status "🌐 Access your panel at:"
print_status "   http://64.188.70.12"
print_status "   http://xpanel.xload.ru"
echo
print_status "📊 Monitor with:"
print_status "   pm2 status"
print_status "   pm2 logs xpanel"
print_status "   pm2 monit"
echo
print_status "🔧 Admin email: fillsites0@gmail.com"
print_status "🔑 Change JWT_SECRET in .env for security!"
echo
