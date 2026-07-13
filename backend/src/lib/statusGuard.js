// Pure logic for the "at most one countsAsDone = true per project"
// invariant. The database backs this with a partial unique index
// (belt-and-suspenders), but the application is the primary enforcement
// point since Postgres has no clean native "exactly one true" constraint.

// Given a project's existing statuses and a proposed countsAsDone value for
// one of them (targetStatusId may be a not-yet-created status, e.g. null
// during creation), returns which existing status ids must be flipped to
// false to keep "at most one true" valid.
export function resolveCountsAsDoneChange(existingStatuses, targetStatusId, nextValue) {
  if (!nextValue) return { toFalse: [] };
  const toFalse = existingStatuses
    .filter((s) => s.id !== targetStatusId && s.countsAsDone)
    .map((s) => s.id);
  return { toFalse };
}

// Guards against ending up with zero countsAsDone statuses in a project
// (e.g. demoting the only true one without another becoming true in the
// same request). Returns an error message, or null if the change is safe.
export function validateCountsAsDoneInvariant(existingStatuses, targetStatusId, nextValue) {
  if (nextValue) return null;
  const otherTrue = existingStatuses.some((s) => s.id !== targetStatusId && s.countsAsDone);
  const targetWasTrue = existingStatuses.some((s) => s.id === targetStatusId && s.countsAsDone);
  if (targetWasTrue && !otherTrue) {
    return 'Cannot unset the only counts-as-done status for this project -- set another status as counts-as-done first.';
  }
  return null;
}
