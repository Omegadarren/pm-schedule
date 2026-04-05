import { useState, useEffect } from 'react';

/**
 * Loads the pre-exported web-data.json from the static server root.
 * Used exclusively by AppReadOnly (the GitHub Pages / view-only build).
 *
 * When a per-project share page is loaded, window.__PROJECT_SHARE__ is
 * injected inline by publish.js and contains only that one project's data.
 * In that case we skip the network fetch entirely.
 */

// Read once at module load — it's baked into <head> before any scripts run.
const _shareData = typeof window !== 'undefined' ? window.__PROJECT_SHARE__ : null;

export function useStaticData() {
  const [projects,   setProjects]   = useState(_shareData ? [_shareData.project]                                    : []);
  const [allTasks,   setAllTasks]   = useState(_shareData ? { [_shareData.project.id]: _shareData.tasks }           : {});
  const [resources,  setResources]  = useState(_shareData ? { [_shareData.project.id]: _shareData.resources }       : {});
  const [loading,    setLoading]    = useState(!_shareData);
  const [error,      setError]      = useState(null);
  const [exportedAt, setExportedAt] = useState(_shareData?.exportedAt ?? null);
  const [colState,   setColState]   = useState(null);

  useEffect(() => {
    if (_shareData) return; // already loaded from inline script — no fetch needed

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
        setColState(d.colState  ?? null);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, []);

  return {
    projects, allTasks, resources, loading, error,
    exportedAt, colState,
    isShareMode: !!_shareData,
  };
}
