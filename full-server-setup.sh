#!/bin/bash

echo "========================================"
echo "    Xpanel - Complete Server Setup"
echo "    From Zero to Production"
echo "========================================"
echo

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    print_error "Please run as root (use sudo)"
    exit 1
fi

# Detect OS
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$NAME
    VER=$VERSION_ID
else
    print_error "Cannot detect OS"
    exit 1
fi

print_info "Detected OS: $OS $VER"

# Update system
print_info "Updating system packages..."
if command -v apt >/dev/null 2>&1; then
    export DEBIAN_FRONTEND=noninteractive
    apt update && apt upgrade -y
    PKG_MANAGER="apt"
elif command -v yum >/dev/null 2>&1; then
    yum update -y
    PKG_MANAGER="yum"
elif command -v dnf >/dev/null 2>&1; then
    dnf update -y
    PKG_MANAGER="dnf"
else
    print_error "No supported package manager found"
    exit 1
fi

print_status "System updated"

# Install basic tools
print_info "Installing basic tools..."
if [ "$PKG_MANAGER" = "apt" ]; then
    apt install -y sudo curl wget git unzip tar gzip nano vim htop net-tools ufw
elif [ "$PKG_MANAGER" = "yum" ]; then
    yum install -y sudo curl wget git unzip tar gzip nano vim htop net-tools firewalld
elif [ "$PKG_MANAGER" = "dnf" ]; then
    dnf install -y sudo curl wget git unzip tar gzip nano vim htop net-tools firewalld
fi

print_status "Basic tools installed"

# Install Node.js 18.x
print_info "Installing Node.js 18.x..."
if [ "$PKG_MANAGER" = "apt" ]; then
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt-get install -y nodejs
elif [ "$PKG_MANAGER" = "yum" ] || [ "$PKG_MANAGER" = "dnf" ]; then
    curl -fsSL https://rpm.nodesource.com/setup_18.x | bash -
    $PKG_MANAGER install -y nodejs
fi

# Verify Node.js installation
if command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1; then
    print_status "Node.js $(node --version) and npm $(npm --version) installed"
else
    print_error "Node.js installation failed"
    exit 1
fi

# Install Python and dependencies
print_info "Installing Python dependencies..."
if [ "$PKG_MANAGER" = "apt" ]; then
    apt install -y python3 python3-pip python3-venv
elif [ "$PKG_MANAGER" = "yum" ] || [ "$PKG_MANAGER" = "dnf" ]; then
    $PKG_MANAGER install -y python3 python3-pip
fi

print_status "Python installed"

# Install Nginx
print_info "Installing Nginx..."
if [ "$PKG_MANAGER" = "apt" ]; then
    apt install -y nginx
elif [ "$PKG_MANAGER" = "yum" ] || [ "$PKG_MANAGER" = "dnf" ]; then
    $PKG_MANAGER install -y nginx
fi

systemctl enable nginx
systemctl start nginx
print_status "Nginx installed and started"

# Install Certbot for SSL
print_info "Installing Certbot for SSL..."
if [ "$PKG_MANAGER" = "apt" ]; then
    apt install -y certbot python3-certbot-nginx
elif [ "$PKG_MANAGER" = "yum" ] || [ "$PKG_MANAGER" = "dnf" ]; then
    $PKG_MANAGER install -y certbot python3-certbot-nginx
fi

print_status "Certbot installed"

# Create application directory
print_info "Setting up application directory..."
mkdir -p /opt/xpanel
cd /opt/xpanel

# Create package.json
cat > package.json << 'EOF'
{
  "name": "xpanel-vps-manager",
  "version": "1.0.0",
  "description": "Xpanel - VPS Management System",
  "main": "server/index.js",
  "scripts": {
    "start": "node server/index.js",
    "dev": "node server/index.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "socket.io": "^4.7.2",
    "bcryptjs": "^2.4.3",
    "jsonwebtoken": "^9.0.2",
    "dotenv": "^16.3.1",
    "cors": "^2.8.5",
    "multer": "^1.4.5",
    "node-ssh": "^13.1.0",
    "nodemailer": "^6.9.4"
  }
}
EOF

# Try to install npm dependencies with fallback
print_info "Installing Node.js dependencies..."
if npm install --production --no-optional; then
    print_status "Dependencies installed via npm"
else
    print_warning "npm install failed, using system packages..."
    
    # Install available Node.js packages from system repos
    if [ "$PKG_MANAGER" = "apt" ]; then
        apt install -y node-express node-ws || true
    fi
    
    # Create minimal node_modules structure
    mkdir -p node_modules
    
    # Create simple fallback modules
    mkdir -p node_modules/express
    cat > node_modules/express/index.js << 'EOF'
// Fallback Express-like server
const http = require('http');
const url = require('url');

function express() {
    const app = {
        routes: { GET: {}, POST: {}, PUT: {}, DELETE: {} },
        middlewares: [],
        
        use(middleware) {
            if (typeof middleware === 'function') {
                this.middlewares.push(middleware);
            }
        },
        
        get(path, handler) { this.routes.GET[path] = handler; },
        post(path, handler) { this.routes.POST[path] = handler; },
        put(path, handler) { this.routes.PUT[path] = handler; },
        delete(path, handler) { this.routes.DELETE[path] = handler; },
        
        listen(port, callback) {
            const server = http.createServer((req, res) => {
                const parsedUrl = url.parse(req.url, true);
                const method = req.method;
                const path = parsedUrl.pathname;
                
                // Add CORS headers
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
                res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
                
                if (method === 'OPTIONS') {
                    res.writeHead(200);
                    res.end();
                    return;
                }
                
                // Simple routing
                const handler = this.routes[method] && this.routes[method][path];
                if (handler) {
                    handler(req, res);
                } else {
                    res.writeHead(404);
                    res.end('Not Found');
                }
            });
            
            server.listen(port, callback);
            return server;
        }
    };
    
    return app;
}

express.static = (dir) => {
    return (req, res, next) => {
        // Simple static file serving would go here
        next();
    };
};

module.exports = express;
EOF

    # Create other minimal modules
    mkdir -p node_modules/cors
    cat > node_modules/cors/index.js << 'EOF'
module.exports = function(options) {
    return function(req, res, next) {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        if (next) next();
    };
};
EOF

    mkdir -p node_modules/dotenv
    cat > node_modules/dotenv/index.js << 'EOF'
const fs = require('fs');
const path = require('path');

module.exports = {
    config: function(options = {}) {
        const envPath = options.path || path.join(process.cwd(), '.env');
        try {
            const data = fs.readFileSync(envPath, 'utf8');
            const lines = data.split('\n');
            lines.forEach(line => {
                const [key, ...values] = line.split('=');
                if (key && values.length) {
                    process.env[key.trim()] = values.join('=').trim();
                }
            });
        } catch (err) {
            // .env file not found or not readable
        }
    }
};
EOF

    print_warning "Using fallback modules"
fi

# Create server directory and main server file
mkdir -p server
cat > server/index.js << 'EOF'
const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');

// Try to load optional modules
let cors, dotenv;
try { cors = require('cors'); } catch(e) { cors = null; }
try { dotenv = require('dotenv'); if (dotenv) dotenv.config(); } catch(e) {}

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3001;

// Middleware
if (cors) app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static(path.join(__dirname, '../public')));

// API Routes
app.get('/api/status', (req, res) => {
    res.json({
        status: 'running',
        version: '1.0.0',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        timestamp: new Date().toISOString()
    });
});

app.get('/api/system', (req, res) => {
    const os = require('os');
    res.json({
        platform: os.platform(),
        arch: os.arch(),
        cpus: os.cpus().length,
        memory: {
            total: os.totalmem(),
            free: os.freemem()
        },
        uptime: os.uptime(),
        loadavg: os.loadavg()
    });
});

// Main route
app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Xpanel - VPS Management System</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .container {
            background: white;
            padding: 2rem;
            border-radius: 15px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            max-width: 800px;
            width: 90%;
        }
        h1 { 
            color: #333;
            text-align: center;
            margin-bottom: 2rem;
            font-size: 2.5rem;
        }
        .status-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 1rem;
            margin: 2rem 0;
        }
        .status-card {
            background: #f8f9fa;
            padding: 1.5rem;
            border-radius: 10px;
            border-left: 4px solid #28a745;
        }
        .status-card h3 {
            color: #28a745;
            margin-bottom: 0.5rem;
        }
        .info-section {
            background: #e3f2fd;
            padding: 1.5rem;
            border-radius: 10px;
            margin: 1rem 0;
        }
        .info-section h3 {
            color: #1976d2;
            margin-bottom: 1rem;
        }
        .command {
            background: #2d3748;
            color: #e2e8f0;
            padding: 0.5rem 1rem;
            border-radius: 5px;
            font-family: 'Courier New', monospace;
            margin: 0.5rem 0;
            display: inline-block;
        }
        .api-links {
            display: flex;
            gap: 1rem;
            margin: 1rem 0;
        }
        .api-link {
            background: #007bff;
            color: white;
            padding: 0.5rem 1rem;
            text-decoration: none;
            border-radius: 5px;
            transition: background 0.3s;
        }
        .api-link:hover {
            background: #0056b3;
        }
        .footer {
            text-align: center;
            margin-top: 2rem;
            color: #666;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 Xpanel VPS Management</h1>
        
        <div class="status-grid">
            <div class="status-card">
                <h3>✅ Server Status</h3>
                <p><strong>Status:</strong> Running</p>
                <p><strong>Port:</strong> ${PORT}</p>
                <p><strong>Node.js:</strong> ${process.version}</p>
                <p><strong>Uptime:</strong> ${Math.floor(process.uptime())}s</p>
            </div>
            
            <div class="status-card">
                <h3>🌐 Network</h3>
                <p><strong>Host:</strong> ${req.get('host')}</p>
                <p><strong>Protocol:</strong> ${req.protocol}</p>
                <p><strong>IP:</strong> ${req.ip || req.connection.remoteAddress}</p>
                <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
            </div>
        </div>

        <div class="info-section">
            <h3>📡 API Endpoints</h3>
            <div class="api-links">
                <a href="/api/status" class="api-link">Server Status</a>
                <a href="/api/system" class="api-link">System Info</a>
            </div>
        </div>

        <div class="info-section">
            <h3>🔧 Server Management</h3>
            <p><strong>Start Service:</strong> <span class="command">systemctl start xpanel</span></p>
            <p><strong>Stop Service:</strong> <span class="command">systemctl stop xpanel</span></p>
            <p><strong>Restart Service:</strong> <span class="command">systemctl restart xpanel</span></p>
            <p><strong>View Logs:</strong> <span class="command">journalctl -u xpanel -f</span></p>
            <p><strong>Check Status:</strong> <span class="command">systemctl status xpanel</span></p>
        </div>

        <div class="info-section">
            <h3>📋 Next Steps</h3>
            <ul>
                <li>✅ Basic server setup completed</li>
                <li>✅ Nginx reverse proxy configured</li>
                <li>✅ SSL certificate ready for installation</li>
                <li>⏳ Add VPS management features</li>
                <li>⏳ Configure SSH connections</li>
                <li>⏳ Add monitoring dashboard</li>
            </ul>
        </div>

        <div class="footer">
            <p>Xpanel VPS Management System v1.0.0</p>
            <p>Powered by Node.js ${process.version}</p>
        </div>
    </div>

    <script>
        // Auto-refresh status every 30 seconds
        setTimeout(() => location.reload(), 30000);
        
        // Add click handlers for API links
        document.querySelectorAll('.api-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                fetch(link.href)
                    .then(response => response.json())
                    .then(data => {
                        alert(JSON.stringify(data, null, 2));
                    })
                    .catch(err => alert('Error: ' + err.message));
            });
        });
    </script>
</body>
</html>
    `);
});

// Error handling
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
});

// Start server
server.listen(PORT, () => {
    console.log(`🚀 Xpanel server running on port ${PORT}`);
    console.log(`📡 Access: http://localhost:${PORT}`);
    console.log(`⏰ Started at: ${new Date().toISOString()}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 Received SIGTERM, shutting down gracefully...');
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('🛑 Received SIGINT, shutting down gracefully...');
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});
EOF

# Create .env file
cat > .env << 'EOF'
# Production Environment
NODE_ENV=production
PORT=3001
DOMAIN=xpanel.xload.ru

# JWT Configuration
JWT_SECRET=xpanel_production_secret_$(openssl rand -hex 32)

# Email Configuration (configure manually)
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password

# Admin Configuration
ADMIN_EMAIL=admin@example.com

# Security
BCRYPT_ROUNDS=12
EOF

print_status "Application files created"

# Create systemd service
print_info "Creating systemd service..."
cat > /etc/systemd/system/xpanel.service << 'EOF'
[Unit]
Description=Xpanel VPS Management System
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/xpanel
Environment=NODE_ENV=production
Environment=PORT=3001
ExecStart=/usr/bin/node server/index.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=xpanel

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable xpanel
systemctl start xpanel

print_status "Xpanel service created and started"

# Configure Nginx
print_info "Configuring Nginx..."
cat > /etc/nginx/sites-available/xpanel << 'EOF'
server {
    listen 80;
    server_name xpanel.xload.ru;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;

    # Main proxy to Node.js app
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }

    # WebSocket support
    location /socket.io/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Static files caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF

# Enable site
if [ -d "/etc/nginx/sites-enabled" ]; then
    ln -sf /etc/nginx/sites-available/xpanel /etc/nginx/sites-enabled/
    rm -f /etc/nginx/sites-enabled/default
elif [ -d "/etc/nginx/conf.d" ]; then
    cp /etc/nginx/sites-available/xpanel /etc/nginx/conf.d/xpanel.conf
fi

# Test nginx configuration
if nginx -t; then
    systemctl reload nginx
    print_status "Nginx configured and reloaded"
else
    print_error "Nginx configuration test failed"
    exit 1
fi

# Configure firewall
print_info "Configuring firewall..."
if command -v ufw >/dev/null 2>&1; then
    ufw allow 22/tcp
    ufw allow 80/tcp
    ufw allow 443/tcp
    ufw --force enable
    print_status "UFW firewall configured"
elif command -v firewall-cmd >/dev/null 2>&1; then
    systemctl enable firewalld
    systemctl start firewalld
    firewall-cmd --permanent --add-service=ssh
    firewall-cmd --permanent --add-service=http
    firewall-cmd --permanent --add-service=https
    firewall-cmd --reload
    print_status "Firewalld configured"
fi

# Create management scripts
print_info "Creating management scripts..."
cat > /opt/xpanel/manage.sh << 'EOF'
#!/bin/bash

case "$1" in
    start)
        systemctl start xpanel
        systemctl start nginx
        echo "✅ Xpanel started"
        ;;
    stop)
        systemctl stop xpanel
        echo "🛑 Xpanel stopped"
        ;;
    restart)
        systemctl restart xpanel
        systemctl reload nginx
        echo "🔄 Xpanel restarted"
        ;;
    status)
        echo "📊 Xpanel Status:"
        systemctl status xpanel --no-pager
        echo ""
        echo "📊 Nginx Status:"
        systemctl status nginx --no-pager
        ;;
    logs)
        journalctl -u xpanel -f
        ;;
    ssl)
        if [ -z "$2" ]; then
            echo "Usage: $0 ssl <domain>"
            exit 1
        fi
        certbot --nginx -d "$2" --non-interactive --agree-tos --email admin@"$2"
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status|logs|ssl <domain>}"
        echo ""
        echo "Examples:"
        echo "  $0 start          - Start Xpanel"
        echo "  $0 stop           - Stop Xpanel"
        echo "  $0 restart        - Restart Xpanel"
        echo "  $0 status         - Show status"
        echo "  $0 logs           - Show live logs"
        echo "  $0 ssl example.com - Setup SSL for domain"
        exit 1
        ;;
esac
EOF

chmod +x /opt/xpanel/manage.sh
ln -sf /opt/xpanel/manage.sh /usr/local/bin/xpanel

print_status "Management scripts created"

# Final status check
print_info "Performing final status check..."
sleep 3

if systemctl is-active --quiet xpanel; then
    print_status "Xpanel service is running"
else
    print_error "Xpanel service is not running"
fi

if systemctl is-active --quiet nginx; then
    print_status "Nginx service is running"
else
    print_error "Nginx service is not running"
fi

# Test local connection
if curl -s http://localhost:3001 >/dev/null; then
    print_status "Application responding on port 3001"
else
    print_warning "Application not responding on port 3001"
fi

echo
echo "========================================"
print_status "Xpanel installation completed!"
echo "========================================"
echo
print_info "🌐 Your application is running on:"
print_info "   Local: http://localhost:3001"
print_info "   Public: http://$(curl -s ifconfig.me 2>/dev/null || echo 'YOUR_SERVER_IP')"
echo
print_info "🔧 Management commands:"
print_info "   xpanel start     - Start services"
print_info "   xpanel stop      - Stop services"  
print_info "   xpanel restart   - Restart services"
print_info "   xpanel status    - Show status"
print_info "   xpanel logs      - Show logs"
print_info "   xpanel ssl <domain> - Setup SSL"
echo
print_info "📁 Application directory: /opt/xpanel"
print_info "📝 Configuration file: /opt/xpanel/.env"
print_info "🔧 Service file: /etc/systemd/system/xpanel.service"
echo
print_info "🔒 To setup SSL certificate:"
print_info "   xpanel ssl your-domain.com"
echo
print_info "📊 To monitor:"
print_info "   xpanel status"
print_info "   xpanel logs"
echo
print_warning "⚠️  Next steps:"
print_warning "   1. Configure your domain DNS to point to this server"
print_warning "   2. Run: xpanel ssl your-domain.com"
print_warning "   3. Edit /opt/xpanel/.env for email settings"
print_warning "   4. Add your VPS management features"
echo
print_status "Installation complete! 🎉"
