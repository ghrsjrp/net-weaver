# NetTopo Self-Hosted - Guia de Instalação

Sistema de descoberta e visualização de topologia de rede para ISPs.

## Requisitos

- **Sistema Operacional:** Ubuntu 22.04+, Debian 12+, CentOS 8+, Rocky Linux 8+
- **RAM:** 2GB mínimo (4GB recomendado)
- **Disco:** 20GB mínimo
- **Node.js:** 18+ (instalado automaticamente)
- **PostgreSQL:** 15+ (instalado automaticamente)
- **Acesso SSH:** aos switches da rede

## Instalação Rápida

```bash
# 1. Clone o repositório
git clone <URL_DO_REPO> nettopo
cd nettopo

# 2. Execute o script de instalação
sudo bash scripts/install.sh
```

O script irá:
- Instalar Node.js, PostgreSQL e Nginx
- Criar banco de dados e aplicar schema
- Buildar frontend e backend
- Configurar Nginx como proxy reverso
- Criar serviço systemd

## Instalação Manual

### 1. Instalar Dependências

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install -y curl git nginx postgresql postgresql-contrib
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
sudo apt install -y nodejs

# CentOS/Rocky
sudo dnf install -y curl git nginx postgresql-server
sudo postgresql-setup --initdb
sudo systemctl start postgresql
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo dnf install -y nodejs
```

### 2. Configurar PostgreSQL

```bash
sudo -u postgres psql
CREATE USER nettopo WITH PASSWORD 'sua_senha_segura';
CREATE DATABASE nettopo OWNER nettopo;
GRANT ALL PRIVILEGES ON DATABASE nettopo TO nettopo;
\q
```

### 3. Configurar o Backend

```bash
cd server
cp .env.example .env
nano .env  # Edite com suas credenciais

npm install
npm run build
```

### 4. Aplicar Schema do Banco

```bash
bash scripts/setup-database.sh nettopo sua_senha_segura nettopo
```

### 5. Buildar Frontend

```bash
cd ..
npm install
npm run build
sudo mkdir -p /opt/nettopo/frontend
sudo cp -r dist/* /opt/nettopo/frontend/
```

### 6. Configurar Nginx

```nginx
# /etc/nginx/sites-available/nettopo
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
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/nettopo /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl restart nginx
```

### 7. Criar Serviço Systemd

```ini
# /etc/systemd/system/nettopo.service
[Unit]
Description=NetTopo Backend
After=network.target postgresql.service

[Service]
Type=simple
WorkingDirectory=/opt/nettopo/server
ExecStart=/usr/bin/node dist/index.js
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable nettopo
sudo systemctl start nettopo
```

## Uso

### Primeiro Acesso

1. Acesse `http://IP_DO_SERVIDOR`
2. Vá em **Dispositivos** → **Novo Dispositivo**
3. Cadastre um switch com IP, usuário e senha SSH
4. Clique no menu ⋮ do dispositivo → **Coletar Dados**

### Comandos Úteis

```bash
# Status do serviço
sudo systemctl status nettopo

# Ver logs em tempo real
sudo journalctl -u nettopo -f

# Reiniciar backend
sudo systemctl restart nettopo

# Verificar Nginx
sudo nginx -t
sudo systemctl status nginx
```

### API Endpoints

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | /api/devices | Listar dispositivos |
| POST | /api/devices | Criar dispositivo |
| POST | /api/collect/:id | Coletar dados de um dispositivo |
| GET | /api/topology/data | Obter dados de topologia |
| POST | /api/topology/auto-links | Auto-criar links |

## Vendors Suportados

- **Huawei** - S-Series, NE-Series, AR-Series
- **Cisco** - IOS, IOS-XE
- **Juniper** - Junos
- **MikroTik** - RouterOS
- **Datacom** - DmSwitch

## Troubleshooting

### Erro de conexão SSH
- Verifique IP, porta, usuário e senha
- Teste: `ssh usuario@ip_do_switch -p porta`
- Verifique firewall do servidor

### Banco de dados não conecta
```bash
sudo systemctl status postgresql
sudo -u postgres psql -c "SELECT 1"
```

### Frontend não carrega
```bash
ls -la /opt/nettopo/frontend/
sudo nginx -t
```

## Docker (Alternativa)

```bash
cd docker
docker-compose up -d
```

Acesse: `http://localhost`

## Licença

MIT License
