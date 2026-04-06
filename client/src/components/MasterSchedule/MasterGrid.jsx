import React, { useMemo, useState, useCallback } from 'react';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import { format, parseISO, addDays, differenceInCalendarDays } from 'date-fns';

const USD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 });

// ── Sort modes ────────────────────────────────────────────────────────────────
// 'project' — project header rows + tasks grouped under them (original)
// 'date'    — all tasks flat sorted by start_date (nulls last), no project headers

function buildProjectRows(tasks) {
  const projectOrder = [];
  const byProject = {};
  for (const t of tasks) {
    if (!byProject[t.project_id]) {
      projectOrder.push(t.project_id);
      byProject[t.project_id] = { id: t.project_id, name: t.project_name, color: t.project_color || '#3b82f6', tasks: [] };
    }
    byProject[t.project_id].tasks.push(t);
  }
  const rows = [];
  for (const pid of projectOrder) {
    const proj = byProject[pid];
    const taskList = proj.tasks;
    const avgPct = taskList.length > 0 ? Math.round(taskList.reduce((s, t) => s + (t.percent_complete || 0), 0) / taskList.length) : 0;
    const totalCost = taskList.reduce((s, t) => s + (Number(t.cost) || 0), 0);
    rows.push({ id: `_proj_${pid}`, _isProjectHeader: true, _projectColor: proj.color, name: proj.name, percent_complete: avgPct, cost: totalCost });
    for (const t of taskList) rows.push({ ...t, _projectColor: proj.color });
  }
  return rows;
}

function buildDateRows(tasks) {
  return [...tasks]
    .filter((t) => !t._isProjectHeader)
    .sort((a, b) => {
      if (!a.start_date && !b.start_date) return 0;
      if (!a.start_date) return 1;
      if (!b.start_date) return -1;
      return a.start_date.localeCompare(b.start_date);
    })
    .map((t) => ({ ...t, _projectColor: t.project_color || '#3b82f6' }));
}

// ── Cell renderers ────────────────────────────────────────────────────────────

function WbsCell({ value, data }) {
  if (data?._isProjectHeader || !value) return null;
  return <span style={{ color: 'var(--text-muted)' }}>{value}</span>;
}

function NameCell({ value, data }) {
  if (data?._isProjectHeader) {
    const pct = data.percent_complete ?? 0;
    return (
      <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 13, width: '100%' }}>
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: data._projectColor, flexShrink: 0, display: 'inline-block' }} />
        <span style={{ flex: 1 }}>{value}</span>
        <span style={{
          fontSize: 11, fontWeight: 600,
          color: pct === 100 ? '#34d399' : pct > 0 ? '#60a5fa' : 'var(--text-muted)',
          background: pct === 100 ? 'rgba(52,211,153,0.12)' : pct > 0 ? 'rgba(96,165,250,0.12)' : 'rgba(255,255,255,0.06)',
          borderRadius: 4, padding: '1px 7px', whiteSpace: 'nowrap', marginRight: 4,
        }}>{pct}%</span>
      </span>
    );
  }
  const depth = data?.wbs ? (data.wbs.match(/\./g) || []).length : 0;
  const isComplete = data?.status === 'complete';
  return (
    <span style={{ paddingLeft: depth * 8, textDecoration: isComplete ? 'line-through' : 'none', opacity: isComplete ? 0.6 : 1 }}>
      {value}
    </span>
  );
}

function ProjectCell({ data }) {
  if (data?._isProjectHeader) return null;
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: data?._projectColor, flexShrink: 0, display: 'inline-block' }} />
      <span style={{ color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{data?.project_name}</span>
    </span>
  );
}

function StatusCell({ value, data }) {
  if (data?._isProjectHeader) return null;
  const map = { not_started: 'Not Started', in_progress: 'In Progress', complete: 'Complete', on_hold: 'On Hold' };
  return <span className={`badge badge-${value}`}>{map[value] || value}</span>;
}

function PriorityCell({ value, data }) {
  if (data?._isProjectHeader) return null;
  return <span className={`badge badge-${value}`}>{value}</span>;
}

function DateCell({ value, data }) {
  if (data?._isProjectHeader) return null;
  if (!value) return <span style={{ color: 'var(--text-muted)' }}>—</span>;
  try { return <span>{format(parseISO(value), 'M/d/yy')}</span>; } catch { return <span>{value}</span>; }
}

function ProgressCell({ value, data }) {
  if (data?._isProjectHeader) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
      <div className="progress-bar" style={{ flex: 1 }}>
        <div className="progress-fill" style={{ width: `${value || 0}%` }} />
      </div>
      <span style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 28, textAlign: 'right' }}>{value || 0}%</span>
    </div>
  );
}

function DurationCell({ value, data }) {
  if (data?._isProjectHeader) return null;
  const n = Number(value) || 0;
  return n > 0 ? <span>{n}d</span> : <span style={{ color: 'var(--text-muted)', opacity: 0.4 }}>—</span>;
}

function CostCell({ value, data }) {
  const n = Number(value);
  if (!n && !data?._isProjectHeader) return <span style={{ color: 'var(--text-muted)', opacity: 0.4 }}>—</span>;
  return (
    <span style={{ fontWeight: data?._isProjectHeader ? 700 : 400, color: data?._isProjectHeader ? '#86efac' : 'inherit' }}>
      {USD.format(n || 0)}
    </span>
  );
}

// ── Column definitions factory ────────────────────────────────────────────────

function buildColumnDefs(sortMode) {
  const notHeader = (params) => !params.data?._isProjectHeader;
  return [
    { field: 'wbs',              headerName: 'WBS',      width: 72,  resizable: true, editable: false, cellRenderer: WbsCell },
    { field: 'name',             headerName: 'Task Name', flex: 1,   minWidth: 200, resizable: true, editable: notHeader, cellRenderer: NameCell },
    { field: 'project_name',     headerName: 'Project',   width: 150, resizable: true, editable: false, cellRenderer: ProjectCell },
    { field: 'start_date',       headerName: 'Start',     width: 96,  resizable: true, editable: notHeader, cellEditor: 'agDateStringCellEditor', cellRenderer: DateCell },
    { field: 'end_date',         headerName: 'End',       width: 96,  resizable: true, editable: notHeader, cellEditor: 'agDateStringCellEditor', cellRenderer: DateCell },
    { field: 'duration_days',    headerName: 'Days',      width: 68,  resizable: true, editable: notHeader, cellDataType: 'number', cellRenderer: DurationCell },
    {
      field: 'status', headerName: 'Status', width: 118, resizable: true,
      editable: notHeader,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: { values: ['not_started', 'in_progress', 'complete', 'on_hold'] },
      cellRenderer: StatusCell,
    },
    {
      field: 'priority', headerName: 'Priority', width: 88, resizable: true,
      editable: notHeader,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: { values: ['high', 'medium', 'low'] },
      cellRenderer: PriorityCell,
    },
    { field: 'percent_complete', headerName: '% Done',   width: 130, resizable: true, editable: notHeader, cellDataType: 'number', cellRenderer: ProgressCell },
    { field: 'cost',             headerName: 'Cost',      width: 104, resizable: true, editable: notHeader, cellDataType: 'number', cellRenderer: CostCell },
  ];
}

// ── Main component ────────────────────────────────────────────────────────────

export default function MasterGrid({ tasks, onUpdate }) {
  const [sortMode, setSortMode] = useState('project'); // 'project' | 'date'
  const [saving, setSaving] = useState(new Set());

  const rows = useMemo(
    () => sortMode === 'project' ? buildProjectRows(tasks) : buildDateRows(tasks),
    [tasks, sortMode]
  );

  const columnDefs = useMemo(() => buildColumnDefs(sortMode), [sortMode]);

  const getRowStyle = useCallback((params) => {
    if (params.data?._isProjectHeader) {
      return { background: `${params.data._projectColor}1a`, borderLeft: `3px solid ${params.data._projectColor}` };
    }
    if (sortMode === 'date' && params.data?._projectColor) {
      return { borderLeft: `3px solid ${params.data._projectColor}44` };
    }
    return null;
  }, [sortMode]);

  const getRowHeight = useCallback(
    (params) => (params.data?._isProjectHeader ? 42 : 36),
    []
  );

  const onCellValueChanged = useCallback(async (params) => {
    if (params.data?._isProjectHeader) return;
    const field = params.colDef.field;
    let u = { ...params.data };

    // Keep duration/dates consistent
    try {
      if (field === 'duration_days' && u.start_date && u.duration_days > 0) {
        u.end_date = format(addDays(parseISO(u.start_date), Number(u.duration_days) - 1), 'yyyy-MM-dd');
      } else if (field === 'start_date' && u.start_date && u.duration_days > 0) {
        u.end_date = format(addDays(parseISO(u.start_date), Number(u.duration_days) - 1), 'yyyy-MM-dd');
      } else if (field === 'end_date' && u.start_date && u.end_date) {
        u.duration_days = Math.max(1, differenceInCalendarDays(parseISO(u.end_date), parseISO(u.start_date)) + 1);
      }
    } catch (_) {}

    setSaving((prev) => new Set(prev).add(u.id));
    try {
      await onUpdate(u.id, u);
    } catch (err) {
      console.error('master cell update:', err);
    } finally {
      setSaving((prev) => { const s = new Set(prev); s.delete(u.id); return s; });
    }
  }, [onUpdate]);

  if (!tasks.length) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: 14 }}>
        No tasks found across any project.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', marginRight: 2 }}>Sort by:</span>
        {[
          { id: 'project', label: '🏷 Project', title: 'Group tasks under each project' },
          { id: 'date',    label: '📅 Date',    title: 'Flat list ordered by start date — reveals conflicts' },
        ].map((m) => (
          <button
            key={m.id}
            className={`tab-btn ${sortMode === m.id ? 'active' : ''}`}
            style={{ fontSize: 12, padding: '4px 12px' }}
            onClick={() => setSortMode(m.id)}
            title={m.title}
          >
            {m.label}
          </button>
        ))}

        {sortMode === 'date' && (
          <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>
            Tasks without a start date appear last
          </span>
        )}

        {saving.size > 0 && (
          <span style={{ marginLeft: 'auto', fontSize: 11, color: '#60a5fa' }}>Saving…</span>
        )}
      </div>

      <div className="ag-theme-alpine-dark" style={{ flex: 1, width: '100%' }}>
        <AgGridReact
          rowData={rows}
          columnDefs={columnDefs}
          defaultColDef={{ resizable: true, sortable: false }}
          getRowStyle={getRowStyle}
          getRowHeight={getRowHeight}
          onCellValueChanged={onCellValueChanged}
          singleClickEdit
          stopEditingWhenCellsLoseFocus
          headerHeight={36}
          animateRows={false}
        />
      </div>
    </div>
  );
}
