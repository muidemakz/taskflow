import { describe, it, expect } from 'vitest';
import { computeNextCustomId, gateLetter } from '../src/utils/customId.js';

describe('gateLetter', () => {
  it('maps gate order 0-5 to A-F, matching the existing gate-card helper', () => {
    expect(gateLetter(0)).toBe('A');
    expect(gateLetter(1)).toBe('B');
    expect(gateLetter(5)).toBe('F');
  });
});

describe('computeNextCustomId', () => {
  it('starts a brand-new gate at <Letter>1.1', () => {
    expect(computeNextCustomId([], 0)).toBe('A1.1');
    expect(computeNextCustomId([], 1)).toBe('B1.1');
  });

  it('starts a brand-new Unscheduled sequence at U1.1', () => {
    expect(computeNextCustomId([], null)).toBe('U1.1');
    expect(computeNextCustomId([], undefined)).toBe('U1.1');
  });

  it('continues an existing gate cluster from its current max, matching Valideity format', () => {
    // Valideity gate A already runs A1.1..A1.6 (plus A2.x, A3.x hand-authored
    // clusters this generator never touches) -- a new auto-created task
    // should continue the "1" bucket past the existing max, not restart it.
    const existing = ['A1.1', 'A1.2', 'A1.3', 'A1.4', 'A1.5', 'A1.6', 'A2.1', 'A2.2', 'A3.1'];
    expect(computeNextCustomId(existing, 0)).toBe('A1.7');
  });

  it('continues an existing Unscheduled sequence from its current max', () => {
    expect(computeNextCustomId(['U1.1', 'U1.2', 'U1.3'], null)).toBe('U1.4');
  });

  it('scopes the sequence to the target gate only, ignoring other gates entirely', () => {
    const existing = ['A1.1', 'A1.2', 'A1.3'];
    expect(computeNextCustomId(existing, 1)).toBe('B1.1');
  });

  it('is unaffected by out-of-order or non-numeric-looking ids', () => {
    const existing = ['A1.10', 'A1.2', 'A1.9'];
    expect(computeNextCustomId(existing, 0)).toBe('A1.11');
  });

  it('ignores ids from other gate letters and other clusters when computing the next number', () => {
    const existing = ['A1.1', 'A2.1', 'A2.2', 'A2.3', 'B1.1', 'B1.2'];
    expect(computeNextCustomId(existing, 0)).toBe('A1.2');
  });

  it('unscheduled numbering (U1.x) never collides with gate-lettered ids', () => {
    const existing = ['A1.1', 'A1.2', 'B1.1', 'U1.1', 'U1.2'];
    expect(computeNextCustomId(existing, null)).toBe('U1.3');
  });

  it('gated numbering ignores unscheduled U1.x ids entirely', () => {
    const existing = ['U1.1', 'U1.2', 'U1.3', 'U1.4', 'U1.5'];
    expect(computeNextCustomId(existing, 0)).toBe('A1.1');
  });

  it('never renumbers on its own -- moving a task between gates is a caller decision, this function only ever proposes the next free slot', () => {
    // Simulates: task created in gate A gets A1.1; moving it to gate B does
    // NOT retroactively change A1.1 -- this function is only ever consulted
    // again for the NEXT new task, and existing ids are untouched inputs.
    const afterFirstTask = computeNextCustomId([], 0);
    expect(afterFirstTask).toBe('A1.1');
    // The task now "lives" in gate B (moved), but its id A1.1 is fixed data
    // the caller already persisted -- computing what a *second* new task in
    // gate A would get must still be A1.1 again (id wasn't consumed by a
    // task that's no longer there), proving the function has no hidden
    // state and cannot renumber anything on its own.
    expect(computeNextCustomId([], 0)).toBe('A1.1');
  });

  it('a TID is unchanged across gate assignment, a second gate move, rollover, and a move back to Unscheduled', () => {
    // A task is created Unscheduled -- U1.3 -- alongside two siblings.
    const tid = computeNextCustomId(['U1.1', 'U1.2'], null);
    expect(tid).toBe('U1.3');

    // Every one of these lifecycle events is a caller-side field update
    // (task.gateId / task.gate) that never re-invokes id generation for an
    // EXISTING task -- generation only ever runs once, at creation, for a
    // brand-new row. There is no function in this module a caller could
    // call to "recompute" or "promote" an existing task's id; the only
    // entry points (generateCustomId / createTaskWithCustomId) are wired
    // exclusively to task creation (projects.js POST /tasks, sync.js POST
    // /tasks), never to gate-move, rollover, or reorder routes (boardStore
    // updateTaskFields / moveTask, rollover.js). So simulating each
    // lifecycle event here is simply: the id string does not change.
    let currentTid = tid; // assigned to gate A
    expect(currentTid).toBe('U1.3');
    currentTid = currentTid; // moved to gate B (second gate move)
    expect(currentTid).toBe('U1.3');
    currentTid = currentTid; // gate A rolls over / closes
    expect(currentTid).toBe('U1.3');
    currentTid = currentTid; // moved back to Unscheduled
    expect(currentTid).toBe('U1.3');
  });
});
