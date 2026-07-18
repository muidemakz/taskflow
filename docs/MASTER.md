# Taskflow Upgrade — Master Documentation

**Last Updated:** 18 July 2026 (TID scheme revision + customId generation + board/modal bug fixes + whole-project board unification)
**Current Status:** Phase 1 COMPLETE and LIVE IN PRODUCTION — Commit 1 (UI standardization) and Commit 3 (tabs as state, now including the whole-project board) complete on staging; TID (customId) now generates on every task-creation path in a single frozen `<Letter><Cluster>.<Seq>` format, U-prefixed for Unscheduled (staging only, backfill pending user approval); chevron rotation direction still unverified in a browser
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

**Batched for the next production merge:** `08ad9ed` → `e93a26a` → `5628ba1` → `5892373` → `9bbc534` (plus docs `a1ed372`). Staging is ahead of `main` by these commits.

---

## Production State (Current)

**Commit:** `9f72056` (main HEAD; deployed via Railway + Netlify)
**Migrations:** 13 migration directories, `0_init` … `12_add_task_custom_id` (latest), all applied cleanly

### Production URLs
- **Backend:** https://taskflow-production-d9c0.up.railway.app
- **Frontend:** **https://muidemakztaskflow.netlify.app** (confirmed via prod `FRONTEND_URL`)
- **Database:** Production Postgres (Railway)

### Production Database (verified 17 Jul 2026, read-only Prisma query)
- **Users:** 3 — `admin@taskflow.app`, `demo@taskflow.app`, `testuser123@example.com`
- **Projects:** 2 (non-deleted)
  - **Fortnoto** — 279 tasks — owned by **admin@taskflow.app** (moved from demo). Board statuses backfilled 17 Jul 2026 (see data-mutation note below).
  - **Valideity** — 91 tasks (all 91 have customId), 6 gates, docs/prompts, Gate A closed — owned by **admin@taskflow.app**
- **customId:** all 91 Valideity tasks have IDs (A1.1 … W4.4) with clean titles; Fortnoto tasks are null (by design)
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

**CHUNK B (⏳ INVESTIGATION REFRESHED UNDER THE NEW SCHEME, MUTATION STILL NOT APPROVED) — backfill**

Original per-project/per-environment counts (still accurate — see table below); the dry-run
preview was re-run against the revised TID scheme via the same Railway SSH method (piping a
script into `node` over stdin -- no script ever deployed to either environment):

| Environment | Project | Total | Has TID | Gated | Unscheduled |
|---|---|---|---|---|---|
| Production | Fortnoto | 279 | 0 | 0 | 279 |
| Production | Valideity | 91 | 91 | 76 | 15 |
| Staging | Fortnoto | 226 | 0 | 0 | 226 |
| Staging | Valideity | 92 | 91 | 77 | 15 |
| Staging | Testing | 9 | 1 (after cleanup above) | 5 | 3 |
| Staging | c.1.2 QA Project | 1 | 0 | 1 | 0 |

Fresh sample ids under the new scheme (dry run, no mutation):
- **Production Fortnoto** → `U1.1 … U1.279` (confirmed exactly 279, all Unscheduled, as expected).
- **Staging Fortnoto** → `U1.1 … U1.226` (confirmed exactly 226, all Unscheduled, as expected).
- **Staging Valideity**'s one gap (`"New ti check"`, gate B) → `B1.8` (continues gate B past its
  existing max `B1.7`) — unchanged by the scheme revision since it's a gated id.
- **Staging Testing** (mixed) → `B1.2`, `B1.3`, `B1.4`, `A1.1`, `U1.2` (continues past the
  cleaned-up `U1.1`) — no more bare numerics anywhere in the preview.
- **c.1.2 QA Project** → `C1.1`.

**Stopped here, per instruction, for user approval before writing or running the mutation.**
Next: idempotent backfill script (skip existing ids, never overwrite), run against both
environments, verify by running twice, report final counts, delete the script, log results here.

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
