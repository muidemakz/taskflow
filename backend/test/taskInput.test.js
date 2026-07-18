import { describe, it, expect } from 'vitest';
import { normalizeTaskInput } from '../src/utils/project.js';

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
