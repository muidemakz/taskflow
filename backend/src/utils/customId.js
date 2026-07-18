// TID (customId column) scheme -- ONE shape, always a letter, never a bare
// number (mirrors Valideity's hand-authored IDs, e.g. A1.1, D3.11):
//   gated task  -> <GateLetter>1.<n>   e.g. A1.7, F1.2
//   unscheduled -> U1.<n>              e.g. U1.7, U1.12
//
// Valideity's seed data groups tasks into multiple numbered clusters per
// gate (A1.x, A2.x, A3.x...) reflecting hand-authored theming that has no
// equivalent concept anywhere in the running app. Auto-generated tasks have
// no cluster to belong to, so they all land in a single "1" bucket per
// gate/letter, continuing that gate's own numbering rather than inventing a
// new axis. Unscheduled tasks use the reserved letter "U" as their gate
// letter, so the exact same <Letter>1.<n> pattern and per-letter max-scan
// covers both cases with no separate bare-numeric branch.
//
// FROZEN AT CREATION: a TID never changes once assigned -- not on gate
// assignment, not on a later gate move, not on rollover, not on gate
// closure, not on reorder, not on a move back to Unscheduled. There is no
// promotion/renumbering logic anywhere in this file, deliberately -- see
// the "never renumbers on its own" test in customId.test.js.
//
// Both a gate's letter and "U" are scoped per project via the existing
// @@unique([projectId, customId]) constraint. gateLetter() intentionally
// matches the frontend's existing gate-letter display (GateDetailCard.jsx,
// ProjectBoard.jsx breadcrumb: `String.fromCharCode(65 + order)`) so a
// gate's TID prefix always matches its displayed letter -- a project's 21st
// gate (order 20) would display as "U" and collide with Unscheduled's
// reserved letter, but no project in practice has anywhere near 21 gates,
// and diverging from the display letter to dodge that would create a worse,
// permanent mismatch between what a gate is labeled and what its tasks'
// TIDs say. Not handled; flagged here rather than silently patched over.

const UNSCHEDULED_LETTER = 'U';

export function gateLetter(order) {
  return String.fromCharCode(65 + ((order ?? 0) % 26));
}

// Pure -- no DB access, so it's directly unit-testable. `existingIds` is
// every non-null customId already in the project; `gateOrder` is the
// target gate's `order` field, or null/undefined for Unscheduled.
export function computeNextCustomId(existingIds, gateOrder) {
  const isGated = gateOrder !== null && gateOrder !== undefined;
  const letter = isGated ? gateLetter(gateOrder) : UNSCHEDULED_LETTER;
  const pattern = new RegExp(`^${letter}1\\.(\\d+)$`);
  let max = 0;
  for (const id of existingIds) {
    const match = typeof id === 'string' ? id.match(pattern) : null;
    if (match) max = Math.max(max, Number(match[1]));
  }
  const seq = max + 1;
  return `${letter}1.${seq}`;
}

// gate is the full Gate row (needs .order), or null/undefined for Unscheduled.
export async function generateCustomId(prismaClient, projectId, gate) {
  const rows = await prismaClient.task.findMany({
    where: { projectId, customId: { not: null } },
    select: { customId: true }
  });
  return computeNextCustomId(rows.map((r) => r.customId), gate?.order);
}

// Wraps task creation with customId generation + retry-on-collision. `data`
// is the full Prisma create payload minus customId; `gate` is the full Gate
// row (or null) the task is landing in, used to pick the id format. Retries
// with a freshly-computed id on a unique-constraint hit -- extremely
// unlikely in this single-user app, but cheap to handle correctly rather
// than assume away.
export async function createTaskWithCustomId(prismaClient, projectId, gate, data) {
  const MAX_ATTEMPTS = 20;
  let lastError;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const customId = await generateCustomId(prismaClient, projectId, gate);
    try {
      return await prismaClient.task.create({ data: { ...data, customId } });
    } catch (error) {
      if (error.code === 'P2002') {
        lastError = error;
        continue;
      }
      throw error;
    }
  }
  throw lastError || new Error(`Could not generate a unique customId for project ${projectId}`);
}
