import { describe, it, expect } from 'vitest';
import { validateGateImportRows } from '../src/lib/gateImport.js';

describe('validateGateImportRows', () => {
  it('accepts valid rows and normalizes them, sorted by order', () => {
    const { errors, validRows } = validateGateImportRows([
      { gate_name: 'Beta', order: '2', description: 'Second gate' },
      { gate_name: 'Alpha', order: 1, description: '' }
    ]);
    expect(errors).toHaveLength(0);
    expect(validRows.map((r) => r.name)).toEqual(['Alpha', 'Beta']);
    expect(validRows[1].description).toBe('Second gate');
    expect(validRows[0].description).toBeNull();
  });

  it('rejects a missing gate_name', () => {
    const { errors, validRows } = validateGateImportRows([{ gate_name: '  ', order: 1 }]);
    expect(errors).toEqual(['Row 1: gate_name is required']);
    expect(validRows).toHaveLength(0);
  });

  it('rejects a non-integer order', () => {
    const { errors } = validateGateImportRows([{ gate_name: 'Alpha', order: 'not-a-number' }]);
    expect(errors).toEqual(['Row 1: order must be an integer']);
  });

  it('rejects duplicate gate_name within the batch, case-insensitively', () => {
    const { errors } = validateGateImportRows([
      { gate_name: 'Alpha', order: 1 },
      { gate_name: 'alpha', order: 2 }
    ]);
    expect(errors).toEqual(['Row 2: duplicate gate_name "alpha"']);
  });

  it('rejects duplicate order within the batch', () => {
    const { errors } = validateGateImportRows([
      { gate_name: 'Alpha', order: 1 },
      { gate_name: 'Beta', order: 1 }
    ]);
    expect(errors).toEqual(['Row 2: duplicate order 1']);
  });

  it('returns no validRows at all when any row fails validation', () => {
    const { errors, validRows } = validateGateImportRows([
      { gate_name: 'Alpha', order: 1 },
      { gate_name: '', order: 2 }
    ]);
    expect(errors).toHaveLength(1);
    expect(validRows).toHaveLength(0);
  });
});
