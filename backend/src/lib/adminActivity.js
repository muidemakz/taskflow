// Append-only AdminActivity writes, mirroring lib/activity.js's pattern for
// TaskActivity -- every admin.js mutation that touches another user's
// account routes through here so every row has the same shape.
export async function logAdminActivity(client, entry) {
  return client.adminActivity.create({ data: entry });
}
