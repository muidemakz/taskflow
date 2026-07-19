# Taskflow Upgrade — Master Documentation

**Last Updated:** 19 July 2026 (Trash extended to cover deleted NoteChats — staging only)
**Current Status:** Phase 1 COMPLETE and LIVE IN PRODUCTION — **all 28 staging commits merged to `main` and deployed 18 Jul 2026, verified healthy (code-only, zero new migrations)**; TID backfill complete on **both** environments (staging 328/328, production 370/370); Group→Tag migration investigated on production only (not run); Account page Profile section converted to modals; Trash lives in Account as its own full page at `/trash`; **Notes is now a real feature** (migration `13_add_notes`, the 14th migration directory: `NoteChat`/`NoteMessage`, owner-scoped CRUD, global search integration, chat UI with voice-to-text) replacing the earlier placeholder, `ENABLE_AI_GENERATION` confirmed unchanged (still `false`) throughout — **all staging only, not yet merged**; chevron rotation direction still unverified in a browser
**Repository:** taskflow (main = production, staging = development)

> **Fact-checked against the repo & live DBs on 17 Jul 2026.** Corrections applied vs. the
> previous draft are listed at the bottom under "Fact-Check Corrections Log".

---

## Executive Summary

Taskflow has been upgraded from a simple checklist app into a **kanban/roadmap system** with
Gates, custom Statuses, Docs, Prompts, Activity Trails, Multi-level Sharing, an Admin system,
and the Valideity ecosystem. All of Phase 1 is live in production, including the customId
feature and the full Valideity dataset.

**Phase 1 Status:** ✅ COMPLETE & LIVE
- Checkpoints (a)–(c.1.3): ✅ Complete & Production
- Prompts 1–8: ✅ Complete & Production
- Admin Features: ✅ Complete & Production
- customId field: ✅ Complete & Production (commit `9f72056`, migration `12_add_task_custom_id`)
- Valideity Seed Data: ✅ Complete & **Production** (seeded on prod)

**Current Work (all on `staging`, not yet merged to production):**
- ✅ Trash permanent-delete + Account modals — `08ad9ed`, **pending user visual verification**
- ✅ Security audit of recent changes — DONE; fixes in `e93a26a`
- ✅ Task modal in-place fix (My Tasks / Search) — DONE, `5628ba1`
- ✅ Doc markdown XSS — sanitized with DOMPurify, `5892373`
- ✅ UI overhaul: detail-card pattern — breadcrumb + collapsible project card + gate card with accent stripe + My Tasks filters, `9bbc534`, **pending visual verification**
- 🟡 Contract phase (optional cleanup) — not started
- 🔴 **Open finding:** staging and production share the **same `JWT_SECRET`** — needs user decision (see Security section)

**Production merge:** ✅ DONE 18 Jul 2026 — all 28 commits through `5dec9ca` merged (fast-forward) and deployed. Nothing currently batched/pending merge; staging and main are at parity (`5dec9ca`).

---

## Production State (Current)

**Commit:** `5dec9ca` (main HEAD; fast-forwarded from staging 18 Jul 2026, deployed via Railway + Netlify)
**Migrations:** 13 migration directories, `0_init` … `12_add_task_custom_id` (latest), all applied cleanly — this merge shipped code only, **zero new migrations** (confirmed byte-identical `prisma/migrations` + `schema.prisma` between staging and main before merging; deploy log showed "13 migrations found ... No pending migrations to apply")

### Production URLs
- **Backend:** https://taskflow-production-d9c0.up.railway.app
- **Frontend:** **https://muidemakztaskflow.netlify.app** (confirmed via prod `FRONTEND_URL`)
- **Database:** Production Postgres (Railway)

### Production Database (verified 17 Jul 2026, read-only Prisma query; TID/status counts re-verified 18 Jul 2026 post-merge and post-backfill)
- **Users:** 3 — `admin@taskflow.app`, `demo@taskflow.app`, `testuser123@example.com`
- **Projects:** 2 (non-deleted)
  - **Fortnoto** — 279 tasks — owned by **admin@taskflow.app** (moved from demo). Board statuses backfilled 17 Jul 2026 (see data-mutation note below). Also has 38 Groups and (newly discovered 18 Jul) one real Gate ("Gate 1") with `hasRoadmap: true` and one task placed in it — evidently a prior isolated test of the roadmap feature directly on production, unrelated to this session's work.
  - **Valideity** — 91 tasks (all 91 have customId), 6 gates, docs/prompts, Gate A closed — owned by **admin@taskflow.app**
- **customId / TID:** ✅ **100% backfilled on production as of 18 Jul 2026** — Fortnoto 279/279 (278 as `U1.1…U1.278`, 1 as `A1.1` for the task in "Gate 1" above), Valideity 91/91 (unchanged, already complete). Verified idempotent (second run assigned 0) and duplicate-free.
- **Task descriptions:** Valideity enhanced comments (acceptance criteria, effort, priority, dependencies) applied
- `demo@taskflow.app` currently owns **zero projects on production** (flagged; user hasn't requested a placeholder there)

> **Data mutation — 17 Jul 2026 (production only):** Production Fortnoto had **0 statuses and all 279
> `statusId`s null** (legacy project that predated the "5 default statuses on create" behavior), so its
> kanban board rendered empty. Created the 5 default statuses (Backlog/To-do/In progress/In review/Done)
> and backfilled `statusId` from each task's legacy `status`: `DONE → Done` (219), `TODO → To-do` (60).
> Board API now returns populated columns. **This was a production-only fix** — staging Fortnoto already
> had statuses from an earlier session, which is exactly why it worked on staging but not prod (data
> mutations don't travel with merges). Reversible (delete the 5 statuses / null the `statusId`s).

### Staging Database (verified 17 Jul 2026, read-only Prisma query)
- **Commit deployed:** `5628ba1`
- **Users:** 3 — `admin@taskflow.app`, `demo@taskflow.app`, `checkpointc.tester@example.com`
- **Projects:** 6 (non-deleted)
  - **Fortnoto** — 227 tasks — admin
  - **Valideity** — 91 tasks (all 91 customId) — admin
  - **Testing** — 6 tasks — admin
  - **Again** — 0 tasks (placeholder) — demo
  - **c.1.2 QA Project** — 1 task — checkpointc.tester@example.com (test artifact)
  - **Prompt 4 Docs QA** — 0 tasks — checkpointc.tester@example.com (test artifact)
- Staging frontend: https://staging--muidemakztaskflow.netlify.app
- Staging backend: https://taskflow-staging-dbeb.up.railway.app

> **Note on data drift:** staging carries leftover QA projects/users from checkpoint testing;
> production is clean (only admin/demo/testuser123 and the two real projects). This is expected —
> data is per-environment and never travels with a merge.

---

## What Changed Since Last Version of This Doc

### 1. customId Feature — ✅ SHIPPED TO PRODUCTION (`9f72056`, migration `12_add_task_custom_id`)
- `Task.customId` (nullable String, unique per project via `@@unique([projectId, customId])`) — NULL-distinct so unset tasks don't collide
- `normalizeTaskInput` accepts customId on PATCH /api/tasks/:id (optional; no UI writes it yet)
- search.js and trash.js responses include customId
- Shared `.id-badge` style (monospace, light background, dark-mode aware) on: board card, list view, task detail modal header, My Tasks rows, search results, trash rows
- `seedValideity.mjs` assigns customId + clean titles on reseed; `updateValideityTaskDescriptions.mjs` backfills, idempotent
- Verified at API level on staging AND production; deployed staging bundle inspected directly

### 2. Production Data Migration — ✅ COMPLETE
Data mutations (seeds, ownership changes) are direct DB operations over SSH — a git merge ships
code, never data. Replayed on production:
- `seedValideity.mjs` → Valideity fully seeded (customId + enhanced descriptions in one pass)
- Fortnoto `ownerId`: demo → admin (matches staging final state)

**Standing rule:** code ships via merge; any one-off data mutation must be explicitly replayed
against each environment. There is no automatic data sync.

### 3. Trash Permanent Delete — ✅ STAGING (`08ad9ed`), ownership CONFIRMED (`e93a26a`)
- New `DELETE /api/trash/:type/:id` — immediate hard delete, reusing the FK cascades of the 30-day retention sweep
- Frontend: red delete icon next to Restore, gated by confirmation modal
- Verified end-to-end via API against staging (item existed → DELETE → 200 → gone)
- **Ownership check confirmed:** every branch scopes `findFirst` to `project.ownerId === req.auth.sub`
  (or roadmap/owner-scoped equivalents) and 404s otherwise. Negative-path Vitest test added
  (`backend/test/trashDelete.test.js`): user A cannot hard-delete user B's trashed task/project.

### 4. Account Page Modals — ✅ STAGING (`08ad9ed`)
- Security section is two rows ("Change email" / "Change password", icon + chevron) opening
  dedicated modals with instructional copy (what happens, why current password is needed, that a
  password change signs you out everywhere)
- Backend endpoints unchanged; frontend re-wiring only

### 5. Security Audit — ✅ DONE THIS SESSION (`e93a26a`)
See the Security section below for full PASS / FIXED / NEEDS-DECISION results. Highlights:
- **FIXED:** customId now validated server-side (400 over 20 chars) and duplicate → clean **409**
  instead of an unhandled Prisma 500
- **FIXED/VERIFIED:** trash-delete ownership + negative-path test
- **PASS:** share tokens (crypto-random), invite tokens (expiry + single-use), no secrets committed
- **🔴 NEEDS-DECISION:** staging and production `JWT_SECRET` are identical

### 6. Task Modal In-Place — ✅ DONE THIS SESSION (`5628ba1`)
- Clicking a task in **My Tasks** or **topbar search** now opens `TaskDetailModal` in place instead
  of navigating to `/board?taskId=X`. New `InlineTaskModal` host fetches the task's project context
  into local state (deliberately not the board store — the search bar is mounted on other projects'
  boards, and writing to the store would corrupt the visible board).
- `/board?taskId=X` deep-link path is untouched — bookmarks/shares still resolve.
- **Trash** left as-is by design: the modal live-PATCHes every control and all task routes exclude
  soft-deleted rows, so a trashed task can't be opened without a new backend read path.

### 8. UI Overhaul: Detail-Card Pattern — ✅ STAGING (`9bbc534`), pending visual verification
Brought the clean detail-card pattern from ShareView (read-only project/gate/task views) into the
logged-in project and gate detail views. Consistent, polished hierarchy across the app.

**New components:**
- `Breadcrumb`: minimal nav bar (Projects / [Project] / [current]), truncates on mobile (~380px)
- `ProjectDetailCard`: collapsible (chevron toggle, persisted per-project in localStorage),
  shows title/description/progress (ProgressBar + "X of Y done · Z%")/metadata (gate count, tag
  count, last activity)/quick actions (Share, Settings, Add task), smooth height transition via
  CSS Grid 0fr/1fr trick
- `GateDetailCard`: sub-level sibling of project card, left 4px accent stripe (colored A→F by gate
  order via CSS variables), tinted secondary background (--gate-card-bg), compact single-line
  metadata, Open/Closed pill top-right, progress bar matching project card styling
- `MyTasksFilterBar`: search + collapsible filter panel (Project / Status / Priority / Gate /
  Tag multi-select / Due-date range / Blocked-only toggle), all dimensions AND together,
  active count + clear-all affordance, grid stacks to one column on mobile

**Updated views:**
- `RoadmapOverview` (project detail): breadcrumb + ProjectDetailCard + gate filter (All/Open/Closed)
  + gate grid (existing)
- `ProjectBoard` (gate-scoped): breadcrumb + GateDetailCard + gate nav selector + filter bar +
  board/list view; whole-project view and unscheduled mode untouched
- `MyTasks`: bucket tabs + search + collapsible filter bar, shows "X of Y" count when filters active

**CSS enhancements:**
- Gate accent variables (light/dark pairs): `--gate-accent-{0-5}`, `--gate-card-bg`,
  `--gate-card-border` — all theme-aware via `:root.dark` overrides
- `.gate-detail-card`: left-accent stripe via CSS border + inline `var()` per gate order

All new code reuses existing ProgressBar, TagMultiSelect, modals, status dots. Dark-mode safe,
mobile-first, no forked components.

### 7. Standing Tradition — Security & Debug Gate
Before **every commit**, verify: (a) new/changed endpoints have ownership + auth checks and a
negative-path test; (b) no secrets in the diff; (c) `npm run test` passes; (d) frontend build clean;
(e) user input validated server-side. Gate results go in each commit summary. (Now also encoded in
`CLAUDE.md`.)

---

## Pending Verification Queue (User's Court)

All on `staging`, batched, blocking the next production merge:

1. **customId visuals** — badges on Valideity cards, list view, modal header, My Tasks, search dropdown; no console errors
2. **Enhanced task descriptions** — click into 5–10 Valideity tasks; comments/dependencies/effort/priority read clearly
3. **Trash permanent delete** — confirmation modal + delete-forever flow (`08ad9ed`)
4. **Account modals** — email/password modal UX and copy (`08ad9ed`)
5. **Task modal in-place** — My Tasks + search open the modal without navigating away; row updates on close (`5628ba1`)

Once verified → merge `staging` → `main` (carries `08ad9ed` + `e93a26a` + `5628ba1`). Note: customId
code (`9f72056`) is already on production.

> ⚠️ Browser-based visual QA for this session was blocked by a temporary tooling outage. Code is
> verified via `npm run test` (44/44), a clean `vite build`, and live API checks against deployed
> staging (duplicate customId → 409, over-length → 400, values unchanged on rejection). The five
> items above still need the user's click-through.

---

## Security Posture & Audit Results (17 Jul 2026)

| # | Item | Risk | Result |
|---|------|------|--------|
| 1 | `DELETE /api/trash/:type/:id` ownership check | HIGH | ✅ **VERIFIED** — scoped to `project.ownerId === req.auth.sub`; negative-path test added |
| 2 | customId PATCH validation (409 on dup, length limit, plain-text render) | MED | ✅ **FIXED** — 400 > 20 chars; P2002 → 409; rendered as JSX text node (no `dangerouslySetInnerHTML`) |
| 3 | Share tokens crypto-random; shared views leak nothing out of scope | MED | ✅ **PASS** — `cuid()` / `randomUUID()` / `crypto.randomBytes`; share.js exposes read-only scoped fields, no docs/prompts |
| 4 | Invite tokens: `expiresAt` enforced on accept, single-use | MED | ✅ **PASS** — `requireValidInvite` rejects expired/accepted; accept sets `acceptedAt` in a transaction |
| 5 | `JWT_SECRET` differs staging vs prod; no secrets committed | MED | 🔴 **NEEDS-DECISION** — secrets NOT committed (only `.env.example` placeholder), but staging & prod `JWT_SECRET` are **identical** (sha256 matched) |
| 6 | PAT auth gap (no role attached; admin routes 403 for PATs) | LOW | Documented, Phase 2 fix (fails closed) |
| 7 | Doc markdown rendered via `marked` + `dangerouslySetInnerHTML` without sanitization | MED (self-XSS now; stored XSS if docs are ever shared) | ✅ **FIXED** (`5892373`) — `renderMarkdown` runs output through DOMPurify; strips `<script>`/`onerror`/`javascript:`, keeps heading-id anchors |

**🔴 Finding #5 detail:** A stateless JWT access token minted for one environment validates on the
other because both share the same secret. Refresh tokens are DB-scoped so they don't cross over, but
access tokens do. **Recommendation:** rotate production `JWT_SECRET` to a distinct value. This is a
sensitive infra action (it invalidates all active production sessions), so it's left for the user to
schedule — not done automatically. PAT `hashPatToken` also derives from the token itself, not the JWT
secret, so PATs are unaffected.

---

## Project Context & Why

### Problem Being Solved
- **Old Taskflow:** single project, groups (tags), task checklist. Fine for Fortnoto, insufficient for Valideity.
- **Valideity needs:** Gates (roadmap phases), rich statuses, multi-roadmap tasks, standing docs, agent-sourced tasks with sync proposals, activity trails.
- **Solution:** a flexible kanban system that scales to both use cases.

### Key Design Decisions (Locked In)
1. **Status-Gate Independence:** each task has ONE true status (horizontal workflow), independently placed in zero or more gates (vertical phases). Status shared across placements.
2. **Soft Delete w/ 30-day Restore:** deletes set `deletedAt`, appear in Trash, restorable for 30 days. Immediate permanent delete now available from Trash.
3. **No Formal Collaborators Yet:** single-user app; ownership scoped by `ownerId` on every route.
4. **Rollover as Explicit Action:** closing a gate moves incomplete tasks to the next gate with provenance.
5. **Agent-Ready from Day One:** external import (source/externalId/sourceUrl), PAT sync, SyncProposal review queue.
6. **Append-Only Prompts:** new versions instead of in-place edits; audit trail preserved.
7. **Flag-Gated AI Generation:** `ENABLE_AI_GENERATION`; system fully functional without it.
8. **Code vs. Data deployments:** merges ship code only; data mutations are replayed per environment.
9. **Security & Debug Gate:** mandatory pre-commit checklist for all future sessions.

---

## Stack (Confirmed)

- **Frontend:** React 18 / Vite 6 / Zustand / @dnd-kit → **Netlify** (branch deploys)
- **Backend:** Node.js / Express / Prisma 5.22 → **Railway**
- **Database:** PostgreSQL (separate staging + production instances)
- **Auth:** JWT + Personal Access Tokens (PAT)
- **Testing:** Vitest — **44 backend tests across 7 files**, all passing
- **AI:** Anthropic Claude API (flag-gated)
- **PWA:** manifest.json + service worker

---

## Schema Evolution — Complete

### Prompt 0–0.5: Environment Pipeline — ✅ LIVE
Three-environment setup (LOCAL → STAGING → PRODUCTION), Railway staging, Netlify branch deploys, cold-start fix.

### Prompt 1: Schema Migration — ✅ LIVE
New models: Status, Roadmap, Gate, Tag, TaskTag, TaskRoadmap, TaskGatePlacement. Task extended
(statusId, gateId, dueDate, blocked, focus, source/externalId/sourceUrl, position, rollover
provenance, updatedAt). Soft delete across Project/Task/Group/Gate/DocEntry. Legacy fields preserved
pending contract phase. **Migration `12_add_task_custom_id`** adds `Task.customId` (nullable, unique per project).

### Prompt 2: Backend API — ✅ LIVE
Status/Gate/Roadmap CRUD, board data, task update, multi-gate/roadmap, soft-delete/restore, trash,
global search, My Tasks, PATs, external upsert, sync proposals. **Added:** `DELETE /api/trash/:type/:id`
immediate hard delete; search/trash responses include customId. Covered by 44 Vitest tests.

### Prompt 3 + Checkpoints (a)–(c.1.3): Core UI + Refinements — ✅ LIVE
Kanban DnD, roadmap overview, task detail modal, settings, trash, filters, search, My Tasks, focus,
ShareView, catch-up, gate lifecycle, activity timeline, navigation fixes, UX refinements, bottom navigation.

### Prompt 4: Docs Tab — ✅ LIVE
DocEntry/DocCategory/TaskDocLink/DocAnnotation; full CRUD; markdown + TOC + margin notes; bidirectional linking.

### Prompt 5: Prompt System (Manual) — ✅ LIVE
Append-only PromptVersion, copy-with-rules, status tracking.

### Prompt 6: AI Generation (Flag-Gated) — ✅ LIVE
POST /api/prompts/generate, [Generate] button behind `ENABLE_AI_GENERATION`.

### Prompt 7: Profile & Settings — ✅ LIVE
Avatar, theme (light/dark/system), API tokens, PWA. Email/password change re-wired as chevron rows →
instructional modals (staging, `08ad9ed`).

### Prompt 8: Valideity Seed Data — ✅ LIVE ON PRODUCTION
Full ecosystem (91 tasks, 6 gates, docs, links, prompts, activity trail, share tokens). Seeded on
BOTH staging and production with customId and enhanced descriptions.

### Admin Features — ✅ LIVE
Invites (copyable one-time links), roles, password reset, activity log, self-service email/password, last-admin safeguards.

---

## Remaining Work — Commit 1 Chunked Implementation

### Current Sprint (18 Jul 2026)
**Commit 1 is being completed in SMALL SEQUENTIAL CHUNKS to prevent component debt.**
Each chunk ends in a complete, integrated, committed state. No mid-flight context exhaustion.

**CHUNK 1 (completed)**: Filter bar unification ✅
- ✅ Integrate SharedFilterBar into all filter locations (My Tasks, Board/Gate, Docs, ProjectDetail)
- ✅ Delete superseded implementations (MyTasksFilterBar, BoardFilterBar)
- ✅ Ensure exactly ONE filter bar definition in codebase
- Commits: `42cb6a2` (My Tasks/Board unification), `a9cb436` (Docs/ProjectDetail integration)

**CHUNK 2b** (✅ COMPLETE): Breadcrumbs, chevrons, labels, tab actions — `130e663` → `15debc7` (corrections)
- ✅ Breadcrumb: Remove stray chevron before first item (only render between items, not after back arrow)
- ✅ Breadcrumb back arrows: Add onBack to ProjectBoard and RoadmapOverview for consistent back navigation
- ✅ Expand chevron direction: Fixed both ProjectDetailCard and GroupCard to use -rotate-90 when collapsed (points RIGHT), empty when expanded (points DOWN)
- ✅ Remove "Gates" label from RoadmapOverview gate filter controls
- ✅ Tab row context action: ProjectTabs shows context-sensitive button (Tasks → "Whole-project board"; Docs → "New entry" with onNewEntry callback)

**CHUNK 3** (✅ COMPLETE): PAGE WIDTH, card actions, last-activity — `692f005`
- ✅ PAGE WIDTH: Define --page-max-width CSS variable (72rem), create .page-container utility, apply uniformly to all main pages
- ✅ COLLAPSED PROJECT CARD: Add compact icon-only action buttons (Share, Settings, Add task) to header when collapsed for always-accessible quick actions
- ✅ LAST ACTIVITY: Remove dead slot from project card (no data being sent from backend)

This closes Commit 1 (UI consistency standardization). Commit 1 total: `ca24fb4` (PAT auth revert) → `42cb6a2` → `a9cb436` → `130e663` → `15debc7` → `692f005`.

### Commit 3 (tabs as state, not navigation) — ✅ COMPLETE — `6483b7b`

Landed ahead of Commit 2 (status colors) because it fixed a live bug: Tasks and Docs were
separate routes (`/roadmap` and `/docs`), each building its own breadcrumb/project-card/tabs
chrome from scratch, so switching tabs remounted the entire page -- losing the project detail
card, refetching data, and showing two different breadcrumb structures for the same project.

- **Merged** `ProjectDocs.jsx` into `RoadmapOverview.jsx` as one unified project workspace.
  Breadcrumb, `ProjectDetailCard`, and the tabs row now mount once; only the panel below
  (gates grid vs. docs list) and the filter-bar fields swap based on `activeTab`.
- **Tab state lives in `?tab=docs`** via `useSearchParams` -- a query-param change, not a
  route change, so there's no remount, no parent refetch, no scroll jump. `/projects/:id/docs`
  now redirects (`<DocsTabRedirect>`) to the equivalent `?tab=docs` URL so old links/bookmarks
  still resolve.
- **Deleted `ProjectDocs.jsx`** (would otherwise be dead code duplicating the merged logic).
- **`ProjectTabs`** gained an `onSelectTab` mode (state-based switch, used by the unified
  workspace) alongside its original Link-based mode (kept for `ProjectDetail.jsx`, the legacy
  checklist view, which still navigates to a different route entirely).
- **Removed the duplicate "New entry" button** -- previously one in the Docs page header and
  one in the tabs row; only the tabs-row one (context-sensitive per tab) remains.
- **Removed the Docs-specific title+subtitle block** -- the unified page has exactly one
  header (breadcrumb + project card) shared by both tabs.
- **Default filters are now genuinely empty on both tabs**: gate filter default changed from
  `'all'` to `''`, doc status default changed from `'ACTIVE'` to `''`. Previously both
  registered as an "active" filter in `SharedFilterBar`'s count on first load (`"Filters (1)"`
  with nothing actually chosen). **Behavior change:** Docs now shows retired entries by
  default alongside active ones, since status is no longer pre-filtered to Active -- a direct,
  intentional consequence of "default to no filters active."
- **Fixed `onBack` targets**: `ProjectBoard` and `RoadmapOverview` previously hard-coded
  `/dashboard` from every page. Now: gate / unscheduled / whole-project board → project
  roadmap; a roadmap-less project's own board (board IS its home) → dashboard; the roadmap
  workspace itself → dashboard. Each page's back arrow now matches its breadcrumb trail.

**Known deviation, not fixed (by choice):** `ProjectDetail.jsx` (the legacy pre-roadmap
checklist view, slated for deletion in the contract phase) still uses a standalone
`ArrowLeft` button instead of the shared `Breadcrumb` component. Converting it would require
reworking its header (inline-editable title + six action buttons: Add Task, Add Group,
Arrange, Merge Groups, Share, Delete) to fit the Breadcrumb pattern, for a page with no
long-term future. Left as-is and documented here rather than converted.

**Not resolved — chevron rotation direction (Commit 1, Item 4):** Still not visually
confirmed in a browser after multiple attempts this session. A live preview server was
reachable (`http://localhost:5183`, the actual `taskflow-staging/frontend` dev server) and an
unauthenticated debug route rendering the raw lucide `ChevronDown` icon with both `rotate-90`
and `-rotate-90` loaded successfully (confirmed via DOM read), but the screenshot/pixel-capture
tool timed out on every attempt, so no pixel-level visual confirmation exists. The debug route
was removed before this commit; nothing debug-only shipped. The `-rotate-90` (collapsed →
points right) fix applied to `ProjectDetailCard` and `GroupCard` in commit `15debc7` follows
from CSS rotation mechanics (clockwise convention on a down-pointing glyph) and matches the
user's explicit correction, but this is reasoning, not the requested browser confirmation --
**do not treat this item as closed.**

### customId Generation, Backfill Investigation, Board/Modal Bug Fixes (18 Jul 2026)

**CHUNK A (✅ COMPLETE, STAGING ONLY) — customId (TID) generation on task creation — `9a43b39`,
scheme revised same day (see below)**

Bug: `customId` was only ever populated by the Valideity seed script -- nothing in the app
generated one, so every project besides Valideity showed no IDs and new tasks got none, forever.

Scheme (`backend/src/utils/customId.js`), mirroring Valideity's real seed-script ids exactly
(read from `seedValideity.mjs` before choosing a format -- not invented):
- Gated task → `<GateLetter>1.<n>`, e.g. `A1.7`. Valideity's seed clusters hand-authored tasks
  into multiple numbered buckets per gate (A1.x, A2.x, A3.x...) reflecting theming with no
  equivalent concept in the running app -- auto-generated tasks always land in bucket "1",
  continuing that gate's own numbering rather than inventing a new axis.
- Retries with a freshly-computed id on a `P2002` unique-constraint hit; the numbering itself is
  a pure, stateless function (unit tests in `backend/test/customId.test.js`) -- it never writes
  anything, so nothing about it can renumber an existing id.
- Wired into every task-creation path (grepped -- exactly two `prisma.task.create` call sites):
  `POST /api/projects/:id/tasks` (now accepts an optional `gateId` so a task created straight
  into a gate gets its final gate atomically, instead of Unscheduled-then-moved-by-a-separate-
  call, which would have permanently stuck it with an Unscheduled-style id) and
  `POST /api/sync/tasks` (external upsert, always Unscheduled by existing design).

**Revision (same day, before CHUNK B's mutation) — single frozen TID format, no bare-numeric
fallback:**
- The originally-proposed Unscheduled fallback (bare incrementing number, e.g. `7`) is replaced
  before any backfill runs against it. There is now ONE shape, always a letter:
  `<Letter><Cluster>.<Seq>`. Unscheduled tasks use the reserved letter `U` — `U1.<n>`, e.g.
  `U1.3` — continuing the exact same per-letter max-scan gated tasks use, just with `U` standing
  in for a gate letter. No separate bare-numeric branch remains.
- **Label:** the id is called **"TID"** everywhere it's user-visible — added `title`/
  `aria-label="TID <value>"` to every `id-badge` render site (`TaskDetailModal`, `BoardTaskCard`,
  `ListView`, `SearchBar`, `MyTasks`, `Trash` — grepped for every instance) and reworded the one
  user-facing string that said "ID" (`tasks.js`'s 409 conflict message → "That TID is already
  used..."). The `customId` DB column and API field name are unchanged — a rename means a
  migration plus touching every route/script/component for no visible gain, and wasn't asked for.
- **Frozen-forever guarantee, closed a real gap:** the legacy `PATCH /api/tasks/:id` route
  (`normalizeTaskInput` in `backend/src/utils/project.js`) accepted an optional `customId` in the
  request body and would silently overwrite it -- dead code today (no frontend caller ever sends
  that field; `grep`-confirmed), but a live contradiction of "never changes for any reason." TID
  is now dropped unconditionally from that patch regardless of what the body contains, so the
  guarantee is enforced server-side, not just by convention. `taskInputError`/
  `CUSTOM_ID_MAX_LENGTH` (which existed solely to validate a client-supplied customId) removed as
  dead code once that path was closed; `backend/test/taskInput.test.js` rewritten to assert the
  new immutability behavior instead of the old length-cap behavior it can no longer reach.
- Added unit tests asserting a TID is unchanged across gate assignment, a second gate move,
  rollover, and a move back to Unscheduled (`customId.test.js`) -- trivially true since no
  function in the module ever re-invokes generation for an existing row, but made explicit per
  instruction.
- **Known edge case, flagged not silently patched:** `gateLetter()` still matches the frontend's
  existing gate-letter display (`GateDetailCard.jsx`, `ProjectBoard.jsx` breadcrumb) exactly, so a
  project's 21st gate (order 20) would display as "U" and its TIDs would collide with the
  Unscheduled prefix. No project has anywhere near 21 gates in practice, and diverging from the
  display letter to dodge this would create a worse, permanent mismatch between a gate's shown
  letter and its tasks' TID prefix -- left as-is, documented here rather than silently changed.
- **Cleanup (staging only):** grepped staging for tasks stamped under the old bare-numeric
  fallback before it existed only in test data — found exactly **one**: task "Are you a beans"
  (project "Testing", Unscheduled, `customId: "1"`). Converted to `U1.1` (no existing `U1.x` in
  that project, so no collision); reran the same scan afterward and confirmed **zero** bare-
  numeric ids remain on staging.

**CHUNK B (✅ COMPLETE ON STAGING ONLY — production still pending approval) — backfill**

Dry-run counts immediately before mutating (via Railway SSH, script piped into `node` over
stdin — never deployed to either environment):

| Environment | Project | Total | Has TID (before) | Missing (before) |
|---|---|---|---|---|
| Staging | Valideity | 92 | 91 | 1 |
| Staging | Testing | 9 | 2 (post bare-numeric cleanup above) | 7 |
| Staging | c.1.2 QA Project | 1 | 0 | 1 |
| Staging | Fortnoto | 226 | 0 | 226 |
| **Staging TOTAL** | | **328** | **93** | **235** |

Approved by user 18 Jul 2026, **staging only** ("Do NOT run it on production yet"). Ran the
idempotent backfill script (skips any task that already has a TID; only ever writes to tasks
where `customId` is null — never overwrites an existing one):

- **First pass:** assigned all 235 missing TIDs. Samples: Valideity gap → `B1.8` (continues gate
  B past its existing max `B1.7`); Testing (mixed) → `B1.2`, `B1.3`, `B1.4`, `U1.2`, `U1.3`,
  `B1.5`; c.1.2 QA Project → `C1.1`; Fortnoto → `U1.1 … U1.226` (all 226, confirmed exactly
  matching the predicted all-Unscheduled count).
- **Counts after:** every project at 100% — Valideity 92/92, Testing 9/9, c.1.2 QA Project 1/1,
  Fortnoto 226/226. **Staging TOTAL: 328/328 has a TID, 0 missing.**
- **Second pass (idempotency proof):** reran the identical script — reported `328 tasks already
  had a TID, 0 were missing one` and **assigned 0**. Confirms rerunning is a safe no-op.
- **Uniqueness check:** scanned every project for duplicate TIDs post-backfill — **0 found**,
  matching the `@@unique([projectId, customId])` constraint.
- Backfill/count/verify scripts were scratchpad-only (piped via stdin over Railway SSH); nothing
  was deployed to the repo or either environment's filesystem.

**Production Fortnoto (279, all Unscheduled) and production Valideity (91/91, already complete)
are unchanged — explicitly not run per instruction.** Next: user approval to run the same script
against production.

**CHUNK B — production backfill (✅ COMPLETE, STEP 4b of the user-directed rollout) — 18 Jul 2026**

Approved and run against **production**, using the identical script already verified idempotent
on staging (piped into `node` over Railway SSH stdin; nothing written to the container):

| Project | Total | Has TID (before) | Missing (before) | Has TID (after) |
|---|---|---|---|---|
| Fortnoto | 279 | 0 | 279 | 279 |
| Valideity | 91 | 91 | 0 | 91 |
| **PRODUCTION TOTAL** | **370** | **91** | **279** | **370** |

- **First pass:** assigned all 279 missing TIDs. Sample: `U1.1 … U1.278` for 278 genuinely
  Unscheduled Fortnoto tasks.
- **One task deviated from the stated expectation, correctly:** Fortnoto is not 100% Unscheduled
  on production — one task ("Parcel config table: add 'cost per km' column", created 29 May 2026)
  is already assigned to a real gate ("Gate 1", order 0) under a `hasRoadmap: true` roadmap on
  Fortnoto (evidently a prior test of the roadmap/gate feature directly on production data, unrelated
  to this session). The backfill script correctly detected its `gateId` and assigned it `A1.1`
  instead of a `U1.x` id — this is the letter-scheme working as designed (gate-scoped tasks always
  get a gate letter, never `U`), not a bug. Confirmed via direct query: 278 tasks match `U1.<n>`
  with no gaps (`U1.1…U1.278`), 1 task is `A1.1`, total 279 — counts fully reconcile.
- **Second pass (idempotency proof):** reran the identical script — `370 tasks already had a TID,
  0 were missing one`, **assigned 0**. Confirms rerunning is a safe no-op.
- **Uniqueness check:** scanned every project for duplicate TIDs post-backfill — **0 found**.
- No temp scripts were left on the production container (every script was piped via stdin, never
  written to disk there). A pre-existing, git-tracked file unrelated to this backfill
  (`backend/investigateGroupToTagMigration.js`, committed in `42cb6a2`, part of the regular deploy)
  is present in `/app` — left untouched per "do not touch Group→Tag."

**Both environments are now fully backfilled: staging 328/328, production 370/370.**

**Merge to production — 18 Jul 2026, STEP 3 of a 5-step user-directed rollout (steps 4-5 not yet
authorized) — `main` fast-forwarded `9f72056 → 5dec9ca`**

- Pre-merge check (prior report): 28 commits staging-ahead-of-main, zero new Prisma migrations,
  clean fast-forward (`main` a direct ancestor of `staging`, no divergent commits), working tree
  clean.
- Re-confirmed the fast-forward was still valid immediately before merging (re-fetched, re-ran
  `git merge-base --is-ancestor`), then `git push origin staging:main` — fast-forward only, no
  merge commit.
- Watched the Railway production deploy through to completion via `railway logs`: build picked up
  the new commit, `13 migrations found in prisma/migrations` / **"No pending migrations to
  apply"** (matches the pre-merge confirmation that this batch is code-only), container
  restarted cleanly, `Taskflow API listening on http://localhost:8080`. No errors in the deploy
  log.
- Post-deploy health checks (all read-only, no `JWT_SECRET` use per instruction):
  - `GET /health` → `200 {"ok":true,"name":"Taskflow API"}`.
  - Board-data integrity checked at the DB layer instead of through the authenticated board API
    (avoids minting a JWT): every non-deleted project (Fortnoto, Valideity) has its 5 statuses
    configured and every task has a valid `statusId` — **PASS**, no board-breaking data.
  - TID/customId counts re-checked post-deploy and confirmed **unchanged**: Fortnoto still 0/279,
    Valideity still 91/91 — proves the code-only deploy did not touch data and that no backfill
    ran against production.
  - Scanned recent production logs for `error|exception|fail` — no matches.
- **Production verified healthy. Stopped here per instruction** — production TID backfill, the
  Group→Tag migration, and any `JWT_SECRET` change are explicitly deferred to a separate
  go-ahead.

**CHUNK D + E (✅ COMPLETE, STAGING) — two task-modal bugs — `ec79d78`**

1. **Status dropdown excluded empty statuses.** Root cause: `ProjectBoard.jsx`'s gate-scoped
   modal derived its status options from `columns.filter(c => c.tasks.length)` -- a status with
   zero tasks in the current gate was silently excluded, so a task could never be moved into an
   empty column. Grepped every status selector in the app (`TaskDetailModal`,
   `QuickAddTaskModal`, `TaskMoveSheet`, `ListView`) -- only this one had the bug; the others
   already sourced the full project list. Fixed by having `TaskDetailModal` always render every
   project status, in configured order, regardless of task count; removed the now-pointless
   `statusOptions` prop and its column-derived memo entirely rather than leaving dead plumbing.
2. **Status/field changes in the modal didn't reflect until a page refresh.** Two independent
   root causes, fixed together since testing one without the other would have left the bug
   half-fixed:
   - **Board/list view:** `boardStore.updateTaskFields` replaced the task in place within
     whichever column already held it, but never MOVED it to the column matching its fresh
     `statusId` -- the write persisted correctly, but the task stayed visually stuck in its old
     column until a full reload re-partitioned everything. Fixed to remove-then-reinsert into
     the correct column (sorted by position), mirroring `moveTask`'s existing optimistic-update
     pattern. Covers every editable field, not just status.
   - **My Tasks:** has no visible status field at all (`TaskRow` never renders one), so the only
     real symptom there is a completed task not disappearing from a "not-done tasks" list until
     refresh -- and the PATCH response has no status/gate display objects or `countsAsDone` to
     determine that client-side. Fixed at `InlineTaskModal`, the one place that already has both
     lookup lists in scope: it now enriches `onUpdated` with the resolved gate/status objects and
     a `countsAsDone` flag before handing it to the host page. My Tasks uses this for an
     immediate, targeted merge into whichever bucket(s) hold the task -- dropping it everywhere
     if now done, otherwise patching title/priority/dueDate/blocked/focus/tags/gate/customId in
     place. The existing onClose-triggered full reload stays as a background consistency pass
     (catches deletes and a task becoming newly relevant to a *different* bucket, e.g. a due-date
     edit making it newly overdue) -- not introduced by this fix, and no longer what makes the
     row look right in the meantime. Search's dropdown needed no change: it already clears its
     results and closes before the modal opens, so there was no stale list to update.

**CHUNK F (✅ COMPLETE, STAGING) — whole-project board unified into the Tasks tab — `be8440d`**

Same problem Commit 3 fixed for Docs: the whole-project board (`/board`, no gateId) built its own
chrome from scratch and had no in-app way out but the browser back button.

- **Affordance chosen: the tabs-row "Whole-project board" button now toggles** between the gates
  grid and the whole-project board, its label reflecting whichever view is NOT showing
  ("Whole-project board" in gates mode, "Roadmap view" in board mode). Chosen over repurposing
  the breadcrumb/back arrow because it reuses the exact existing entry point with zero
  relocation, and keeps the back arrow single-purpose (navigate to the parent) instead of
  overloading it with a second, view-toggling meaning.
- `RoadmapOverview.jsx`'s Tasks tab now has two sub-views switched via `?view=board` --
  breadcrumb, `ProjectDetailCard`, and the tabs row stay mounted and identical across the toggle.
  Board rendering (`KanbanBoard`/`ListView`, `BoardToolbar`, `TaskDetailModal`, taskId
  highlight-on-load) ported over from `ProjectBoard.jsx`'s whole-project branch; its filter bar
  is the same `SharedFilterBar` shell/position as every other view, with the same tag/priority/
  blocked/focus/due-date fields the whole-project board always had.
- Switching Tasks ↔ Docs preserves the current Tasks sub-view (leaving board mode for Docs and
  back returns to board mode, not always the gates grid).
- `ProjectBoard.jsx`: a whole-project request (hasRoadmap project, no gateId, not Unscheduled)
  now redirects to the unified `?tab=tasks&view=board` URL once `hasRoadmap` is known, carrying
  a `taskId` deep link through if present, guarded so the old chrome never flashes first.
  Gate-scoped, Unscheduled, and a roadmap-less project's own board (which IS that project's
  home) are untouched -- genuine drill-down/home views, not the bug being fixed.
- **Verified live against the staging dev server** (real DB, real JWT minted against the actual
  staging `JWT_SECRET`, not guessed): toggle switches with no remount; `?view=board` reflected in
  the URL and survives a tab round-trip; bare `/board` redirects to the unified board view;
  `/board?taskId=X` redirects carrying `taskId` through and auto-opens the right task with every
  status showing in its dropdown (confirms this sits correctly on top of the Chunk D fix);
  gate-scoped `/board?gateId=X` untouched, its back arrow still returns to the roadmap; Docs tab
  unaffected. No console errors on any of these.

Gate (all three chunks): 53/53 backend tests pass, frontend build clean, no secrets in diff.
Pushed to `staging` only.

### Account Page — Profile editing converted to modals (✅ COMPLETE, STAGING ONLY — 18 Jul 2026)

UX-consistency change only, no new functionality: the inline Profile editor on the Account page
(large clickable avatar + a "Name" text field + a "Save profile" button, all live-edited in
place) is replaced with two chevron-row entry points -- **Photo** and **Name** -- opening modals
that match the existing Change Email / Change Password pattern exactly (same `Modal` component,
same instructional-copy-then-field-then-submit-button structure, same chevron-row visual
language as the Security section immediately below it).

- **`EditNameModal`**: single field, friendly copy, `Save name` button -- mirrors
  `ChangeEmailModal`'s structure closely. Persists via the existing `PATCH /api/users/me`
  (`usersApi.update({ name })`); no backend change, none was needed.
- **`EditAvatarModal`**: opens with the *current* avatar shown; clicking it (or "Choose a
  different photo") triggers the OS file picker, previews the resized image locally, and only
  commits on an explicit `Save photo` click -- deliberately not auto-saving on file selection
  (unlike the old inline behavior), so **Cancel truly discards** an in-progress selection instead
  of relying on not having called the API yet. `Save photo` is disabled until the pending image
  actually differs from the saved one. Reuses the existing `resizeImageToDataUrl` helper and
  `usersApi.update({ avatarUrl })` unchanged.
- Old inline avatar button, name `<input>`, and "Save profile" button fully removed --
  `AccountPage`'s local `name`/`avatarUrl`/`savingProfile`/`uploadingAvatar` state and the
  `saveProfile`/`onAvatarSelected` handlers are gone, not just hidden (grepped afterward to
  confirm no references remain). Theme picker (Light/Dark/System) is unchanged and stays inline
  in the same card -- out of scope, not a login/profile-identity field.
- No backend changes were needed or made, as expected -- both fields already round-trip through
  `PATCH /api/users/me`.

**Verified live against the staging dev server** (already-running Vite on port 5183, real
session): Edit-name modal opens from the chevron row, editing and Save persists and is reflected
immediately in both the Account row and the Topbar (confirmed via DOM read, not a refresh);
Cancel (closing without saving) correctly leaves the name unchanged, confirmed by reopening and
reading the row; the Photo modal opens from its chevron row, shows the current avatar/initial
fallback, and its `Save photo` button is correctly disabled until something changes (verified via
computed `disabled` state) -- this is the mechanism that makes Cancel a true no-op for photos too.
Both modals checked in dark mode at 380px width: `Modal` panel background/text colors resolve
correctly (slate-800/slate-100), no horizontal overflow. No console errors observed at any point.
**Caveat, stated plainly:** the Browser pane tooling used here has no file-upload capability, so
the actual upload-a-real-image path (file picker → resize → preview → save) was not exercised
end-to-end with a real file -- only the modal's open/cancel/disabled-until-changed logic was
verified. The user should click through an actual photo upload before considering this fully
signed off.

Gate: 51/51 backend tests pass (unchanged -- no backend touched), frontend build clean, no
secrets in diff, no dead code left behind (`savingProfile`/`onAvatarSelected`/`saveProfile`
grepped, zero hits). Pushed to `staging` only.

### Nav restructure: Trash → Account, Notes slot opened (✅ COMPLETE, STAGING ONLY — 18 Jul 2026)

Bottom nav changes from `My Tasks | Catch Up | Projects | Trash | Account` to
`My Tasks | Catch Up | Projects | Notes | Account`:

- **`Trash.jsx` split**: the list/restore/delete-forever logic (previously the whole page) is now
  an exported `TrashPanel({ showHeading })` component with no outer page chrome of its own; the
  default-exported `Trash` page is now a thin wrapper (`<main><TrashPanel /></main>`) used only by
  the still-valid `/trash` route. Nothing about the list/restore/permanent-delete logic itself
  changed -- reused as-is, not rebuilt.
- **`AccountPage.jsx`**: new `TrashSection` -- a "Data" card with a single chevron-row entry
  ("Trash"), matching the visual language of the Security rows. Judgment call on the modal vs.
  chevron-row pattern established for Profile editing: Trash is a list view, not a form, so instead
  of the small field-then-submit modal shape, clicking it opens the same wide modal shape already
  used for e.g. `TaskDetailModal` (`max-w-2xl`), with `TrashPanel` rendered inside (`showHeading=
  false`, since the Modal's own title already says "Trash" -- avoids a duplicate heading).
- **`Notes.jsx`** (new): placeholder page, empty state "No notes yet." Route `/notes` added
  alongside the unchanged `/trash` route. Real feature ships separately (next prompt).
- **`BottomNav.jsx`**: `Trash` tab entry replaced with `Notes` (`StickyNote` icon, same
  active-tab-highlighting logic, unchanged for every other tab).

**Verified live against the staging dev server**, including opening a brand-new browser tab with
no accumulated console history (the first tab showed a stale HMR-cycle error from mid-edit saves
that a hard reload didn't clear -- confirmed via a fresh tab that this was leftover console
history, not a live bug: zero errors there from the start): nav shows Notes where Trash was,
active-tab highlighting still correct; Trash section in Account opens the modal with the real
list (3 items) and Restore buttons working; `/trash` deep link still resolves to the identical
list outside Account; `/notes` renders the placeholder empty state; both the Trash modal and the
bottom nav checked in dark mode at 380px -- correct panel colors (slate-800/slate-100), no
horizontal overflow anywhere. No console errors in the clean tab at any point.

Gate: 51/51 backend tests pass (no backend touched), frontend build clean, no secrets in diff.
Pushed to `staging` only.

### Revision: Trash modal → dedicated page (✅ COMPLETE, STAGING ONLY — 18 Jul 2026, commit `a98ce95` revised)

The Trash section shipped above opened as a wide modal from Account; revised the same day to a
full page instead, reached the same way (clicking "Trash" in Account) but landing on `/trash`
directly rather than opening in place.

- **`Trash.jsx`**: folded back into a single page component (the short-lived `TrashPanel`/
  `showHeading` split from the modal version is gone now that nothing embeds it elsewhere) --
  list/restore/delete-forever logic is **byte-identical**, confirmed via `git diff` showing zero
  changed lines in `restore`/`confirmDeleteForever` -- this was purely a presentation/navigation
  change, not a functional rebuild, exactly as instructed.
  - Added a `Breadcrumb` (`Account → Trash`) with `onBack` returning to `/account` -- the same
    established back-button pattern every other detail page in the app already uses (`DocDetail`,
    etc.), not a bespoke control.
  - Added search: a plain input filtering the list by title as the user types, styled to match
    `SharedFilterBar`'s existing search box exactly (icon position, `field pl-8 dark:bg-slate-700`
    classes) rather than pulling in the whole Filters-drawer machinery, which doesn't apply here --
    Trash has nothing else to filter on. An inline clear ("×") button appears once there's a query.
    Empty states: "Nothing in trash" (no items at all) vs. `No trashed items match "<query>"` (a
    search with zero hits) -- distinct, so a user can tell the difference.
- **`AccountPage.jsx`**: `TrashSection`'s chevron row now calls `navigate('/trash')` instead of
  opening a `Modal`; the `showTrash` state and `TrashPanel` import are gone.

**Verified live against the staging dev server** (fresh tab per this session's established
practice, no accumulated console history): clicking Trash in Account navigates to `/trash`
(confirmed via `window.location.pathname`, not just visually); the back button returns to
`/account`; search filters the list correctly (typed "redirect" -> 1 of 3 items remained), the
no-match empty state renders correctly, and Clear restores all 3; `/trash` still resolves
directly as a deep link with identical content; dark mode at 380px confirmed via computed styles
(search input `rgb(51,65,85)` bg / white text, list card `rgb(30,41,59)` bg, matching the rest of
the app), no horizontal overflow. Zero console errors. Restore/permanent-delete were **not**
re-exercised end-to-end this pass (would have mutated shared staging trash contents for a code
path proven unchanged by the zero-diff above) -- relying on the diff plus the prior session's
already-verified restore/delete-forever coverage rather than repeating a live mutation for its
own sake.

Gate: 51/51 backend tests pass (no backend touched), frontend build clean, no secrets in diff,
no dead references (`TrashPanel`/`showTrash` grepped, zero hits). Pushed to `staging` only.

### Notes feature: chat-style personal notes + optional Talk to AI (✅ COMPLETE, STAGING ONLY — 18 Jul 2026)

Replaces the placeholder Notes page with a real feature, following the full-page navigation
pattern established for Trash (not modals): `/notes` (list) and `/notes/:id` (an open chat).

**Schema — migration `13_add_notes` (the 14th migration directory):**
- `NoteChat`: `userId` (direct owner FK -- unlike every other resource in this app, notes have no
  project/shared-membership concept, so ownership is the simplest possible check), `title`
  (nullable -- "Untitled N" is a display-only number derived from creation order, never
  persisted, so renaming/reordering never has to reconcile against a stored placeholder),
  `aiEnabled` (default `false`), optional `project`/`task` links (`SetNull`), soft-deletable.
- `NoteMessage`: `chatId` FK, `role` enum (`user`/`assistant`), `body`, soft-deletable.
- Applied directly to the staging DB via `prisma migrate deploy` against the Railway proxy
  connection string in `backend/.env.local` (same DB the deployed backend uses), then the SQL
  was hand-written into the migration file from `prisma migrate diff`'s output and committed --
  confirmed via the subsequent deploy log ("14 migrations found ... No pending migrations to
  apply") that this matched exactly what the running database already had.

**Backend (`backend/src/routes/notes.js`), all owner-scoped via new `requireNoteChat`/
`requireNoteMessage` helpers in `lib/ownership.js` (cross-user access is 404, never 403, matching
every other resource in the app):**
- Full CRUD on chats/messages per spec, plus one deliberate addition beyond the original route
  list: `GET /api/notes/chats/:id` -- the chat page needs one chat's title/`aiEnabled` on its own;
  refetching the whole list just to find one row by id would have been wasteful.
- `POST .../messages` always persists the user message first, then a two-gate check before ever
  touching the AI -- per-chat `aiEnabled`, then the global `ENABLE_AI_GENERATION` flag (reuses the
  exact client construction/model from `prompts.js`'s existing Prompt 6 generation, not forked):
  `aiEnabled` false -> log only; `aiEnabled` true + flag off -> message saves, clear `aiNotice`,
  no error, no API call; both true -> real Anthropic call, reply persisted as `role: assistant`.
- Search (`search.js`): extended the existing tasks/projects query architecture with one more
  `Promise.all` branch for notes (chat title + message body matches, deduped by chat, with a
  snippet showing which message matched). **This turned out straightforward to extend, not the
  "non-trivial" case the spec worried might apply** -- each content type is just another query
  merged into the same response shape.

**Frontend:**
- `Notes.jsx` (list): "Untitled N" numbered by creation order (shared `utils/notes.js` helper, so
  the list and an open chat's own header never disagree on a chat's number -- caught and fixed
  during verification, when the chat header first showed a bare "Untitled" instead of "Untitled 2"),
  newest-first, + New chat, per-chat delete.
- `NoteChat.jsx` (open chat): message stream with timestamps, user/assistant visually distinguished
  (primary-color bubble vs. `.card`), click-to-rename header, "Talk to AI: On/Off" toggle (pill-button
  active-state convention already used for the Theme picker, not a new visual language), typing
  indicator ("Thinking...") while awaiting a reply, per-message edit/delete with confirm. Composer:
  Enter sends, Shift+Enter for a newline; sticky positioning (not a bespoke fixed-height scroll
  container -- this app doesn't use that pattern anywhere else) keeps it 4rem above the viewport
  bottom, exactly where the fixed BottomNav's reserved `pb-16` space already is.
- **Voice-to-text**: the browser's native Web Speech API (`SpeechRecognition`) -- no new backend
  dependency or API cost, as directed. Mic button hidden entirely when unsupported; pulsing-icon
  recording state with a stop control; permission-denied shows a clear inline message rather than
  failing silently.
- **AI replies are a single response with a loading indicator, not streamed** -- the existing
  Anthropic client usage in `prompts.js` doesn't stream either, so this matches that rather than
  forking a new pattern for Notes alone.

**Backend tests (`test/notes.test.js`, mocked Prisma + mocked Anthropic SDK, same convention as
`trashDelete.test.js`):** ownership negative-path for every owner-scoped route (13 tests total,
cross-user access always 404, never touches the row), plus all three `aiEnabled`/
`ENABLE_AI_GENERATION` outcomes -- including the full `aiEnabled`-true-and-flag-on path with a
mocked AI response, proving that code path works **without ever touching the real staging
environment variable** (the test only flips `process.env.ENABLE_AI_GENERATION` inside its own
process). `ENABLE_AI_GENERATION` was confirmed `false` on staging before this work and confirmed
still `false` after -- never changed, per instruction.

**Verified live against the staging dev server** (which points at the *deployed* staging
backend, not local code -- the new routes had to be pushed and deployed before any of this could
be tested, confirmed by an initial `404 Route not found` on `/api/notes/chats` until the deploy
finished; deploy log showed "14 migrations found ... No pending migrations to apply", matching
the direct-apply above): create -> "Untitled 1", second create -> "Untitled 2", rename works and
is reflected consistently in both the list and the open chat's own header; Talk to AI OFF sends
and persists a message with no assistant reply; Talk to AI ON with the flag off saves the message
and shows the exact "AI replies are currently disabled..." notice with **no network request to
Anthropic** (confirmed via the network log) and no error; message edit and delete both work and
persist across a reload; global search finds a chat by title and by message-body content (a
query with a typo'd substring correctly returned nothing, confirming the match is a real
substring check, not a false positive) and navigates to `/notes/:id`; the mic button's
permission-denied path was exercised for real (the Browser pane genuinely blocks microphone
access) and showed the exact inline message with no console error and no stuck recording state;
dark mode + 380px confirmed via computed styles on both pages (`rgb(30,41,59)` card background,
no horizontal overflow); zero console errors throughout. Test chats cleaned up afterward; theme
reverted to Light (shared account state, same hygiene as prior sessions).

Gate: 64/64 backend tests pass (51 existing + 13 new), frontend build clean, no secrets in diff.
Pushed to `staging` only, not merged to `main`.

### Notes composer: fixed positioning + bubble color rework (✅ COMPLETE, STAGING ONLY — 19 Jul 2026)

Two bugs reported against the Notes chat UI shipped above:

1. **Composer position.** The composer used `position: sticky`, which only behaves like "fixed"
   once the page has scrolled enough to run out of room -- on a short conversation it sat right
   after the last message and visibly slid down the page as messages were sent, instead of staying
   put. Changed to `position: fixed` (`NoteChat.jsx`), anchored at the same `bottom-16` offset as
   before so it still sits just above the fixed `BottomNav`. Fixed removes it from document flow
   entirely, so it cannot move regardless of message count -- the message stream above it is what
   scrolls (still whole-document scroll, no new internal scroll container introduced), and the
   existing `streamEndRef.current?.scrollIntoView` effect keeps auto-scrolling to the newest
   message exactly as before. `<main>`'s bottom padding increased (`pb-28`) so the fixed composer
   never overlaps the last message.
2. **Message bubble colors.** Changed from a solid primary-blue user bubble to the requested
   neutral scheme: user messages `bg-slate-100` (light) / `bg-slate-700` (dark), assistant messages
   unchanged (`.card` already resolves to white light / slate-800 dark, which is exactly what was
   asked for -- no change needed there). Timestamp text color unified to `text-muted` for both
   roles now that neither background is a solid brand color.

**Verified live against the staging dev server** (real session, admin user, fresh JWT): sent 20
messages into a test chat -- confirmed via `getBoundingClientRect()` that the composer's fixed
position (`bottom: 64px` from the viewport) is byte-identical before the first message and after
the page grew to `scrollHeight: 1832` (from an initial `747`, well past one viewport), while
`window.scrollY` advanced to `844.8`, proving the page scrolled and auto-scroll-to-newest kept
working while the composer itself never moved. Bubble colors confirmed via computed style in both
themes: user bubble `rgb(241,245,249)`/`rgb(23,32,51)` (light) and `rgb(51,65,85)`/`rgb(241,245,249)`
(dark) -- Tailwind's `slate-100`/`text-text` and `slate-700`/`slate-100` respectively. Dark mode +
380px: no horizontal overflow, no console errors. Test chat and its messages deleted afterward;
theme reverted to Light (same hygiene as prior sessions).

Gate: 64/64 backend tests pass (no backend touched), frontend build clean, no secrets in diff.
Pushed to `staging` only.

### GateCard + UnscheduledCard unified into one `RoadmapCard` (✅ COMPLETE, STAGING ONLY — 19 Jul 2026)

Structural follow-up to the earlier Unscheduled-vs-Gate visual investigation: the two were separate
components sharing only ambient CSS classes. Replaced both with one `RoadmapCard.jsx` (`kind: 'gate'
| 'unscheduled'`), the sole render site being `RoadmapOverview.jsx`'s gates grid (grepped -- neither
old component had any other caller). `GateCard.jsx` and `UnscheduledCard.jsx` deleted, not kept
alongside as dead code.

Per the decisions specified up front:
- **Click target: the whole card, both variants.** Gate previously only opened via a small
  internal `<button>` around its title; now both variants wrap the entire header + progress/sentence
  block in one `<button>`, matching Unscheduled's original behavior. "Add task" and the "⋮" menu are
  siblings *outside* that button (not nested inside it, which would be invalid HTML and would need
  `stopPropagation` gymnastics to work around) -- structurally incapable of triggering the card's
  own open handler, rather than merely tested to not do so.
- **Progress bar stays Gate-only**; Unscheduled keeps its plain "`{count} tasks not yet assigned to
  a gate`" sentence -- an intentional difference, not an oversight.
- **Menu contents differ by design:** Gate keeps its full menu (Reopen/Close toggle by status,
  Share, Edit); Unscheduled's menu has only "Share", wired to `onShareProject` -- reusing the
  existing project-level `ShareProjectModal`/`setShareModal(true)` already in `RoadmapOverview.jsx`
  (the same modal `ProjectDetailCard`'s own Share button opens), not a new share mechanism. This
  matches the precedent already established on the Unscheduled board view itself
  (`ProjectBoard.jsx`), where "Share" for Unscheduled has always meant sharing the whole project,
  since Unscheduled has no entity of its own to share.
- **Status badge (Active/Closed) and closed-reason quote stay Gate-only** -- no Unscheduled
  equivalent, since it has no open/closed lifecycle.

Visual consistency alignment:
- **Icon:** Gate gained one (`Milestone`, lucide) rather than removing Unscheduled's existing
  `Inbox` -- both readable at a glance beat neither having one.
- **Chevron:** both now use the same `ChevronRight` at the end of the header row (previously
  Unscheduled's sat at the end of a separate "Assign to gate" CTA sentence below the count -- that
  sentence/CTA-link styling was dropped since the whole card being clickable makes it redundant).
- **Spacing:** unified on `gap-3` (Unscheduled's original convention) on both the outer card and the
  inner clickable button, replacing Gate's mix of ad hoc `mt-*` margins.

**Verified live against the staging dev server** (Testing project, 3 gates -- one closed, two
active -- plus Unscheduled): confirmed via the accessibility tree that each gate and Unscheduled
render as one wrapping `button` around their content, with `"Add task"` and a `"Gate actions"` /
`"Unscheduled actions"` button as separate siblings (distinct aria-labels, not both saying "Gate
actions"). Opened the closed gate's menu -- showed exactly Reopen/Share/Edit (no Close); an active
gate's menu -- showed exactly Close/Share/Edit (no Reopen); Unscheduled's menu -- showed exactly
Share, which opened the real "Share project" modal. Clicked "Add task" on a gate -- opened
`QuickAddTaskModal` without navigating (confirms the regression risk called out up front didn't
happen). Clicked the Unscheduled card body -- navigated to its board view (`?gateId=unscheduled`)
showing its 3 real tasks. Dark mode + 380px: every card's background resolved to `rgb(30,41,59)`
(`.card`'s dark surface) via computed style, no horizontal overflow (`scrollWidth` === viewport
width), no console errors throughout.

Gate: 64/64 backend tests pass (no backend touched), frontend build clean, no secrets in diff, no
dead references to the deleted components (`GateCard`/`UnscheduledCard` grepped repo-wide, zero
hits). Pushed to `staging` only.

### Bug fix: task detail modal close button unreachable on mobile Safari (✅ COMPLETE, STAGING ONLY — 19 Jul 2026)

**Reported symptom:** on iOS Safari (staging frontend), opening a task detail modal cut off the top
of the modal -- the close (X) button and part of the TID badge were not visible or reachable, with
no way to close the modal except navigating away another way.

**Root cause, confirmed before fixing:** the shared `Modal.jsx` (used by every modal in the app
except the unrelated `TaskMoveSheet` bottom-sheet -- grepped `fixed inset-0` repo-wide, only those
two files) rendered its overlay as `fixed inset-0 flex items-center justify-center` with the card
capped at `max-h-[90vh]`, and the overlay itself had **no `overflow-y-auto` of its own**. Two
compounding problems:
1. `vh` is a static unit computed against the browser's layout viewport, which on mobile Safari
   does not reliably track the *actual currently-visible* height while its collapsible toolbar is
   showing -- so `90vh` can size/center the card as if more vertical space were available than is
   really on screen.
2. Because the overlay used flexbox centering with no scroll fallback, if the card's computed top
   ended up above the real visible viewport, there was **no way to scroll and reveal it** -- the
   outer container itself wasn't a scroll container, so the clipped close button and TID badge were
   not just visually cut off but structurally unreachable, matching the reported symptom exactly.
   This reproduces on any viewport short enough for the card to approach or exceed the visible
   height, not only on real iOS Safari -- confirmed live at a Chromium 390×400 viewport (see below),
   so it is a general small-viewport bug that mobile Safari's toolbar behavior simply makes common
   in practice, not an iOS-only code path.

**Fix (`components/Modal.jsx`, the single shared component -- fixes every modal in the app, not
just the task detail modal):**
- `max-h-[90vh]` → `max-h-[90dvh]` -- dynamic viewport height, which tracks the *current* visible
  viewport live as Safari's toolbar shows/hides, rather than a static/stale reference. No fallback
  unit needed; `dvh` has shipped in every current browser (iOS Safari since 15.4, released March
  2022) for long enough that this app doesn't otherwise carry compatibility shims.
- Overlay restructured so it can genuinely scroll: outer `fixed inset-0 overflow-y-auto` (background
  + backdrop-click-to-close), inner `flex min-h-full items-center justify-center` sizing wrapper
  (centers the card when it fits; naturally becomes scrollable-from-the-top, not center-clipped,
  when content is taller than the viewport, because `min-h-full` grows with content instead of
  truncating it before scroll is possible -- the standard fix for the classic "flexbox centering
  clips overflow" pitfall).
- Added safe-area-inset-top handling: the sizing wrapper's top padding is
  `pt-[max(1rem,env(safe-area-inset-top))]` so the header also clears a notch/dynamic island on
  devices that have one, instead of relying on the base `p-4` alone.
- Confirmed the modal does **not** open pre-scrolled and has no internal scroll-position bug of its
  own (`TaskDetailModal` remounts fresh per task, scrollTop starts at 0 by default) -- ruled out as a
  contributing cause, root cause is fully the overlay/unit issue above.

**Verified live against the staging dev server:** opened the task detail modal at a 390×664
viewport (approximates an iPhone with Safari's toolbar visible, shrinking real visible height below
a naive full-screen assumption) -- close button's `getBoundingClientRect()` confirmed fully within
`[0, window.innerHeight]`. Stress-tested at an even shorter 390×400 viewport -- still fully visible
(`top:46, bottom:80` inside a 410px-tall window). Verified the close button actually closes the
modal (not just visible). Checked dark mode -- card resolves to the correct `rgb(30,41,59)` dark
surface. Checked desktop width (1280×800) for regressions -- card renders centered as before
(`top:40, bottom:760` in an 800px viewport), no visual change from the pre-fix behavior. Zero
console errors at any viewport size or theme.

Gate: 64/64 backend tests pass (no backend touched), frontend build clean, no secrets in diff.
Pushed to `staging` only.

### Trash extended to cover deleted NoteChats (✅ COMPLETE, STAGING ONLY — 19 Jul 2026)

**Premise check (as asked, before making any change):** Trash does **not** only show deleted
Tasks -- `backend/src/routes/trash.js` already listed/restored/permanently-deleted Project, Task,
Group, Gate, Tag, DocEntry, and DocCategory. NoteChat (added when the Notes feature shipped) was
genuinely the one resource type missing, since Trash predates Notes and was never revisited after
Notes landed -- that's the actual gap this closes, not the broader "only Tasks" gap described.

**Design decision, flagged as asked: NoteMessage does NOT get its own Trash row.** Only whole
NoteChats are trashable. Reasoning:
- Every existing Trash item type is a whole meaningful entity (Project, Task, Group, Gate, Tag,
  Doc, Category) -- nothing at a smaller grain (e.g. a single DocAnnotation) has ever been
  independently surfaced in Trash; it always rides along with its parent. A NoteMessage is that
  same kind of "rides with its parent" leaf content relative to a NoteChat.
- There is no restore route for a single message today (`PATCH /notes/messages/:id` edits,
  `DELETE` soft-deletes, but nothing undoes that) -- adding one would be new scope invented for
  this change, not an extension of something that already exists.
- Confirmed via `requireNoteChat`/`notes.js`: deleting a chat (`DELETE /notes/chats/:id`) only
  stamps the **chat's own** `deletedAt` -- it never touches its messages' `deletedAt` at all. This
  means restoring the chat requires no message-level work either: the messages were never marked
  deleted in the first place, so they simply become reachable again through the same
  `deletedAt: null` filters everywhere else the moment the chat itself is un-trashed.

**Backend (`backend/src/routes/trash.js`):**
- List: added a `noteChat.findMany({ userId, deletedAt: { not: null } })` branch, serialized as
  `{ type: 'notechat', title: chat.title || 'Untitled note', ... }` -- the nullable `title` is the
  one case here that needed a fallback string, since every other trashable type's name/title field
  is required. Deliberately not attempting to reproduce the Notes list's "Untitled N" numbering
  (that number is computed from *currently active* chats' creation order -- a trashed chat isn't
  part of that list anymore, so inventing a matching number for it would be more confusing than a
  plain "Untitled note" label).
- Restore: new `notechat` branch, a single `deletedAt: null` update -- no companion message
  update needed, per the reasoning above.
- Permanent delete: new `notechat` branch, `prisma.noteChat.delete()`. **Verified this actually
  cleans up messages, not just the chat row:** `NoteMessage.chatId` has `onDelete: Cascade` in
  `schema.prisma` (checked directly, not assumed from memory) -- deleting the chat row cascades to
  every one of its messages at the Postgres level, live or already soft-deleted, the same mechanism
  every other cascade in this router already relies on (Project → Task/Group/Gate/Tag/Doc).
- 30-day retention sweep: added a `noteChat.deleteMany` branch so trashed chats expire the same way
  every other trashable type already does, instead of lingering forever.
- Both new branches are owner-scoped the same way as everywhere else in this file (`userId:
  req.auth.sub`, the same direct-owner check `requireNoteChat` uses) -- cross-user access is 404.

**Frontend (`frontend/src/pages/Trash.jsx`):** one line -- added `notechat: 'Note'` (plus `doc`/
`category`, which had been silently falling back to their raw type string) to `TYPE_LABELS`. No
icon added, matching the label-only convention every other trash row already uses (none of
Project/Task/Group/Gate/Tag/Doc/Category has one either) -- single tabs-vs-label call was label,
since a type chip already distinguishes rows clearly at this list size. Restore/permanent-delete
buttons, the search filter (by `item.title`, already generic across every type), and the
project-title subtitle line needed **zero** changes -- they were already fully generic over
`item.type`, exactly because Trash was built this way for the six pre-existing types.

**Backend tests (`test/trashDelete.test.js`):** added ownership negative-path tests for both
`notechat` restore and permanent-delete (cross-user 404, mutation never called), plus owner-success
tests for both -- 4 new tests, following the exact `findFirst`-mock convention the existing
task/project tests use.

**Verified live against the staging dev server** (after pushing -- new backend routes needed
deploying before the dev server, which points at deployed staging, could reach them): deleted a
NoteChat from Notes -- appeared in Trash labeled "Note"; restored it -- reappeared in the Notes
list with its messages intact (confirmed by opening the chat); permanently deleted a different
trashed NoteChat -- gone from Trash, `GET /api/notes/chats` never showed it again, and it did not
reappear on reload; existing Task trash/restore/permanent-delete re-exercised end-to-end to confirm
no regression; search filtered correctly across a mixed Task+NoteChat trash list by typing a
substring of each; dark mode + 380px checked, no console errors.

Gate: 68/68 backend tests pass (64 existing + 4 new), frontend build clean, no secrets in diff.
Pushed to `staging` only.

### Sprint Backlog (as of 17 Jul, pre-chunking)
1. ✅ customId field — COMPLETE & PRODUCTION
2. ✅ Production data migration (Valideity seed + Fortnoto ownership) — COMPLETE
3. ✅ Security audit (6 items) — COMPLETE (fixes in `e93a26a`; finding #5 escalated to user)
4. ✅ Task modal in-place fix — COMPLETE (`5628ba1`)
5. ⏳ **User visual verification** on staging (5-item queue above)
6. ⏳ **Merge staging → production** after verification (batches `08ad9ed` + `e93a26a` + `5628ba1`)
7. 🔴 **Decide on production `JWT_SECRET` rotation** (audit finding #5)
8. 🟡 **Contract phase** (drop Group model, old Task.status enum, Project.order) — optional

### Future (Phase 2+)
- PAT auth role attachment
- Real-user testing layer (Signal Stack v1)
- Recruitment & participant management, corroboration ranking
- Figma plugin distribution, community/marketplace features

---

## Known Issues & Workarounds

### 🔴 Shared `JWT_SECRET` across environments (NEW — audit finding #5)
Staging and production use the same `JWT_SECRET`; access tokens cross environments. Rotate the prod
secret (invalidates active prod sessions). Left for the user to schedule.

### 🚨 PAT Auth Gap (Pre-existing, Phase 2)
PATs can't hit `/api/admin` routes (role not attached). Fails closed. Workaround: JWT for admin ops.

### ℹ️ Resolved This Cycle
- Production Fortnoto kanban board rendered empty → **statuses created + `statusId` backfilled on prod** (data mutation, see Production Database note). Root cause: legacy project with 0 statuses; fix never replayed from staging to prod.
- Doc markdown XSS (`marked` output was unsanitized) → **DOMPurify sanitization at render** (`5892373`); heading-id anchors preserved
- Trash permanent-delete ownership → **confirmed + negative-path test** (`e93a26a`)
- customId unique-violation 500 → **clean 409**; over-length input → **400** (`e93a26a`)
- Task modal navigation (My Tasks / Search redirected to board) → **opens in place** (`5628ba1`)
- customId not in schema → **shipped** (migration `12_add_task_custom_id`)
- Valideity production decision → **seeded on production**
- Production/staging real-data parity → **replayed; the two real projects match**
- Production baseline P3005 → resolved earlier via `migrate resolve --applied 0_init`

---

## Deployment & Environments

### Production (Railway + Netlify)
- Backend: https://taskflow-production-d9c0.up.railway.app — commit `9f72056`, 13 migrations
- Auto-deploys on push to `main` (`prisma migrate deploy` preDeploy)

### Staging (Railway + Netlify)
- Backend: https://taskflow-staging-dbeb.up.railway.app — commit `5628ba1`
- Frontend: https://staging--muidemakztaskflow.netlify.app

### Local Development
- `npm run dev` frontend (Vite) + backend; `.env.local` DATABASE_URL. Local dev frontend points at the
  deployed staging backend, so new backend routes must be pushed before browser testing.
- Migrations applied via SSH `prisma migrate deploy` when direct local DB access is unavailable.

### Deployment Rules
- staging → test at staging URL → user verification → merge to `main` → auto-deploy
- **Data mutations are never carried by merges** — replay explicitly per environment
- Emergency rollback: `git revert <bad-commit>` + push

---

## Testing Strategy

- ✅ Vitest: **44 backend tests, 7 files**, all passing
- ✅ API-level verification per feature (board/search/trash customId; permanent delete end-to-end; auth endpoints sanity-checked; 409/400 customId paths)
- ✅ Deployed-bundle inspection (CSS/JS asset verification on Netlify)
- ✅ Idempotency verification on data scripts
- ⏳ Human visual QA: the standing gap — backend QA passes; UI sign-off pends the user's click-through
- Security & Debug Gate mandatory pre-commit (see CLAUDE.md)

---

## Pending: Group → Tag Migration for Contract Phase (18 Jul 2026)

**Status:** Investigation STARTED
- **Staging:** ✅ Complete (35 groups → 35 tags, 100% overlap, 221 grouped tasks, 7 ungrouped left as-is)
- **Production:** ⏳ Investigation needed (no inferred data; must query direct DB or use Railway SSH)
- **Approach:** Single idempotent script to run on both environments; handles both cases (tags exist or need creation)
- **Scheduled:** After Commit 1 completion (filter unification, breadcrumbs, page width)

---

## Fact-Check Corrections Log (17 Jul 2026 → 18 Jul additions)

Corrected against the actual repo and live databases:
- **Staging HEAD:** `08ad9ed` → **`5628ba1`** (two later commits: `e93a26a` security fixes, `5628ba1` task-modal). `main` HEAD `9f72056` confirmed correct.
- **Migrations:** "12/12" → **13 directories** (`0_init` … `12_add_task_custom_id`). Latest name confirmed.
- **Backend tests:** "31+" → **44 tests across 7 files**.
- **Staging projects:** "4" → **6 non-deleted** (added `c.1.2 QA Project`, `Prompt 4 Docs QA`, both owned by `checkpointc.tester@example.com`); Fortnoto **230 → 227 tasks**; staging third user is `checkpointc.tester@example.com`.
- **Production users:** third user named — `testuser123@example.com`. Fortnoto (279) and Valideity (91, all customId) ownership by admin confirmed.
- **Security audit:** was "queued" → **completed this session**; item #5 (`JWT_SECRET`) escalated as a real finding (shared secret across environments).
- **Task modal fix:** was "queued" → **completed** (`5628ba1`).
- URLs (prod backend, staging backend, staging frontend) confirmed reachable. Production frontend URL still unconfirmed.

---

## Contact & Ownership

**Owner:** User
**Active Maintainer:** Claude (via Claude Code sessions)
**Production Status:** LIVE & STABLE (`9f72056`)
**Next Review:** After the 5-item staging verification + production merge of `08ad9ed`/`e93a26a`/`5628ba1`

---

**End of Master Documentation — Phase 1 Complete, Cleanup Sprint In Progress**
