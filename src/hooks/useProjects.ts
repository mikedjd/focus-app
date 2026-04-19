import { useState, useCallback, useEffect } from 'react';
import type { Project } from '../types';
import {
  createProject,
  deleteProject,
  getProjects,
  subscribeToDataChanges,
  updateProject,
} from '../api/client';

export const PROJECT_COLORS = [
  '#3B5BDB', // blue
  '#2F9E44', // green
  '#E8590C', // orange
  '#7950F2', // purple
  '#D6336C', // pink
  '#0C8599', // teal
];

export function useProjects(goalId: string | null) {
  const [projects, setProjects] = useState<Project[]>([]);

  const refresh = useCallback(async () => {
    if (!goalId) { setProjects([]); return; }
    setProjects(await getProjects(goalId));
  }, [goalId]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => subscribeToDataChanges(() => void refresh()), [refresh]);

  const addProject = useCallback(
    async (name: string, color: string) => {
      if (!goalId) return null;
      const project = await createProject(goalId, name, color);
      await refresh();
      return project;
    },
    [goalId, refresh]
  );

  const editProject = useCallback(
    async (id: string, name: string, color: string) => {
      await updateProject(id, name, color);
      await refresh();
    },
    [refresh]
  );

  const removeProject = useCallback(
    async (id: string) => {
      await deleteProject(id);
      await refresh();
    },
    [refresh]
  );

  return { projects, addProject, editProject, removeProject, refresh };
}
