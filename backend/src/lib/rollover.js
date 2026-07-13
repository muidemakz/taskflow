// Pure functions, deliberately decoupled from Prisma calls so they're unit
// testable without a live database. Gate rollover and the countsAsDone
// invariant are the two places a bug would silently corrupt progress
// numbers, per the audit -- keeping the decision logic pure and isolated
// is what makes them actually testable.

// Given a project's gates (any order) and the id of the gate being closed,
// returns the next gate (by `order`) to roll incomplete tasks into, or
// null if the closed gate is the last one.
export function nextGateFor(gates, currentGateId) {
  const sorted = [...gates].sort((a, b) => a.order - b.order);
  const idx = sorted.findIndex((g) => g.id === currentGateId);
  if (idx === -1) throw new Error('currentGateId not found among gates');
  return sorted[idx + 1] || null;
}

// Splits a gate's tasks into complete/incomplete using the project's
// countsAsDone status id -- not a hardcoded 'DONE' string, since which
// Status counts as done is per-project configuration.
export function partitionByCompletion(tasks, doneStatusId) {
  const incomplete = tasks.filter((t) => t.statusId !== doneStatusId);
  const complete = tasks.filter((t) => t.statusId === doneStatusId);
  return { incomplete, complete };
}

// Decides what "close gate" should actually do, given the project's
// rolloverMode. Returns a plan object the route handler executes -- this
// function never touches the database, it only decides.
export function planGateClose({ rolloverMode, gates, currentGateId, tasksInGate, doneStatusId, confirmed }) {
  const { incomplete, complete } = partitionByCompletion(tasksInGate, doneStatusId);
  const nextGate = nextGateFor(gates, currentGateId);

  if (incomplete.length === 0) {
    return { action: 'CLOSED_NO_ROLLOVER_NEEDED', incomplete: [], complete, nextGate };
  }

  if (!nextGate) {
    // Last gate: nothing to roll into. Incomplete tasks stay put -- the
    // route layer surfaces this so the frontend can tell the user there's
    // no further gate to move them to.
    return { action: 'NO_NEXT_GATE', incomplete, complete, nextGate: null };
  }

  if (rolloverMode === 'ASK_FIRST' && !confirmed) {
    return { action: 'NEEDS_CONFIRMATION', incomplete, complete, nextGate };
  }

  return { action: 'ROLL_TO_NEXT_GATE', incomplete, complete, nextGate };
}
