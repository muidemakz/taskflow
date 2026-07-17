// Prompt 8: seeds the real "Valideity" demo project from the pasted
// valideity-master-task-list-v1.1 source. Deliberately deviates from the
// original Prompt 8 spec's placeholder assumptions where the real source
// disagrees with them -- see the summary this script prints at the end for
// the full list of deviations (gate names, 91 vs 73 tasks, 6 real tags
// instead of W1-W4, no due dates since the source explicitly rejects fixed
// deadlines in favor of gate sequencing).
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { planGateClose } from '../src/lib/rollover.js';
import { logActivityMany } from '../src/lib/activity.js';
import { generatePatToken, hashPatToken } from '../src/lib/pat.js';

dotenv.config({ path: fs.existsSync('.env.local') ? '.env.local' : '.env' });

const prisma = new PrismaClient();

// --- Source data (transcribed verbatim from valideity-master-task-list-v1.1) ---

const GATES = [
  { code: 'A', name: 'A. Concierge verdict', description: '3 to 5 manual persona-simulation reports delivered; at least 2 recipients change their design and confirm willingness to pay. Go/no-go.' },
  { code: 'B', name: 'B. Calibration proof', description: 'Same study run simulated and real (n >= 5 each); simulation catches >= 70% of real-user issues. Documented.' },
  { code: 'C', name: 'C. Identity, landing page, waitlist', description: 'Name locked, positioning live, waitlist collecting.' },
  { code: 'D', name: 'D. MVP build (end-to-end simulation + assistive guidance)', description: 'Create study, pick personas (preset suggestions offered), run, get structured report including validation guidance and the Signal Stack teaser, on your own prototype, no manual stitching, < 15 minutes.' },
  { code: 'E', name: 'E. 5 external creators', description: '5 external creators complete a study and view a report.' },
  { code: 'F', name: 'F. First payment', description: 'First payment received.' }
];

const GATE_TASKS = [
  // Gate A -- A1. Setup
  { id: 'A1.1', gate: 'A', title: 'Build intake form (Google Form) per concierge kit §1', ac: 'Form live with all 6 fields incl. "authorized to share" checkbox and "what worries you most"', tags: [] },
  { id: 'A1.2', gate: 'A', title: 'Write outreach list of 10 candidate designers/PMs', ac: '10 named people with channel (DM/email); mix of 2 internal, 8 external', tags: [] },
  { id: 'A1.3', gate: 'A', title: 'Send outreach wave 1 (script from kit §4)', ac: '5+ messages sent; replies logged with screenshots', tags: [] },
  { id: 'A1.4', gate: 'A', title: 'Write persona prompt set v1 (5 personas)', ac: '5 versioned persona files incl. at least 2 Nigerian-market personas (device, network, literacy, language attributes)', tags: ['moat'] },
  { id: 'A1.5', gate: 'A', title: 'Build findings report template v1 (kit §3)', ac: 'Template doc with all 8 sections; score formula 40/25/15/10/10 embedded and labeled Directional/Predicted', tags: [] },
  { id: 'A1.6', gate: 'A', title: 'Set up evidence folder structure + time log', ac: 'One folder per study; time log sheet with setup/run/report columns', tags: [] },
  // Gate A -- A2. Runs
  { id: 'A2.1', gate: 'A', title: 'Concierge study 1: Fortnoto flow (internal)', ac: 'Full run: 5 personas, report delivered, time logged, evidence checklist §2 complete', tags: [] },
  { id: 'A2.2', gate: 'A', title: 'Concierge study 2: Medusa/team flow (internal)', ac: 'Same as A2.1; doubles as design system audit evidence for work', tags: [] },
  { id: 'A2.3', gate: 'A', title: 'Concierge study 3: external designer', ac: 'Same as A2.1 plus walkthrough call recorded/noted', tags: [] },
  { id: 'A2.4', gate: 'A', title: 'Concierge study 4: external designer', ac: 'Same as A2.3', tags: [] },
  { id: 'A2.5', gate: 'A', title: 'Concierge study 5: external designer (optional stretch)', ac: 'Same as A2.3', tags: [] },
  { id: 'A2.6', gate: 'A', title: 'Walkthrough calls with money questions', ac: 'WTP answer + referral ask captured verbatim for every external study', tags: [] },
  { id: 'A2.7', gate: 'A', title: 'Day 10-14 follow-ups', ac: '"Did you change anything?" answered for all studies; before/after screenshots collected where yes', tags: [] },
  // Gate A -- A3. Verdict
  { id: 'A3.1', gate: 'A', title: 'Compile Gate A evidence pack', ac: 'Every counted study passes kit §2 checklist; pack stored in evidence folder', tags: [] },
  { id: 'A3.2', gate: 'A', title: 'Write Gate A verdict memo (go/no-go)', ac: 'One-pager: pass criteria from kit §7 checked, decision stated, learnings for persona set v2', tags: [] },
  { id: 'A3.3', gate: 'A', title: 'Update persona set to v2 from learnings', ac: 'Changelog of what changed per persona and why', tags: ['moat'] },

  // Gate B
  { id: 'B1.1', gate: 'B', title: 'Select calibration study (one Gate A study, locked task + questions)', ac: 'Chosen study documented; task and question set frozen per cluster rule', tags: [] },
  { id: 'B1.2', gate: 'B', title: 'Write participant consent + privacy text', ac: 'Plain-language consent covering data use; NDPR-minded; reviewed once by a lawyer contact or template check', tags: ['legal'] },
  { id: 'B1.3', gate: 'B', title: 'Recruit 5+ real participants (BYO sharing)', ac: '5 completed real sessions via shared link (WhatsApp/Slack/community)', tags: [] },
  { id: 'B1.4', gate: 'B', title: 'Run manual real-user test', ac: 'Sessions captured: completion, time, ratings, open answers, observed friction', tags: [] },
  { id: 'B1.5', gate: 'B', title: 'Build Predicted vs Measured comparison', ac: 'Table: issues caught by both / simulation only / real only; score delta computed', tags: [] },
  { id: 'B1.6', gate: 'B', title: 'Calibration verdict memo', ac: '>= 70% issue-catch rate confirmed or failure analyzed with persona adjustments proposed', tags: [] },
  { id: 'B1.7', gate: 'B', title: 'Seed Simulation Accuracy Index with data point 1', ac: 'First index entry recorded in the format intended for public publication', tags: ['moat'] },

  // Gate C -- C1. Name and identity
  { id: 'C1.1', gate: 'C', title: 'Final name decision', ac: 'Valideity vs FlowProof vs TaskLens vs VeriFlow vs other; decision memo with reasoning', tags: ['brand'] },
  { id: 'C1.2', gate: 'C', title: 'Domain + handle availability check', ac: 'Domain purchased; X/LinkedIn/Instagram handles secured', tags: ['brand'] },
  { id: 'C1.3', gate: 'C', title: 'Trademark scan (Nigeria, 1 class)', ac: 'No blocking collision found; filing task created if proceeding', tags: ['legal'] },
  { id: 'C1.4', gate: 'C', title: 'Pronunciation/spelling test', ac: '10 people asked to spell it after hearing it; misspell rate recorded (Valideity vs Validity risk)', tags: ['brand'] },
  { id: 'C1.5', gate: 'C', title: 'Logo + minimal brand kit', ac: 'Wordmark, color, type; enough for landing page and report template', tags: ['brand'] },
  { id: 'C1.6', gate: 'C', title: 'Rebrand report template with final identity', ac: 'Concierge template carries final brand', tags: [] },
  // Gate C -- C2. Landing page + waitlist
  { id: 'C2.1', gate: 'C', title: 'Positioning + page copy', ac: 'Headline on "prove your design works"; triangulation story as supporting narrative; no Maze-alternative framing', tags: [] },
  { id: 'C2.2', gate: 'C', title: 'Design landing page', ac: 'Hi-fi design, mobile-first', tags: [] },
  { id: 'C2.3', gate: 'C', title: 'Build + ship landing page', ac: 'Live on purchased domain; loads < 3s on 3G', tags: [] },
  { id: 'C2.4', gate: 'C', title: 'Waitlist capture + analytics', ac: 'Email capture working; PostHog (or similar) events firing', tags: ['ops'] },
  { id: 'C2.5', gate: 'C', title: 'Privacy policy for waitlist', ac: 'Published; covers email collection lawfully', tags: ['legal'] },
  { id: 'C2.6', gate: 'C', title: 'Waitlist growth push', ac: '3 LinkedIn posts on UX evidence pain (no pitch) + community shares; 50 signups minimum before Gate D build starts', tags: ['content'] },

  // Gate D -- D1. Product definition freeze
  { id: 'D1.1', gate: 'D', title: 'MVP scope freeze doc', ac: 'In/out list signed off: synthetic simulation core, validation guidance section, preset persona suggestions, signal_sources schema + report teaser only', tags: [] },
  { id: 'D1.2', gate: 'D', title: 'Data model v1', ac: 'Subset of PRD §8.2: users, workspaces, projects, studies, personas, simulation_sessions, findings, reports; plus signal_sources table as schema only', tags: [] },
  { id: 'D1.3', gate: 'D', title: 'Score implementation spec', ac: 'Formula 40/25/15/10/10, normalization, Predicted/Directional labeling, suppression when non-comparable', tags: [] },
  { id: 'D1.4', gate: 'D', title: 'Cluster/branch rules spec', ac: 'Locked core = comparable; additions allowed; disabling locked item downgrades branch to Directional with visible flag', tags: [] },
  { id: 'D1.5', gate: 'D', title: 'Persona chip taxonomy + preset suggestion table', ac: 'Attribute set defined; static lookup mapping audience keywords to preset personas; no history/acceptance logic in v1', tags: ['moat', 'assistive'] },
  { id: 'D1.6', gate: 'D', title: 'Validation guidance spec', ac: '"What to validate with real users" report section: High/Med severity findings flagged with a one-line reason; suggestions only, skippable, no enforcement', tags: ['assistive'] },
  // Gate D -- D2. Design
  { id: 'D2.1', gate: 'D', title: 'IA / sitemap', ac: 'Dashboard, project, study wizard, persona picker, run view, report; nothing else', tags: [] },
  { id: 'D2.2', gate: 'D', title: 'Study creation wizard flows', ac: 'Wireframes: target → task + success condition → question set → persona selection with preset suggestions → run', tags: [] },
  { id: 'D2.3', gate: 'D', title: 'Persona picker UI', ac: 'Chip-based selection with presets + custom attributes; persona card preview; "Suggested for your audience" callout', tags: ['assistive'] },
  { id: 'D2.4', gate: 'D', title: 'Report screens (Maze-adapted + assistive)', ac: 'Predicted paths view, per-screen grid, score card with formula on hover, severity-ranked friction list, validation guidance section, Signal Stack teaser affordance', tags: ['assistive'] },
  { id: 'D2.5', gate: 'D', title: 'Design system v1', ac: 'Tokens + components for the above, incl. validation guidance callout style; no heatmap/corroboration components yet', tags: [] },
  { id: 'D2.6', gate: 'D', title: 'Clickable prototype + self-review', ac: 'Full creator journey clickable; reviewed against participant-trust and no-fake-precision principles', tags: [] },
  // Gate D -- D3. Build
  { id: 'D3.1', gate: 'D', title: 'Stack + infra setup', ac: 'Next.js/TypeScript, Node backend, Postgres, Railway/Vercel; dev/prod envs', tags: ['ops'] },
  { id: 'D3.2', gate: 'D', title: 'Auth', ac: 'Google + email/password sign up, sign in, reset', tags: [] },
  { id: 'D3.3', gate: 'D', title: 'Workspace / project / study CRUD', ac: 'Create, edit, list, delete on the D1.2 model; signal_sources table migrated but dormant', tags: [] },
  { id: 'D3.4', gate: 'D', title: 'Figma ingestion', ac: 'Given a prototype link: frames extracted in flow order, screens stored, hotspot data where available', tags: [] },
  { id: 'D3.5', gate: 'D', title: 'URL target handling', ac: 'Live URL target accepted with task + expected end state definition', tags: [] },
  { id: 'D3.6', gate: 'D', title: 'Persona engine + preset suggestions', ac: 'Persona chips compile to versioned prompts; engine runs a persona through target screens step by step; static suggestion lookup wired to the audience field', tags: ['moat', 'assistive'] },
  { id: 'D3.7', gate: 'D', title: 'Simulation runner', ac: '1 to 20 synthetic sessions per run; per-step predicted first-click, hesitation, confusion, drop-off captured; all sessions flagged synthetic', tags: [] },
  { id: 'D3.8', gate: 'D', title: 'Findings + report generation', ac: 'Report auto-compiles: predicted score, severity-ranked friction list with persona quotes, evidence links, validation guidance section auto-generated, Signal Stack teaser rendered', tags: ['assistive'] },
  { id: 'D3.9', gate: 'D', title: 'Report share/export', ac: 'Shareable read-only link + PDF export (teaser included; no empty data sections)', tags: [] },
  { id: 'D3.10', gate: 'D', title: 'Eval harness v0', ac: '3+ golden test cases; persona output regression-checked before any prompt/model change ships; validation guidance quality spot-checked', tags: ['moat'] },
  { id: 'D3.11', gate: 'D', title: 'Cost instrumentation', ac: 'Token cost per simulation run logged; cost per report visible internally', tags: ['ops'] },
  // Gate D -- D4. Self-test (dogfood)
  { id: 'D4.1', gate: 'D', title: 'End-to-end run on own prototype', ac: 'Fortnoto or Valideity\'s own flow: study created, preset suggestion tested, run completed, report viewed with validation guidance present, zero manual stitching', tags: [] },
  { id: 'D4.2', gate: 'D', title: 'Compare product output vs Gate A manual report', ac: 'Product report quality >= manual concierge report on same flow; gaps listed and triaged', tags: [] },
  { id: 'D4.3', gate: 'D', title: 'Guidance tone check', ac: 'Validation recommendations read as suggestions, all skippable; no false precision anywhere; teaser does not imply features that don\'t exist', tags: [] },
  { id: 'D4.4', gate: 'D', title: 'Time-to-report measured', ac: 'Wall-clock from study creation to report < 15 minutes', tags: [] },
  { id: 'D4.5', gate: 'D', title: 'Gate D verdict memo', ac: 'Pass declared with evidence, or blocker list', tags: [] },

  // Gate E
  { id: 'E1.1', gate: 'E', title: 'Alpha cohort recruitment', ac: '8 to 10 invited from waitlist + concierge referrals; 5+ activated', tags: [] },
  { id: 'E1.2', gate: 'E', title: 'Onboarding flow', ac: 'First-run experience gets a new user to a published study; skippable explainer; preset suggestions demonstrated', tags: [] },
  { id: 'E1.3', gate: 'E', title: 'Product analytics wired to playbook metrics', ac: 'Time to first study, activation rate, report views, suggestion acceptance rate, validation guidance clicks instrumented', tags: ['ops', 'assistive'] },
  { id: 'E1.4', gate: 'E', title: 'Feedback capture loop', ac: 'In-product or call-based feedback logged per creator; weekly triage (incl. assistive feature reactions)', tags: [] },
  { id: 'E1.5', gate: 'E', title: 'Bug triage + fix cycle', ac: 'P0/P1 bugs from alpha fixed within the cycle; log kept', tags: [] },
  { id: 'E1.6', gate: 'E', title: 'Persona set v3 + suggestion review from alpha learnings', ac: 'Changelog documented; suggestion acceptance rate reviewed to inform the V2 engine', tags: ['moat', 'assistive'] },
  { id: 'E1.7', gate: 'E', title: 'Gate E verdict', ac: '5 external creators each completed a study and viewed a report; evidence in analytics', tags: [] },

  // Gate F
  { id: 'F1.1', gate: 'F', title: 'Pricing page', ac: 'Free + Researcher (₦9,000 / $8) live; paywall capacity, never comprehension of collected data', tags: [] },
  { id: 'F1.2', gate: 'F', title: 'Paystack integration', ac: 'Subscription charge, receipt, cancel flow working in test + live', tags: ['ops'] },
  { id: 'F1.3', gate: 'F', title: 'Free tier limits enforced', ac: 'Study/simulation caps enforced with upgrade prompt', tags: [] },
  { id: 'F1.4', gate: 'F', title: 'Terms of Service published', ac: 'ToS + acceptable use live; lawyer-reviewed or template-verified', tags: ['legal'] },
  { id: 'F1.5', gate: 'F', title: 'First paying customer', ac: 'One real payment received and confirmed; who and why documented', tags: [] },
  { id: 'F1.6', gate: 'F', title: 'Gate F verdict + next-roadmap review', ac: 'Verdict memo; V1 parking lot (incl. Signal Stack v1 build) reviewed and re-prioritized', tags: [] }
];

// Parallel workstreams -- explicitly "not gate-blocked" per source, so these
// stay Unscheduled (no gateId) and carry only their workstream's tag.
const WORKSTREAM_TASKS = [
  { id: 'W1.1', title: 'Company registration decision (CAC)', ac: 'Decide entity + timing (after C1.1); register when decided; certificate stored', tags: ['legal'] },
  { id: 'W1.2', title: 'NDPR compliance baseline', ac: 'Privacy policy, consent records design, DPO named, NITDA data controller registration when live', tags: ['legal'] },
  { id: 'W1.3', title: 'DPAs with sub-processors', ac: 'Anthropic, hosting, email, analytics DPAs signed before production user data', tags: ['legal'] },
  { id: 'W1.4', title: 'Trademark filing', ac: 'Filed in 1 class after C1.3 clears', tags: ['legal'] },
  { id: 'W2.1', title: 'Article 1: concierge story (PARKED until confirmed)', ac: 'Drafted only after go-ahead; uses kit §6 story-arc proof mapping', tags: ['content'] },
  { id: 'W2.2', title: 'Article 2: calibration proof (placeholder)', ac: 'Slotted after Gate B; not drafted yet', tags: ['content'] },
  { id: 'W2.3', title: 'Public resource: "How to run a usability test in Nigeria for free"', ac: 'Published; SEO seed per playbook', tags: ['content'] },
  { id: 'W2.4', title: 'Community presence cadence', ac: 'Active in 2+ communities (Figma Africa, Design Lagos); weekly touchpoint', tags: ['content'] },
  { id: 'W3.1', title: 'Tool stack + accounts', ac: 'Domain email, hosting, analytics, error monitoring on free tiers per playbook §8.1', tags: ['ops'] },
  { id: 'W3.2', title: 'Budget tracker', ac: 'Pre-MVP budget tracked against playbook\'s ₦537,900 baseline; monthly review', tags: ['ops'] },
  { id: 'W3.3', title: 'Personal capacity plan', ac: 'Weekly hours allocated across job, job search, Fortnoto, Valideity; reviewed monthly', tags: ['ops'] },
  { id: 'W4.1', title: 'Simulation Accuracy Index format + publication plan', ac: 'Public format defined; updates on every calibration study', tags: ['moat'] },
  { id: 'W4.2', title: 'Benchmark database schema (design only, build later)', ac: 'Schema for anonymized cross-study benchmarks drafted; includes suggestion-accuracy fields; build deferred to V1+', tags: ['moat'] },
  { id: 'W4.3', title: 'Persona library versioning system', ac: 'Personas versioned, changelogged, tagged by market; suggestion acceptance tracked from Gate E; calibration feedback loop defined', tags: ['moat'] },
  { id: 'W4.4', title: 'Moat Register quarterly review', ac: 'Register reviewed and updated each quarter or at each gate verdict', tags: ['moat'] }
];

const ALL_TAGS = ['moat', 'content', 'legal', 'brand', 'ops', 'assistive'];

// Mirrors DEFAULT_STATUSES in routes/projects.js and STARTER_CATEGORIES in
// routes/docCategories.js exactly -- both are normally seeded by the
// POST /api/projects route handler as part of its transaction, not by any
// DB-level default, so calling prisma.project.create() directly (as this
// script does, bypassing the route) skips them unless recreated here.
const DEFAULT_STATUSES = [
  { name: 'Backlog', order: 0, countsAsDone: false },
  { name: 'To-do', order: 1, countsAsDone: false },
  { name: 'In progress', order: 2, countsAsDone: false },
  { name: 'In review', order: 3, countsAsDone: false },
  { name: 'Done', order: 4, countsAsDone: true }
];
const STARTER_CATEGORIES = ['moat', 'decision', 'principle', 'reference', 'prd'];

// Editorial addition (not in the source, which has no priority field):
// HIGH for gate-verdict/go-no-go/critical-path items, LOW for explicitly
// optional/parked/placeholder/design-only items, MID otherwise.
function inferPriority(title) {
  const t = title.toLowerCase();
  if (/optional stretch|parked|placeholder|design only|build deferred/.test(t)) return 'LOW';
  if (/verdict|go\/no-go|first paying customer|final name decision|mvp scope freeze|trademark scan|pricing page|paystack integration|terms of service/.test(t)) return 'HIGH';
  return 'MID';
}

// Editorial addition: which gate-scoped tasks are already Done, so closing
// Gate A has a natural, non-contrived mix of complete/incomplete work to
// roll over. Everything else defaults to To-do.
const DONE_TASK_IDS = new Set([
  'A1.1', 'A1.2', 'A1.3', 'A1.4', 'A1.5', 'A1.6',
  'A2.1', 'A2.2', 'A2.3', 'A2.4', 'A2.6',
  'A3.1', 'A3.2',
  'B1.1', 'B1.2',
  'C1.1', 'C1.2',
  'W3.1'
]);
const IN_PROGRESS_TASK_IDS = new Set(['A2.7', 'B1.3', 'B1.4', 'C1.5', 'D1.1', 'D1.2', 'W3.2', 'W1.1']);
// Everything else, including A2.5 and A3.3, stays To-do -- those two are
// exactly the tasks left incomplete in Gate A at close time.

// --- Docs content, compiled from the source's own Companion sections ---

const DOCS = [
  {
    category: 'decision',
    title: 'Architecture Decision Log',
    body: `# Architecture Decision Log

Compiled from Companion 3 of the Valideity master task list (v1.1).

## Product & methodology
1. AI simulation first; real-user testing is the evidence standard it calibrates against (Predicted vs Measured framing).
2. Hybrid is v1.1, not v1.0. Real-user layer enters at V1.
3. MVP targets: Figma prototypes + live URLs only.
4. Concierge test precedes all build; Gate A is go/no-go.
5. Six gates A-F replace deadlines; gates block phases.
6. Solo vibe-coded build; no fixed deadline; capacity governed by W3.3.

## Cluster & branch model
7. Cluster rule: locked core earns comparable score; disabling locked items downgrades to Directional visibly.
8. Branch vocabulary: a Study has Branches; branches in a locked cluster are benchmark-comparable.

## Assistive layer & Signal Stack
9. Assistive layer ships in MVP as report content + presets only: validation guidance and static preset persona suggestions. Non-prescriptive throughout: suggestions, never mandates; everything skippable.
10. Signal Stack = triangulation of Predicted + Measured + Feedback. Lives in the report (not a separate tab). Split build: Gate D = signal_sources schema + report teaser; V1 = manual paste-in with dropdown assignment + corroboration badges; V2 = automated sources + auto-matching + confidence weighting.
11. Persona suggestion engine (history + acceptance based) deferred to V2; cold-start solved with a static audience-keyword preset lookup in MVP.
12. Signal Stack paste format free-text first (screenshots later); matching manual in V1, fuzzy auto-match V2; visible and paste-in free on free tier (feeds the M12 data moat); corroboration badges algorithmic with user override, recency weighting V2.

## Naming & positioning
13. Working name Valideity; final name decision is task C1.1.
14. Paywall capacity, never comprehension of already-collected data.

## Scope boundaries
15. Taskflow and Valideity remain separate products; a findings-scoped Fixes module may later borrow Taskflow concepts.
16. Moats live in a register, not as tasks; reviewed at gate verdicts.
17. Article series parked until explicitly confirmed; Chowdeck-style voice noted as reference.

## Vocabulary
18. Signal overlap is corroboration, never priority. Severity and corroboration are independent axes; single-signal findings display as "unvalidated," not "low priority."`
  },
  {
    category: 'moat',
    title: 'Competitive Moat Register',
    body: `# Competitive Moat Register

Living document (Companion 1 of the master task list). Reviewed at every gate verdict per W4.4 -- no moat is a task; moats spawn tasks tagged \`moat\`.

| # | Moat | Type | What feeds it | Status |
|---|------|------|---------------|--------|
| M1 | Calibration dataset / Simulation Accuracy Index | Data, compounds with usage | Every Predicted-vs-Measured study; validation guidance is its in-product funnel | Seeding at Gate B |
| M2 | Benchmark database (scores by flow type + market) | Data | Study volume | Design only (W4.2) |
| M3 | Locally grounded, behaviorally tuned persona library + suggestion accuracy | Data | Calibration + acceptance metrics from Gate E on | Presets at A1.4/D1.5; engine V2 |
| M4 | Benchmark/cluster history as switching cost | Workflow | Teams' study history | Built into D1.4 |
| M5 | Handoff ritual: buglist export + "Validated on Valideity" badge | Workflow | Team adoption | V1 parking lot |
| M6 | Evidence -> fix -> re-test closed loop (Fixes module, findings-scoped) | Workflow | Signal Stack + benchmark system | V3 (Companion 2) |
| M7 | Figma plugin + Lovable/Vercel/v0 plugin distribution | Distribution | Build effort | Parking lot V1/V2 |
| M8 | Community proximity (Lagos design community) | Brand/trust | W2 cadence, bootcamps | Active from Gate A |
| M9 | Own the standard: published Valideity Score + Verified badge | Standard | Publishing rubric openly | Post-Gate D |
| M10 | Eval harness / persona + guidance quality regression testing | Operational | D3.10 | Builds at Gate D |
| M11 | Local pricing in NGN + local payments | Market access | Pricing decisions | Locked in F1.1 |
| M12 | Signal Stack: multi-signal triangulation (Predicted + Measured + Feedback) with corroboration ranking | Data + Workflow | Every signal users attach; compounds as sources automate | Schema + teaser at Gate D; paste-in V1; automation V2 |

New moats are added here; dead ones are retired with a note, never deleted.`
  },
  {
    category: 'prd',
    title: 'Product Requirements (Valideity Q3)',
    body: `# Product Requirements -- Valideity Q3

Compiled from Gate D (MVP build) of the master task list, the phase where scope is actually frozen and specced.

## Scope (D1.1)
In: synthetic simulation core, validation guidance section, preset persona suggestions, signal_sources schema + report teaser only. Targets: Figma prototypes + live URLs. Single-study report.
Out: paste-in flows, corroboration heatmap, auto-matching, automated sources, recruitment, real-session capture.

## Data model v1 (D1.2)
Subset of the full PRD's §8.2: users, workspaces, projects, studies, personas, simulation_sessions, findings, reports (every session flagged \`synthetic\`); plus a \`signal_sources\` table (id, study_id, source_type [Predicted/Measured/Feedback], source_subtype, raw_content, finding_id nullable, added_by, added_at) as schema only -- no UI writes to it yet.

## Scoring (D1.3)
Formula 40/25/15/10/10, normalized, labeled Predicted/Directional, suppressed when non-comparable.

## Personas (D1.5)
Attribute set: role, device, tech literacy, network condition, language, skepticism, product familiarity. Static lookup maps audience keywords (e.g. "fintech + Lagos + consumer") to preset personas including Nigerian-market presets. No acceptance-history logic in v1.

## Acceptance criteria highlights
- Report screens (D2.4): Predicted paths view with screen thumbnails, per-screen grid, score card with formula on hover, severity-ranked friction list, every view badged Predicted, validation guidance section, single Signal Stack teaser (disabled/coming-soon, no machinery).
- Simulation runner (D3.7): 1 to 20 synthetic sessions per run; per-step predicted first-click, hesitation, confusion, drop-off captured.
- Report generation (D3.8): auto-compiles predicted score, severity-ranked friction list with persona quotes, evidence links from every insight, validation guidance auto-generated in the same pass.
- Time-to-report (D4.4): wall-clock from study creation to report must be under 15 minutes.`
  },
  {
    category: 'principle',
    title: 'Design Principles',
    body: `# Design Principles

Distilled from the source document's decision log and Gate D self-test criteria (D4.3).

1. **Non-prescriptive, always.** Guidance and suggestions, never mandates. Every assistive recommendation must be skippable.
2. **No false precision.** Scores are labeled Predicted or Directional, never presented as ground truth. Suppress a score rather than fake comparability.
3. **Participant trust first.** Every design and copy decision is reviewed against participant-trust before shipping (D2.6).
4. **Severity and corroboration are independent axes.** Never conflate signal overlap with priority. A high-severity single-signal finding is "High severity, unvalidated," never "Low priority."
5. **Teasers describe what exists, not what's coming.** The Signal Stack teaser must never imply a feature is live when it isn't (D4.3).
6. **Paywall capacity, never comprehension.** Free-tier limits gate simulation volume and study count -- never a user's ability to understand data they already collected.
7. **Locally grounded by default.** Persona and pricing decisions default to the Nigerian market (device, network, literacy, language attributes; NGN pricing) rather than a generic global default.`
  },
  {
    category: 'reference',
    title: 'External Reference Links',
    body: `# External Reference Links

Stub -- the source task list names these tools and services but does not include URLs. Fill in real links as they're set up.

## Infrastructure
- Next.js -- [add link]
- Railway -- [add link]
- Vercel -- [add link]
- Postgres -- [add link]

## Payments & analytics
- Paystack (F1.2, subscription + receipt + cancel flow) -- [add link]
- PostHog (C2.4, waitlist analytics) -- [add link]

## AI
- Anthropic (persona simulation engine; DPA required per W1.3) -- [add link]

## Legal / compliance
- NDPR guidance (W1.2) -- [add link]
- NITDA data controller registration (W1.2) -- [add link]`
  }
];

// --- Prompts, tied to real Gate D build/design tasks ---

const PROMPTS = [
  { taskId: 'D3.2', targetTool: 'CLAUDE_CODE', generated: false,
    body: 'Implement authentication for a Next.js + Node backend: Google OAuth and email/password sign up, sign in, and password reset. Use JWT access tokens with refresh-token rotation, matching the pattern already established in the Taskflow backend (bcrypt for password hashing, short-lived access token + longer-lived stored refresh token).' },
  { taskId: 'D3.4', targetTool: 'CLAUDE_CODE', generated: true,
    body: 'Build a Figma REST API integration that, given a prototype link, extracts frames in flow order, stores each screen, and captures hotspot/interaction data where the Figma API exposes it. Handle prototypes with branching flows, not just a single linear path.' },
  { taskId: 'D3.6', targetTool: 'CLAUDE_CODE', generated: true,
    body: 'Design a persona-compilation engine: persona chips (role, device, tech literacy, network condition, language, skepticism, product familiarity) compile into a versioned prompt. The engine then runs that persona through a target\'s screens step by step, producing per-step predicted first-click, hesitation, confusion, and drop-off signals. Wire in a static audience-keyword-to-preset-persona lookup table.' },
  { taskId: 'D3.7', targetTool: 'CLAUDE_CODE', generated: false,
    body: 'Build a simulation runner that executes 1 to 20 synthetic sessions per study run against a target (Figma prototype or live URL), capturing per-step predicted first-click, hesitation, confusion, and drop-off for each session. Every session record must be flagged synthetic: true -- there is no real-user capture in this phase.' },
  { taskId: 'D3.8', targetTool: 'CLAUDE_CODE', generated: false,
    body: 'Build report generation that auto-compiles a completed simulation run into: a predicted score (40/25/15/10/10 formula, normalized, labeled Predicted/Directional), a severity-ranked friction list with persona quotes and evidence links back to the originating session, and a validation guidance section (High/Med severity findings flagged with a one-line reason) generated in the same pass. Render the Signal Stack teaser as a disabled/coming-soon affordance -- no backing functionality yet.' },
  { taskId: 'D3.10', targetTool: 'CLAUDE_CODE', generated: true,
    body: 'Build an eval harness with at least 3 golden test cases for the persona simulation engine. Every persona-output or model-version change must run against these cases and be regression-checked before shipping. Include a lightweight spot-check path for validation-guidance quality, not just the simulation output.' },
  { taskId: 'D2.3', targetTool: 'FIGMA_AI', generated: false,
    body: 'Design a chip-based persona picker UI: users select from preset persona chips or add custom attributes, see a persona card preview, and get a "Suggested for your audience" callout driven by a static audience-keyword lookup. Keep the tone non-prescriptive -- presets are suggestions, not defaults the user must accept.' },
  { taskId: 'D2.4', targetTool: 'FIGMA_AI', generated: true,
    body: 'Design the study report screens: a Predicted paths view with screen thumbnails, a per-screen grid, a score card that reveals the scoring formula on hover, a severity-ranked friction list, per-question visualizations, and a validation guidance callout section. Every view must carry a visible "Predicted" badge. Include one Signal Stack teaser affordance in a disabled/coming-soon state.' },
  { taskId: 'D2.1', targetTool: 'FIGMA_MAKE', generated: false,
    body: 'Generate an IA / sitemap for the Valideity MVP: dashboard, project, study creation wizard, persona picker, run view, and report -- nothing else in scope for this phase.' },
  { taskId: 'C2.2', targetTool: 'FIGMA_MAKE', generated: false,
    body: 'Design a hi-fi, mobile-first landing page for Valideity. Headline should center on "prove your design works," with the Predicted/Measured/Feedback triangulation story as supporting narrative -- avoid framing this as a Maze alternative.' }
];

// --- Cleanup: known scratch/test projects from earlier checkpoints ---

const CLEANUP_TITLES = ['c.1.3 QA Project', 'c.1.3 Staging QA Project', 'Test'];

async function cleanupTestProjects() {
  const projects = await prisma.project.findMany({ where: { title: { in: CLEANUP_TITLES }, deletedAt: null } });
  const now = new Date();
  const removed = [];
  for (const project of projects) {
    await prisma.$transaction(async (tx) => {
      const roadmap = await tx.roadmap.findUnique({ where: { projectId: project.id } });
      await Promise.all([
        tx.task.updateMany({ where: { projectId: project.id, deletedAt: null }, data: { deletedAt: now } }),
        tx.group.updateMany({ where: { projectId: project.id, deletedAt: null }, data: { deletedAt: now } }),
        roadmap
          ? tx.gate.updateMany({ where: { roadmapId: roadmap.id, deletedAt: null }, data: { deletedAt: now } })
          : Promise.resolve(),
        tx.tag.updateMany({ where: { projectId: project.id, deletedAt: null }, data: { deletedAt: now } }),
        tx.docEntry.updateMany({ where: { projectId: project.id, deletedAt: null }, data: { deletedAt: now } }),
        tx.docCategory.updateMany({ where: { projectId: project.id, deletedAt: null }, data: { deletedAt: now } })
      ]);
      await tx.project.update({ where: { id: project.id }, data: { deletedAt: now } });
    });
    removed.push(project.title);
  }
  return removed;
}

// --- Main seed ---

async function main() {
  const hashed = await bcrypt.hash('Admin1234!', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@taskflow.app' },
    update: {},
    create: { email: 'admin@taskflow.app', name: 'Taskflow Admin', password: hashed, role: 'ADMIN' }
  });

  const removedProjects = await cleanupTestProjects();

  const existing = await prisma.project.findFirst({ where: { ownerId: admin.id, title: 'Valideity', deletedAt: null } });
  if (existing) {
    console.log(`Valideity project already exists (${existing.id}). Skipping seed -- delete it first to reseed.`);
    await prisma.$disconnect();
    return;
  }

  const project = await prisma.project.create({
    data: {
      title: 'Valideity',
      description: 'AI-simulated UX validation, calibrated against real users. Seeded from valideity-master-task-list-v1.1.',
      ownerId: admin.id,
      hasConfigured: true,
      order: []
    }
  });

  await prisma.status.createMany({ data: DEFAULT_STATUSES.map((s) => ({ ...s, projectId: project.id })) });
  await prisma.docCategory.createMany({ data: STARTER_CATEGORIES.map((name) => ({ name, projectId: project.id })) });

  const [statuses, categories] = await Promise.all([
    prisma.status.findMany({ where: { projectId: project.id }, orderBy: { order: 'asc' } }),
    prisma.docCategory.findMany({ where: { projectId: project.id } })
  ]);
  const statusByName = Object.fromEntries(statuses.map((s) => [s.name, s]));
  const categoryByName = Object.fromEntries(categories.map((c) => [c.name, c]));

  const roadmap = await prisma.roadmap.create({ data: { projectId: project.id } });
  await prisma.project.update({ where: { id: project.id }, data: { hasRoadmap: true } });

  const gateByCode = {};
  for (let i = 0; i < GATES.length; i++) {
    const g = GATES[i];
    gateByCode[g.code] = await prisma.gate.create({
      data: { roadmapId: roadmap.id, name: g.name, description: g.description, order: i }
    });
  }

  const tags = {};
  for (const name of ALL_TAGS) {
    tags[name] = await prisma.tag.create({ data: { projectId: project.id, name } });
  }

  function statusFor(id) {
    if (DONE_TASK_IDS.has(id)) return statusByName['Done'];
    if (IN_PROGRESS_TASK_IDS.has(id)) return statusByName['In progress'];
    return statusByName['To-do'];
  }

  const taskByShortId = {};
  const positionCounters = {};

  async function createTask(def, gateId) {
    const status = statusFor(def.id);
    positionCounters[status.id] = (positionCounters[status.id] || 0) + 1000;
    const task = await prisma.task.create({
      data: {
        title: def.title,
        customId: def.id,
        comment: def.ac,
        priority: inferPriority(def.title),
        projectId: project.id,
        gateId: gateId || null,
        statusId: status.id,
        position: positionCounters[status.id]
      }
    });
    if (def.tags.length) {
      await prisma.taskTag.createMany({ data: def.tags.map((t) => ({ taskId: task.id, tagId: tags[t].id })) });
    }
    taskByShortId[def.id] = task;
    return task;
  }

  for (const def of GATE_TASKS) {
    await createTask(def, gateByCode[def.gate].id);
  }
  for (const def of WORKSTREAM_TASKS) {
    await createTask(def, null);
  }

  console.log(`Seeded ${GATE_TASKS.length + WORKSTREAM_TASKS.length} tasks across 6 gates + parallel workstreams.`);

  // --- Docs + task-doc links ---
  const docByCategory = {};
  for (const d of DOCS) {
    const doc = await prisma.docEntry.create({
      data: { projectId: project.id, title: d.title, body: d.body, categoryId: categoryByName[d.category].id, status: 'ACTIVE' }
    });
    docByCategory[d.category] = doc;
  }

  const docLinks = [
    ['decision', ['C1.1', 'D1.1']],
    ['moat', ['A1.4', 'B1.7', 'D1.5', 'D3.6', 'W4.3']],
    ['prd', ['D1.2', 'D2.4', 'D3.8']],
    ['principle', ['D4.3', 'D1.6']],
    ['reference', ['D3.1', 'F1.2']]
  ];
  let linkCount = 0;
  for (const [category, taskIds] of docLinks) {
    const doc = docByCategory[category];
    for (const shortId of taskIds) {
      const task = taskByShortId[shortId];
      if (!task) continue;
      await prisma.taskDocLink.create({ data: { taskId: task.id, docEntryId: doc.id } });
      linkCount++;
    }
  }
  console.log(`Seeded 5 docs, ${linkCount} task-doc links.`);

  await prisma.project.update({ where: { id: project.id }, data: { promptRulesCategoryId: categoryByName['prd'].id } });

  // --- Prompts ---
  for (const p of PROMPTS) {
    const task = taskByShortId[p.taskId];
    if (!task) continue;
    await prisma.promptVersion.create({
      data: { taskId: task.id, body: p.body, targetTool: p.targetTool, status: 'FINAL', generated: p.generated }
    });
  }
  console.log(`Seeded ${PROMPTS.length} prompts.`);

  // --- Close Gate A (real rollover + activity trail via the actual route logic) ---
  const gateA = gateByCode.A;
  const gatesForRoadmap = await prisma.gate.findMany({ where: { roadmapId: roadmap.id, deletedAt: null } });
  const tasksInGateA = await prisma.task.findMany({ where: { gateId: gateA.id, deletedAt: null }, orderBy: { position: 'asc' } });
  const doneStatus = statusByName['Done'];

  const plan = planGateClose({
    rolloverMode: project.rolloverMode,
    gates: gatesForRoadmap,
    currentGateId: gateA.id,
    tasksInGate: tasksInGateA,
    doneStatusId: doneStatus.id,
    confirmed: true
  });

  const reason = 'Concierge verdict reached (go decision) -- moving into calibration proof.';
  await prisma.$transaction(async (tx) => {
    if (plan.action === 'ROLL_TO_NEXT_GATE') {
      const maxPosition = (await tx.task.aggregate({ where: { gateId: plan.nextGate.id }, _max: { position: true } }))._max.position ?? 0;
      await Promise.all(
        plan.incomplete.map((task, i) =>
          tx.task.update({
            where: { id: task.id },
            data: { gateId: plan.nextGate.id, movedFromGateId: gateA.id, movedFromGateAt: new Date(), position: maxPosition + (i + 1) * 1000 }
          })
        )
      );
      await logActivityMany(tx, plan.incomplete.map((task) => ({
        taskId: task.id, eventType: 'gate_changed', oldValue: gateA.name, newValue: plan.nextGate.name,
        reason: 'Rolled over on gate close', changedById: admin.id
      })));
    }
    await tx.gate.update({ where: { id: gateA.id }, data: { status: 'CLOSED', closedAt: new Date(), closedReason: reason } });
    if (tasksInGateA.length) {
      await logActivityMany(tx, tasksInGateA.map((task) => ({
        taskId: task.id, eventType: 'closed_gate_reason', oldValue: null, newValue: null, reason, changedById: admin.id
      })));
    }
  });
  console.log(`Closed Gate A (${plan.action}, ${plan.incomplete.length} task(s) rolled to ${plan.nextGate?.name ?? 'n/a'}).`);

  // --- Sharing: 1 gate, 1 task, project already shared by default ---
  const gateB = gateByCode.B;
  await prisma.gate.update({ where: { id: gateB.id }, data: { shareEnabled: true, shareToken: randomUUID() } });

  const sharedTask = taskByShortId['C2.3']; // "Build + ship landing page" -- outcome-visible, natural to share
  await prisma.task.update({ where: { id: sharedTask.id }, data: { shareEnabled: true, shareToken: randomUUID() } });

  await prisma.project.update({ where: { id: project.id }, data: { shareEnabled: true } });
  console.log('Sharing enabled: Gate B, task C2.3, and the project (project-level sharing was already on by default).');

  // --- Admin profile: avatar + dark theme + a PAT ---
  const avatarSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><rect width="128" height="128" fill="#2357d9"/><text x="64" y="82" font-family="Arial, sans-serif" font-size="64" font-weight="bold" fill="#fff" text-anchor="middle">T</text></svg>`;
  const avatarUrl = `data:image/svg+xml;base64,${Buffer.from(avatarSvg).toString('base64')}`;
  await prisma.user.update({ where: { id: admin.id }, data: { avatarUrl, theme: 'DARK' } });

  const existingToken = await prisma.personalAccessToken.findFirst({ where: { userId: admin.id, label: 'Valideity demo API access', revokedAt: null } });
  if (!existingToken) {
    const token = generatePatToken();
    await prisma.personalAccessToken.create({ data: { userId: admin.id, label: 'Valideity demo API access', tokenHash: hashPatToken(token) } });
    console.log('Created a PAT for admin@taskflow.app labeled "Valideity demo API access".');
  }
  console.log('Admin profile updated: avatar set, theme = DARK.');

  console.log('\n--- Cleanup ---');
  console.log(removedProjects.length ? `Soft-deleted: ${removedProjects.join(', ')}` : 'No leftover test projects found by title match.');

  console.log('\nDone. Valideity project id:', project.id);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
