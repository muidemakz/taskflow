import { describe, it, expect } from 'vitest';
import { resolveCategoryDeletion } from '../src/lib/docCategoryDeletion.js';

describe('resolveCategoryDeletion', () => {
  it('asks for resolution when the category has docs and no mode was given', () => {
    const decision = resolveCategoryDeletion({ affectedDocs: [{ id: 'd1', title: 'Doc' }], mode: undefined });
    expect(decision).toEqual({ needsResolution: true });
  });

  it('deletes cleanly with uncategorize when there are no affected docs, even with no mode', () => {
    const decision = resolveCategoryDeletion({ affectedDocs: [], mode: undefined });
    expect(decision).toEqual({ action: 'uncategorize' });
  });

  it('an explicit uncategorize mode always proceeds, even with affected docs', () => {
    const decision = resolveCategoryDeletion({ affectedDocs: [{ id: 'd1' }], mode: 'uncategorize' });
    expect(decision).toEqual({ action: 'uncategorize' });
  });

  it('reassign requires a targetCategoryId', () => {
    const missing = resolveCategoryDeletion({ affectedDocs: [{ id: 'd1' }], mode: 'reassign' });
    expect(missing.error).toMatch(/targetCategoryId/);

    const ok = resolveCategoryDeletion({ affectedDocs: [{ id: 'd1' }], mode: 'reassign', targetCategoryId: 'cat2' });
    expect(ok).toEqual({ action: 'reassign', targetCategoryId: 'cat2' });
  });

  it('create-and-move requires a non-blank newCategoryName and trims it', () => {
    const missing = resolveCategoryDeletion({ affectedDocs: [{ id: 'd1' }], mode: 'create-and-move', newCategoryName: '   ' });
    expect(missing.error).toMatch(/newCategoryName/);

    const ok = resolveCategoryDeletion({ affectedDocs: [{ id: 'd1' }], mode: 'create-and-move', newCategoryName: '  design-decisions  ' });
    expect(ok).toEqual({ action: 'create-and-move', newCategoryName: 'design-decisions' });
  });

  it('rejects an unknown mode', () => {
    const decision = resolveCategoryDeletion({ affectedDocs: [{ id: 'd1' }], mode: 'delete-everything' });
    expect(decision.error).toMatch(/mode must be one of/);
  });
});
