import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { getSocketId } from './useSocket.js';

export function useTasks(projectId) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchTasks = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const { data } = await axios.get(`/api/tasks/project/${projectId}`);
      setTasks(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const addTask = useCallback(async (taskData) => {
    const { data } = await axios.post('/api/tasks', { project_id: projectId, ...taskData, _socketId: getSocketId() });
    setTasks((prev) => [...prev, data]);
    return data;
  }, [projectId]);

  const updateTask = useCallback(async (id, taskData) => {
    const { data } = await axios.put(`/api/tasks/${id}`, { ...taskData, _socketId: getSocketId() });
    setTasks((prev) => prev.map((t) => (t.id === id ? data : t)));
    return data;
  }, []);

  const deleteTask = useCallback(async (id) => {
    await axios.delete(`/api/tasks/${id}`, { params: { _socketId: getSocketId() } });
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Called by socket listener to apply remote updates without API round-trip
  const applyRemoteUpdate = useCallback((task) => {
    setTasks((prev) => prev.map((t) => (t.id === task.id ? task : t)));
  }, []);

  const applyRemoteAdd = useCallback((task) => {
    setTasks((prev) => {
      if (prev.find((t) => t.id === task.id)) return prev;
      return [...prev, task];
    });
  }, []);

  const applyRemoteDelete = useCallback((taskId) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
  }, []);

  // Silent refetch: re-fetches data without showing the loading spinner.
  // Use this for background refreshes (e.g. after drag-reorder) so the grid
  // doesn't unmount and remount on every operation.
  const silentRefetch = useCallback(async () => {
    if (!projectId) return;
    try {
      const { data } = await axios.get(`/api/tasks/project/${projectId}`);
      setTasks(data);
    } catch (_) {}
  }, [projectId]);

  return {
    tasks, loading, error,
    addTask, updateTask, deleteTask, refetch: fetchTasks, silentRefetch,
    applyRemoteUpdate, applyRemoteAdd, applyRemoteDelete,
  };
}

export function useProjects() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axios.get('/api/projects');
      setProjects(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  const createProject = useCallback(async (data) => {
    const { data: proj } = await axios.post('/api/projects', data);
    setProjects((prev) => [proj, ...prev]);
    return proj;
  }, []);

  const deleteProject = useCallback(async (id) => {
    await axios.delete(`/api/projects/${id}`);
    setProjects((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const renameProject = useCallback(async (id, newName) => {
    setProjects((prev) => prev.map((p) => p.id === id ? { ...p, name: newName } : p));
    const proj = await axios.get(`/api/projects/${id}`);
    await axios.put(`/api/projects/${id}`, { ...proj.data, name: newName });
  }, []);

  const updateProject = useCallback(async (id, fields) => {
    const { data: updated } = await axios.put(`/api/projects/${id}`, fields);
    setProjects((prev) => prev.map((p) => p.id === id ? updated : p));
    return updated;
  }, []);

  // Sync a project object directly into local state without an API call.
  // Used after share-token generation/revocation, where the API response
  // already contains the updated project.
  const syncProject = useCallback((updatedProject) => {
    setProjects((prev) => prev.map((p) => p.id === updatedProject.id ? updatedProject : p));
  }, []);

  return { projects, loading, createProject, deleteProject, renameProject, updateProject, syncProject, refetch: fetchProjects };
}

export function useAllTasks(enabled = false) {
  const [allTasks, setAllTasks] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const { data } = await axios.get('/api/tasks/master');
      setAllTasks(data);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  return { allTasks, loading, refetch: fetchAll };
}
