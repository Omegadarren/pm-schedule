import React, { useState, useEffect, useRef } from 'react';

const PROJECT_ICONS = { active: '🟢', on_hold: '🟡', complete: '✅', archived: '⬛' };
const STATUS_OPTIONS = [
  { value: 'active',      label: '🟢 Active' },
  { value: 'on_hold',     label: '🟡 On Hold' },
  { value: 'complete',    label: '✅ Complete' },
  { value: 'archived',    label: '⬛ Archived' },
  { value: 'not_started', label: '📋 Not Started' },
];
const COLOR_SWATCHES = ['#3b82f6','#8b5cf6','#ec4899','#ef4444','#f97316','#eab308','#22c55e','#06b6d4','#64748b','#1e293b'];

function NewProjectModal({ onCreate, onClose }) {
  const [form, setForm] = useState({ name: '', description: '', start_date: '', end_date: '' });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    onCreate(form);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>New Project</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Project Name *</label>
            <input autoFocus value={form.name} onChange={set('name')} placeholder="e.g. Office Renovation Phase 2" />
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea value={form.description} onChange={set('description')} rows={2} placeholder="Optional description" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label>Start Date</label>
              <input type="date" value={form.start_date} onChange={set('start_date')} />
            </div>
            <div className="form-group">
              <label>End Date</label>
              <input type="date" value={form.end_date} onChange={set('end_date')} />
            </div>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">Create Project</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ProjectPropertiesModal({ project, onSave, onClose }) {
  const [form, setForm] = useState({
    name:        project.name || '',
    description: project.description || '',
    status:      project.status || 'active',
    start_date:  project.start_date || '',
    end_date:    project.end_date || '',
    color:       project.color || '#3b82f6',
    hourly_rate: project.hourly_rate ?? 0,
  });
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    await onSave(project.id, form);
    setSaving(false);
    onClose();
  };

  const inputStyle = {
    width: '100%', background: 'var(--bg, #0f172a)',
    border: '1px solid var(--border, #334155)', borderRadius: 6,
    color: 'var(--text, #f1f5f9)', padding: '7px 10px', fontSize: 13,
    outline: 'none', boxSizing: 'border-box',
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: 460 }} onClick={(e) => e.stopPropagation()}>
        {/* Modal header strip */}
        <div style={{ background: form.color, borderRadius: '8px 8px 0 0', height: 6, margin: '-24px -24px 20px' }} />
        <h2 style={{ marginTop: 0 }}>Project Properties</h2>

        <form onSubmit={handleSubmit}>
          {/* Name */}
          <div className="form-group">
            <label>Project Name *</label>
            <input autoFocus style={inputStyle} value={form.name} onChange={set('name')} placeholder="Project name" />
          </div>

          {/* Description */}
          <div className="form-group">
            <label>Description</label>
            <textarea style={{ ...inputStyle, resize: 'vertical', minHeight: 64 }}
              value={form.description} onChange={set('description')} rows={3}
              placeholder="Brief description of the project..."
            />
          </div>

          {/* Status + Color row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label>Status</label>
              <select style={inputStyle} value={form.status} onChange={set('status')}>
                {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Accent Color</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', paddingTop: 4 }}>
                {COLOR_SWATCHES.map((c) => (
                  <div
                    key={c}
                    onClick={() => setForm((f) => ({ ...f, color: c }))}
                    style={{
                      width: 22, height: 22, borderRadius: '50%', background: c, cursor: 'pointer',
                      border: form.color === c ? '2px solid #fff' : '2px solid transparent',
                      boxShadow: form.color === c ? `0 0 0 2px ${c}` : 'none',
                      transition: 'box-shadow 0.15s',
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Hourly Rate */}
          <div className="form-group">
            <label>Default Hourly Rate (USD)</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted, #94a3b8)', fontSize: 13, pointerEvents: 'none' }}>$</span>
              <input
                type="number" min="0" step="0.01"
                style={{ ...inputStyle, paddingLeft: 22 }}
                value={form.hourly_rate}
                onChange={(e) => setForm((f) => ({ ...f, hourly_rate: parseFloat(e.target.value) || 0 }))}
                placeholder="0.00"
              />
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted, #64748b)', marginTop: 4 }}>
              Use <code style={{ background: 'rgba(96,165,250,0.12)', color: '#93c5fd', borderRadius: 3, padding: '1px 5px' }}>hourly_rate</code> in cost formulas, e.g. <code style={{ background: 'rgba(96,165,250,0.12)', color: '#93c5fd', borderRadius: 3, padding: '1px 5px' }}>=hourly_rate*8</code>
            </div>
          </div>

          {/* Dates row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label>Start Date</label>
              <input type="date" style={inputStyle} value={form.start_date || ''} onChange={set('start_date')} />
            </div>
            <div className="form-group">
              <label>End Date</label>
              <input type="date" style={inputStyle} value={form.end_date || ''} onChange={set('end_date')} />
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DeleteConfirmModal({ project, onConfirm, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: 380, textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🗑️</div>
        <h2 style={{ marginBottom: 8 }}>Delete Project?</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 4 }}>
          <strong style={{ color: 'var(--text)' }}>{project.name}</strong>
        </p>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 24 }}>
          This will permanently delete all tasks in this project. This cannot be undone.
        </p>
        <div className="modal-actions" style={{ justifyContent: 'center' }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className="btn"
            style={{ background: '#ef4444', color: '#fff', border: 'none' }}
            onClick={() => { onConfirm(project.id); onClose(); }}
          >
            Delete Project
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Sidebar({ projects, selectedProjectId, onSelectProject, onCreateProject, onRenameProject, onUpdateProject, onDeleteProject, readOnly = false }) {
  const [showModal, setShowModal] = useState(false);
  const [contextMenu, setContextMenu] = useState(null); // { x, y, projectId }
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [propsProject, setPropsProject] = useState(null);
  const [deleteProject, setDeleteProject] = useState(null);
  const renameInputRef = useRef(null);

  useEffect(() => {
    const close = () => setContextMenu(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, []);

  const handleContextMenu = (e, projectId) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, projectId });
  };

  const startRename = (proj) => {
    setRenamingId(proj.id);
    setRenameValue(proj.name);
    setContextMenu(null);
    setTimeout(() => renameInputRef.current?.select(), 20);
  };

  const commitRename = async () => {
    if (renameValue.trim() && renamingId && onRenameProject) {
      await onRenameProject(renamingId, renameValue.trim());
    }
    setRenamingId(null);
  };

  const handleRenameKey = (e) => {
    if (e.key === 'Enter') commitRename();
    if (e.key === 'Escape') setRenamingId(null);
  };

  return (
    <>
      <aside className="sidebar">
        <div className="sidebar-logo">
          📅 PM Schedule
        </div>

        {/* Master Schedule entry */}
        <div
          className={`sidebar-item ${selectedProjectId === '__master__' ? 'active' : ''}`}
          onClick={() => onSelectProject('__master__')}
          style={{ marginBottom: 2 }}
        >
          <span>📊</span>
          <span>Master Schedule</span>
        </div>

        <div style={{ borderTop: '1px solid var(--border)', margin: '6px 8px 8px' }} />

        <div className="sidebar-section-title">Projects</div>

        {projects.map((p) => (
          <div
            key={p.id}
            className={`sidebar-item ${selectedProjectId === p.id ? 'active' : ''}`}
            onClick={() => { if (renamingId !== p.id) onSelectProject(p.id); }}
            onContextMenu={readOnly ? undefined : (e) => handleContextMenu(e, p.id)}
          >
            <span>{PROJECT_ICONS[p.status] || '📁'}</span>
            {renamingId === p.id ? (
              <input
                ref={renameInputRef}
                autoFocus
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={commitRename}
                onKeyDown={handleRenameKey}
                onClick={(e) => e.stopPropagation()}
                style={{
                  flex: 1,
                  background: 'var(--bg-tertiary, #1e293b)',
                  color: 'var(--text-primary, #f1f5f9)',
                  border: '1px solid var(--accent, #3b82f6)',
                  borderRadius: 4,
                  padding: '1px 6px',
                  fontSize: 13,
                  outline: 'none',
                  minWidth: 0,
                }}
              />
            ) : (
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {p.name}
              </span>
            )}
          </div>
        ))}

        {!readOnly && (
          <button className="sidebar-new-project" onClick={() => setShowModal(true)}>
            + New Project
          </button>
        )}

        <div style={{ flex: 1 }} />

        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--text-muted)' }}>
          {readOnly ? '👁 View Only' : 'PM Schedule v1.0'}
        </div>
      </aside>

      {showModal && (
        <NewProjectModal
          onCreate={onCreateProject}
          onClose={() => setShowModal(false)}
        />
      )}

      {contextMenu && (() => {
        const ctxProj = projects.find((p) => p.id === contextMenu.projectId);
        const menuItem = (icon, label, onClick, danger = false) => (
          <div
            style={{
              padding: '8px 14px', cursor: 'pointer', fontSize: 13,
              color: danger ? '#f87171' : 'var(--text-primary, #f1f5f9)',
              display: 'flex', alignItems: 'center', gap: 8,
              transition: 'background 0.1s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = danger ? 'rgba(239,68,68,0.12)' : 'var(--bg-tertiary, #334155)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            onClick={onClick}
          >
            {icon} {label}
          </div>
        );
        return (
          <div
            style={{
              position: 'fixed', top: contextMenu.y, left: contextMenu.x,
              background: 'var(--bg-secondary, #1e293b)',
              border: '1px solid var(--border, #334155)',
              borderRadius: 6, boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
              zIndex: 9999, minWidth: 170, padding: '4px 0',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {menuItem('✏️', 'Rename', () => { if (ctxProj) startRename(ctxProj); })}
            {menuItem('⚙️', 'Properties', () => { setPropsProject(ctxProj); setContextMenu(null); })}
            <div style={{ borderTop: '1px solid var(--border, #334155)', margin: '4px 0' }} />
            {menuItem('🗑️', 'Delete Project', () => { setDeleteProject(ctxProj); setContextMenu(null); }, true)}
          </div>
        );
      })()}

      {propsProject && (
        <ProjectPropertiesModal
          project={propsProject}
          onSave={onUpdateProject}
          onClose={() => setPropsProject(null)}
        />
      )}

      {deleteProject && (
        <DeleteConfirmModal
          project={deleteProject}
          onConfirm={onDeleteProject}
          onClose={() => setDeleteProject(null)}
        />
      )}
    </>
  );
}
