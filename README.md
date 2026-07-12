# Taskflow

Create tasks. Share progress. Get things done.

Taskflow is a full-stack rebuild of the original single-file EPM checklist artifact. It uses React + Vite on the frontend, Express + Prisma on the backend, JWT authentication, role-based admin screens, and a public read-only share route.

## Stack

- Frontend: React 18, Vite, React Router, Tailwind CSS, Zustand, Axios, Lucide React, react-hot-toast, dnd-kit
- Backend: Node.js, Express, Prisma, PostgreSQL, JWT, bcrypt
- Deploy: Netlify (frontend), Railway (backend + Postgres) — see [docs/runbook.md](docs/runbook.md) for the LOCAL / STAGING / PRODUCTION pipeline

## Environments

Taskflow runs in three environments — see [docs/runbook.md](docs/runbook.md) for the full promotion workflow:

| Environment | Where | Branch | Database |
|---|---|---|---|
| LOCAL | Your laptop | any feature branch | local Docker Postgres via `.env.local` |
| STAGING | Railway `staging` environment + Netlify branch deploy | `staging` | separate Railway Postgres, staging-only data |
| PRODUCTION | Railway `production` environment + Netlify production deploy | `main` | production Railway Postgres |

## Local Setup

### Database

Start a local Postgres with Docker:

```bash
docker compose up -d
```

This runs Postgres on `localhost:5432` with user/password/db all `taskflow`, matching the default `DATABASE_URL` in `backend/.env.example`.

### Backend

```bash
cd backend
npm install
cp .env.example .env.local
npm run db:push
npm run seed
npm run dev
```

Backend runs on `http://localhost:4000`. `.env.local` is preferred over `.env` if both exist (and is gitignored). `npm run db:push` applies the Prisma schema to your local database; `npm run seed` creates the demo admin/user accounts and the Fortnoto demo project — safe to rerun any time.

Demo accounts:

- Admin: `admin@taskflow.app` / `Admin1234!`
- Demo user: `demo@taskflow.app` / `Demo1234!`

### Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Frontend runs on `http://localhost:5173` and points at your local backend. Running `npm run dev` in either package never touches staging or production — they're separate databases with separate credentials that only exist in Railway/Netlify's own environment variables, never in your local `.env.local`.

## Routes

- `/` landing page
- `/login`, `/register`
- `/dashboard`
- `/projects/:id`
- `/share/:shareToken`
- `/admin`
- `/admin/users`
- `/admin/users/:id`

## API Summary

- Auth: `/api/auth/register`, `/api/auth/login`, `/api/auth/logout`, `/api/auth/me`
- Projects: `/api/projects`
- Groups: `/api/groups`
- Tasks: `/api/tasks`
- Public share: `/api/share/:shareToken`
- Admin: `/api/admin/stats`, `/api/admin/users`
