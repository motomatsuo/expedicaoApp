# Frontend - Moto Matsuo Expedicao

WebApp Next.js com login, shell autenticado e dashboard inicial.

## Stack

- Next.js + TypeScript
- Tailwind CSS
- PWA basico (manifest + theme color)

## Setup

1. Instale as dependencias:

```bash
npm install
```

2. Crie o arquivo `.env.local` com base no `.env.example`.

3. Rode o frontend:

```bash
npm run dev
```

Frontend padrao em `http://localhost:3001`.

## Rotas MVP

- `/login`
- `/dashboard`

## Integracao com backend

- Configure `NEXT_PUBLIC_API_URL` apontando para `http://localhost:3000/api/v1`.
- O login chama `POST /auth/login`.
- O dashboard usa protecao de rota por cookie de sessao de UI (`portal_ui_session`) para o MVP inicial.
