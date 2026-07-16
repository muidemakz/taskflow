// Pure decision logic for the three-path category delete, decoupled from
// Prisma so it's unit testable -- same rationale as rollover.js and
// gateImport.js. The route layer does the actual database writes based on
// what this returns.
export function resolveCategoryDeletion({ affectedDocs, mode, targetCategoryId, newCategoryName }) {
  if (affectedDocs.length && !mode) {
    return { needsResolution: true };
  }
  if (mode === 'reassign') {
    if (!targetCategoryId) return { error: 'targetCategoryId is required for reassign' };
    return { action: 'reassign', targetCategoryId };
  }
  if (mode === 'create-and-move') {
    const trimmed = newCategoryName?.trim();
    if (!trimmed) return { error: 'newCategoryName is required for create-and-move' };
    return { action: 'create-and-move', newCategoryName: trimmed };
  }
  if (mode === 'uncategorize' || !mode) {
    return { action: 'uncategorize' };
  }
  return { error: 'mode must be one of: reassign, create-and-move, uncategorize' };
}
