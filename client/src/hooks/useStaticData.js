import { useState, useEffect } from 'react';

/**
 * Loads the pre-exported web-data.json from the static server root.
 * Used exclusively by AppReadOnly (the GitHub Pages / view-only build).
 */
export function useStaticData() {
  const [projects,  setProjects]  = useState([]);
  const [allTasks,  setAllTasks]  = useState({});      // { [projectId]: task[] }
  const [resources, setResources] = useState({});      // { [projectId]: resource[] }
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [exportedAt, setExportedAt] = useState(null);

  useEffect(() => {
    fetch('./web-data.json')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => {
        setProjects(d.projects  ?? []);
        setAllTasks(d.tasks     ?? {});
        setResources(d.resources ?? {});
        setExportedAt(d.exportedAt ?? null);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, []);

  return { projects, allTasks, resources, loading, error, exportedAt };
}
