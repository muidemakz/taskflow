// Updates the comment/description on all 91 existing Valideity tasks with
// structured context (section, AC, effort, priority, dependencies, tags,
// external blockers, gate status). Does NOT reseed or touch anything else --
// only Task.comment is written. AC/tags/ids are transcribed verbatim from the
// same valideity-master-task-list-v1.1 source used by seedValideity.mjs;
// effort/dependencies/external-blockers are an editorial layer (the source
// has no such fields), reasoned from task order, explicit cross-references
// in the source AC text ("after C1.1", "before Gate D build starts", etc.),
// and real-world sequencing. Priority and gate-closure date are read live
// from the DB rather than duplicated, so they can't drift from reality.
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import fs from 'node:fs';

dotenv.config({ path: fs.existsSync('.env.local') ? '.env.local' : '.env' });

const prisma = new PrismaClient();

// --- Source data (same as seedValideity.mjs) ---

const GATES = [
  { code: 'A', name: 'A. Concierge verdict' },
  { code: 'B', name: 'B. Calibration proof' },
  { code: 'C', name: 'C. Identity, landing page, waitlist' },
  { code: 'D', name: 'D. MVP build (end-to-end simulation + assistive guidance)' },
  { code: 'E', name: 'E. 5 external creators' },
  { code: 'F', name: 'F. First payment' }
];

const GATE_TASKS = [
  { id: 'A1.1', gate: 'A', title: 'Build intake form (Google Form) per concierge kit §1', ac: 'Form live with all 6 fields incl. "authorized to share" checkbox and "what worries you most"', tags: [] },
  { id: 'A1.2', gate: 'A', title: 'Write outreach list of 10 candidate designers/PMs', ac: '10 named people with channel (DM/email); mix of 2 internal, 8 external', tags: [] },
  { id: 'A1.3', gate: 'A', title: 'Send outreach wave 1 (script from kit §4)', ac: '5+ messages sent; replies logged with screenshots', tags: [] },
  { id: 'A1.4', gate: 'A', title: 'Write persona prompt set v1 (5 personas)', ac: '5 versioned persona files incl. at least 2 Nigerian-market personas (device, network, literacy, language attributes)', tags: ['moat'] },
  { id: 'A1.5', gate: 'A', title: 'Build findings report template v1 (kit §3)', ac: 'Template doc with all 8 sections; score formula 40/25/15/10/10 embedded and labeled Directional/Predicted', tags: [] },
  { id: 'A1.6', gate: 'A', title: 'Set up evidence folder structure + time log', ac: 'One folder per study; time log sheet with setup/run/report columns', tags: [] },
  { id: 'A2.1', gate: 'A', title: 'Concierge study 1: Fortnoto flow (internal)', ac: 'Full run: 5 personas, report delivered, time logged, evidence checklist §2 complete', tags: [] },
  { id: 'A2.2', gate: 'A', title: 'Concierge study 2: Medusa/team flow (internal)', ac: 'Same as A2.1; doubles as design system audit evidence for work', tags: [] },
  { id: 'A2.3', gate: 'A', title: 'Concierge study 3: external designer', ac: 'Same as A2.1 plus walkthrough call recorded/noted', tags: [] },
  { id: 'A2.4', gate: 'A', title: 'Concierge study 4: external designer', ac: 'Same as A2.3', tags: [] },
  { id: 'A2.5', gate: 'A', title: 'Concierge study 5: external designer (optional stretch)', ac: 'Same as A2.3', tags: [] },
  { id: 'A2.6', gate: 'A', title: 'Walkthrough calls with money questions', ac: 'WTP answer + referral ask captured verbatim for every external study', tags: [] },
  { id: 'A2.7', gate: 'A', title: 'Day 10-14 follow-ups', ac: '"Did you change anything?" answered for all studies; before/after screenshots collected where yes', tags: [] },
  { id: 'A3.1', gate: 'A', title: 'Compile Gate A evidence pack', ac: 'Every counted study passes kit §2 checklist; pack stored in evidence folder', tags: [] },
  { id: 'A3.2', gate: 'A', title: 'Write Gate A verdict memo (go/no-go)', ac: 'One-pager: pass criteria from kit §7 checked, decision stated, learnings for persona set v2', tags: [] },
  { id: 'A3.3', gate: 'A', title: 'Update persona set to v2 from learnings', ac: 'Changelog of what changed per persona and why', tags: ['moat'] },

  { id: 'B1.1', gate: 'B', title: 'Select calibration study (one Gate A study, locked task + questions)', ac: 'Chosen study documented; task and question set frozen per cluster rule', tags: [] },
  { id: 'B1.2', gate: 'B', title: 'Write participant consent + privacy text', ac: 'Plain-language consent covering data use; NDPR-minded; reviewed once by a lawyer contact or template check', tags: ['legal'] },
  { id: 'B1.3', gate: 'B', title: 'Recruit 5+ real participants (BYO sharing)', ac: '5 completed real sessions via shared link (WhatsApp/Slack/community)', tags: [] },
  { id: 'B1.4', gate: 'B', title: 'Run manual real-user test', ac: 'Sessions captured: completion, time, ratings, open answers, observed friction', tags: [] },
  { id: 'B1.5', gate: 'B', title: 'Build Predicted vs Measured comparison', ac: 'Table: issues caught by both / simulation only / real only; score delta computed', tags: [] },
  { id: 'B1.6', gate: 'B', title: 'Calibration verdict memo', ac: '>= 70% issue-catch rate confirmed or failure analyzed with persona adjustments proposed', tags: [] },
  { id: 'B1.7', gate: 'B', title: 'Seed Simulation Accuracy Index with data point 1', ac: 'First index entry recorded in the format intended for public publication', tags: ['moat'] },

  { id: 'C1.1', gate: 'C', title: 'Final name decision', ac: 'Valideity vs FlowProof vs TaskLens vs VeriFlow vs other; decision memo with reasoning', tags: ['brand'] },
  { id: 'C1.2', gate: 'C', title: 'Domain + handle availability check', ac: 'Domain purchased; X/LinkedIn/Instagram handles secured', tags: ['brand'] },
  { id: 'C1.3', gate: 'C', title: 'Trademark scan (Nigeria, 1 class)', ac: 'No blocking collision found; filing task created if proceeding', tags: ['legal'] },
  { id: 'C1.4', gate: 'C', title: 'Pronunciation/spelling test', ac: '10 people asked to spell it after hearing it; misspell rate recorded (Valideity vs Validity risk)', tags: ['brand'] },
  { id: 'C1.5', gate: 'C', title: 'Logo + minimal brand kit', ac: 'Wordmark, color, type; enough for landing page and report template', tags: ['brand'] },
  { id: 'C1.6', gate: 'C', title: 'Rebrand report template with final identity', ac: 'Concierge template carries final brand', tags: [] },
  { id: 'C2.1', gate: 'C', title: 'Positioning + page copy', ac: 'Headline on "prove your design works"; triangulation story as supporting narrative; no Maze-alternative framing', tags: [] },
  { id: 'C2.2', gate: 'C', title: 'Design landing page', ac: 'Hi-fi design, mobile-first', tags: [] },
  { id: 'C2.3', gate: 'C', title: 'Build + ship landing page', ac: 'Live on purchased domain; loads < 3s on 3G', tags: [] },
  { id: 'C2.4', gate: 'C', title: 'Waitlist capture + analytics', ac: 'Email capture working; PostHog (or similar) events firing', tags: ['ops'] },
  { id: 'C2.5', gate: 'C', title: 'Privacy policy for waitlist', ac: 'Published; covers email collection lawfully', tags: ['legal'] },
  { id: 'C2.6', gate: 'C', title: 'Waitlist growth push', ac: '3 LinkedIn posts on UX evidence pain (no pitch) + community shares; 50 signups minimum before Gate D build starts', tags: ['content'] },

  { id: 'D1.1', gate: 'D', title: 'MVP scope freeze doc', ac: 'In/out list signed off: synthetic simulation core, validation guidance section, preset persona suggestions, signal_sources schema + report teaser only', tags: [] },
  { id: 'D1.2', gate: 'D', title: 'Data model v1', ac: 'Subset of PRD §8.2: users, workspaces, projects, studies, personas, simulation_sessions, findings, reports; plus signal_sources table as schema only', tags: [] },
  { id: 'D1.3', gate: 'D', title: 'Score implementation spec', ac: 'Formula 40/25/15/10/10, normalization, Predicted/Directional labeling, suppression when non-comparable', tags: [] },
  { id: 'D1.4', gate: 'D', title: 'Cluster/branch rules spec', ac: 'Locked core = comparable; additions allowed; disabling locked item downgrades branch to Directional with visible flag', tags: [] },
  { id: 'D1.5', gate: 'D', title: 'Persona chip taxonomy + preset suggestion table', ac: 'Attribute set defined; static lookup mapping audience keywords to preset personas; no history/acceptance logic in v1', tags: ['moat', 'assistive'] },
  { id: 'D1.6', gate: 'D', title: 'Validation guidance spec', ac: '"What to validate with real users" report section: High/Med severity findings flagged with a one-line reason; suggestions only, skippable, no enforcement', tags: ['assistive'] },
  { id: 'D2.1', gate: 'D', title: 'IA / sitemap', ac: 'Dashboard, project, study wizard, persona picker, run view, report; nothing else', tags: [] },
  { id: 'D2.2', gate: 'D', title: 'Study creation wizard flows', ac: 'Wireframes: target → task + success condition → question set → persona selection with preset suggestions → run', tags: [] },
  { id: 'D2.3', gate: 'D', title: 'Persona picker UI', ac: 'Chip-based selection with presets + custom attributes; persona card preview; "Suggested for your audience" callout', tags: ['assistive'] },
  { id: 'D2.4', gate: 'D', title: 'Report screens (Maze-adapted + assistive)', ac: 'Predicted paths view, per-screen grid, score card with formula on hover, severity-ranked friction list, validation guidance section, Signal Stack teaser affordance', tags: ['assistive'] },
  { id: 'D2.5', gate: 'D', title: 'Design system v1', ac: 'Tokens + components for the above, incl. validation guidance callout style; no heatmap/corroboration components yet', tags: [] },
  { id: 'D2.6', gate: 'D', title: 'Clickable prototype + self-review', ac: 'Full creator journey clickable; reviewed against participant-trust and no-fake-precision principles', tags: [] },
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
  { id: 'D4.1', gate: 'D', title: 'End-to-end run on own prototype', ac: 'Fortnoto or Valideity\'s own flow: study created, preset suggestion tested, run completed, report viewed with validation guidance present, zero manual stitching', tags: [] },
  { id: 'D4.2', gate: 'D', title: 'Compare product output vs Gate A manual report', ac: 'Product report quality >= manual concierge report on same flow; gaps listed and triaged', tags: [] },
  { id: 'D4.3', gate: 'D', title: 'Guidance tone check', ac: 'Validation recommendations read as suggestions, all skippable; no false precision anywhere; teaser does not imply features that don\'t exist', tags: [] },
  { id: 'D4.4', gate: 'D', title: 'Time-to-report measured', ac: 'Wall-clock from study creation to report < 15 minutes', tags: [] },
  { id: 'D4.5', gate: 'D', title: 'Gate D verdict memo', ac: 'Pass declared with evidence, or blocker list', tags: [] },

  { id: 'E1.1', gate: 'E', title: 'Alpha cohort recruitment', ac: '8 to 10 invited from waitlist + concierge referrals; 5+ activated', tags: [] },
  { id: 'E1.2', gate: 'E', title: 'Onboarding flow', ac: 'First-run experience gets a new user to a published study; skippable explainer; preset suggestions demonstrated', tags: [] },
  { id: 'E1.3', gate: 'E', title: 'Product analytics wired to playbook metrics', ac: 'Time to first study, activation rate, report views, suggestion acceptance rate, validation guidance clicks instrumented', tags: ['ops', 'assistive'] },
  { id: 'E1.4', gate: 'E', title: 'Feedback capture loop', ac: 'In-product or call-based feedback logged per creator; weekly triage (incl. assistive feature reactions)', tags: [] },
  { id: 'E1.5', gate: 'E', title: 'Bug triage + fix cycle', ac: 'P0/P1 bugs from alpha fixed within the cycle; log kept', tags: [] },
  { id: 'E1.6', gate: 'E', title: 'Persona set v3 + suggestion review from alpha learnings', ac: 'Changelog documented; suggestion acceptance rate reviewed to inform the V2 engine', tags: ['moat', 'assistive'] },
  { id: 'E1.7', gate: 'E', title: 'Gate E verdict', ac: '5 external creators each completed a study and viewed a report; evidence in analytics', tags: [] },

  { id: 'F1.1', gate: 'F', title: 'Pricing page', ac: 'Free + Researcher (₦9,000 / $8) live; paywall capacity, never comprehension of collected data', tags: [] },
  { id: 'F1.2', gate: 'F', title: 'Paystack integration', ac: 'Subscription charge, receipt, cancel flow working in test + live', tags: ['ops'] },
  { id: 'F1.3', gate: 'F', title: 'Free tier limits enforced', ac: 'Study/simulation caps enforced with upgrade prompt', tags: [] },
  { id: 'F1.4', gate: 'F', title: 'Terms of Service published', ac: 'ToS + acceptable use live; lawyer-reviewed or template-verified', tags: ['legal'] },
  { id: 'F1.5', gate: 'F', title: 'First paying customer', ac: 'One real payment received and confirmed; who and why documented', tags: [] },
  { id: 'F1.6', gate: 'F', title: 'Gate F verdict + next-roadmap review', ac: 'Verdict memo; V1 parking lot (incl. Signal Stack v1 build) reviewed and re-prioritized', tags: [] }
];

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

const ALL_TASKS = [...GATE_TASKS, ...WORKSTREAM_TASKS];

// --- Section labels ---

const SECTION_BY_ID = (() => {
  const map = {};
  const set = (ids, label) => ids.forEach((id) => { map[id] = label; });
  set(['A1.1', 'A1.2', 'A1.3', 'A1.4', 'A1.5', 'A1.6'], 'Gate A, Section 1: Setup');
  set(['A2.1', 'A2.2', 'A2.3', 'A2.4', 'A2.5', 'A2.6', 'A2.7'], 'Gate A, Section 2: Runs');
  set(['A3.1', 'A3.2', 'A3.3'], 'Gate A, Section 3: Verdict');
  set(['B1.1', 'B1.2', 'B1.3', 'B1.4', 'B1.5', 'B1.6', 'B1.7'], 'Gate B: Calibration proof');
  set(['C1.1', 'C1.2', 'C1.3', 'C1.4', 'C1.5', 'C1.6'], 'Gate C, Section 1: Name and identity');
  set(['C2.1', 'C2.2', 'C2.3', 'C2.4', 'C2.5', 'C2.6'], 'Gate C, Section 2: Landing page + waitlist');
  set(['D1.1', 'D1.2', 'D1.3', 'D1.4', 'D1.5', 'D1.6'], 'Gate D, Section 1: Product definition freeze');
  set(['D2.1', 'D2.2', 'D2.3', 'D2.4', 'D2.5', 'D2.6'], 'Gate D, Section 2: Design');
  set(['D3.1', 'D3.2', 'D3.3', 'D3.4', 'D3.5', 'D3.6', 'D3.7', 'D3.8', 'D3.9', 'D3.10', 'D3.11'], 'Gate D, Section 3: Build');
  set(['D4.1', 'D4.2', 'D4.3', 'D4.4', 'D4.5'], 'Gate D, Section 4: Self-test (dogfood)');
  set(['E1.1', 'E1.2', 'E1.3', 'E1.4', 'E1.5', 'E1.6', 'E1.7'], 'Gate E: 5 external creators');
  set(['F1.1', 'F1.2', 'F1.3', 'F1.4', 'F1.5', 'F1.6'], 'Gate F: First payment');
  set(['W1.1', 'W1.2', 'W1.3', 'W1.4'], 'Workstream 1: Legal & Compliance');
  set(['W2.1', 'W2.2', 'W2.3', 'W2.4'], 'Workstream 2: Content & Community');
  set(['W3.1', 'W3.2', 'W3.3'], 'Workstream 3: Operations & Infrastructure');
  set(['W4.1', 'W4.2', 'W4.3', 'W4.4'], 'Workstream 4: Competitive Moat');
  return map;
})();

// --- Effort, dependencies, external blockers, reference (editorial layer --
// the source has no such fields; reasoned from task order, explicit
// cross-references in the AC text, and real-world sequencing) ---

const META = {
  'A1.1': { effort: 'Quick (~2-4 hrs)', dependsOn: [], reference: 'Concierge kit §1' },
  'A1.2': { effort: 'Quick (~1-2 hrs)', dependsOn: [] },
  'A1.3': { effort: 'Quick (~2-3 hrs to send; replies trickle in over days)', dependsOn: ['A1.1', 'A1.2'], reference: 'Concierge kit §4' },
  'A1.4': { effort: 'Medium (~1-2 days)', dependsOn: [] },
  'A1.5': { effort: 'Medium (~1 day)', dependsOn: [], reference: 'Concierge kit §3' },
  'A1.6': { effort: 'Quick (~1 hr)', dependsOn: [] },
  'A2.1': { effort: 'Medium (~1-2 days)', dependsOn: ['A1.4', 'A1.5', 'A1.6'], reference: 'Concierge kit §2' },
  'A2.2': { effort: 'Medium (~1-2 days)', dependsOn: ['A1.4', 'A1.5', 'A1.6'] },
  'A2.3': { effort: 'Medium (~1-2 days)', dependsOn: ['A1.3', 'A1.4', 'A1.5', 'A1.6'] },
  'A2.4': { effort: 'Medium (~1-2 days)', dependsOn: ['A1.3', 'A1.4', 'A1.5', 'A1.6'] },
  'A2.5': { effort: 'Medium (~1-2 days)', dependsOn: ['A1.3', 'A1.4', 'A1.5', 'A1.6'] },
  'A2.6': { effort: 'Medium (~spread across all external studies)', dependsOn: ['A2.3'] },
  'A2.7': { effort: 'Medium (~spread over the 10-14 day window)', dependsOn: ['A2.1', 'A2.2', 'A2.3', 'A2.4'] },
  'A3.1': { effort: 'Medium (~1 day)', dependsOn: ['A2.1', 'A2.2', 'A2.3', 'A2.4', 'A2.6', 'A2.7'], reference: 'Concierge kit §2' },
  'A3.2': { effort: 'Quick (~half day)', dependsOn: ['A3.1'], reference: 'Concierge kit §7' },
  'A3.3': { effort: 'Medium (~1 day)', dependsOn: ['A3.2'] },

  'B1.1': { effort: 'Quick (~1-2 hrs)', dependsOn: ['A3.2'] },
  'B1.2': { effort: 'Medium (~1 day incl. review)', dependsOn: ['B1.1'], externalBlocker: 'Awaiting lawyer contact (or verified template) review' },
  'B1.3': { effort: 'Medium (~2-3 days)', dependsOn: ['B1.2'] },
  'B1.4': { effort: 'Medium (~2-3 days)', dependsOn: ['B1.3'] },
  'B1.5': { effort: 'Medium (~1 day)', dependsOn: ['B1.1', 'B1.4'] },
  'B1.6': { effort: 'Quick (~half day)', dependsOn: ['B1.5'] },
  'B1.7': { effort: 'Quick (~1-2 hrs)', dependsOn: ['B1.6'] },

  'C1.1': { effort: 'Quick (~half day)', dependsOn: ['B1.6'] },
  'C1.2': { effort: 'Quick (~1-2 hrs)', dependsOn: ['C1.1'] },
  'C1.3': { effort: 'Quick (~2-3 hrs)', dependsOn: ['C1.1'] },
  'C1.4': { effort: 'Quick (~half day)', dependsOn: ['C1.1'] },
  'C1.5': { effort: 'Medium (~2-3 days)', dependsOn: ['C1.1'] },
  'C1.6': { effort: 'Quick (~2-3 hrs)', dependsOn: ['C1.5'] },
  'C2.1': { effort: 'Medium (~1 day)', dependsOn: ['C1.1'] },
  'C2.2': { effort: 'Medium (~2-3 days)', dependsOn: ['C2.1', 'C1.5'] },
  'C2.3': { effort: 'Medium (~2-3 days)', dependsOn: ['C2.2', 'C1.2'] },
  'C2.4': { effort: 'Quick (~half day)', dependsOn: ['C2.3'] },
  'C2.5': { effort: 'Quick (~few hrs)', dependsOn: ['C2.3'] },
  'C2.6': { effort: 'Major (~1-2 weeks to reach 50 signups)', dependsOn: ['C2.3', 'C2.4', 'C2.5'] },

  'D1.1': { effort: 'Medium (~1 day)', dependsOn: ['C2.6'] },
  'D1.2': { effort: 'Medium (~1-2 days)', dependsOn: ['D1.1'], reference: 'PRD §8.2' },
  'D1.3': { effort: 'Medium (~1 day)', dependsOn: ['D1.1'] },
  'D1.4': { effort: 'Medium (~1 day)', dependsOn: ['D1.1'] },
  'D1.5': { effort: 'Medium (~1-2 days)', dependsOn: ['D1.1'] },
  'D1.6': { effort: 'Medium (~1 day)', dependsOn: ['D1.1'] },
  'D2.1': { effort: 'Quick (~half day)', dependsOn: ['D1.2'] },
  'D2.2': { effort: 'Medium (~2 days)', dependsOn: ['D2.1'] },
  'D2.3': { effort: 'Medium (~2 days)', dependsOn: ['D1.5', 'D2.1'] },
  'D2.4': { effort: 'Major (~1 week)', dependsOn: ['D1.3', 'D1.6', 'D2.1'] },
  'D2.5': { effort: 'Major (~1 week)', dependsOn: ['D2.2', 'D2.3', 'D2.4'] },
  'D2.6': { effort: 'Medium (~2-3 days)', dependsOn: ['D2.5'] },
  'D3.1': { effort: 'Medium (~2-3 days)', dependsOn: ['D1.1'] },
  'D3.2': { effort: 'Medium (~2-3 days)', dependsOn: ['D3.1'] },
  'D3.3': { effort: 'Medium (~3 days)', dependsOn: ['D1.2', 'D3.1'] },
  'D3.4': { effort: 'Major (~1-2 weeks)', dependsOn: ['D3.3'] },
  'D3.5': { effort: 'Medium (~1-2 days)', dependsOn: ['D3.3'] },
  'D3.6': { effort: 'Major (~1-2 weeks)', dependsOn: ['D1.5', 'D3.3'] },
  'D3.7': { effort: 'Major (~1-2 weeks)', dependsOn: ['D3.4', 'D3.5', 'D3.6'] },
  'D3.8': { effort: 'Major (~1 week)', dependsOn: ['D1.3', 'D1.6', 'D3.7'] },
  'D3.9': { effort: 'Medium (~2 days)', dependsOn: ['D3.8'] },
  'D3.10': { effort: 'Medium (~2-3 days)', dependsOn: ['D3.6', 'D3.7'] },
  'D3.11': { effort: 'Quick (~1 day)', dependsOn: ['D3.7'] },
  'D4.1': { effort: 'Medium (~1-2 days)', dependsOn: ['D2.6', 'D3.8', 'D3.9'] },
  'D4.2': { effort: 'Quick (~half day)', dependsOn: ['D4.1', 'A3.1'] },
  'D4.3': { effort: 'Quick (~half day)', dependsOn: ['D4.1'] },
  'D4.4': { effort: 'Quick (~few hrs)', dependsOn: ['D4.1'] },
  'D4.5': { effort: 'Quick (~half day)', dependsOn: ['D4.2', 'D4.3', 'D4.4'] },

  'E1.1': { effort: 'Medium (~3-5 days)', dependsOn: ['D4.5', 'C2.6'] },
  'E1.2': { effort: 'Medium (~2-3 days)', dependsOn: ['D4.5'] },
  'E1.3': { effort: 'Medium (~1-2 days)', dependsOn: ['D4.5'] },
  'E1.4': { effort: 'Medium (~1-2 days to set up, then ongoing)', dependsOn: ['E1.2'] },
  'E1.5': { effort: 'Major (~1+ week, ongoing across the alpha)', dependsOn: ['E1.1', 'E1.2'] },
  'E1.6': { effort: 'Medium (~1-2 days)', dependsOn: ['E1.4', 'E1.3'] },
  'E1.7': { effort: 'Quick (~half day)', dependsOn: ['E1.1', 'E1.2', 'E1.5'] },

  'F1.1': { effort: 'Quick (~1 day)', dependsOn: ['E1.7'] },
  'F1.2': { effort: 'Medium (~2-3 days incl. test+live)', dependsOn: ['F1.1'] },
  'F1.3': { effort: 'Medium (~1-2 days)', dependsOn: ['F1.1'] },
  'F1.4': { effort: 'Quick (~few hrs incl. review)', dependsOn: ['F1.1'], externalBlocker: 'Awaiting lawyer review (or verified template) before publishing' },
  'F1.5': { effort: 'Medium (~conversion effort, not just paperwork)', dependsOn: ['F1.2', 'F1.3', 'F1.4'] },
  'F1.6': { effort: 'Medium (~1 day)', dependsOn: ['F1.5'] },

  'W1.1': { effort: 'Medium (~2-3 days incl. filing)', dependsOn: ['C1.1'], externalBlocker: 'Awaiting CAC registration processing once filed' },
  'W1.2': { effort: 'Medium (~2-3 days, multi-part)', dependsOn: [] },
  'W1.3': { effort: 'Medium (~1-2 days per agreement)', dependsOn: ['D3.1'], externalBlocker: 'Awaiting sub-processor DPA templates/signatures (Anthropic, hosting, email, analytics)' },
  'W1.4': { effort: 'Quick (~few hrs to file)', dependsOn: ['C1.3'], externalBlocker: 'Awaiting trademark office filing/processing' },
  'W2.1': { effort: 'Medium (~1-2 days)', dependsOn: [], externalBlocker: 'Parked -- awaiting explicit go-ahead to draft', reference: 'Concierge kit §6' },
  'W2.2': { effort: 'Medium (~1-2 days)', dependsOn: ['B1.6'], externalBlocker: 'Not started -- slotted after Gate B calibration proof' },
  'W2.3': { effort: 'Medium (~1-2 days)', dependsOn: [] },
  'W2.4': { effort: 'Quick (~1-2 hrs per weekly touchpoint, ongoing)', dependsOn: [] },
  'W3.1': { effort: 'Quick (~half day)', dependsOn: [], reference: 'Playbook §8.1' },
  'W3.2': { effort: 'Quick (~few hrs to set up, then monthly)', dependsOn: [] },
  'W3.3': { effort: 'Quick (~few hrs, then monthly review)', dependsOn: [] },
  'W4.1': { effort: 'Quick (~half day)', dependsOn: ['B1.7'] },
  'W4.2': { effort: 'Medium (~1 day, design only)', dependsOn: [] },
  'W4.3': { effort: 'Medium (~1-2 days)', dependsOn: ['E1.6'] },
  'W4.4': { effort: 'Quick (~few hrs per quarterly review, ongoing)', dependsOn: [] }
};

// --- Derived: reverse the dependsOn graph into "blocks" ---

const BLOCKS_BY_ID = {};
for (const id of Object.keys(META)) BLOCKS_BY_ID[id] = [];
for (const [id, meta] of Object.entries(META)) {
  for (const dep of meta.dependsOn) {
    if (!BLOCKS_BY_ID[dep]) BLOCKS_BY_ID[dep] = [];
    BLOCKS_BY_ID[dep].push(id);
  }
}

function priorityLabel(dbPriority) {
  if (dbPriority === 'HIGH') return 'Critical (gate-blocking)';
  if (dbPriority === 'LOW') return 'Optional (stretch)';
  return 'High (core path)'; // MID and fallback
}

function formatDate(d) {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(d);
}

function buildComment(def, dbTask, gate) {
  const meta = META[def.id];
  const section = SECTION_BY_ID[def.id];
  const blocks = BLOCKS_BY_ID[def.id] || [];
  const tagsLine = def.tags.length ? def.tags.join(', ') : 'None';
  const dependsLine = meta.dependsOn.length ? `Blocked by: ${meta.dependsOn.join(', ')}` : 'Blocked by: None (independent)';
  const blocksLine = blocks.length ? `Blocks: ${blocks.join(', ')}` : 'Blocks: None';
  const externalLine = meta.externalBlocker || 'None';

  let gateStatusLine;
  if (gate) {
    gateStatusLine = gate.status === 'CLOSED'
      ? `Gate ${def.gate}: Closed · ${formatDate(gate.closedAt)}`
      : `Gate ${def.gate}: Open`;
  } else {
    gateStatusLine = 'Not gate-blocked (parallel workstream)';
  }

  const lines = [
    `[${section}]`,
    '',
    `Acceptance Criteria: ${def.ac}`,
    '',
    `Effort: ${meta.effort}`,
    `Priority: ${priorityLabel(dbTask.priority)}`,
    '',
    dependsLine,
    blocksLine,
    '',
    `Tags: ${tagsLine}`,
    '',
    `External blockers: ${externalLine}`,
    '',
    `Gate status: ${gateStatusLine}`
  ];
  if (meta.reference) {
    lines.push('', `Reference: ${meta.reference}`);
  }
  return lines.join('\n');
}

async function main() {
  const project = await prisma.project.findFirst({
    where: { title: 'Valideity', deletedAt: null },
    include: { owner: true }
  });
  if (!project) throw new Error('Valideity project not found -- nothing to update.');

  const roadmap = await prisma.roadmap.findUnique({ where: { projectId: project.id } });
  const gates = roadmap
    ? await prisma.gate.findMany({ where: { roadmapId: roadmap.id, deletedAt: null } })
    : [];
  const gateByCode = {};
  for (const g of gates) gateByCode[g.name[0]] = g;

  const tasks = await prisma.task.findMany({ where: { projectId: project.id, deletedAt: null } });
  const taskByShortId = {};
  for (const t of tasks) {
    const shortId = t.title.split(' ')[0];
    taskByShortId[shortId] = t;
  }

  let updated = 0;
  const missing = [];
  for (const def of ALL_TASKS) {
    const dbTask = taskByShortId[def.id];
    if (!dbTask) { missing.push(def.id); continue; }
    const gate = def.gate ? gateByCode[def.gate] : null;
    const comment = buildComment(def, dbTask, gate);
    await prisma.task.update({ where: { id: dbTask.id }, data: { comment } });
    updated++;
  }

  console.log(`Updated ${updated}/${ALL_TASKS.length} task comments.`);
  if (missing.length) console.log(`Missing (not found in DB): ${missing.join(', ')}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
