import { create } from 'zustand';
import toast from 'react-hot-toast';
import { groupsApi, projectsApi, tasksApi } from '../api/endpoints';

export const useProjectStore = create((set, get) => ({
  projects: [],
  current: null,
  loading: false,
  async loadProjects() {
    set({ loading: true });
    const { data } = await projectsApi.list();
    set({ projects: data, loading: false });
  },
  async loadProject(id) {
    set({ loading: true });
    const { data } = await projectsApi.detail(id);
    set({ current: data, loading: false });
  },
  async createProject(payload) {
    const { data } = await projectsApi.create(payload);
    set({ projects: [data, ...get().projects] });
    toast.success('Project created');
    return data;
  },
  async updateProject(id, payload) {
    const { data } = await projectsApi.update(id, payload);
    set({ current: data, projects: get().projects.map((project) => (project.id === id ? data : project)) });
  },
  async deleteProject(id) {
    await projectsApi.remove(id);
    set({ projects: get().projects.filter((project) => project.id !== id), current: null });
    toast.success('Project deleted');
  },
  applyProject(project) {
    set({ current: project, projects: get().projects.map((item) => (item.id === project.id ? project : item)) });
  },
  async createGroup(title) {
    const { current } = get();
    const { data } = await projectsApi.createGroup(current.id, { title });
    get().applyProject(data);
  },
  async createTask(payload) {
    const { current } = get();
    const { data } = await projectsApi.createTask(current.id, payload);
    get().applyProject(data);
  },
  async updateGroup(id, payload) {
    const { data } = await groupsApi.update(id, payload);
    get().applyProject(data);
  },
  async deleteGroup(id) {
    const { data } = await groupsApi.remove(id);
    get().applyProject(data);
  },
  async ungroup(id) {
    const { data } = await groupsApi.ungroup(id);
    get().applyProject(data);
  },
  async mergeGroups(payload) {
    const { data } = await groupsApi.merge(payload);
    get().applyProject(data);
  },
  async updateTask(id, payload, optimistic) {
    if (optimistic) set({ current: optimistic });
    const { data } = await tasksApi.update(id, payload);
    get().applyProject(data);
  },
  async deleteTask(id) {
    const { data } = await tasksApi.remove(id);
    get().applyProject(data);
  },
  async moveTask(id, groupId) {
    const { data } = await tasksApi.move(id, { groupId });
    get().applyProject(data);
  },
  async toggleShare(shareEnabled) {
    const { current } = get();
    const { data } = await projectsApi.share(current.id, { shareEnabled });
    get().applyProject(data);
    return data.shareUrl;
  }
}));
