// customId scheme (mirrors Valideity's hand-authored IDs, e.g. A1.1, D3.11):
//   gated task  -> <GateLetter>1.<n>   e.g. A1.7, F1.2
//   unscheduled -> <n>                 e.g. 7, 12
//
// Valideity's seed data groups tasks into multiple numbered clusters per
// gate (A1.x, A2.x, A3.x...) reflecting hand-authored theming that has no
// equivalent concept anywhere in the running app. Auto-generated tasks have
// no cluster to belong to, so they all land in a single "1" bucket per
// gate, continuing that gate's own numbering rather than inventing a new
// axis. Unscheduled tasks get a bare number with no letter prefix, which
// can never collide with a gate-based id (those always start with a
// letter) regardless of how many gates a project has.
//
// Both namespaces are scoped per project via the existing
// @@unique([projectId, customId]) constraint.

export function gateLetter(order) {
  return String.fromCharCode(65 + ((order ?? 0) % 26));
}

// Pure -- no DB access, so it's directly unit-testable. `existingIds` is
// every non-null customId already in the project; `gateOrder` is the
// target gate's `order` field, or null/undefined for Unscheduled.
export function computeNextCustomId(existingIds, gateOrder) {
  const isGated = gateOrder !== null && gateOrder !== undefined;
  const pattern = isGated ? new RegExp(`^${gateLetter(gateOrder)}1\\.(\\d+)$`) : /^(\d+)$/;
  let max = 0;
  for (const id of existingIds) {
    const match = typeof id === 'string' ? id.match(pattern) : null;
    if (match) max = Math.max(max, Number(match[1]));
  }
  const seq = max + 1;
  return isGated ? `${gateLetter(gateOrder)}1.${seq}` : String(seq);
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
