#!/bin/bash
set -e

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║           NetTopo Self-Hosted Installation Script         ║"
echo "╚═══════════════════════════════════════════════════════════╝"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Configuration
INSTALL_DIR="/opt/nettopo"
DB_NAME="nettopo"
DB_USER="nettopo"
DB_PASSWORD=$(openssl rand -base64 32 | tr -d /=+ | cut -c1-24)

echo ""
echo -e "${YELLOW}This script will install NetTopo on your Linux server.${NC}"
echo "Installation directory: $INSTALL_DIR"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}Please run as root (sudo)${NC}"
  exit 1
fi

# Detect OS
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
else
    echo -e "${RED}Cannot detect OS${NC}"
    exit 1
fi

echo -e "${GREEN}Detected OS: $OS${NC}"

# Install dependencies based on OS
echo ""
echo "=== Installing system dependencies ==="

if [ "$OS" = "ubuntu" ] || [ "$OS" = "debian" ]; then
    apt update
    apt install -y curl git nginx postgresql postgresql-contrib
    
    # Install Node.js 20
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt install -y nodejs
    
elif [ "$OS" = "centos" ] || [ "$OS" = "rhel" ] || [ "$OS" = "rocky" ] || [ "$OS" = "almalinux" ]; then
    dnf install -y curl git nginx postgresql-server postgresql-contrib
    postgresql-setup --initdb
    systemctl start postgresql
    systemctl enable postgresql
    
    # Install Node.js 20
    curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
    dnf install -y nodejs
else
    echo -e "${RED}Unsupported OS: $OS${NC}"
    exit 1
fi

echo -e "${GREEN}✓ System dependencies installed${NC}"

# Setup PostgreSQL
echo ""
echo "=== Setting up PostgreSQL ==="

sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';" 2>/dev/null || echo "User may already exist"
sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;" 2>/dev/null || echo "Database may already exist"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"

echo -e "${GREEN}✓ PostgreSQL configured${NC}"

# Create installation directory
echo ""
echo "=== Setting up NetTopo ==="

mkdir -p $INSTALL_DIR
cd $INSTALL_DIR

# Copy server files (assuming we're running from the repo)
if [ -d "$(dirname "$0")/../server" ]; then
    cp -r "$(dirname "$0")/../server" $INSTALL_DIR/
fi

# Create .env file
cat > $INSTALL_DIR/server/.env << EOF
PORT=3001
NODE_ENV=production
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=$DB_NAME
DATABASE_USER=$DB_USER
DATABASE_PASSWORD=$DB_PASSWORD
SSH_TIMEOUT=30000
CORS_ORIGIN=http://localhost
EOF

echo -e "${GREEN}✓ Configuration created${NC}"

# Apply database migrations
echo ""
echo "=== Applying database migrations ==="

if [ -f "$(dirname "$0")/setup-database.sh" ]; then
    bash "$(dirname "$0")/setup-database.sh" "$DB_USER" "$DB_PASSWORD" "$DB_NAME"
fi

# Install Node.js dependencies and build
echo ""
echo "=== Building backend ==="

cd $INSTALL_DIR/server
npm install
npm run build

echo -e "${GREEN}✓ Backend built${NC}"

# Build frontend
echo ""
echo "=== Building frontend ==="

if [ -d "$INSTALL_DIR/../" ]; then
    cd $INSTALL_DIR/..
    npm install
    npm run build
    mkdir -p $INSTALL_DIR/frontend
    cp -r dist/* $INSTALL_DIR/frontend/
fi

echo -e "${GREEN}✓ Frontend built${NC}"

# Configure Nginx
echo ""
echo "=== Configuring Nginx ==="

cat > /etc/nginx/sites-available/nettopo << 'EOF'
server {
    listen 80;
    server_name _;
    
    root /opt/nettopo/frontend;
    index index.html;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    location /api/ {
        proxy_pass http://127.0.0.1:3001/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
EOF

ln -sf /etc/nginx/sites-available/nettopo /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true
nginx -t && systemctl restart nginx

echo -e "${GREEN}✓ Nginx configured${NC}"

# Create systemd service
echo ""
echo "=== Creating systemd service ==="

cat > /etc/systemd/system/nettopo.service << EOF
[Unit]
Description=NetTopo Backend API
After=network.target postgresql.service

[Service]
Type=simple
User=root
WorkingDirectory=$INSTALL_DIR/server
ExecStart=/usr/bin/node dist/index.js
Restart=on-failure
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable nettopo
systemctl start nettopo

echo -e "${GREEN}✓ Service created and started${NC}"

# Summary
echo ""
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║              Installation Complete!                        ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""
echo -e "${GREEN}NetTopo is now running!${NC}"
echo ""
echo "Access: http://$(hostname -I | awk '{print $1}')"
echo ""
echo "Database credentials (save these!):"
echo "  Database: $DB_NAME"
echo "  User: $DB_USER"
echo "  Password: $DB_PASSWORD"
echo ""
echo "Useful commands:"
echo "  sudo systemctl status nettopo    - Check backend status"
echo "  sudo systemctl restart nettopo   - Restart backend"
echo "  sudo journalctl -u nettopo -f    - View logs"
echo ""
