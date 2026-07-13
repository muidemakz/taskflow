import { describe, it, expect } from 'vitest';
import { nextGateFor, partitionByCompletion, planGateClose } from '../src/lib/rollover.js';

const gates = [
  { id: 'g1', order: 0 },
  { id: 'g2', order: 1 },
  { id: 'g3', order: 2 }
];

describe('nextGateFor', () => {
  it('returns the next gate by order', () => {
    expect(nextGateFor(gates, 'g1').id).toBe('g2');
    expect(nextGateFor(gates, 'g2').id).toBe('g3');
  });

  it('returns null when the current gate is last', () => {
    expect(nextGateFor(gates, 'g3')).toBeNull();
  });

  it('is order-independent in the input array', () => {
    const shuffled = [gates[2], gates[0], gates[1]];
    expect(nextGateFor(shuffled, 'g1').id).toBe('g2');
  });

  it('throws if the current gate is not found', () => {
    expect(() => nextGateFor(gates, 'missing')).toThrow();
  });
});

describe('partitionByCompletion', () => {
  it('splits tasks by the project-specific done status id, not a hardcoded value', () => {
    const tasks = [
      { id: 't1', statusId: 'done-id' },
      { id: 't2', statusId: 'todo-id' },
      { id: 't3', statusId: 'done-id' }
    ];
    const { incomplete, complete } = partitionByCompletion(tasks, 'done-id');
    expect(complete.map((t) => t.id)).toEqual(['t1', 't3']);
    expect(incomplete.map((t) => t.id)).toEqual(['t2']);
  });
});

describe('planGateClose', () => {
  const doneStatusId = 'done-id';
  const baseArgs = { gates, currentGateId: 'g1', doneStatusId };

  it('closes cleanly with no rollover needed when every task is done', () => {
    const plan = planGateClose({
      ...baseArgs,
      rolloverMode: 'AUTOMATIC',
      tasksInGate: [{ id: 't1', statusId: doneStatusId }],
      confirmed: false
    });
    expect(plan.action).toBe('CLOSED_NO_ROLLOVER_NEEDED');
    expect(plan.incomplete).toHaveLength(0);
  });

  it('reports NO_NEXT_GATE when closing the last gate with incomplete tasks', () => {
    const plan = planGateClose({
      gates,
      currentGateId: 'g3',
      doneStatusId,
      rolloverMode: 'AUTOMATIC',
      tasksInGate: [{ id: 't1', statusId: 'todo-id' }],
      confirmed: false
    });
    expect(plan.action).toBe('NO_NEXT_GATE');
    expect(plan.incomplete).toHaveLength(1);
    expect(plan.nextGate).toBeNull();
  });

  it('ASK_FIRST without confirmation returns NEEDS_CONFIRMATION and does not roll', () => {
    const plan = planGateClose({
      ...baseArgs,
      rolloverMode: 'ASK_FIRST',
      tasksInGate: [{ id: 't1', statusId: 'todo-id' }],
      confirmed: false
    });
    expect(plan.action).toBe('NEEDS_CONFIRMATION');
    expect(plan.nextGate.id).toBe('g2');
  });

  it('ASK_FIRST with confirmation rolls to the next gate', () => {
    const plan = planGateClose({
      ...baseArgs,
      rolloverMode: 'ASK_FIRST',
      tasksInGate: [{ id: 't1', statusId: 'todo-id' }],
      confirmed: true
    });
    expect(plan.action).toBe('ROLL_TO_NEXT_GATE');
    expect(plan.incomplete.map((t) => t.id)).toEqual(['t1']);
  });

  it('AUTOMATIC rolls immediately regardless of confirmation', () => {
    const plan = planGateClose({
      ...baseArgs,
      rolloverMode: 'AUTOMATIC',
      tasksInGate: [{ id: 't1', statusId: 'todo-id' }],
      confirmed: false
    });
    expect(plan.action).toBe('ROLL_TO_NEXT_GATE');
  });

  it('never rolls complete tasks along with incomplete ones', () => {
    const plan = planGateClose({
      ...baseArgs,
      rolloverMode: 'AUTOMATIC',
      tasksInGate: [
        { id: 'done-task', statusId: doneStatusId },
        { id: 'todo-task', statusId: 'todo-id' }
      ],
      confirmed: false
    });
    expect(plan.action).toBe('ROLL_TO_NEXT_GATE');
    expect(plan.incomplete.map((t) => t.id)).toEqual(['todo-task']);
    expect(plan.complete.map((t) => t.id)).toEqual(['done-task']);
  });
});
