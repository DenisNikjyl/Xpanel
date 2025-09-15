#!/bin/bash

echo "========================================"
echo "    Xpanel - Server Setup Script"
echo "========================================"
echo

# Update system
echo "🔄 Updating system packages..."
apt update && apt upgrade -y

# Install Node.js 18.x
echo "📦 Installing Node.js..."
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
apt-get install -y nodejs

# Install Python and dependencies
echo "🐍 Installing Python dependencies..."
apt-get install -y python3 python3-pip

# Install PM2 for process management
echo "⚙️ Installing PM2..."
npm install -g pm2

# Install nginx for reverse proxy
echo "🌐 Installing Nginx..."
apt-get install -y nginx

# Install certbot for SSL
echo "🔒 Installing Certbot..."
apt-get install -y certbot python3-certbot-nginx

# Navigate to project directory
cd /root/Xpanels

# Install dependencies
echo "📦 Installing project dependencies..."
npm install
cd client && npm install && cd ..

# Build React app
echo "🏗️ Building React application..."
cd client && npm run build && cd ..

# Create .env file
echo "⚙️ Creating environment configuration..."
cat > .env << EOF
# Production Environment
NODE_ENV=production
PORT=3001
DOMAIN=xpanel.xload.ru

# JWT Configuration
JWT_SECRET=xpanel_production_secret_$(openssl rand -hex 32)

# Email Configuration (configure these manually)
EMAIL_USER=xpanel.service@gmail.com
EMAIL_PASS=your-gmail-app-password

# Admin Configuration
ADMIN_EMAIL=fillsites0@gmail.com

# Security
BCRYPT_ROUNDS=12
EOF

# Create PM2 ecosystem file
echo "🚀 Creating PM2 configuration..."
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'xpanel',
    script: 'server/index.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    }
  }]
}
EOF

# Create Nginx configuration
echo "🌐 Configuring Nginx..."
cat > /etc/nginx/sites-available/xpanel << EOF
server {
    listen 80;
    server_name xpanel.xload.ru;

    # Redirect HTTP to HTTPS
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name xpanel.xload.ru;

    # SSL Configuration (will be configured by certbot)
    ssl_certificate /etc/letsencrypt/live/xpanel.xload.ru/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/xpanel.xload.ru/privkey.pem;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;

    # Main proxy to Node.js app
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 86400;
    }

    # WebSocket support for Socket.io
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

    # Static files caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF

# Enable the site
ln -sf /etc/nginx/sites-available/xpanel /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test nginx configuration
nginx -t

if [ $? -eq 0 ]; then
    echo "✅ Nginx configuration is valid"
    systemctl reload nginx
else
    echo "❌ Nginx configuration error!"
    exit 1
fi

# Setup SSL certificate
echo "🔒 Setting up SSL certificate..."
certbot --nginx -d xpanel.xload.ru --non-interactive --agree-tos --email fillsites0@gmail.com

# Start the application with PM2
echo "🚀 Starting Xpanel application..."
pm2 start ecosystem.config.js
pm2 save
pm2 startup

# Setup firewall
echo "🔥 Configuring firewall..."
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# Create backup script
echo "💾 Creating backup script..."
cat > /root/backup-xpanel.sh << EOF
#!/bin/bash
DATE=\$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/root/backups"
mkdir -p \$BACKUP_DIR

# Backup application
tar -czf \$BACKUP_DIR/xpanel_\$DATE.tar.gz -C /root Xpanels

# Keep only last 7 backups
find \$BACKUP_DIR -name "xpanel_*.tar.gz" -mtime +7 -delete

echo "Backup created: xpanel_\$DATE.tar.gz"
EOF

chmod +x /root/backup-xpanel.sh

# Add backup to crontab (daily at 2 AM)
(crontab -l 2>/dev/null; echo "0 2 * * * /root/backup-xpanel.sh") | crontab -

echo
echo "========================================"
echo "✅ Xpanel setup completed successfully!"
echo "========================================"
echo
echo "🌐 Your application is available at:"
echo "   https://xpanel.xload.ru"
echo
echo "📊 PM2 Status:"
pm2 status
echo
echo "🔧 Next steps:"
echo "1. Configure email settings in /root/Xpanels/.env"
echo "2. Test the application"
echo "3. Monitor logs with: pm2 logs xpanel"
echo
echo "📝 Useful commands:"
echo "   pm2 restart xpanel  - Restart application"
echo "   pm2 logs xpanel     - View logs"
echo "   pm2 monit           - Monitor resources"
echo "   /root/backup-xpanel.sh - Create backup"
echo
