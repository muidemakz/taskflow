// Float positions let a task be inserted between two existing ones without
// renumbering the whole column on every move.
const STEP = 1000;

export function appendPosition(maxPosition) {
  return (maxPosition ?? 0) + STEP;
}

export function insertBetween(before, after) {
  if (before == null && after == null) return STEP;
  if (before == null) return after / 2;
  if (after == null) return before + STEP;
  return (before + after) / 2;
}
