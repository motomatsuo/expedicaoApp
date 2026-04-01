# Backend - Moto Matsuo Expedicao

API NestJS para autenticacao e base inicial do portal de expedicao.

## Stack

- Node.js + NestJS + TypeScript
- Supabase (tabela `public.db_login_portal`)
- JWT em cookie `HttpOnly`

## Setup

1. Instale as dependencias:

```bash
npm install
```

2. Crie o arquivo `.env` com base no `.env.example`.

3. Rode o backend:

```bash
npm run start:dev
```

Backend padrao em `http://localhost:3000`.

## Endpoints MVP

- `POST /api/v1/auth/login`
- `GET /api/v1/auth/me`
- `POST /api/v1/auth/logout`
- `GET /api/v1/health`

## Observacoes de seguranca

- A comparacao de senha aceita texto puro para compatibilidade inicial.
- Se `senha_vend` estiver em bcrypt (`$2a$` ou `$2b$`), faz verificacao por hash.
- Proxima fase: migrar 100% para hash forte e eliminar texto puro.
