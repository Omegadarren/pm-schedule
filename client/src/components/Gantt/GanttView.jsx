import React, { useEffect, useRef, useState } from 'react';
import Gantt from 'frappe-gantt';
import 'frappe-gantt/dist/frappe-gantt.css';
import { parseDeps } from '../Grid/DependencyEditor.jsx';

const VIEW_MODES = ['Quarter Day', 'Half Day', 'Day', 'Week', 'Month'];

function tasksToGanttTasks(tasks) {
  return tasks
    .filter((t) => t.start_date && t.end_date)
    .map((t) => ({
      id: t.id,
      name: t.name,
      start: t.start_date,
      end: t.end_date,
      progress: t.percent_complete || 0,
      // Extract only the IDs for Frappe Gantt arrow drawing
      // (FS only — Frappe doesn't natively support SS/FF/SF arrows but still draws lines)
      dependencies: parseDeps(t.predecessor_ids)
        .filter((d) => d.id)
        .map((d) => d.id)
        .join(', '),
      custom_class: `priority-${t.priority}`,
    }));
}

export default function GanttView({ tasks, onUpdate }) {
  const containerRef = useRef(null);
  const ganttRef = useRef(null);
  const [viewMode, setViewMode] = useState('Week');
  const prevTasksRef = useRef(null);

  // Init or reinit Gantt when tasks change
  useEffect(() => {
    const ganttTasks = tasksToGanttTasks(tasks);
    if (!ganttTasks.length || !containerRef.current) return;

    // Avoid full reinit if only data changed slightly
    const taskHash = JSON.stringify(ganttTasks.map((t) => t.id));
    const prevHash = prevTasksRef.current;

    if (ganttRef.current && taskHash === prevHash) {
      // Just refresh
      ganttRef.current.refresh(ganttTasks);
    } else {
      prevTasksRef.current = taskHash;
      containerRef.current.innerHTML = '';

      ganttRef.current = new Gantt(containerRef.current, ganttTasks, {
        view_mode: viewMode,
        date_format: 'YYYY-MM-DD',
        language: 'en',
        on_click: (task) => {
          // Could open a detail panel
        },
        on_date_change: async (task, start, end) => {
          const fmt = (d) => d.toISOString().split('T')[0];
          await onUpdate(task.id, {
            start_date: fmt(start),
            end_date: fmt(end),
            duration_days: Math.round((end - start) / 86400000) + 1,
          });
        },
        on_progress_change: async (task, progress) => {
          await onUpdate(task.id, { percent_complete: Math.round(progress) });
        },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks]);

  // Change view mode without rebuilding
  useEffect(() => {
    if (ganttRef.current) {
      ganttRef.current.change_view_mode(viewMode);
    }
  }, [viewMode]);

  const ganttTasks = tasksToGanttTasks(tasks);
  const hasData = ganttTasks.length > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
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
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)' }}>
          Drag bars to reschedule · Drag right edge to resize · Drag progress marker
        </span>
      </div>

      {/* Chart */}
      <div className="gantt-wrapper">
        {!hasData ? (
          <div className="empty-state">
            <div className="icon">📊</div>
            <div>No tasks with dates to display.</div>
            <div style={{ fontSize: 12 }}>Add start and end dates to tasks in the Grid view.</div>
          </div>
        ) : (
          <svg ref={containerRef} style={{ width: '100%' }} />
        )}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-muted)', padding: '0 4px' }}>
        <span>
          <span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 2, background: 'var(--accent)', marginRight: 4, verticalAlign: 'middle' }} />
          Task bar = planned duration
        </span>
        <span>
          <span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 2, background: 'rgba(59,130,246,0.3)', marginRight: 4, verticalAlign: 'middle' }} />
          Filled = % complete
        </span>
        <span>
          <span style={{ display: 'inline-block', width: 2, height: 12, background: '#60a5fa', marginRight: 4, verticalAlign: 'middle', display: 'inline-block' }} />
          Today line
        </span>
      </div>
    </div>
  );
}
