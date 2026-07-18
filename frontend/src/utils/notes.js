// "Untitled N" is never stored -- it's a display-only number derived from
// creation order (oldest = 1), independent of any list's own sort order, so
// renaming/reordering never has to reconcile against a placeholder that was
// written to the DB. Shared between the chat list and an open chat's own
// header so both agree on the same number for the same chat.
export function withDisplayNumbers(chats) {
  const byCreatedAsc = [...chats].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  const numberById = new Map(byCreatedAsc.map((c, i) => [c.id, i + 1]));
  return chats.map((c) => ({ ...c, displayTitle: c.title || `Untitled ${numberById.get(c.id)}` }));
}
