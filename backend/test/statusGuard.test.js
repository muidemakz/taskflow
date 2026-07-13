import { describe, it, expect } from 'vitest';
import { resolveCountsAsDoneChange, validateCountsAsDoneInvariant } from '../src/lib/statusGuard.js';

const threeStatuses = [
  { id: 's1', countsAsDone: false },
  { id: 's2', countsAsDone: false },
  { id: 's3', countsAsDone: true }
];

describe('resolveCountsAsDoneChange', () => {
  it('flips every other true status to false when promoting a new one to true', () => {
    const { toFalse } = resolveCountsAsDoneChange(threeStatuses, 's1', true);
    expect(toFalse).toEqual(['s3']);
  });

  it('flips nothing when demoting to false', () => {
    const { toFalse } = resolveCountsAsDoneChange(threeStatuses, 's3', false);
    expect(toFalse).toEqual([]);
  });

  it('flips nothing when the target is already the only true one being re-set true', () => {
    const { toFalse } = resolveCountsAsDoneChange(threeStatuses, 's3', true);
    expect(toFalse).toEqual([]);
  });

  it('works for a not-yet-created status (targetStatusId null) during creation', () => {
    const { toFalse } = resolveCountsAsDoneChange(threeStatuses, null, true);
    expect(toFalse).toEqual(['s3']);
  });
});

describe('validateCountsAsDoneInvariant', () => {
  it('rejects demoting the only true status with nothing else true', () => {
    const single = [{ id: 's1', countsAsDone: true }, { id: 's2', countsAsDone: false }];
    const error = validateCountsAsDoneInvariant(single, 's1', false);
    expect(error).toMatch(/only counts-as-done status/i);
  });

  it('allows demoting when another status is already true', () => {
    // A transitional state with two true statuses at once shouldn't occur
    // in practice (the guard is what prevents it), but the invariant check
    // itself must still behave correctly if it's ever reached.
    const twoTrue = [{ id: 's1', countsAsDone: true }, { id: 's2', countsAsDone: true }];
    const error = validateCountsAsDoneInvariant(twoTrue, 's1', false);
    expect(error).toBeNull();
  });

  it('never blocks promoting a status to true', () => {
    expect(validateCountsAsDoneInvariant(threeStatuses, 's1', true)).toBeNull();
  });

  it('allows demoting a status that was never true in the first place', () => {
    expect(validateCountsAsDoneInvariant(threeStatuses, 's1', false)).toBeNull();
  });
});
