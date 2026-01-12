# NetTopo Self-Hosted - Guia de Instalação

Sistema de descoberta e visualização de topologia de rede para ISPs.
**100% Self-Hosted** - Roda completamente local, sem dependência de nuvem.

## Índice

- [Requisitos](#requisitos)
- [Instalação Rápida](#instalação-rápida)
- [Instalação via Docker](#instalação-via-docker)
- [Instalação Manual](#instalação-manual)
- [Configuração](#configuração)
- [Primeiro Uso](#primeiro-uso)
- [API Endpoints](#api-endpoints)
- [Vendors Suportados](#vendors-suportados)
- [Comandos Úteis](#comandos-úteis)
- [Troubleshooting](#troubleshooting)

---

## Requisitos

### Hardware
- **RAM:** 2GB mínimo (4GB recomendado)
- **Disco:** 20GB mínimo
- **CPU:** 2 cores

### Software
- **Sistema Operacional:** Ubuntu 22.04+, Debian 12+, Rocky Linux 8+
- **Node.js:** 18+ (instalado automaticamente pelo script)
- **PostgreSQL:** 15+ (instalado automaticamente pelo script)

### Rede
- Acesso SSH aos switches/roteadores da rede
- Porta 80 ou 443 liberada para acesso web
- Porta 3001 (apenas interna, para API)

---

## Instalação Rápida

A forma mais fácil de instalar é usando o script automatizado:

```bash
# 1. Clone o repositório
git clone <URL_DO_REPO> nettopo
cd nettopo

# 2. Torne o script executável
chmod +x scripts/install.sh

# 3. Execute como root
sudo bash scripts/install.sh
```

### O que o script faz:

1. ✅ Detecta o sistema operacional (Ubuntu/Debian/RHEL)
2. ✅ Instala Node.js 20, PostgreSQL 15+, Nginx
3. ✅ Cria banco de dados e usuário
4. ✅ Aplica schema do banco (migrations)
5. ✅ Compila backend TypeScript
6. ✅ Compila frontend React
7. ✅ Configura Nginx como proxy reverso
8. ✅ Cria serviço systemd
9. ✅ Inicia todos os serviços

Após instalação, acesse: `http://IP_DO_SERVIDOR`

---

## Instalação via Docker

Opção ideal para ambientes que já usam containers:

```bash
cd docker

# Criar arquivo de ambiente
cp ../server/.env.example .env
# Edite o .env com sua senha do banco
nano .env

# Subir containers
docker-compose up -d

# Verificar status
docker-compose ps

# Ver logs
docker-compose logs -f backend
```

### Estrutura Docker

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   PostgreSQL    │◄────│    Backend      │◄────│    Frontend     │
│   porta 5432    │     │   porta 3001    │     │   porta 80      │
│   (interno)     │     │   (interno)     │     │   (público)     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

**Volumes persistentes:**
- `pgdata` - Dados do PostgreSQL

**Acesse:** `http://localhost`

---

## Instalação Manual

Para controle total sobre a instalação:

### 1. Instalar Dependências

#### Ubuntu/Debian
```bash
sudo apt update
sudo apt install -y curl git nginx postgresql postgresql-contrib build-essential

# Instalar Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
sudo apt install -y nodejs
```

#### Rocky Linux / RHEL
```bash
sudo dnf install -y curl git nginx postgresql-server postgresql-contrib
sudo postgresql-setup --initdb
sudo systemctl enable postgresql
sudo systemctl start postgresql

# Instalar Node.js 20
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo dnf install -y nodejs
```

### 2. Configurar PostgreSQL

```bash
# Criar usuário e banco
sudo -u postgres psql << EOF
CREATE USER nettopo WITH PASSWORD 'SUA_SENHA_SEGURA_AQUI';
CREATE DATABASE nettopo OWNER nettopo;
GRANT ALL PRIVILEGES ON DATABASE nettopo TO nettopo;
\c nettopo
GRANT ALL ON SCHEMA public TO nettopo;
EOF

# Aplicar schema
sudo bash scripts/setup-database.sh nettopo SUA_SENHA_SEGURA_AQUI nettopo localhost
```

### 3. Configurar Backend

```bash
cd server

# Criar arquivo de configuração
cp .env.example .env

# Editar com suas credenciais
nano .env
```

Conteúdo do `.env`:
```env
PORT=3001
NODE_ENV=production
CORS_ORIGIN=*

DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=nettopo
DATABASE_USER=nettopo
DATABASE_PASSWORD=SUA_SENHA_SEGURA_AQUI

SSH_TIMEOUT=30000
SSH_KEEPALIVE_INTERVAL=10000
```

```bash
# Instalar dependências e compilar
npm install
npm run build
```

### 4. Compilar Frontend

```bash
cd ..

# Instalar dependências
npm install

# Build de produção
npm run build

# Copiar para diretório de produção
sudo mkdir -p /opt/nettopo/frontend
sudo cp -r dist/* /opt/nettopo/frontend/
```

### 5. Configurar Nginx

```bash
sudo nano /etc/nginx/sites-available/nettopo
```

```nginx
server {
    listen 80;
    server_name _;  # ou seu domínio

    # Frontend
    root /opt/nettopo/frontend;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_types text/css application/javascript application/json;

    # Cache para assets estáticos
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API Proxy
    location /api/ {
        proxy_pass http://127.0.0.1:3001/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Health check
    location /health {
        proxy_pass http://127.0.0.1:3001/health;
    }
}
```

```bash
# Habilitar site
sudo ln -sf /etc/nginx/sites-available/nettopo /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Testar e reiniciar
sudo nginx -t
sudo systemctl restart nginx
sudo systemctl enable nginx
```

### 6. Criar Serviço Systemd

```bash
sudo nano /etc/systemd/system/nettopo.service
```

```ini
[Unit]
Description=NetTopo Backend - Network Topology Discovery
After=network.target postgresql.service
Requires=postgresql.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/nettopo/server
Environment=NODE_ENV=production
ExecStart=/usr/bin/node dist/index.js
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

```bash
# Copiar backend para produção
sudo mkdir -p /opt/nettopo/server
sudo cp -r server/* /opt/nettopo/server/

# Habilitar e iniciar
sudo systemctl daemon-reload
sudo systemctl enable nettopo
sudo systemctl start nettopo

# Verificar status
sudo systemctl status nettopo
```

---

## Configuração

### Variáveis de Ambiente do Backend

| Variável | Descrição | Padrão |
|----------|-----------|--------|
| `PORT` | Porta da API | 3001 |
| `NODE_ENV` | Ambiente (development/production) | production |
| `DATABASE_HOST` | Host do PostgreSQL | localhost |
| `DATABASE_PORT` | Porta do PostgreSQL | 5432 |
| `DATABASE_NAME` | Nome do banco | nettopo |
| `DATABASE_USER` | Usuário do banco | nettopo |
| `DATABASE_PASSWORD` | Senha do banco | - |
| `SSH_TIMEOUT` | Timeout SSH (ms) | 30000 |
| `CORS_ORIGIN` | Origem permitida | * |

### HTTPS com Let's Encrypt

```bash
# Instalar Certbot
sudo apt install -y certbot python3-certbot-nginx

# Obter certificado
sudo certbot --nginx -d seu-dominio.com

# Renovação automática já é configurada
```

---

## Primeiro Uso

### 1. Acessar o Sistema

Abra `http://IP_DO_SERVIDOR` no navegador.

### 2. Cadastrar Primeiro Dispositivo

1. Clique em **Dispositivos** no menu lateral
2. Clique em **Novo Dispositivo**
3. Preencha:
   - **Nome:** Identificador amigável (ex: "Core-Switch-01")
   - **Hostname:** Nome do dispositivo
   - **IP:** Endereço de gerência do switch
   - **Vendor:** Fabricante (Huawei, Cisco, etc.)
   - **SSH Username:** Usuário de acesso
   - **SSH Password:** Senha de acesso
   - **Porta SSH:** (padrão 22)

### 3. Testar Conexão

1. No card do dispositivo, clique no menu ⋮ (três pontos)
2. Selecione **Testar Conexão**
3. Aguarde confirmação de sucesso

### 4. Coletar Dados

1. Clique no menu ⋮ do dispositivo
2. Selecione **Coletar Dados**
3. O sistema irá:
   - Conectar via SSH no equipamento
   - Executar comandos de descoberta (LLDP, OSPF, interfaces)
   - Parsear e salvar os vizinhos descobertos

### 5. Visualizar Topologia

1. Vá em **Topologia** no menu
2. Veja o grafo de rede gerado
3. Arraste os nós para organizar
4. Exporte para Draw.io se desejar

---

## API Endpoints

### Dispositivos

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `GET` | `/api/devices` | Listar todos dispositivos |
| `POST` | `/api/devices` | Criar novo dispositivo |
| `GET` | `/api/devices/:id` | Buscar dispositivo por ID |
| `PUT` | `/api/devices/:id` | Atualizar dispositivo |
| `DELETE` | `/api/devices/:id` | Remover dispositivo |

### Coleta SSH

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `POST` | `/api/collect/:deviceId` | Coletar dados de um dispositivo |
| `POST` | `/api/collect` | Coletar de múltiplos dispositivos |
| `POST` | `/api/collect/test/:deviceId` | Testar conexão SSH |
| `GET` | `/api/collect/history` | Histórico de coletas |

### Topologia

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `GET` | `/api/topology/data` | Dados completos da topologia |
| `GET` | `/api/topology/neighbors` | Listar vizinhos descobertos |
| `GET` | `/api/topology/links` | Listar links |
| `POST` | `/api/topology/links` | Criar link manual |
| `POST` | `/api/topology/auto-links` | Gerar links automaticamente |
| `GET` | `/api/topology/snapshots` | Listar snapshots |
| `POST` | `/api/topology/snapshots` | Salvar snapshot |

### Sistema

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `GET` | `/health` | Health check da API |
| `GET` | `/api/settings` | Configurações do sistema |
| `PUT` | `/api/settings/:key` | Atualizar configuração |

---

## Vendors Suportados

| Vendor | Modelos Testados | Protocolos |
|--------|------------------|------------|
| **Huawei** | S-Series, NE-Series, AR-Series | LLDP, OSPF |
| **Cisco** | IOS, IOS-XE, NX-OS | LLDP, CDP, OSPF |
| **Juniper** | Junos (EX, QFX, MX) | LLDP, OSPF |
| **MikroTik** | RouterOS 6.x, 7.x | LLDP, OSPF |
| **Datacom** | DmSwitch Series | LLDP |

### Adicionar Novo Vendor

Crie um arquivo em `server/src/parsers/novo_vendor.ts` seguindo o padrão existente.

---

## Comandos Úteis

### Gerenciamento do Serviço

```bash
# Status
sudo systemctl status nettopo

# Reiniciar
sudo systemctl restart nettopo

# Parar
sudo systemctl stop nettopo

# Logs em tempo real
sudo journalctl -u nettopo -f

# Últimas 100 linhas de log
sudo journalctl -u nettopo -n 100
```

### Banco de Dados

```bash
# Conectar ao PostgreSQL
sudo -u postgres psql -d nettopo

# Verificar tabelas
\dt

# Contar dispositivos
SELECT COUNT(*) FROM network_devices;

# Ver vizinhos descobertos
SELECT * FROM topology_neighbors LIMIT 10;

# Backup do banco
pg_dump -U nettopo nettopo > backup_nettopo.sql
```

### Nginx

```bash
# Testar configuração
sudo nginx -t

# Recarregar
sudo systemctl reload nginx

# Ver logs
sudo tail -f /var/log/nginx/error.log
```

---

## Troubleshooting

### ❌ Erro de Conexão SSH

**Sintomas:** "Connection refused" ou timeout

**Soluções:**
1. Verifique IP e porta do dispositivo
2. Teste manualmente: `ssh usuario@ip -p porta`
3. Verifique firewall do servidor: `sudo iptables -L`
4. Confirme que SSH está habilitado no switch

### ❌ Banco de Dados Não Conecta

**Sintomas:** "Connection refused to PostgreSQL"

**Soluções:**
```bash
# Verificar se está rodando
sudo systemctl status postgresql

# Verificar se aceita conexões
sudo -u postgres psql -c "SELECT 1"

# Verificar pg_hba.conf para conexões locais
sudo nano /etc/postgresql/*/main/pg_hba.conf
# Garantir que existe:
# local all all md5
```

### ❌ Frontend Não Carrega

**Sintomas:** Página em branco ou 404

**Soluções:**
```bash
# Verificar se arquivos existem
ls -la /opt/nettopo/frontend/

# Verificar permissões
sudo chown -R www-data:www-data /opt/nettopo/frontend/

# Verificar Nginx
sudo nginx -t
sudo systemctl status nginx
```

### ❌ API Retorna 502 Bad Gateway

**Sintomas:** Erro 502 ao acessar /api/

**Soluções:**
```bash
# Verificar se backend está rodando
sudo systemctl status nettopo

# Verificar se está na porta certa
curl http://localhost:3001/health

# Ver logs do backend
sudo journalctl -u nettopo -n 50
```

### ❌ Coleta Não Retorna Dados

**Sintomas:** Coleta "sucesso" mas sem vizinhos

**Soluções:**
1. Verifique se LLDP está habilitado no switch
2. Confirme que existem vizinhos conectados
3. Verifique os comandos para seu vendor em `server/src/parsers/`
4. Execute manualmente no switch: `display lldp neighbor brief`

---

## Atualizações

Para atualizar o sistema:

```bash
cd /opt/nettopo

# Parar serviço
sudo systemctl stop nettopo

# Atualizar código
git pull

# Reinstalar dependências
npm install
cd server && npm install && npm run build && cd ..

# Rebuild frontend
npm run build
sudo cp -r dist/* /opt/nettopo/frontend/

# Reiniciar
sudo systemctl start nettopo
```

---

## Suporte

- **Issues:** Abra uma issue no repositório
- **Logs:** Sempre inclua `journalctl -u nettopo -n 100`
- **Debug:** Execute com `NODE_ENV=development` para mais detalhes

---

## Licença

MIT License
