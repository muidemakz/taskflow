import { describe, it, expect } from 'vitest';
import { normalizeTaskInput, taskCounts } from '../src/utils/project.js';

describe('normalizeTaskInput customId immutability', () => {
  // TID (customId) is generated once at creation (utils/customId.js) and
  // frozen forever after -- this route must never let a client set or
  // overwrite it, so normalizeTaskInput drops it unconditionally regardless
  // of what the request body contains.
  it('never includes customId in the patch, even when the request body sets one', () => {
    expect('customId' in normalizeTaskInput({ customId: 'A1.1' })).toBe(false);
  });

  it('never includes customId when the request tries to clear it', () => {
    expect('customId' in normalizeTaskInput({ customId: '' })).toBe(false);
  });

  it('still normalizes other fields normally alongside an ignored customId', () => {
    const patch = normalizeTaskInput({ title: ' hi ', customId: 'A1.1' });
    expect(patch.title).toBe('hi');
    expect('customId' in patch).toBe(false);
  });
});

describe('taskCounts derives "done" from statusId, not the legacy status column', () => {
  const DONE = 'status-done';
  const BACKLOG = 'status-backlog';
  const statuses = [
    { id: BACKLOG, countsAsDone: false },
    { id: DONE, countsAsDone: true }
  ];

  it('counts a task as done when its real statusId maps to countsAsDone, even if legacy status still says TODO', () => {
    // This is exactly the drift found in production/staging: the board
    // only ever writes statusId, never the legacy column, so a task moved
    // to a Done-equivalent status keeps status: 'TODO' forever.
    const project = { statuses, tasks: [{ id: 't1', status: 'TODO', statusId: DONE }], groups: [] };
    expect(taskCounts(project)).toEqual({ total: 1, done: 1, pct: 100 });
  });

  it('does not count a task as done just because legacy status says DONE, if its real status does not counts-as-done', () => {
    const project = { statuses, tasks: [{ id: 't1', status: 'DONE', statusId: BACKLOG }], groups: [] };
    expect(taskCounts(project)).toEqual({ total: 1, done: 0, pct: 0 });
  });

  it('counts tasks inside groups the same way as ungrouped tasks', () => {
    const project = {
      statuses,
      tasks: [{ id: 't1', status: 'TODO', statusId: DONE }],
      groups: [{ id: 'g1', tasks: [{ id: 't2', status: 'TODO', statusId: DONE }, { id: 't3', status: 'TODO', statusId: BACKLOG }] }]
    };
    expect(taskCounts(project)).toEqual({ total: 3, done: 2, pct: 67 });
  });

  it('treats a task with no statusId as not done, without throwing', () => {
    const project = { statuses, tasks: [{ id: 't1', status: 'DONE', statusId: null }], groups: [] };
    expect(taskCounts(project)).toEqual({ total: 1, done: 0, pct: 0 });
  });

  it('does not throw when project.statuses is missing entirely', () => {
    const project = { tasks: [{ id: 't1', status: 'DONE', statusId: DONE }], groups: [] };
    expect(taskCounts(project)).toEqual({ total: 1, done: 0, pct: 0 });
  });
});
