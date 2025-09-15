#!/bin/bash

echo "========================================"
echo "    Manual SSL Setup for Xpanel"
echo "========================================"
echo

# Check if domain points to server
echo "🔍 Checking DNS configuration..."
dig +short xpanel.xload.ru

echo "📋 Current server IP addresses:"
hostname -I

echo
echo "⚠️  IMPORTANT: Before running SSL setup, ensure:"
echo "   1. Domain xpanel.xload.ru points to this server IP"
echo "   2. Ports 80 and 443 are open"
echo "   3. No other web server is running on these ports"
echo

read -p "Continue with SSL setup? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "SSL setup cancelled"
    exit 1
fi

# Stop any conflicting services
echo "🛑 Stopping conflicting services..."
systemctl stop apache2 2>/dev/null || true
systemctl disable apache2 2>/dev/null || true

# Install certbot if not present
echo "📦 Installing/updating Certbot..."
apt update
apt install -y certbot python3-certbot-nginx

# Get SSL certificate
echo "🔒 Obtaining SSL certificate for xpanel.xload.ru..."
certbot --nginx -d xpanel.xload.ru --non-interactive --agree-tos --email fillsites0@gmail.com --redirect

if [ $? -eq 0 ]; then
    echo "✅ SSL certificate obtained successfully!"
    
    # Test certificate renewal
    echo "🔄 Testing certificate renewal..."
    certbot renew --dry-run
    
    # Setup auto-renewal
    echo "⏰ Setting up automatic renewal..."
    (crontab -l 2>/dev/null; echo "0 12 * * * /usr/bin/certbot renew --quiet") | crontab -
    
    # Reload nginx
    systemctl reload nginx
    
    echo
    echo "✅ SSL setup completed!"
    echo "🌐 Your site is now available at: https://xpanel.xload.ru"
    echo "🔒 Certificate will auto-renew every 12 hours"
    
else
    echo "❌ SSL certificate setup failed!"
    echo
    echo "🔧 Troubleshooting steps:"
    echo "1. Check DNS: dig xpanel.xload.ru"
    echo "2. Check firewall: ufw status"
    echo "3. Check nginx: systemctl status nginx"
    echo "4. Manual certificate: certbot --nginx -d xpanel.xload.ru"
    echo
    echo "📝 Site will still work on: http://xpanel.xload.ru"
fi

echo
echo "📊 Current certificate status:"
certbot certificates

echo
echo "🔧 Useful SSL commands:"
echo "  certbot certificates        - View certificates"
echo "  certbot renew              - Renew certificates"
echo "  certbot delete             - Delete certificates"
echo "  systemctl reload nginx     - Reload nginx config"
