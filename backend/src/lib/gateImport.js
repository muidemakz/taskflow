// Pure validation for CSV gate import, decoupled from Prisma so it's unit
// testable without a live database -- same rationale as rollover.js and
// statusGuard.js. Order values are validated for internal consistency (no
// duplicates within the batch) but are not the final persisted order; the
// caller re-sequences validRows (sorted by this order) after whatever gates
// already exist in the project.
export function validateGateImportRows(rows) {
  const errors = [];
  const seenNames = new Set();
  const seenOrders = new Set();
  const validRows = [];

  rows.forEach((row, i) => {
    const line = i + 1;
    const name = String(row.gate_name || '').trim();
    const order = typeof row.order === 'number' ? row.order : parseInt(row.order, 10);
    const description = row.description ? String(row.description).trim() : null;

    if (!name) return errors.push(`Row ${line}: gate_name is required`);
    if (!Number.isInteger(order)) return errors.push(`Row ${line}: order must be an integer`);
    if (seenNames.has(name.toLowerCase())) return errors.push(`Row ${line}: duplicate gate_name "${name}"`);
    if (seenOrders.has(order)) return errors.push(`Row ${line}: duplicate order ${order}`);
    seenNames.add(name.toLowerCase());
    seenOrders.add(order);
    validRows.push({ name, order, description });
  });

  if (errors.length) return { errors, validRows: [] };

  validRows.sort((a, b) => a.order - b.order);
  return { errors: [], validRows };
}
