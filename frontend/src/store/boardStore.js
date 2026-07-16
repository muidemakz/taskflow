import { create } from 'zustand';
import { boardApi, gatesApi, roadmapApi, statusesApi, tagsApi } from '../api/endpoints';

const VIEW_PREFS_KEY = 'taskflow_board_view_prefs';

function readViewPrefs() {
  try {
    return JSON.parse(localStorage.getItem(VIEW_PREFS_KEY) || '{}');
  } catch {
    return {};
  }
}

function writeViewPrefs(prefs) {
  localStorage.setItem(VIEW_PREFS_KEY, JSON.stringify(prefs));
}

export const useBoardStore = create((set, get) => ({
  projectId: null,
  gateId: null,
  statuses: [],
  columns: [],
  unassignedCount: 0,
  roadmap: null,
  gates: [],
  hasRoadmap: false,
  tags: [],
  loading: false,
  view: 'board',
  sortKey: 'default',

  setView(view) {
    set({ view });
    const prefs = readViewPrefs();
    prefs[get().projectId] = { ...prefs[get().projectId], view };
    writeViewPrefs(prefs);
  },

  setSortKey(sortKey) {
    set({ sortKey });
    const prefs = readViewPrefs();
    prefs[get().projectId] = { ...prefs[get().projectId], sortKey };
    writeViewPrefs(prefs);
  },

  async loadProjectMeta(projectId) {
    const prefs = readViewPrefs()[projectId] || {};
    set({ projectId, view: prefs.view || 'board', sortKey: prefs.sortKey || 'default' });
    const [statuses, roadmap, tags] = await Promise.all([
      statusesApi.list(projectId).then((r) => r.data),
      roadmapApi.get(projectId).then((r) => r.data),
      tagsApi.list(projectId).then((r) => r.data)
    ]);
    set({
      statuses,
      roadmap: roadmap.roadmap,
      gates: roadmap.gates || [],
      hasRoadmap: roadmap.hasRoadmap,
      tags
    });
  },

  async loadBoard(projectId, gateId = null) {
    set({ loading: true, projectId, gateId });
    const { data } = await boardApi.get(projectId, gateId);
    set({ columns: data.columns, unassignedCount: data.unassignedCount, loading: false });
  },

  async refreshBoard() {
    const { projectId, gateId } = get();
    if (!projectId) return;
    await get().loadBoard(projectId, gateId);
  },

  // Optimistic move: applied to local state immediately, then confirmed
  // (or rolled back) against the server.
  async moveTask(taskId, payload) {
    const before = get().columns;
    const beforeColumns = before.map((col) => ({ ...col, tasks: [...col.tasks] }));

    const optimisticColumns = before.map((col) => ({ ...col, tasks: col.tasks.filter((t) => t.id !== taskId) }));
    let movedTask = null;
    for (const col of before) {
      const found = col.tasks.find((t) => t.id === taskId);
      if (found) movedTask = found;
    }
    if (movedTask) {
      const targetStatusId = payload.statusId ?? movedTask.statusId;
      const updated = { ...movedTask, ...payload, statusId: targetStatusId };
      const targetCol = optimisticColumns.find((c) => c.status.id === targetStatusId);
      if (targetCol) {
        const items = [...targetCol.tasks, updated].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
        targetCol.tasks = items;
      }
      set({ columns: optimisticColumns });
    }

    try {
      const { data } = await boardApi.updateTask(taskId, payload);
      set((state) => ({
        columns: state.columns.map((col) => ({
          ...col,
          tasks: col.tasks.map((t) => (t.id === data.id ? data : t)).filter((t) => t.statusId === col.status.id)
        }))
      }));
      // A task that moved into a column it wasn't optimistically placed in
      // (e.g. server recalculated something) is covered by a full refresh
      // if it goes missing.
      const stillPresent = get().columns.some((c) => c.tasks.some((t) => t.id === data.id));
      if (!stillPresent) await get().refreshBoard();
    } catch (error) {
      set({ columns: beforeColumns });
      throw error;
    }
  },

  async updateTaskFields(taskId, payload) {
    const { data } = await boardApi.updateTask(taskId, payload);
    set((state) => {
      // A real gate-scoped board (state.gateId set) only ever holds that
      // gate's tasks -- if this update moved the task to a different gate,
      // it no longer belongs here and must be dropped, not just updated in
      // place. Whole-project/Unscheduled views (gateId null) don't need
      // this: their own client-side filtering already re-derives visibility
      // from the task's (now-updated) gateId on every columns change.
      const stillInScope = !state.gateId || data.gateId === state.gateId;
      return {
        columns: state.columns.map((col) => ({
          ...col,
          tasks: stillInScope
            ? col.tasks.map((t) => (t.id === taskId ? data : t))
            : col.tasks.filter((t) => t.id !== taskId)
        }))
      };
    });
    return data;
  },

  async closeGate(gateId, confirm = false, reason = null) {
    const { data } = await gatesApi.close(gateId, { confirm, reason });
    return data;
  },

  async reopenGate(gateId, reason = null) {
    const { data } = await gatesApi.reopen(gateId, { reason });
    return data;
  }
}));
