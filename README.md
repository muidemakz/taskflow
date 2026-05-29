# Taskflow

Create tasks. Share progress. Get things done.

Taskflow is a full-stack rebuild of the original single-file EPM checklist artifact. It uses React + Vite on the frontend, Express + Prisma on the backend, JWT authentication, role-based admin screens, and a public read-only share route.

## Stack

- Frontend: React 18, Vite, React Router, Tailwind CSS, Zustand, Axios, Lucide React, react-hot-toast, dnd-kit
- Backend: Node.js, Express, Prisma, PostgreSQL, JWT, bcrypt
- Deploy: Netlify frontend, Render or Railway backend, Railway Postgres or Supabase database

## Local Setup

### Backend

```bash
cd backend
npm install
cp .env.example .env
npx prisma generate
npm run db:setup
npm run seed
npm run dev
```

Backend runs on `http://localhost:4000`. For production and Railway, use PostgreSQL and set `DATABASE_URL` from your Railway Postgres service.

Demo accounts:

- Admin: `admin@taskflow.app` / `Admin1234!`
- Demo user: `demo@taskflow.app` / `Demo1234!`

The seed script creates the Fortnoto project with the extracted tasks, groups, statuses, and ordering from the HTML artifact.

### Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Frontend runs on `http://localhost:5173`.

## Deployment

### Backend on Render

1. Create a PostgreSQL database on Render, Railway, or Supabase.
2. Create a Render web service using `backend/render.yaml`, or configure:
   - Root directory: `backend`
   - Build command: `npm install && npx prisma generate && npx prisma db push`
   - Start command: `npm start`
3. Add environment variables:
   - `DATABASE_URL`
   - `JWT_SECRET`
   - `FRONTEND_URL=https://your-netlify-site.netlify.app`
4. Run `npm run seed` once from the backend shell.

### Frontend on Netlify

1. Set the Netlify base directory to `frontend`.
2. Build command: `npm run build`
3. Publish directory: `dist`
4. Add `VITE_API_URL=https://your-api-url.onrender.com`.
5. `frontend/netlify.toml` handles SPA redirects.

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
