import React, { useEffect, useRef, useState, useMemo } from 'react';
import Gantt from 'frappe-gantt';
import 'frappe-gantt/dist/frappe-gantt.css';

const VIEW_MODES = ['Quarter Day', 'Half Day', 'Day', 'Week', 'Month'];

export default function MasterGantt({ tasks }) {
  const containerRef = useRef(null);
  const ganttRef     = useRef(null);
  const [viewMode, setViewMode] = useState('Week');
  const prevIdsRef   = useRef(null);

  // Build a stable project index map: project_id → { color, index, name }
  const projectMap = useMemo(() => {
    const seen = {};
    let idx = 0;
    for (const t of tasks) {
      if (t.project_id && !seen[t.project_id]) {
        seen[t.project_id] = {
          color: t.project_color || '#3b82f6',
          index: idx++,
          name: t.project_name || t.project_id,
        };
      }
    }
    return seen;
  }, [tasks]);

  // Inject CSS to color each project's bars uniquely
  const styleSheet = useMemo(() => {
    return Object.values(projectMap).map(({ color, index }) => {
      // Derive a darker shade for the progress fill
      return [
        `.bar-wrapper.proj-${index} .bar { fill: ${color}; opacity: 0.82; }`,
        `.bar-wrapper.proj-${index} .bar-progress { fill: ${color}; opacity: 1; }`,
        `.bar-wrapper.proj-${index} .bar-label { fill: #fff; font-weight: 500; }`,
        `.bar-wrapper.proj-${index}:hover .bar { opacity: 1; }`,
      ].join('\n');
    }).join('\n');
  }, [projectMap]);

  // Build Frappe Gantt task objects (read-only — callbacks are no-ops)
  const ganttTasks = useMemo(() => {
    return tasks
      .filter((t) => t.start_date && t.end_date && !t._isProjectHeader)
      .map((t) => {
        const proj = projectMap[t.project_id] || { index: 0 };
        return {
          id:           t.id,
          name:         t.name,
          start:        t.start_date,
          end:          t.end_date,
          progress:     t.percent_complete || 0,
          dependencies: '',
          custom_class: `proj-${proj.index}`,
        };
      });
  }, [tasks, projectMap]);

  // Init or refresh the Gantt chart when data changes
  useEffect(() => {
    if (!ganttTasks.length || !containerRef.current) return;

    const idsKey = ganttTasks.map((t) => t.id).join(',');

    if (ganttRef.current && idsKey === prevIdsRef.current) {
      ganttRef.current.refresh(ganttTasks);
      return;
    }

    prevIdsRef.current = idsKey;
    containerRef.current.innerHTML = '';

    ganttRef.current = new Gantt(containerRef.current, ganttTasks, {
      view_mode:   viewMode,
      date_format: 'YYYY-MM-DD',
      language:    'en',
      on_click:            () => {},
      on_date_change:      () => {},
      on_progress_change:  () => {},
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ganttTasks]);

  // Change view mode without full rebuild
  useEffect(() => {
    if (ganttRef.current) ganttRef.current.change_view_mode(viewMode);
  }, [viewMode]);

  const legendItems = useMemo(() => Object.values(projectMap), [projectMap]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Inject per-project bar colors */}
      <style>{styleSheet}</style>

      {/* Toolbar + legend */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', marginRight: 4 }}>View:</span>
        {VIEW_MODES.map((mode) => (
          <button
            key={mode}
            className={`tab-btn ${viewMode === mode ? 'active' : ''}`}
            style={{ fontSize: 12, padding: '4px 10px' }}
            onClick={() => setViewMode(mode)}
          >
            {mode}
          </button>
        ))}

        {/* Project color legend */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          {legendItems.map((proj, i) => (
            <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-muted)' }}>
              <span style={{
                width: 10, height: 10, borderRadius: 2,
                background: proj.color, display: 'inline-block', flexShrink: 0,
              }} />
              {proj.name}
            </span>
          ))}
        </div>
      </div>

      {ganttTasks.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)', fontSize: 14 }}>
          No tasks with start/end dates found across all projects.
        </div>
      ) : (
        <div ref={containerRef} style={{ overflowX: 'auto' }} />
      )}
    </div>
  );
}
