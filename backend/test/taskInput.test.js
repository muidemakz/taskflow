import { describe, it, expect } from 'vitest';
import { CUSTOM_ID_MAX_LENGTH, normalizeTaskInput, taskInputError } from '../src/utils/project.js';

describe('taskInputError', () => {
  it('rejects a customId longer than the cap', () => {
    expect(taskInputError({ customId: 'X'.repeat(CUSTOM_ID_MAX_LENGTH + 1) })).toMatch(/20 characters/);
  });

  it('accepts a customId at exactly the cap', () => {
    expect(taskInputError({ customId: 'X'.repeat(CUSTOM_ID_MAX_LENGTH) })).toBeNull();
  });

  it('ignores requests that do not touch customId', () => {
    expect(taskInputError({ title: 'X'.repeat(500) })).toBeNull();
  });

  it('measures the trimmed value, not raw padding', () => {
    expect(taskInputError({ customId: `  ${'X'.repeat(CUSTOM_ID_MAX_LENGTH)}  ` })).toBeNull();
  });
});

describe('normalizeTaskInput customId handling', () => {
  it('trims and keeps a valid customId', () => {
    expect(normalizeTaskInput({ customId: ' A1.1 ' }).customId).toBe('A1.1');
  });

  it('clears customId back to null on empty string', () => {
    expect(normalizeTaskInput({ customId: '  ' }).customId).toBeNull();
  });

  it('leaves customId untouched when absent', () => {
    expect('customId' in normalizeTaskInput({ title: 'hi' })).toBe(false);
  });
});
