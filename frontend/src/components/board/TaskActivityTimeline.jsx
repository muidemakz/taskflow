import { useEffect, useState } from 'react';
import { activityApi } from '../../api/endpoints';
import ActivityTimelineList from './ActivityTimelineList';

// Read-only -- there is no update/delete endpoint by design. Rows arrive
// already most-recent-first from the API.
export default function TaskActivityTimeline({ taskId, refreshKey }) {
  const [entries, setEntries] = useState(null);

  useEffect(() => {
    activityApi.list(taskId).then(({ data }) => setEntries(data)).catch(() => setEntries([]));
    // refreshKey (the task's updatedAt) changes on every mutation, so a new
    // activity row shows up here right after the patch that created it.
  }, [taskId, refreshKey]);

  if (entries === null) return <p className="text-sm text-muted">Loading activity...</p>;
  return <ActivityTimelineList entries={entries} />;
}
