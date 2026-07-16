// Append-only TaskActivity writes, always routed through here so every
// call site produces the same shape. `client` is a $transaction handle when
// called from inside one (the common case -- activity rows should never be
// visible without the mutation that produced them actually committing).

export async function logActivity(client, entry) {
  return client.taskActivity.create({ data: entry });
}

export async function logActivityMany(client, entries) {
  if (!entries.length) return { count: 0 };
  return client.taskActivity.createMany({ data: entries });
}
