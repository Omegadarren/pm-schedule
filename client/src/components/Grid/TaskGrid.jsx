import React, { useCallback, useRef, useMemo, useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { createPortal } from 'react-dom';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import { format, parseISO, addDays, differenceInCalendarDays } from 'date-fns';
import DependencyEditor, { parseDeps, depLabel } from './DependencyEditor.jsx';
import { computeTaskDates, cascadeSchedule } from '../../utils/scheduler.js';

const USD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 });

// ── Cell renderers ──────────────────────────────────────────────────────────

function StatusCell({ value }) {
  const map = { not_started: 'Not Started', in_progress: 'In Progress', complete: 'Complete', on_hold: 'On Hold' };
  return <span className={`badge badge-${value}`}>{map[value] || value}</span>;
}
function PriorityCell({ value }) {
  return <span className={`badge badge-${value}`}>{value}</span>;
}
function ProgressCell({ value, data }) {
  if (data?._isSection) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
      <div className="progress-bar" style={{ flex: 1 }}>
        <div className="progress-fill" style={{ width: `${value || 0}%` }} />
      </div>
      <span style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 28, textAlign: 'right' }}>{value || 0}%</span>
    </div>
  );
}
function DateCell({ value, data }) {
  if (data?._isSection) return null;
  if (!value) return <span style={{ color: 'var(--text-muted)' }}>—</span>;
  try { return <span>{format(parseISO(value), 'EEE-M/d/yy')}</span>; } catch { return <span>{value}</span>; }
}
function WbsCell({ value, data }) {
  if (data?._isSection || !value) return null;
  const depth = (value.match(/\./g) || []).length;
  return <span style={{ color: 'var(--text-muted)', paddingLeft: depth * 12 }}>{value}</span>;
}
function NameCell({ value, data }) {
  if (data?._isSection) {
    return <span style={{ fontWeight: 700, fontSize: 13, letterSpacing: '0.03em', color: 'var(--text)' }}>{value}</span>;
  }
  const depth = data?.wbs ? (data.wbs.match(/\./g) || []).length : 0;
  return <span style={{ paddingLeft: depth * 8 }}>{value}</span>;
}
function CostCell({ value, data }) {
  const n = Number(value);
  if (!n && !data?._isSection) return <span style={{ color: 'var(--text-muted)', opacity: 0.4 }}>—</span>;
  return <span style={{ fontWeight: data?._isSection ? 700 : 400, color: data?._isSection ? '#86efac' : 'inherit' }}>{USD.format(n || 0)}</span>;
}
function PredecessorsCell(params) {
  const { value, data, allTasksRef, onOpenEditor, readOnly = false } = params;
  if (data?._isSection) return null;
  const allTasks = allTasksRef?.current || [];
  const validDeps = parseDeps(value).filter((d) => d.id);
  return (
    <div
      style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', width: '100%', cursor: readOnly ? 'default' : 'pointer' }}
      onClick={(e) => { if (readOnly) return; e.stopPropagation(); onOpenEditor(data); }}
      title={readOnly ? '' : 'Click to edit dependencies'}
    >
      {validDeps.length === 0
        ? !readOnly && <span style={{ color: 'var(--text-muted)', fontSize: 11, opacity: 0.5 }}>+ add link</span>
        : validDeps.map((dep, i) => (
          <span key={i} style={{ background: 'rgba(59,130,246,0.18)', color: '#60a5fa', borderRadius: 4, padding: '2px 7px', fontSize: 11, whiteSpace: 'nowrap', border: '1px solid rgba(59,130,246,0.3)' }}>
            {depLabel(dep, allTasks)}
          </span>
        ))}
    </div>
  );
}
// ── Stepper cell (shared by Duration and Lag/Lead) ────────────────────────
function StepperCell({ value, onUpdate, formatDisplay, getColor, readOnly = false }) {
  const [hovered, setHovered] = useState(false);
  const [typing, setTyping] = useState(false);

  const num = Number(value) || 0;
  const color = getColor ? getColor(num) : 'var(--text)';

  if (readOnly) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>
        <span style={{ minWidth: 32, textAlign: 'center', fontSize: 13, fontWeight: 500, color }}>
          {formatDisplay(num)}
        </span>
      </div>
    );
  }

  if (typing) {
    return (
      <input
        autoFocus
        type="number"
        defaultValue={num}
        onFocus={(e) => e.target.select()}
        style={{ width: '88%', background: 'var(--surface2)', color: 'var(--text)', border: '1px solid #60a5fa', borderRadius: 4, padding: '2px 6px', fontSize: 13, outline: 'none', textAlign: 'center' }}
        onBlur={(e) => {
          const v = parseInt(e.target.value, 10);
          if (!isNaN(v)) onUpdate(v);
          setTyping(false);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.target.blur();
          if (e.key === 'Escape') setTyping(false);
          e.stopPropagation();
        }}
      />
    );
  }

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onDoubleClick={(e) => { e.stopPropagation(); setTyping(true); }}
      style={{ display: 'flex', alignItems: 'center', gap: 3, width: '100%', height: '100%', justifyContent: 'center', cursor: 'default' }}
    >
      {hovered && (
        <button
          onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); onUpdate(num - 1); }}
          style={{ width: 20, height: 20, border: '1px solid var(--border)', borderRadius: 3, cursor: 'pointer', background: 'var(--surface2)', color: '#60a5fa', fontSize: 15, lineHeight: 1, padding: 0, flexShrink: 0 }}
        >−</button>
      )}
      <span style={{ minWidth: 32, textAlign: 'center', fontSize: 13, fontWeight: 500, color, userSelect: 'none' }}>
        {formatDisplay(num)}
      </span>
      {hovered && (
        <button
          onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); onUpdate(num + 1); }}
          style={{ width: 20, height: 20, border: '1px solid var(--border)', borderRadius: 3, cursor: 'pointer', background: 'var(--surface2)', color: '#60a5fa', fontSize: 15, lineHeight: 1, padding: 0, flexShrink: 0 }}
        >+</button>
      )}
    </div>
  );
}
function DurationCell({ value, data, onDurationUpdate, readOnly = false }) {
  if (data?._isSection) {
    const total = Number(value) || 0;
    return total > 0
      ? <span style={{ fontWeight: 700, color: '#86efac' }}>{total}d</span>
      : null;
  }
  return (
    <StepperCell
      value={value ?? 1}
      onUpdate={(v) => onDurationUpdate(data.id, v)}
      formatDisplay={(v) => `${v}d`}
      readOnly={readOnly}
    />
  );
}
function LagCell({ value, data, onLagUpdate, readOnly = false }) {
  if (data?._isSection) return null;
  const deps = parseDeps(data?.predecessor_ids).filter((d) => d.id);
  if (!deps.length) return <span style={{ color: 'var(--text-muted)', opacity: 0.35 }}>—</span>;
  return (
    <StepperCell
      value={value ?? deps[0]?.lag ?? 0}
      onUpdate={(v) => onLagUpdate(data.id, v)}
      formatDisplay={(v) => v > 0 ? `+${v}d` : v < 0 ? `${v}d` : '0d'}
      getColor={(v) => v > 0 ? '#fbbf24' : v < 0 ? '#34d399' : 'var(--text-muted)'}
      readOnly={readOnly}
    />
  );
}
function LinkCell({ data, onLinkStart, readOnly = false }) {
  if (data?._isSection || readOnly) return null;
  return (
    <div
      title="Drag to link this task to another"
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const rect = e.currentTarget.getBoundingClientRect();
        onLinkStart(data, rect.left + rect.width / 2, rect.top + rect.height / 2);
      }}
      style={{ cursor: 'crosshair', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', userSelect: 'none' }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)', opacity: 0.7 }}>
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
      </svg>
    </div>
  );
}
function RubberBand({ drag }) {
  if (!drag) return null;
  const { from, to } = drag;
  const dx = to.x - from.x;
  const cx1 = from.x + Math.max(60, Math.abs(dx) * 0.5);
  const cx2 = to.x - Math.max(60, Math.abs(dx) * 0.5);
  return (
    <svg style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', pointerEvents: 'none', zIndex: 9990 }}>
      <defs>
        <marker id="rb-arrow" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
          <path d="M0,0 L0,6 L8,3 z" fill="#60a5fa" />
        </marker>
      </defs>
      <path
        d={`M${from.x},${from.y} C${cx1},${from.y} ${cx2},${to.y} ${to.x},${to.y}`}
        stroke="#60a5fa" strokeWidth="2" fill="none"
        strokeDasharray="8 4" markerEnd="url(#rb-arrow)" opacity="0.9"
      />
      <circle cx={from.x} cy={from.y} r="4" fill="#60a5fa" opacity="0.9" />
    </svg>
  );
}

// ── WBS helpers ─────────────────────────────────────────────────────────────

function nextSectionWbs(tasks) {
  const nums = tasks.filter((t) => t.wbs && !t.wbs.includes('.')).map((t) => parseInt(t.wbs, 10)).filter((n) => !isNaN(n));
  return nums.length ? (Math.max(...nums) + 1).toString() : '1';
}
function nextChildWbs(secWbs, tasks) {
  const children = tasks.filter((t) => t.wbs?.startsWith(secWbs + '.') && t.wbs.split('.').length === 2).map((t) => parseInt(t.wbs.split('.')[1], 10)).filter((n) => !isNaN(n));
  return `${secWbs}.${children.length ? Math.max(...children) + 1 : 1}`;
}

// ── Context Menu ────────────────────────────────────────────────────────────

function ContextMenu({ menu, onClose, onAction }) {
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [onClose]);
  if (!menu) return null;
  const { x, y, type, row } = menu;
  const MENUS = {
    empty:   [{ label: '＋  Add New Section', action: 'addSection' }],
    section: [
      { label: '＋  Add Task Here', action: 'addTask' },
      { sep: true },
      { label: '✕  Delete Section & All Tasks', action: 'deleteSection', danger: true },
    ],
    task: [
      { label: '＋  Add Task Below', action: 'addTaskBelow' },
      { sep: true },
      { label: '✕  Delete Task', action: 'deleteTask', danger: true },
    ],
  };
  const items = MENUS[type] || MENUS.empty;
  return (
    <div ref={ref} style={{ position: 'fixed', left: Math.min(x, window.innerWidth - 220), top: Math.min(y, window.innerHeight - 240), zIndex: 9999, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '4px 0', minWidth: 210, boxShadow: '0 8px 32px rgba(0,0,0,0.55)', fontSize: 13 }}>
      {items.map((item, i) => item.sep
        ? <div key={i} style={{ borderTop: '1px solid var(--border)', margin: '3px 0' }} />
        : <div key={i}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => { onAction(item.action, row); onClose(); }}
            style={{ padding: '8px 16px', cursor: 'pointer', color: item.danger ? 'var(--danger)' : 'var(--text)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = item.danger ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.07)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >{item.label}</div>
      )}
    </div>
  );
}

// ── Column definitions ──────────────────────────────────────────────────────

const STATUS_OPTIONS = ['not_started', 'in_progress', 'complete', 'on_hold'];
const PRIORITY_OPTIONS = ['low', 'medium', 'high', 'critical'];

function AssignedToCell({ value, data, resources, onAssignedToUpdate, onAddResource, readOnly = false }) {
  const [open, setOpen] = useState(false);
  const [dropPos, setDropPos] = useState({ top: 0, left: 0 });
  const [addingNew, setAddingNew] = useState(false);
  const [newName, setNewName] = useState('');
  const triggerRef = useRef(null);
  const panelRef = useRef(null);

  if (data?._isSection) return null;

  const selected = value ? value.split(',').map((s) => s.trim()).filter(Boolean) : [];

  const openMenu = (e) => {
    if (readOnly) return;
    e.stopPropagation();
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) setDropPos({ top: rect.bottom + 2, left: rect.left });
    setOpen((o) => !o);
  };

  const toggle = (name) => {
    const next = selected.includes(name) ? selected.filter((n) => n !== name) : [...selected, name];
    onAssignedToUpdate(data.id, next.join(', '));
  };

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (!panelRef.current?.contains(e.target) && !triggerRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const submitNew = async () => {
    const trimmed = newName.trim();
    if (trimmed) {
      await onAddResource(trimmed);
      onAssignedToUpdate(data.id, [...selected, trimmed].join(', '));
    }
    setAddingNew(false);
    setNewName('');
  };

  const panel = open && createPortal(
    <div
      ref={panelRef}
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'fixed', top: dropPos.top, left: dropPos.left,
        background: 'var(--bg-secondary, #1e293b)',
        border: '1px solid var(--border, #334155)',
        borderRadius: 6, boxShadow: '0 6px 20px rgba(0,0,0,0.6)',
        zIndex: 99999, minWidth: 180, maxHeight: 240, overflowY: 'auto',
        padding: '4px 0',
      }}
    >
      {resources.length === 0 && (
        <div style={{ padding: '6px 14px', fontSize: 12, color: 'var(--text-muted, #94a3b8)' }}>No resources yet</div>
      )}
      {resources.map((r) => (
        <label
          key={r.id}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 13, color: 'var(--text-primary, #f1f5f9)', userSelect: 'none' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          <input
            type="checkbox"
            checked={selected.includes(r.name)}
            onChange={() => toggle(r.name)}
            style={{ accentColor: '#3b82f6', width: 14, height: 14, flexShrink: 0, cursor: 'pointer' }}
          />
          {r.name}
        </label>
      ))}
      <div style={{ borderTop: '1px solid var(--border, #334155)', margin: '4px 0' }} />
      {addingNew ? (
        <div style={{ display: 'flex', gap: 4, padding: '4px 10px', alignItems: 'center' }}>
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submitNew(); if (e.key === 'Escape') { setAddingNew(false); setNewName(''); } e.stopPropagation(); }}
            placeholder="Name..."
            style={{ flex: 1, background: 'var(--bg, #0f172a)', border: '1px solid #60a5fa', borderRadius: 4, color: 'var(--text, #f1f5f9)', padding: '3px 8px', fontSize: 12, outline: 'none', minWidth: 0 }}
          />
          <button onClick={submitNew} style={{ background: '#3b82f6', border: 'none', borderRadius: 4, color: '#fff', cursor: 'pointer', padding: '3px 10px', fontSize: 12, flexShrink: 0 }}>OK</button>
        </div>
      ) : (
        <div
          style={{ padding: '6px 14px', cursor: 'pointer', fontSize: 13, color: '#60a5fa' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(96,165,250,0.1)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          onClick={() => setAddingNew(true)}
        >
          ＋ Add new resource...
        </div>
      )}
    </div>,
    document.body
  );

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center' }}>
      <div
        ref={triggerRef}
        onClick={openMenu}
        style={{ display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'nowrap', overflow: 'hidden', cursor: 'pointer', width: '100%', height: '100%', padding: '0 4px' }}
      >
        {selected.length === 0
          ? <span style={{ color: 'var(--text-muted)', fontSize: 12, opacity: 0.5 }}>— unassigned —</span>
          : <>
              {selected.slice(0, 2).map((name) => (
                <span key={name} style={{ background: 'rgba(59,130,246,0.18)', color: '#93c5fd', borderRadius: 10, padding: '1px 8px', fontSize: 11, border: '1px solid rgba(59,130,246,0.3)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {name}
                </span>
              ))}
              {selected.length > 2 && (
                <span style={{ color: 'var(--text-muted)', fontSize: 11, whiteSpace: 'nowrap', flexShrink: 0 }}>+{selected.length - 2}</span>
              )}
            </>
        }
      </div>
      {panel}
    </div>
  );
}

// ── Formula evaluator ────────────────────────────────────────────────────────
function evaluateFormula(raw, hourlyRate) {
  if (raw == null || raw === '') return 0;
  let expr = String(raw).trim().replace(/[$,]/g, '');
  if (!expr.startsWith('=')) {
    const n = parseFloat(expr);
    return isNaN(n) ? 0 : Math.round(n * 100) / 100;
  }
  expr = expr.slice(1);
  expr = expr.replace(/\bhourly_rate\b|\bhourly\b|\bhou\b/gi, String(Number(hourlyRate) || 0));
  if (!/^[\d\s+\-*/().%]+$/.test(expr)) return 0;
  try {
    // eslint-disable-next-line no-new-func
    const result = new Function('"use strict"; return (' + expr + ')')();
    return typeof result === 'number' && isFinite(result) ? Math.round(result * 100) / 100 : 0;
  } catch (_) { return 0; }
}

// ── Cost formula cell editor ──────────────────────────────────────────────────
const CostEditor = forwardRef(function CostEditor({ value, hourlyRate, stopEditing }, ref) {
  const [raw, setRaw] = useState(() => (value != null && value !== 0 ? String(value) : ''));
  const [suggestion, setSuggestion] = useState(false);
  const inputRef = useRef(null);
  const suggestionRef = useRef(null);

  useImperativeHandle(ref, () => ({
    getValue: () => evaluateFormula(raw, hourlyRate),
    isCancelBeforeStart: () => false,
    isCancelAfterEnd: () => false,
  }));

  useEffect(() => { setTimeout(() => inputRef.current?.select(), 0); }, []);

  const handleChange = (e) => {
    const v = e.target.value;
    setRaw(v);
    if (v.startsWith('=')) {
      const token = (v.slice(1).match(/([a-zA-Z_]*)$/) || ['', ''])[1].toLowerCase();
      setSuggestion(token.length >= 2 && 'hourly_rate'.startsWith(token) && token !== 'hourly_rate');
    } else {
      setSuggestion(false);
    }
  };

  const acceptSuggestion = () => {
    setRaw((prev) => prev.replace(/[a-zA-Z_]*$/, 'hourly_rate'));
    setSuggestion(false);
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        const len = inputRef.current.value.length;
        inputRef.current.setSelectionRange(len, len);
      }
    }, 0);
  };

  const handleKeyDown = (e) => {
    if ((e.key === 'Tab' || e.key === 'ArrowRight') && suggestion) {
      e.preventDefault();
      e.stopPropagation();
      e.nativeEvent?.stopImmediatePropagation?.();
      acceptSuggestion();
      return;
    }
    if (e.key === 'Enter') { stopEditing(); }
    if (e.key === 'Escape') { setRaw(value != null ? String(value) : ''); stopEditing(); }
    e.stopPropagation();
  };

  const isFormula = raw.startsWith('=');

  // Position suggestion below the input using a portal
  const [inputRect, setInputRect] = useState(null);
  useEffect(() => {
    if (suggestion && inputRef.current) {
      setInputRect(inputRef.current.getBoundingClientRect());
    }
  }, [suggestion]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <input
        ref={inputRef}
        value={raw}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="e.g. =hourly_rate*8"
        style={{
          width: '100%', height: '100%', padding: '0 8px',
          background: isFormula ? '#0f2744' : 'var(--surface2, #1e293b)',
          color: isFormula ? '#93c5fd' : 'var(--text, #f1f5f9)',
          border: '2px solid #3b82f6', outline: 'none', fontSize: 13,
          fontFamily: isFormula ? 'monospace' : 'inherit',
          boxSizing: 'border-box',
        }}
      />
      {suggestion && inputRect && createPortal(
        <div
          ref={suggestionRef}
          onMouseDown={(e) => { e.preventDefault(); acceptSuggestion(); }}
          style={{
            position: 'fixed', top: inputRect.bottom + 2, left: inputRect.left,
            background: '#1e293b', border: '1px solid #3b82f6', borderRadius: 5,
            padding: '5px 12px', fontSize: 12, color: '#93c5fd',
            boxShadow: '0 4px 14px rgba(0,0,0,0.6)', cursor: 'pointer', whiteSpace: 'nowrap',
            zIndex: 99999,
          }}
        >
          <span style={{ color: '#475569' }}>Tab → </span>
          <strong>hourly_rate</strong>
          <span style={{ color: '#475569', marginLeft: 10 }}>${Number(hourlyRate || 0).toFixed(2)}/hr</span>
        </div>,
        document.body
      )}
    </div>
  );
});

function createColumnDefs(allTasksRef, onOpenEditor, onLinkStart, onDurationUpdate, onLagUpdate, resources, onAssignedToUpdate, onAddResource, hourlyRate, readOnly = false) {
  const ed = (fn) => readOnly ? false : fn; // wrap editable functions
  return [
    { colId: 'drag', headerName: '', width: 36, rowDrag: !readOnly, sortable: false, filter: false, resizable: false, suppressMovable: true, suppressSizeToFit: true, cellStyle: { display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'grab', color: 'var(--text-muted)', fontSize: 16, userSelect: 'none' }, cellRenderer: () => '⠿' },
    { colId: 'link', headerName: '', width: readOnly ? 0 : 36, sortable: false, filter: false, resizable: false, suppressMovable: true, suppressSizeToFit: true, hide: readOnly, cellRenderer: LinkCell, cellRendererParams: { onLinkStart, readOnly }, cellStyle: { display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 } },
    { field: 'wbs', headerName: 'WBS', width: 70, sortable: true, cellRenderer: WbsCell, cellStyle: { display: 'flex', alignItems: 'center' } },
    { field: 'name', headerName: 'Task / Section', flex: 2, minWidth: 200, editable: ed(() => true), cellRenderer: NameCell, cellStyle: { display: 'flex', alignItems: 'center', gap: 4 } },
    { field: 'start_date', headerName: 'Start', width: 120, editable: ed((p) => !p.data?._isSection), cellRenderer: DateCell, cellEditor: 'agDateStringCellEditor', cellStyle: { display: 'flex', alignItems: 'center' } },
    { field: 'end_date', headerName: 'End', width: 120, editable: ed((p) => !p.data?._isSection), cellRenderer: DateCell, cellEditor: 'agDateStringCellEditor', cellStyle: { display: 'flex', alignItems: 'center' } },
    { field: 'duration_days', headerName: 'Days', width: 78, editable: false, suppressClickEdit: true, sortable: true, cellRenderer: DurationCell, cellRendererParams: { onDurationUpdate, readOnly }, cellStyle: { display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 } },
    {
      colId: 'lag', headerName: 'Lag/Lead', width: 92, sortable: false, filter: false,
      editable: false, suppressClickEdit: true,
      valueGetter: (p) => { if (p.data?._isSection) return null; const deps = parseDeps(p.data?.predecessor_ids).filter((d) => d.id); return deps.length ? deps[0].lag : null; },
      cellRenderer: LagCell,
      cellRendererParams: { onLagUpdate, readOnly },
      cellStyle: { display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 },
    },
    { field: 'percent_complete', headerName: '% Done', width: 130, editable: ed((p) => !p.data?._isSection), type: 'numericColumn', cellRenderer: ProgressCell, cellStyle: { display: 'flex', alignItems: 'center' } },
    { field: 'status', headerName: 'Status', width: 130, editable: ed((p) => !p.data?._isSection), cellRenderer: (p) => p.data?._isSection ? null : <StatusCell value={p.value} />, cellEditor: 'agSelectCellEditor', cellEditorParams: { values: STATUS_OPTIONS }, cellStyle: { display: 'flex', alignItems: 'center' } },
    { field: 'priority', headerName: 'Priority', width: 100, editable: ed((p) => !p.data?._isSection), cellRenderer: (p) => p.data?._isSection ? null : <PriorityCell value={p.value} />, cellEditor: 'agSelectCellEditor', cellEditorParams: { values: PRIORITY_OPTIONS }, cellStyle: { display: 'flex', alignItems: 'center' } },
    { field: 'cost', headerName: 'Cost (USD)', width: 125, editable: ed((p) => !p.data?._isSection), type: 'numericColumn', cellRenderer: CostCell, ...(readOnly ? {} : { cellEditor: CostEditor, cellEditorParams: { hourlyRate } }), cellStyle: (p) => ({ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', background: p.data?._isSection ? 'rgba(52,211,153,0.06)' : 'transparent' }) },
    { field: 'assigned_to', headerName: 'Assigned To', width: 155, editable: false, suppressClickEdit: true, cellRenderer: AssignedToCell, cellRendererParams: { resources, onAssignedToUpdate, onAddResource, readOnly }, cellStyle: { display: 'flex', alignItems: 'center', padding: '0 4px' } },
    { field: 'predecessor_ids', headerName: 'Predecessors', width: 175, editable: false, suppressClickEdit: true, cellRenderer: PredecessorsCell, cellRendererParams: { allTasksRef, onOpenEditor, readOnly }, cellStyle: { display: 'flex', alignItems: 'center' } },
    { field: 'notes', headerName: 'Notes', flex: 1, minWidth: 100, editable: ed((p) => !p.data?._isSection), cellStyle: { display: 'flex', alignItems: 'center', color: 'var(--text-muted)' } },
  ];
}

// ── Column chooser ─────────────────────────────────────────────────────────
const CHOOSABLE_COLS = [
  { id: 'wbs',              label: 'WBS' },
  { id: 'start_date',       label: 'Start Date' },
  { id: 'end_date',         label: 'End Date' },
  { id: 'duration_days',    label: 'Days' },
  { id: 'lag',              label: 'Lag / Lead' },
  { id: 'percent_complete', label: '% Done' },
  { id: 'status',           label: 'Status' },
  { id: 'priority',         label: 'Priority' },
  { id: 'cost',             label: 'Cost (USD)' },
  { id: 'assigned_to',      label: 'Assigned To' },
  { id: 'predecessor_ids',  label: 'Predecessors' },
  { id: 'notes',            label: 'Notes' },
];

function ColumnChooserPanel({ pos, gridApi, onToggle, onClose }) {
  const ref = useRef(null);
  const colState = gridApi?.getColumnState() || [];
  const visMap = {};
  for (const cs of colState) visMap[cs.colId] = !cs.hide;

  useEffect(() => {
    const handler = (e) => { if (!ref.current?.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return createPortal(
    <div
      ref={ref}
      style={{
        position: 'fixed', top: pos.top, left: pos.left,
        background: 'var(--bg-secondary, #1e293b)',
        border: '1px solid var(--border, #334155)',
        borderRadius: 8, boxShadow: '0 6px 24px rgba(0,0,0,0.6)',
        zIndex: 99999, width: 210, padding: '8px 0',
      }}
    >
      <div style={{ padding: '4px 14px 8px', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-muted, #64748b)', textTransform: 'uppercase' }}>
        Toggle Columns
      </div>
      <div style={{ borderBottom: '1px solid var(--border, #334155)', marginBottom: 4 }} />
      {CHOOSABLE_COLS.map((col) => (
        <label
          key={col.id}
          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 14px', cursor: 'pointer', fontSize: 13, color: 'var(--text-primary, #f1f5f9)', userSelect: 'none' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          <input
            type="checkbox"
            checked={visMap[col.id] !== false}
            onChange={() => onToggle(col.id, visMap[col.id] !== false)}
            style={{ accentColor: '#3b82f6', width: 14, height: 14, cursor: 'pointer', flexShrink: 0 }}
          />
          {col.label}
        </label>
      ))}
      <div style={{ borderTop: '1px solid var(--border, #334155)', margin: '4px 0' }} />
      <div
        style={{ padding: '6px 14px', fontSize: 12, color: '#60a5fa', cursor: 'pointer' }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(96,165,250,0.1)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        onClick={() => { CHOOSABLE_COLS.forEach((col) => onToggle(col.id, false)); onClose(); }}
      >
        Show all columns
      </div>
    </div>,
    document.body
  );
}

// ── Main component ──────────────────────────────────────────────────────────

export default function TaskGrid({ tasks, projectId, hourlyRate, onUpdate = () => Promise.resolve(), onAdd = () => {}, onDelete = () => {}, onRefetch = () => {}, readOnly = false, colState = null }) {
  const gridRef = useRef(null);
  const [quickFilter, setQuickFilter] = useState('');
  const [depEditorTask, setDepEditorTask] = useState(null);
  const [ctxMenu, setCtxMenu] = useState(null);
  const [showColChooser, setShowColChooser] = useState(false);
  const [colChooserPos, setColChooserPos] = useState({ top: 0, left: 0 });
  const colBtnRef = useRef(null);

  const allTasksRef = useRef(tasks);
  allTasksRef.current = tasks;

  // ── Resources ───────────────────────────────────────────────────
  const [resources, setResources] = useState([]);
  useEffect(() => {
    if (!projectId) return;
    fetch(`/api/resources/project/${projectId}`)
      .then((r) => r.json())
      .then(setResources)
      .catch(() => {});
  }, [projectId]);

  const handleAddResource = useCallback(async (name) => {
    if (!projectId) return;
    try {
      const res = await fetch('/api/resources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId, name }),
      });
      const newResource = await res.json();
      setResources((prev) => {
        if (prev.find((r) => r.id === newResource.id)) return prev;
        return [...prev, newResource].sort((a, b) => a.name.localeCompare(b.name));
      });
    } catch (err) { console.error('addResource:', err); }
  }, [projectId]);

  // ── Link-drag (rubber band) ─────────────────────────────────────────────
  const linkDragRef = useRef(null);
  const [linkDragState, setLinkDragState] = useState(null);
  const [depEditorPresetId, setDepEditorPresetId] = useState(null);

  const handleLinkStart = useCallback((fromTask, x, y) => {
    const state = { fromTask, from: { x, y }, to: { x, y } };
    linkDragRef.current = state;
    setLinkDragState(state);
  }, []);

  // Mount-once document listeners; read state from ref to avoid stale closures
  useEffect(() => {
    const onMove = (e) => {
      if (!linkDragRef.current) return;
      const next = { ...linkDragRef.current, to: { x: e.clientX, y: e.clientY } };
      linkDragRef.current = next;
      setLinkDragState({ ...next });
    };
    const onUp = (e) => {
      const drag = linkDragRef.current;
      if (!drag) return;
      linkDragRef.current = null;
      setLinkDragState(null);
      // Find the AG Grid row under the cursor
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const rowEl = el?.closest('[row-id]');
      const rowId = rowEl?.getAttribute('row-id');
      const fromIdStr = String(drag.fromTask.id);
      if (rowId && rowId !== fromIdStr && !rowId.startsWith('_')) {
        const targetTask = allTasksRef.current.find((t) => String(t.id) === rowId);
        if (targetTask && !targetTask._isSection) {
          setDepEditorTask(drag.fromTask);
          setDepEditorPresetId(targetTask.id); // use original type from data
        }
      }
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, []); // mount once — reads from ref

  const dragOverRowRef = useRef(null);
  const clearDragHighlight = useCallback(() => {
    if (dragOverRowRef.current) {
      dragOverRowRef.current.classList.remove('row-drop-target');
      dragOverRowRef.current = null;
    }
  }, []);
  const onRowDragMove = useCallback((params) => {
    clearDragHighlight();
    const overNode = params.overNode;
    if (!overNode) return;
    const draggedIsSection = !!(params.node?.data?._isSection);
    let highlightId = overNode.data?.id;
    // When dragging a section, snap the visual indicator to a section boundary:
    // hovering over a child → highlight the LAST child of that section block
    if (draggedIsSection && overNode.data && !overNode.data._isSection) {
      const parentWbs = overNode.data.wbs?.split('.')[0];
      if (parentWbs) {
        const sorted = [...allTasksRef.current].sort((a, b) => (a.row_order ?? 0) - (b.row_order ?? 0));
        const lastChild = [...sorted].reverse().find((t) => t.wbs?.startsWith(parentWbs + '.'));
        if (lastChild) highlightId = lastChild.id;
      }
    }
    if (highlightId && !highlightId.startsWith('_')) {
      const el = document.querySelector(`.ag-row[row-id="${highlightId}"]`);
      if (el) { el.classList.add('row-drop-target'); dragOverRowRef.current = el; }
    }
  }, [clearDragHighlight]);
  const onRowDragLeave = useCallback(() => clearDragHighlight(), [clearDragHighlight]);

  const handleOpenEditor = useCallback((task) => setDepEditorTask(task), []);
  const closeCtxMenu = useCallback(() => setCtxMenu(null), []);

  // Apply a set of updated task objects to the grid in-place (no remount of cell renderers)
  const applyTaskUpdates = useCallback((changedTasks) => {
    const map = new Map(changedTasks.map((t) => [t.id, t]));
    allTasksRef.current = allTasksRef.current.map((x) => map.get(x.id) ?? x);
    // Recompute section totals for any section whose children were affected
    const affectedSectionWbss = new Set(
      changedTasks.map((t) => t.wbs?.split('.')[0]).filter(Boolean)
    );
    const sectionUpdates = [...affectedSectionWbss].flatMap((secWbs) => {
      const secRow = allTasksRef.current.find((t) => t.wbs === secWbs && !t.wbs.includes('.'));
      if (!secRow) return [];
      const children = allTasksRef.current.filter((c) => c.wbs?.startsWith(secWbs + '.'));
      const childCost = children.reduce((s, c) => s + (Number(c.cost) || 0), 0);
      const childDuration = children.reduce((s, c) => s + (Number(c.duration_days) || 0), 0);
      return [{ ...secRow, _isSection: true, cost: childCost, duration_days: childDuration }];
    });
    gridRef.current?.api?.applyTransaction({ update: [...changedTasks, ...sectionUpdates] });
  }, []);

  const handleDurationUpdate = useCallback(async (taskId, newDuration) => {
    const row = allTasksRef.current.find((t) => t.id === taskId);
    if (!row) return;
    const dur = Math.max(1, newDuration);
    let updated = { ...row, duration_days: dur };
    try { if (updated.start_date && dur > 0) updated.end_date = format(addDays(parseISO(updated.start_date), dur - 1), 'yyyy-MM-dd'); } catch (_) {}
    const changed = [updated];
    const merged = allTasksRef.current.map((x) => (x.id === updated.id ? updated : x));
    for (const upd of cascadeSchedule(updated.id, merged)) {
      const tgt = merged.find((x) => x.id === upd.id);
      if (tgt) { const next = { ...tgt, ...upd }; changed.push(next); }
    }
    applyTaskUpdates(changed);
    for (const t of changed) await onUpdate(t.id, t);
  }, [onUpdate, applyTaskUpdates]);

  const handleLagUpdate = useCallback(async (taskId, newLag) => {
    const row = allTasksRef.current.find((t) => t.id === taskId);
    if (!row) return;
    const deps = parseDeps(row.predecessor_ids);
    const idx = deps.findIndex((d) => d.id);
    if (idx === -1) return;
    deps[idx] = { ...deps[idx], lag: newLag };
    const updated = { ...row, predecessor_ids: JSON.stringify(deps) };
    const changed = [updated];
    let merged = allTasksRef.current.map((x) => (x.id === updated.id ? updated : x));
    const nd = computeTaskDates(updated, merged);
    const base = nd ? { ...updated, ...nd } : updated;
    if (nd) { changed[0] = base; merged = merged.map((x) => (x.id === base.id ? base : x)); }
    for (const upd of cascadeSchedule(base.id, merged)) {
      const tgt = merged.find((x) => x.id === upd.id);
      if (tgt) { const next = { ...tgt, ...upd }; changed.push(next); }
    }
    applyTaskUpdates(changed);
    for (const t of changed) await onUpdate(t.id, t);
  }, [onUpdate, applyTaskUpdates]);

  const handleAssignedToUpdate = useCallback(async (taskId, name) => {
    const row = allTasksRef.current.find((t) => t.id === taskId);
    if (!row) return;
    const updated = { ...row, assigned_to: name };
    allTasksRef.current = allTasksRef.current.map((x) => (x.id === taskId ? updated : x));
    gridRef.current?.api?.applyTransaction({ update: [updated] });
    await onUpdate(taskId, updated);
  }, [onUpdate]);

  const columnDefs = useMemo(() => createColumnDefs(allTasksRef, handleOpenEditor, handleLinkStart, handleDurationUpdate, handleLagUpdate, resources, handleAssignedToUpdate, handleAddResource, hourlyRate, readOnly), [handleOpenEditor, handleLinkStart, handleDurationUpdate, handleLagUpdate, resources, handleAssignedToUpdate, handleAddResource, hourlyRate, readOnly]);

  // Overlay section cost + duration = sum of children; mark section rows
  const rowData = useMemo(() => tasks.map((t) => {
    const isSection = !!(t.wbs && !t.wbs.includes('.'));
    if (!isSection) return t;
    const children = tasks.filter((c) => c.wbs?.startsWith(t.wbs + '.'));
    const childCost = children.reduce((s, c) => s + (Number(c.cost) || 0), 0);
    const childDuration = children.reduce((s, c) => s + (Number(c.duration_days) || 0), 0);
    return { ...t, _isSection: true, cost: childCost, duration_days: childDuration };
  }), [tasks]);

  const grandTotalRow = useMemo(() => {
    const total = tasks.filter((t) => !t.wbs || t.wbs.includes('.')).reduce((s, t) => s + (Number(t.cost) || 0), 0);
    return [{ id: '_grand_total', name: 'PROJECT TOTAL', cost: total, _isSection: true }];
  }, [tasks]);

  const defaultColDef = useMemo(() => ({ sortable: true, filter: true, resizable: true, suppressMovable: false }), []);

  // Right-click: empty area
  const handleWrapperContextMenu = useCallback((e) => {
    e.preventDefault();
    if (!e.target.closest('.ag-cell')) setCtxMenu({ x: e.clientX, y: e.clientY, type: 'empty', row: null });
  }, []);

  // Right-click: cell
  const handleCellContextMenu = useCallback((params) => {
    if (!params.event) return;
    params.event.preventDefault();
    params.event.stopPropagation();
    const { clientX, clientY } = params.event;
    setCtxMenu({ x: clientX, y: clientY, type: params.data?._isSection ? 'section' : 'task', row: params.data });
  }, []);

  // Context menu actions
  const handleCtxAction = useCallback(async (action, row) => {
    const all = allTasksRef.current;
    const sorted = [...all].sort((a, b) => (a.row_order ?? 0) - (b.row_order ?? 0));
    if (action === 'addSection') {
      const maxOrder = sorted.length ? sorted[sorted.length - 1].row_order ?? sorted.length : 0;
      await onAdd({ name: 'New Section', wbs: nextSectionWbs(all), row_order: maxOrder + 1 });
      if (onRefetch) await onRefetch();
    }
    if (action === 'addTask' && row) {
      // Insert after the last child of this section (or after the header if no children)
      const sectionChildren = sorted.filter((t) => t.wbs?.startsWith(row.wbs + '.'));
      const lastInSection = sectionChildren.length
        ? sectionChildren[sectionChildren.length - 1]
        : row;
      const insertOrder = (lastInSection.row_order ?? 0) + 1;
      await onAdd({ name: 'New Task', wbs: nextChildWbs(row.wbs, all), start_date: new Date().toISOString().split('T')[0], duration_days: 1, percent_complete: 0, status: 'not_started', priority: 'medium', row_order: insertOrder });
      if (onRefetch) await onRefetch();
    }
    if (action === 'addTaskBelow' && row) {
      const sec = row.wbs?.split('.')[0];
      const insertOrder = (row.row_order ?? 0) + 1;
      await onAdd({ name: 'New Task', wbs: sec ? nextChildWbs(sec, all) : undefined, start_date: new Date().toISOString().split('T')[0], duration_days: 1, percent_complete: 0, status: 'not_started', priority: 'medium', row_order: insertOrder });
      if (onRefetch) await onRefetch();
    }
    if (action === 'deleteTask' && row) await onDelete(row.id);
    if (action === 'deleteSection' && row) {
      for (const c of all.filter((t) => t.wbs?.startsWith(row.wbs + '.'))) await onDelete(c.id);
      await onDelete(row.id);
    }
  }, [onAdd, onDelete, onUpdate, onRefetch]);

  // Cell value changed
  const onCellValueChanged = useCallback(async (params) => {
    const field = params.colDef.field;
    const colId = params.colDef.colId;
    // Section rows: only allow name edits
    if (params.data?._isSection) {
      if (field !== 'name') return;
      try {
        const orig = allTasksRef.current.find((t) => t.id === params.data.id);
        if (orig) await onUpdate(params.data.id, { ...orig, name: params.data.name });
      } catch (err) { console.error('section rename:', err); }
      return;
    }
    if (colId === 'lag') {
      const t = { ...params.data };
      try {
        await onUpdate(t.id, t);
        const merged = allTasksRef.current.map((x) => (x.id === t.id ? t : x));
        const nd = computeTaskDates(t, merged);
        const base = nd ? { ...t, ...nd } : t;
        if (nd) await onUpdate(base.id, base);
        const ma = merged.map((x) => (x.id === base.id ? base : x));
        for (const upd of cascadeSchedule(base.id, ma)) { const tgt = ma.find((x) => x.id === upd.id); if (tgt) await onUpdate(upd.id, { ...tgt, ...upd }); }
      } catch (err) { console.error('lag:', err); }
      return;
    }
    let u = { ...params.data };
    try {
      if (field === 'duration_days' && u.start_date && u.duration_days > 0) u.end_date = format(addDays(parseISO(u.start_date), u.duration_days - 1), 'yyyy-MM-dd');
      else if (field === 'start_date' && u.start_date && u.duration_days > 0) u.end_date = format(addDays(parseISO(u.start_date), u.duration_days - 1), 'yyyy-MM-dd');
      else if (field === 'end_date' && u.start_date && u.end_date) u.duration_days = Math.max(1, differenceInCalendarDays(parseISO(u.end_date), parseISO(u.start_date)) + 1);
    } catch (_) {}
    try {
      await onUpdate(u.id, u);
      if (['start_date', 'end_date', 'duration_days'].includes(field)) {
        const merged = allTasksRef.current.map((x) => (x.id === u.id ? u : x));
        for (const upd of cascadeSchedule(u.id, merged)) { const tgt = allTasksRef.current.find((x) => x.id === upd.id); if (tgt) await onUpdate(upd.id, { ...tgt, ...upd }); }
      }
    } catch (err) { console.error('cell:', err); }
  }, [onUpdate]);

  // Drag reorder
  const onRowDragEnd = useCallback(async (params) => {
    clearDragHighlight();
    const draggedId = params.node?.data?.id;
    if (!draggedId) return;

    // allSorted is always the reliable source of truth (never mutated by the grid).
    // suppressMoveWhenRowDragging ensures the grid model is untouched during drag.
    const allSorted = [...allTasksRef.current].sort((a, b) => (a.row_order ?? 0) - (b.row_order ?? 0));
    const draggedRow = allSorted.find((t) => t.id === draggedId);
    if (!draggedRow) return;

    const isSection = !!(draggedRow.wbs && !draggedRow.wbs.includes('.'));
    const dragChildren = isSection
      ? allSorted.filter((t) => t.wbs?.startsWith(draggedRow.wbs + '.'))
      : [];
    const dragGroupIds = new Set([draggedId, ...dragChildren.map((t) => t.id)]);
    const dragGroup = [draggedRow, ...dragChildren];
    const base = allSorted.filter((t) => !dragGroupIds.has(t.id));

    // overRow = the row under the cursor at release (the cursor stays on a non-dragged row
    // because suppressMoveWhenRowDragging means the grid never moves rows visually).
    const overNodeId = params.overNode?.data?.id;
    const overRow = overNodeId && !overNodeId.startsWith('_') && !dragGroupIds.has(overNodeId)
      ? base.find((t) => t.id === overNodeId)
      : null;

    // Return last index of a section block (header + all children) in base
    const lastIdxOfBlock = (secWbs) => {
      let last = base.findIndex((r) => r.wbs === secWbs && !r.wbs.includes('.'));
      base.forEach((r, i) => { if (r.wbs?.startsWith(secWbs + '.')) last = Math.max(last, i); });
      return last < 0 ? 0 : last;
    };

    let insertAt;
    if (!overRow) {
      // Released past the last row → append
      insertAt = base.length;
    } else {
      const overIdx = base.indexOf(overRow);
      const dragOrigIdx = allSorted.findIndex((t) => t.id === draggedId);
      const overOrigIdx = allSorted.findIndex((t) => t.id === overRow.id);
      const movingDown = dragOrigIdx < overOrigIdx;

      if (isSection) {
        const overSecWbs = overRow.wbs?.includes('.') ? overRow.wbs.split('.')[0] : overRow.wbs;
        if (movingDown) {
          // Insert after the complete block of the section we're hovering over/inside
          insertAt = lastIdxOfBlock(overSecWbs) + 1;
        } else {
          // Insert before the header of the section we're hovering over/inside
          const headerIdx = base.findIndex((r) => r.wbs === overSecWbs && !r.wbs.includes('.'));
          insertAt = headerIdx >= 0 ? headerIdx : overIdx;
        }
      } else {
        // Task drag: insert before or after the hovered row
        insertAt = movingDown ? overIdx + 1 : overIdx;
      }
    }

    const newOrder = [
      ...base.slice(0, insertAt),
      ...dragGroup,
      ...base.slice(insertAt),
    ];

    // Renumber WBS top-to-bottom
    let secNum = 0;
    const secIdToNum = {};
    const childCounters = {};
    const updates = newOrder.map((row, idx) => {
      const rowIsSection = !!(row.wbs && !row.wbs.includes('.'));
      let newWbs = row.wbs;
      if (rowIsSection) {
        secNum++;
        secIdToNum[row.id] = secNum;
        childCounters[secNum] = 0;
        newWbs = String(secNum);
      } else if (row.wbs?.includes('.')) {
        for (let i = idx - 1; i >= 0; i--) {
          const above = newOrder[i];
          if (above.wbs && !above.wbs.includes('.')) {
            const psn = secIdToNum[above.id];
            if (psn !== undefined) {
              childCounters[psn] = (childCounters[psn] || 0) + 1;
              newWbs = `${psn}.${childCounters[psn]}`;
            }
            break;
          }
        }
      }
      return { id: row.id, row_order: idx, wbs: newWbs };
    });

    const changed = updates.filter((u) => {
      const orig = allTasksRef.current.find((t) => t.id === u.id);
      return u.row_order !== (orig?.row_order ?? -1) || u.wbs !== orig?.wbs;
    });
    if (!changed.length) return;
    try {
      await fetch('/api/tasks/reorder', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates: changed }),
      });
      if (onRefetch) await onRefetch();
    } catch (err) { console.error('reorder:', err); }
  }, [clearDragHighlight, onRefetch]);

  // Dependency save
  const handleSaveDeps = useCallback(async (deps) => {
    if (!depEditorTask) return;
    const depsJson = JSON.stringify(deps);
    const td = { ...depEditorTask, predecessor_ids: depsJson };
    await onUpdate(td.id, td);
    const merged = allTasksRef.current.map((t) => (t.id === td.id ? td : t));
    const nd = computeTaskDates(td, merged);
    if (nd) {
      const rs = { ...td, ...nd };
      await onUpdate(rs.id, rs);
      const ma = merged.map((t) => (t.id === rs.id ? rs : t));
      for (const upd of cascadeSchedule(rs.id, ma)) { const tgt = ma.find((t) => t.id === upd.id); if (tgt) await onUpdate(upd.id, { ...tgt, ...upd }); }
    }
    gridRef.current?.api?.getRowNode(td.id)?.setDataValue('predecessor_ids', depsJson);
  }, [depEditorTask, onUpdate]);

  const handleExportCSV = useCallback(() => { gridRef.current?.api.exportDataAsCsv({ fileName: 'tasks.csv' }); }, []);

  // ── Column state persistence ─────────────────────────────────────────────
  const COL_STATE_KEY = 'pm_col_state';

  const saveColState = useCallback(() => {
    const state = gridRef.current?.api?.getColumnState();
    if (state) localStorage.setItem(COL_STATE_KEY, JSON.stringify(state));
  }, []);

  const onGridReady = useCallback(() => {
    // In read-only (web) mode, use the snapshot state passed as a prop.
    // In live mode, restore from localStorage.
    const stateToApply = readOnly
      ? colState
      : (() => { try { const s = localStorage.getItem(COL_STATE_KEY); return s ? JSON.parse(s) : null; } catch (_) { return null; } })();
    if (stateToApply) {
      try {
        gridRef.current?.api?.applyColumnState({ state: stateToApply, applyOrder: true });
      } catch (_) {}
    }
  }, [readOnly, colState]);

  const toggleCol = useCallback((colId, currentlyVisible) => {
    gridRef.current?.api?.applyColumnState({ state: [{ colId, hide: currentlyVisible }] });
    saveColState();
  }, [saveColState]);

  const openColChooser = useCallback((e) => {
    const rect = colBtnRef.current?.getBoundingClientRect();
    if (rect) setColChooserPos({ top: rect.bottom + 4, left: rect.right - 210 });
    setShowColChooser((v) => !v);
  }, []);

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 10 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input placeholder="Quick search..." value={quickFilter} onChange={(e) => setQuickFilter(e.target.value)}
            style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: 13, fontFamily: 'var(--font)', outline: 'none', width: 200 }} />
          {!readOnly && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => handleCtxAction('addSection', null)}
              title="Add a new section to the bottom of the schedule"
              style={{ display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' }}
            >
              ＋ Section
            </button>
          )}
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Right-click rows to add tasks · Drag rows to reorder</span>
          <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: 12 }}>{tasks.length} tasks</span>
          <button
            ref={colBtnRef}
            className="btn btn-secondary btn-sm"
            onClick={openColChooser}
            title="Show/hide columns"
            style={{ display: 'flex', alignItems: 'center', gap: 5 }}
          >
            ⊟ Columns
          </button>
          <button className="btn btn-secondary btn-sm" onClick={handleExportCSV} title="Export to CSV">↓ CSV</button>
        </div>
        <div className="ag-theme-alpine-dark" style={{ flex: 1, minHeight: 0 }} onContextMenu={handleWrapperContextMenu}>
          <AgGridReact
            ref={gridRef}
            rowData={rowData}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            quickFilterText={quickFilter}
            animateRows
            rowSelection="multiple"
            suppressRowClickSelection
            onCellValueChanged={onCellValueChanged}
            onCellContextMenu={handleCellContextMenu}
            getRowId={(params) => params.data.id}
            rowHeight={40}
            headerHeight={38}
            pinnedBottomRowData={grandTotalRow}
            rowClassRules={{ 'section-header-row': (p) => !!p.data?._isSection }}
            rowDragManaged
            suppressMoveWhenRowDragging
            onRowDragEnd={onRowDragEnd}
            onRowDragMove={onRowDragMove}
            onRowDragLeave={onRowDragLeave}
            onGridReady={onGridReady}
            onColumnMoved={saveColState}
            onColumnResized={saveColState}
            onColumnVisible={saveColState}
            onColumnPinned={saveColState}
          />
        </div>
      </div>
      <RubberBand drag={linkDragState} />
      <ContextMenu menu={ctxMenu} onClose={closeCtxMenu} onAction={handleCtxAction} />
      {showColChooser && (
        <ColumnChooserPanel
          pos={colChooserPos}
          gridApi={gridRef.current?.api}
          onToggle={toggleCol}
          onClose={() => setShowColChooser(false)}
        />
      )}
      {depEditorTask && (
        <DependencyEditor
          task={depEditorTask}
          allTasks={tasks.filter((t) => t.id !== depEditorTask.id)}
          onSave={handleSaveDeps}
          onClose={() => { setDepEditorTask(null); setDepEditorPresetId(null); }}
          presetDepId={depEditorPresetId}
        />
      )}
    </>
  );
}
