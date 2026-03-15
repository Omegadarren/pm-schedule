import React, { useState, useMemo } from 'react';

const DEP_TYPES = [
  { value: 'FS', label: 'FS — Finish to Start', desc: 'Successor starts after predecessor finishes' },
  { value: 'SS', label: 'SS — Start to Start',  desc: 'Successor starts when predecessor starts' },
  { value: 'FF', label: 'FF — Finish to Finish', desc: 'Successor finishes when predecessor finishes' },
  { value: 'SF', label: 'SF — Start to Finish',  desc: 'Successor finishes when predecessor starts' },
];

/** Parse stored predecessor_ids into [{id, type, lag}] regardless of old/new format */
export function parseDeps(raw) {
  try {
    const arr = typeof raw === 'string' ? JSON.parse(raw) : (raw || []);
    return arr.map((item) => {
      if (typeof item === 'string') return { id: item, type: 'FS', lag: 0 };
      return { id: item.id, type: item.type || 'FS', lag: item.lag ?? 0 };
    });
  } catch {
    return [];
  }
}

/** Format a single dep as a compact label, e.g. "1.2 FS+2d" */
export function depLabel(dep, allTasks) {
  const task = allTasks.find((t) => t.id === dep.id);
  const name = task ? (task.wbs || task.name.slice(0, 12)) : dep.id.slice(0, 6);
  const lagStr = dep.lag > 0 ? `+${dep.lag}d` : dep.lag < 0 ? `${dep.lag}d` : '';
  return `${name} ${dep.type}${lagStr}`;
}

function DepRow({ dep, allTasks, onChange, onRemove }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 110px 130px 36px',
      gap: 8,
      alignItems: 'center',
      padding: '6px 0',
      borderBottom: '1px solid var(--border)',
    }}>
      {/* Task selector */}
      <select
        value={dep.id}
        onChange={(e) => onChange({ ...dep, id: e.target.value })}
        style={{
          background: 'var(--bg)', border: '1px solid var(--border)',
          borderRadius: 4, color: 'var(--text)', padding: '4px 6px', fontSize: 12,
        }}
      >
        <option value="">— Select task —</option>
        {allTasks.map((t) => (
          <option key={t.id} value={t.id}>
            {t.wbs ? `${t.wbs} ` : ''}{t.name}
          </option>
        ))}
      </select>

      {/* Dependency type */}
      <select
        value={dep.type}
        onChange={(e) => onChange({ ...dep, type: e.target.value })}
        style={{
          background: 'var(--bg)', border: '1px solid var(--border)',
          borderRadius: 4, color: 'var(--text)', padding: '4px 6px', fontSize: 12,
        }}
      >
        {DEP_TYPES.map((dt) => (
          <option key={dt.value} value={dt.value}>{dt.value}</option>
        ))}
      </select>

      {/* Lag / Lead */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <input
          type="number"
          value={dep.lag}
          onChange={(e) => onChange({ ...dep, lag: parseInt(e.target.value, 10) || 0 })}
          style={{
            width: 64, background: 'var(--bg)', border: '1px solid var(--border)',
            borderRadius: 4, color: 'var(--text)', padding: '4px 6px', fontSize: 12,
            textAlign: 'center',
          }}
        />
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          {dep.lag > 0 ? 'lag' : dep.lag < 0 ? 'lead' : 'days'}
        </span>
      </div>

      {/* Remove */}
      <button
        onClick={onRemove}
        style={{
          background: 'transparent', border: 'none', color: 'var(--danger)',
          cursor: 'pointer', fontSize: 16, padding: 0, lineHeight: 1,
        }}
        title="Remove dependency"
      >×</button>
    </div>
  );
}

export default function DependencyEditor({ task, allTasks, onSave, onClose, presetDepId }) {
  const [deps, setDeps] = useState(() => {
    const existing = parseDeps(task.predecessor_ids);
    if (presetDepId && !existing.find((d) => d.id === presetDepId)) {
      return [...existing, { id: presetDepId, type: 'FS', lag: 0 }];
    }
    return existing;
  });

  // Exclude the task itself from the selectable list
  const selectableTasks = useMemo(
    () => allTasks.filter((t) => t.id !== task.id),
    [allTasks, task.id]
  );

  const addDep = () => setDeps((prev) => [...prev, { id: '', type: 'FS', lag: 0 }]);

  const updateDep = (i, updated) =>
    setDeps((prev) => prev.map((d, idx) => (idx === i ? updated : d)));

  const removeDep = (i) => setDeps((prev) => prev.filter((_, idx) => idx !== i));

  const handleSave = () => {
    const valid = deps.filter((d) => d.id);
    onSave(valid);
    onClose();
  };

  const depType = DEP_TYPES.find((dt) => deps.length === 1 && dt.value === deps[0]?.type);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: 560 }} onClick={(e) => e.stopPropagation()}>
        <h2>Task Dependencies</h2>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
          For: <strong style={{ color: 'var(--text)' }}>{task.wbs ? `${task.wbs} — ` : ''}{task.name}</strong>
        </p>

        {/* Column headers */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 110px 130px 36px',
          gap: 8,
          padding: '0 0 6px',
          fontSize: 11,
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          borderBottom: '1px solid var(--border)',
        }}>
          <span>Predecessor Task</span>
          <span>Type</span>
          <span>Lag (+) / Lead (−)</span>
          <span></span>
        </div>

        {/* Dependency rows */}
        <div style={{ minHeight: 40, maxHeight: 300, overflowY: 'auto', marginBottom: 8 }}>
          {deps.length === 0 ? (
            <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              No dependencies. Click "Add Link" to create one.
            </div>
          ) : (
            deps.map((dep, i) => (
              <DepRow
                key={i}
                dep={dep}
                allTasks={selectableTasks}
                onChange={(updated) => updateDep(i, updated)}
                onRemove={() => removeDep(i)}
              />
            ))
          )}
        </div>

        <button
          className="btn btn-secondary btn-sm"
          onClick={addDep}
          style={{ marginBottom: 16 }}
        >
          + Add Link
        </button>

        {/* Type legend */}
        <div style={{
          background: 'var(--bg)', borderRadius: 6, padding: '10px 12px',
          marginBottom: 16, fontSize: 11, color: 'var(--text-muted)',
        }}>
          {DEP_TYPES.map((dt) => (
            <div key={dt.value} style={{ marginBottom: 3 }}>
              <strong style={{ color: 'var(--text)', minWidth: 28, display: 'inline-block' }}>{dt.value}</strong>
              {' — '}{dt.desc}
            </div>
          ))}
          <div style={{ marginTop: 6 }}>
            <strong style={{ color: 'var(--text)' }}>Lag</strong> = positive days delay after link point &nbsp;|&nbsp;
            <strong style={{ color: 'var(--text)' }}>Lead</strong> = negative days (overlap / early start)
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>Save Dependencies</button>
        </div>
      </div>
    </div>
  );
}
