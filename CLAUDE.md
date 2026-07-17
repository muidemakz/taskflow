# Taskflow — Session Rules

## Master Documentation
- `docs/MASTER.md` is the single source of truth for project status, data state, pending work, and design decisions.
- READ `docs/MASTER.md` at the start of every session before doing any work.
- UPDATE `docs/MASTER.md` at the end of every session, in the same commit or a final commit, whenever any of these change: features shipped, commits merged, migrations added, data mutations run, environment state, pending-verification queue, known issues, security audit status.
- Data mutations (seeds, ownership changes, backfills) must be logged in the doc's data-state section for BOTH environments — merges ship code, never data.

## Security & Debug Gate (mandatory before every commit)
- (a) New/changed endpoints have ownership + auth checks and a negative-path test
- (b) No secrets in the diff
- (c) `npm run test` passes
- (d) Frontend build clean, no console errors
- (e) User input validated server-side
- Include gate results in the commit summary.
