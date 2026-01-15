# NetTopo (Self-Hosted)

NetTopo é um sistema **100% local** para descoberta e visualização de topologia de rede (LLDP/OSPF) para provedores/ISPs.

## Subir com Docker (do zero)

Pré-requisitos:
- Docker + Docker Compose (plugin `docker compose`)

Na raiz do repositório:

```bash
docker compose build
docker compose up
```

Acesso:
- Frontend: `http://localhost/`
- Backend healthcheck: `http://localhost/api/health`

## Como funciona (arquitetura)

- **PostgreSQL**: persiste dispositivos, vizinhos, links e histórico de coletas.
- **Backend (Node/TypeScript)**: expõe a API REST em `/api/*`.
- **Frontend (Vite + Nginx)**: SPA servida pelo Nginx com proxy `/api/*` para o backend.

## Reset completo (apagar dados)

Se você quer recriar o banco do zero (incluindo tabelas):

```bash
docker compose down -v
docker compose up --build
```

## Configuração

Você pode definir a senha do banco via variável:

```bash
export DB_PASSWORD='minha_senha_forte'
docker compose up --build
```

## Troubleshooting rápido

- **"relation ... does not exist" / tabelas ausentes**: o volume antigo do Postgres pode ter sido reaproveitado.
  Rode `docker compose down -v` para recriar.
- **Frontend não conecta no backend**: valide `GET http://localhost/api/health`.


