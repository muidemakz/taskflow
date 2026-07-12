# Taskflow deploy pipeline runbook

Three environments. Changes only reach production after being verified on staging.

| | LOCAL | STAGING | PRODUCTION |
|---|---|---|---|
| Branch | any feature branch | `staging` | `main` |
| Backend | `npm run dev` on your laptop | Railway `staging` environment | Railway `production` environment |
| Frontend | `npm run dev` on your laptop (Vite, port 5173) | Netlify branch deploy (`staging--<site>.netlify.app`) | Netlify production deploy |
| Database | local Docker Postgres (`.env.local`) | dedicated Railway Postgres, staging-only data | production Railway Postgres |
| `ENABLE_AI_GENERATION` | `true` (your call, just you testing) | `false` by default | `false` by default |
| Data | whatever you create locally | synthetic seed data only (never real user data) | real user data |

Nothing in this pipeline is automatic across environments — a change only moves forward when you explicitly merge/push it, and a schema change only reaches a database when you explicitly run a migration command against it.

---

## One-time setup (you do this in the Railway/Netlify dashboards)

I can't safely drive these dashboards for you — Railway's console didn't survive browser automation reliably when I checked it earlier, and creating billed resources (a second Postgres instance) shouldn't happen without you watching it happen. Everything below is a dashboard action for you to run once.

### 1. Railway: create the `staging` environment

1. Open the Taskflow project in Railway.
2. Top nav → environment dropdown → **+ New Environment**.
3. Choose **Empty Environment**, name it `staging`.
4. In the new `staging` environment, add two services:
   - **Backend service**: deploy from the same GitHub repo, same root directory (`backend`) as production, but set it to track the **`staging`** branch (Service → Settings → Source → change tracked branch to `staging`).
   - **Postgres**: **+ New → Database → PostgreSQL**. This is a separate database from production — Railway gives it its own `DATABASE_URL` automatically, injected into any service in the same environment that references it.
5. On the `staging` backend service, set environment variables (Settings → Variables):
   - `DATABASE_URL` — reference the staging Postgres you just created (Railway lets you reference another service's variable directly, or paste its connection string).
   - `JWT_SECRET` — generate a **different** secret than production (don't reuse it).
   - `JWT_EXPIRES_IN=30m`, `JWT_REFRESH_EXPIRES_IN=7d`
   - `FRONTEND_URL` — the staging Netlify URL from step 2 below (e.g. `https://staging--taskflow.netlify.app`)
   - `ENABLE_AI_GENERATION=false` (matches production default; flip to `true` yourself if you want to test the feature there)
   - `ANTHROPIC_API_KEY` — only set this if/when you turn `ENABLE_AI_GENERATION` on for staging; use a key you're comfortable spending against a non-production environment.
6. Confirm `backend/railway.json`'s `deploy.preDeployCommand` (`npx prisma db push`) and `startCommand` (`npm start`) apply here automatically — they're the same config file for every environment, only the env vars differ per environment.

### 2. Netlify: enable a persistent `staging` branch deploy

1. Site → **Project configuration → Build & deploy → Continuous Deployment → Branches and deploy contexts → Configure**.
2. Under **Branch deploys**, choose **Let me add individual branches**, add `staging`.
3. Save. Every push to `staging` now deploys to a stable URL: `https://staging--<your-site-name>.netlify.app` (not a throwaway PR-preview URL — same URL every time).
4. Open [netlify.toml](../netlify.toml) in this repo and replace the placeholder `VITE_API_URL` under `[context.staging.environment]` with your real staging Railway backend URL from step 1.
5. Update backend `staging` environment's `FRONTEND_URL` (step 1.5 above) to match this exact Netlify staging URL.

### 3. Confirm CORS already covers staging — no code change needed

[backend/src/index.js](../backend/src/index.js) already allows any `https://*.netlify.app` origin via regex (`/^https:\/\/[a-z0-9-]+\.netlify\.app$/i`), which covers Netlify's branch-deploy subdomain pattern (`staging--taskflow.netlify.app`) automatically. Setting `FRONTEND_URL` per environment (step 1.5) is still worth doing for clarity and defense-in-depth, but the app would already accept the staging origin even without it.

### 4. Seed staging once

Staging must never silently contain real production data. Per your call, staging gets the same synthetic seed data already used locally — the existing `seed.js` only ever creates a fixed demo admin/user and the fictional "Fortnoto" checklist project (from `fortnotoSeed.json`), never real user data.

Run it once against staging using the Railway CLI, scoped to the `staging` environment:

```bash
railway link            # select the Taskflow project
railway environment staging
railway run npm run seed:run
```

`seed:run` is idempotent (it upserts the demo users and skips the Fortnoto project if it already exists), so it's safe to rerun if staging ever needs resetting.

---

## Promotion workflow: local → staging → production

```
feature branch  →  staging  →  main
   (local)        (staging)   (production)
```

1. **Develop locally.** Branch off `staging` (or `main`, doesn't matter — just make sure you rebase/merge in `staging`'s latest before opening a PR into it) for your feature work. Run against your local Docker Postgres via `.env.local`. Nothing here touches staging or production — see confirmation below.
2. **Schema changes go first.** If your change touches `backend/prisma/schema.prisma`, generate a proper Prisma migration locally (`npx prisma migrate dev --name <description>`) once migrations exist (see note below — they don't yet, this repo still uses `db push`). Commit the migration files.
3. **Merge into `staging`**, not `main`. Open a PR from your feature branch into `staging`, review, merge.
4. **Staging auto-deploys.** Railway's `staging` backend and Netlify's `staging` branch deploy both pick up the push automatically. Railway runs `preDeployCommand` (`npx prisma db push`, or `prisma migrate deploy` once real migrations exist) once against the **staging** database before starting the server — this is where your schema change actually gets applied for the first time outside your laptop.
5. **Verify on staging.** Use the stable staging URLs (Netlify `staging--...` frontend hitting the Railway `staging` backend). This is a real, persistent environment you can return to — not a one-shot preview that disappears.
6. **Promote to production.** Once staging looks right, open a PR from `staging` into `main`, review, merge.
7. **Production deploys.** Railway's `production` environment and Netlify's production deploy pick up the `main` push. `preDeployCommand` runs the same migration against the **production** database — the exact same migration that was already proven on staging in step 4, not a new one.

**Rule of thumb:** a schema or config change should never hit `main` without having gone through `staging` first and been applied there via the same `preDeployCommand` mechanism it'll use in production.

### Migrations note (relevant once Prompt 1 runs)

This repo currently manages schema with `prisma db push` (no `backend/prisma/migrations/` directory exists yet). `db push` is fine for solo local iteration but doesn't produce a reviewable, replayable migration history — once Prompt 1's schema change happens, switch to `prisma migrate dev` locally (which generates migration files to commit) and change `railway.json`'s `preDeployCommand` from `npx prisma db push` to `npx prisma migrate deploy` in both the staging and production Railway environments. `migrate deploy` only ever applies migrations that don't already exist on that database, which is what makes "staging first, then the identical migration on production" a meaningful safety property.

---

## Confirmation: local dev never touches staging or production

- `backend/src/index.js` loads `.env.local` (falling back to `.env`) via `dotenv.config()` — both files are gitignored and live only on your laptop.
- `DATABASE_URL` in `.env.local` points at your Docker Postgres on `localhost:5432`. There is no code path where the backend reads Railway's staging/production `DATABASE_URL` locally — those values exist only as environment variables injected by Railway into its own containers, never checked into this repo or written to any local file.
- `frontend/.env` / `VITE_API_URL` defaults to `http://localhost:4000` (your local backend). It only points at staging/production if you manually set `VITE_API_URL` to one of those URLs, which the standard `npm run dev` flow never does.
- Running `npm run seed` / `npm run seed:run` locally only ever runs against whatever `DATABASE_URL` is currently in your local `.env.local` — i.e., your local Postgres, never staging or production, unless you deliberately export a different `DATABASE_URL` in your shell first (don't do that).

---

## What changed in this setup (summary)

- **Cold-start fix**: `backend/railway.json` no longer runs `prisma db push` and the full seed script on every container start/wake. `prisma db push` moved to `deploy.preDeployCommand` (runs once per deploy only); `startCommand` is now plain `npm start`; seeding is fully manual (`npm run seed:run`, run once per environment when needed).
- **PrismaClient consolidated**: `backend/src/lib/prisma.js` is now the single shared client, imported by `auth.js`, `projects.js`, `groups.js`, `tasks.js`, `share.js`, `admin.js` (previously 6 separate instances).
- **Dead config removed**: `backend/render.yaml` (unused Render config) and `backend/prisma/setupSqlite.js` (a SQLite bootstrap script disconnected from the real Postgres-only Prisma schema, referenced by a now-removed `db:setup` npm script) are both deleted.
- **Netlify config consolidated**: `frontend/netlify.toml` (duplicate) removed; root `netlify.toml` is now the single source of truth and includes the `staging` branch-deploy context.
- **`.env.local` support**: backend now prefers `.env.local` over `.env` if present; `.env.local` and `.env.*.local` are gitignored.
- **`staging` git branch**: created from `main`, pushed to `origin/staging`.
- **Local worktree**: `C:\Users\Excellentm\Documents\Fortnoto\taskflow-staging`, checked out to `staging`, alongside the existing `main` checkout — no branch-switching needed to work on both at once.
- **`docker-compose.yml`**: local Postgres for `.env.local`-based development.
