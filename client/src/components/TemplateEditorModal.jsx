import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const PRIORITY_OPTIONS = ['high', 'medium', 'low'];

const css = {
  overlay: {
    position: 'fixed', inset: 0, zIndex: 3000,
    background: 'rgba(0,0,0,0.6)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 16,
  },
  dialog: {
    background: 'var(--surface, #1e293b)',
    border: '1px solid var(--border, #334155)',
    borderRadius: 10,
    width: '100%', maxWidth: 760,
    maxHeight: '90vh',
    display: 'flex', flexDirection: 'column',
    boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
    overflow: 'hidden',
  },
  header: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '14px 18px',
    borderBottom: '1px solid var(--border, #334155)',
    flexShrink: 0,
  },
  body: {
    flex: 1, overflowY: 'auto', padding: '12px 16px',
  },
  footer: {
    padding: '12px 18px',
    borderTop: '1px solid var(--border, #334155)',
    display: 'flex', justifyContent: 'flex-end', gap: 10,
    flexShrink: 0,
  },
  input: {
    background: 'var(--surface2, #0f172a)',
    color: 'var(--text, #f1f5f9)',
    border: '1px solid var(--border, #334155)',
    borderRadius: 5, padding: '5px 8px',
    fontSize: 12, outline: 'none',
    fontFamily: 'inherit',
    width: '100%', boxSizing: 'border-box',
  },
  th: {
    textAlign: 'left', fontSize: 11,
    color: 'var(--text-muted, #64748b)',
    fontWeight: 600, letterSpacing: 0.4,
    padding: '0 6px 8px',
    borderBottom: '1px solid var(--border, #334155)',
    whiteSpace: 'nowrap',
  },
  td: {
    padding: '4px 6px', verticalAlign: 'middle',
  },
  iconBtn: {
    background: 'transparent', border: 'none',
    cursor: 'pointer', padding: '3px 5px',
    borderRadius: 4, fontSize: 13, lineHeight: 1,
    color: 'var(--text-muted, #64748b)',
    transition: 'color 0.1s, background 0.1s',
  },
};

export default function TemplateEditorModal({ templateId, onSaved, onClose }) {
  const [name, setName]     = useState('');
  const [tasks, setTasks]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const nameRef = useRef(null);

  useEffect(() => {
    axios.get(`/api/templates/${templateId}`).then(({ data }) => {
      setName(data.name);
      setTasks(data.tasks.map((t) => ({ ...t, _key: t.id })));
      setLoading(false);
      setTimeout(() => nameRef.current?.focus(), 50);
    });
  }, [templateId]);

  // ── Row mutations ────────────────────────────────────────────────────────
  const updateTask = (key, field, value) =>
    setTasks((prev) => prev.map((t) => t._key === key ? { ...t, [field]: value } : t));

  const addRow = () => {
    const key = `new-${Date.now()}`;
    setTasks((prev) => [...prev, {
      id: null, _key: key,
      wbs: '', name: '', duration_days: 1, priority: 'medium', notes: null,
    }]);
    // Scroll table to bottom after render
    setTimeout(() => {
      document.getElementById('tpl-task-table')
        ?.parentElement?.scrollTo({ top: 99999, behavior: 'smooth' });
    }, 30);
  };

  const deleteRow = (key) => setTasks((prev) => prev.filter((t) => t._key !== key));

  const moveRow = (idx, dir) => {
    const dest = idx + dir;
    setTasks((prev) => {
      if (dest < 0 || dest >= prev.length) return prev;
      const arr = [...prev];
      [arr[idx], arr[dest]] = [arr[dest], arr[idx]];
      return arr;
    });
  };

  // ── Save ────────────────────────────────────────────────────────────────
  const handleSave = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    const validTasks = tasks.filter((t) => t.name.trim());
    setSaving(true);
    try {
      await axios.put(`/api/templates/${templateId}`, { name: name.trim() });
      await axios.put(`/api/templates/${templateId}/tasks`, {
        tasks: validTasks.map((t, i) => ({
          id: t.id || null,
          wbs: t.wbs || null,
          name: t.name.trim(),
          duration_days: parseInt(t.duration_days) || 1,
          priority: t.priority || 'medium',
          notes: t.notes || null,
          row_order: i,
        })),
      });
      onSaved();
      onClose();
    } catch (err) {
      console.error('Template save failed:', err);
    } finally {
      setSaving(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={css.overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={css.dialog}>

        {/* Header */}
        <div style={css.header}>
          <span style={{ fontSize: 18 }}>📋</span>
          <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', flex: 1 }}>
            Edit Template
          </span>
          <button
            style={{ ...css.iconBtn, fontSize: 18, color: 'var(--text-muted)' }}
            onClick={onClose}
            title="Close"
          >✕</button>
        </div>

        {loading ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>
        ) : (
          <form onSubmit={handleSave} style={{ display: 'contents' }}>

            {/* Body */}
            <div style={css.body}>

              {/* Template name */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: 0.4, display: 'block', marginBottom: 5 }}>
                  TEMPLATE NAME
                </label>
                <input
                  ref={nameRef}
                  style={{ ...css.input, fontSize: 14, padding: '7px 10px' }}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Template name…"
                  required
                />
              </div>

              {/* Task table */}
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: 0.4, marginBottom: 6 }}>
                TASKS — {tasks.filter((t) => t.name.trim()).length} rows
              </div>

              <div style={{ border: '1px solid var(--border, #334155)', borderRadius: 6, overflow: 'hidden' }}>
                <table
                  id="tpl-task-table"
                  style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}
                >
                  <colgroup>
                    <col style={{ width: 72 }} />   {/* WBS */}
                    <col />                          {/* Name (flex) */}
                    <col style={{ width: 74 }} />   {/* Duration */}
                    <col style={{ width: 90 }} />   {/* Priority */}
                    <col style={{ width: 72 }} />   {/* Actions */}
                  </colgroup>
                  <thead style={{ background: 'var(--surface2, #0f172a)', position: 'sticky', top: 0 }}>
                    <tr>
                      <th style={css.th}>WBS</th>
                      <th style={css.th}>Task Name</th>
                      <th style={{ ...css.th, textAlign: 'center' }}>Days</th>
                      <th style={css.th}>Priority</th>
                      <th style={css.th} />
                    </tr>
                  </thead>
                  <tbody>
                    {tasks.length === 0 && (
                      <tr>
                        <td colSpan={5} style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                          No tasks yet — click + Add Row below
                        </td>
                      </tr>
                    )}
                    {tasks.map((task, idx) => (
                      <tr
                        key={task._key}
                        style={{ borderTop: idx === 0 ? 'none' : '1px solid var(--border, #1e293b)' }}
                      >
                        {/* WBS */}
                        <td style={css.td}>
                          <input
                            style={css.input}
                            value={task.wbs || ''}
                            onChange={(e) => updateTask(task._key, 'wbs', e.target.value)}
                            placeholder="1.1"
                          />
                        </td>

                        {/* Name */}
                        <td style={css.td}>
                          <input
                            style={css.input}
                            value={task.name}
                            onChange={(e) => updateTask(task._key, 'name', e.target.value)}
                            placeholder="Task name…"
                            required
                          />
                        </td>

                        {/* Duration */}
                        <td style={{ ...css.td, textAlign: 'center' }}>
                          <input
                            type="number"
                            min={1}
                            style={{ ...css.input, textAlign: 'center' }}
                            value={task.duration_days}
                            onChange={(e) => updateTask(task._key, 'duration_days', e.target.value)}
                          />
                        </td>

                        {/* Priority */}
                        <td style={css.td}>
                          <select
                            style={css.input}
                            value={task.priority}
                            onChange={(e) => updateTask(task._key, 'priority', e.target.value)}
                          >
                            {PRIORITY_OPTIONS.map((p) => (
                              <option key={p} value={p}>
                                {p.charAt(0).toUpperCase() + p.slice(1)}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Actions */}
                        <td style={{ ...css.td, display: 'flex', gap: 2, justifyContent: 'center' }}>
                          <button
                            type="button"
                            style={css.iconBtn}
                            onClick={() => moveRow(idx, -1)}
                            disabled={idx === 0}
                            title="Move up"
                            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted, #64748b)'; e.currentTarget.style.background = 'transparent'; }}
                          >↑</button>
                          <button
                            type="button"
                            style={css.iconBtn}
                            onClick={() => moveRow(idx, 1)}
                            disabled={idx === tasks.length - 1}
                            title="Move down"
                            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted, #64748b)'; e.currentTarget.style.background = 'transparent'; }}
                          >↓</button>
                          <button
                            type="button"
                            style={css.iconBtn}
                            onClick={() => deleteRow(task._key)}
                            title="Delete row"
                            onMouseEnter={(e) => { e.currentTarget.style.color = '#f87171'; e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted, #64748b)'; e.currentTarget.style.background = 'transparent'; }}
                          >🗑</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Add row */}
              <button
                type="button"
                onClick={addRow}
                style={{
                  marginTop: 10, width: '100%',
                  background: 'transparent',
                  border: '1px dashed var(--border, #334155)',
                  borderRadius: 6, color: 'var(--text-muted, #64748b)',
                  cursor: 'pointer', padding: '7px 0', fontSize: 12,
                  transition: 'border-color 0.15s, color 0.15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent, #3b82f6)'; e.currentTarget.style.color = 'var(--accent, #3b82f6)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border, #334155)'; e.currentTarget.style.color = 'var(--text-muted, #64748b)'; }}
              >
                + Add Row
              </button>
            </div>

            {/* Footer */}
            <div style={css.footer}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onClose}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={saving || !name.trim()}
              >
                {saving ? 'Saving…' : 'Save Template'}
              </button>
            </div>

          </form>
        )}
      </div>
    </div>
  );
}
