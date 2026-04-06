import React, { useState, useCallback, useRef, useEffect } from 'react';
import Sidebar from './components/Layout/Sidebar.jsx';
import Header from './components/Layout/Header.jsx';
import TaskGrid from './components/Grid/TaskGrid.jsx';
import GanttView from './components/Gantt/GanttView.jsx';
import MasterGrid from './components/MasterSchedule/MasterGrid.jsx';
import MasterGantt from './components/MasterSchedule/MasterGantt.jsx';
import { useTasks, useProjects, useAllTasks, useTemplates } from './hooks/useTasks.js';
import { useSocket } from './hooks/useSocket.js';

// ── Helpers ────────────────────────────────────────────────────
function parseNarrativeEntries(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch (_) {}
  // Legacy plain-text → migrate to single entry without a timestamp
  if (typeof raw === 'string' && raw.trim()) {
    return [{ id: 'legacy-0', timestamp: null, text: raw.trim() }];
  }
  return [];
}

function formatTimestamp(ts) {
  if (!ts) return 'Legacy entry';
  return new Date(ts).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ── Project Narrative dialog (editable) ───────────────────────
function NarrativeDialog({ project, onSave, open, onClose }) {
  const [entries, setEntries]     = useState([]);
  const [newText, setNewText]     = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText]   = useState('');
  const logEndRef                 = useRef(null);
  const newTextRef                = useRef(null);

  // Re-parse entries whenever the dialog opens or the project changes
  useEffect(() => {
    if (open) {
      setEntries(parseNarrativeEntries(project?.narrative));
      setNewText('');
      setEditingId(null);
      setEditText('');
    }
  }, [open, project?.id, project?.narrative]);

  // Scroll log to bottom when entries arrive / are added
  useEffect(() => {
    if (open && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [entries, open]);

  const persist = (updated) => {
    setEntries(updated);
    onSave(JSON.stringify(updated));
  };

  const handleAdd = () => {
    const trimmed = newText.trim();
    if (!trimmed) return;
    const entry = {
      id: (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`,
      timestamp: new Date().toISOString(),
      text: trimmed,
    };
    persist([...entries, entry]);
    setNewText('');
    newTextRef.current?.focus();
  };

  const handleDelete = (id) => {
    if (!window.confirm('Delete this entry?')) return;
    persist(entries.filter((e) => e.id !== id));
  };

  const startEdit = (entry) => {
    setEditingId(entry.id);
    setEditText(entry.text);
  };

  const commitEdit = (id) => {
    const trimmed = editText.trim();
    if (!trimmed) return;
    persist(entries.map((e) => e.id === id ? { ...e, text: trimmed } : e));
    setEditingId(null);
    setEditText('');
  };

  const cancelEdit = () => { setEditingId(null); setEditText(''); };

  if (!open) return null;

  // ── Styles ──────────────────────────────────────────────────
  const overlay = {
    position: 'fixed', inset: 0, zIndex: 2000,
    background: 'rgba(0,0,0,0.55)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '16px',
  };
  const dialog = {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    width: '100%', maxWidth: 640,
    maxHeight: '90vh',
    display: 'flex', flexDirection: 'column',
    boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
    overflow: 'hidden',
  };
  const dialogHeader = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '14px 18px',
    borderBottom: '1px solid var(--border)',
    flexShrink: 0,
  };
  const logArea = {
    flex: 1, overflowY: 'auto', padding: '12px 16px',
    display: 'flex', flexDirection: 'column', gap: 10,
  };
  const entryCard = {
    background: 'var(--surface2)',
    border: '1px solid var(--border)',
    borderRadius: 7,
    padding: '10px 12px',
  };
  const tsLabel = {
    fontSize: 11, color: 'var(--text-muted)',
    marginBottom: 5, letterSpacing: 0.2,
  };
  const entryText = {
    fontSize: 13, lineHeight: 1.65, color: 'var(--text)',
    whiteSpace: 'pre-wrap', wordBreak: 'break-word',
    marginBottom: 8,
  };
  const actionRow = {
    display: 'flex', gap: 6,
  };
  const textareaStyle = {
    width: '100%', boxSizing: 'border-box',
    background: 'var(--surface2)', color: 'var(--text)',
    border: '1px solid var(--border)', borderRadius: 6,
    padding: '8px 10px', fontSize: 13, lineHeight: 1.6,
    fontFamily: 'inherit', resize: 'vertical', outline: 'none',
  };
  const addSection = {
    borderTop: '1px solid var(--border)',
    padding: '12px 16px',
    flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8,
  };
  const btnBase = {
    cursor: 'pointer', border: 'none', borderRadius: 5,
    fontSize: 12, padding: '5px 11px', fontFamily: 'inherit',
  };

  return (
    <div style={overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={dialog}>
        {/* Header */}
        <div style={dialogHeader}>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
            📝 Project Narrative — {project?.name}
          </span>
          <button
            onClick={onClose}
            style={{ ...btnBase, background: 'transparent', color: 'var(--text-muted)', fontSize: 18, padding: '2px 8px' }}
            title="Close"
          >✕</button>
        </div>

        {/* Scrollable log */}
        <div style={logArea}>
          {entries.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>
              No entries yet. Add the first one below.
            </div>
          ) : (
            entries.map((entry) => (
              <div key={entry.id} style={entryCard}>
                <div style={tsLabel}>🕐 {formatTimestamp(entry.timestamp)}</div>
                {editingId === entry.id ? (
                  <>
                    <textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      style={{ ...textareaStyle, minHeight: 80 }}
                      autoFocus
                      onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) commitEdit(entry.id); }}
                    />
                    <div style={{ ...actionRow, marginTop: 6 }}>
                      <button
                        onClick={() => commitEdit(entry.id)}
                        disabled={!editText.trim()}
                        style={{ ...btnBase, background: '#3b82f6', color: '#fff' }}
                      >Save</button>
                      <button
                        onClick={cancelEdit}
                        style={{ ...btnBase, background: 'var(--surface)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
                      >Cancel</button>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={entryText}>{entry.text}</div>
                    <div style={actionRow}>
                      <button
                        onClick={() => startEdit(entry)}
                        style={{ ...btnBase, background: 'var(--surface)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
                      >✏ Edit</button>
                      <button
                        onClick={() => handleDelete(entry.id)}
                        style={{ ...btnBase, background: 'transparent', color: '#f87171', border: '1px solid #f87171' }}
                      >🗑 Delete</button>
                    </div>
                  </>
                )}
              </div>
            ))
          )}
          <div ref={logEndRef} />
        </div>

        {/* Add new entry */}
        <div style={addSection}>
          <textarea
            ref={newTextRef}
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            placeholder="Write a status update, note, or observation… (Ctrl+Enter to add)"
            style={{ ...textareaStyle, minHeight: 80 }}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleAdd(); }}
          />
          <button
            onClick={handleAdd}
            disabled={!newText.trim()}
            style={{
              ...btnBase,
              background: newText.trim() ? '#3b82f6' : 'var(--surface2)',
              color: newText.trim() ? '#fff' : 'var(--text-muted)',
              border: '1px solid var(--border)',
              padding: '8px 16px', fontSize: 13, alignSelf: 'flex-end',
            }}
          >+ Add Entry</button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [activeTab, setActiveTab] = useState('grid');
  const [narrativeOpen, setNarrativeOpen] = useState(false);

  const isMaster = selectedProjectId === '__master__';

  // Projects
  const { projects, createProject, renameProject, updateProject, deleteProject, syncProject, refetch: refetchProjects } = useProjects();

  // Templates
  const { templates, saveAsTemplate, createFromTemplate, deleteTemplate, refetch: refetchTemplates } = useTemplates();

  const handleCreateFromTemplate = useCallback(async (templateId, form) => {
    const { project } = await createFromTemplate(templateId, form);
    await refetchProjects();
    setSelectedProjectId(project.id);
    setActiveTab('grid');
  }, [createFromTemplate, refetchProjects]);

  // Auto-select first project if none selected
  React.useEffect(() => {
    if (!selectedProjectId && projects.length > 0) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId]);

  // Tasks for selected project (skip when in master mode)
  const {
    tasks, loading, error,
    addTask, updateTask, deleteTask, refetch, silentRefetch,
    applyRemoteUpdate, applyRemoteAdd, applyRemoteDelete,
  } = useTasks(isMaster ? null : selectedProjectId);

  // All tasks for master schedule view
  const { allTasks, loading: masterLoading, refetch: refetchAll } = useAllTasks(isMaster);

  const handleMasterUpdate = useCallback(async (id, data) => {
    await updateTask(id, data);
    refetchAll();
  }, [updateTask, refetchAll]);

  // Realtime Socket.IO (no room when master)
  const { connected } = useSocket(isMaster ? null : selectedProjectId, {
    onTaskUpdated: applyRemoteUpdate,
    onTaskAdded: applyRemoteAdd,
    onTaskDeleted: applyRemoteDelete,
  });

  // ── Undo / Redo ──────────────────────────────────────────────────────────
  // Each history entry: { type: 'update'|'add'|'delete', before?, after?, tasks? }
  const histPast   = useRef([]);  // most-recent last, max 20
  const histFuture = useRef([]);
  // eslint-disable-next-line no-unused-vars
  const [histVersion, setHistVersion] = useState(0); // bumped to trigger re-renders

  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;

  // Pending batch: groups rapid cascade-related onUpdate calls into one undo entry
  const pendingBeforeMap     = useRef(null);
  const pendingAfterMap      = useRef(null);
  const commitTimerRef       = useRef(null);
  const pendingDeletesRef    = useRef(null);
  const commitDeleteTimerRef = useRef(null);
  const isUndoRedoingRef     = useRef(false);

  const commitPendingUpdates = useCallback(() => {
    if (!pendingBeforeMap.current) return;
    const before = [...pendingBeforeMap.current.values()];
    const after  = [...pendingAfterMap.current.values()];
    pendingBeforeMap.current = null;
    pendingAfterMap.current  = null;
    if (before.length === 0) return;
    histPast.current = [...histPast.current.slice(-19), { type: 'update', before, after }];
    histFuture.current = [];
    setHistVersion((v) => v + 1);
  }, []);

  const commitPendingDeletes = useCallback(() => {
    if (!pendingDeletesRef.current) return;
    const deleted = pendingDeletesRef.current;
    pendingDeletesRef.current = null;
    histPast.current = [...histPast.current.slice(-19), { type: 'delete', tasks: deleted }];
    histFuture.current = [];
    setHistVersion((v) => v + 1);
  }, []);

  // Clear history when project changes
  useEffect(() => {
    histPast.current = [];
    histFuture.current = [];
    clearTimeout(commitTimerRef.current);
    clearTimeout(commitDeleteTimerRef.current);
    pendingBeforeMap.current  = null;
    pendingAfterMap.current   = null;
    pendingDeletesRef.current = null;
    setHistVersion(0);
  }, [selectedProjectId]);

  // Handlers for TaskGrid updates — intercepts before/after for undo
  const handleUpdate = useCallback(async (id, data) => {
    const existing = tasksRef.current.find((t) => t.id === id);
    if (!existing) return;
    if (!isUndoRedoingRef.current) {
      if (!pendingBeforeMap.current) {
        pendingBeforeMap.current = new Map();
        pendingAfterMap.current  = new Map();
      }
      if (!pendingBeforeMap.current.has(id)) {
        pendingBeforeMap.current.set(id, { ...existing });
      }
    }
    const result = await updateTask(id, { ...existing, ...data });
    if (!isUndoRedoingRef.current && result && pendingAfterMap.current) {
      pendingAfterMap.current.set(id, result);
      clearTimeout(commitTimerRef.current);
      commitTimerRef.current = setTimeout(commitPendingUpdates, 200);
    }
    return result;
  }, [updateTask, commitPendingUpdates]);

  const handleAddTask = useCallback(async (taskData) => {
    const newTask = await addTask(taskData);
    if (!isUndoRedoingRef.current && newTask) {
      histPast.current = [...histPast.current.slice(-19), { type: 'add', tasks: [newTask] }];
      histFuture.current = [];
      setHistVersion((v) => v + 1);
    }
    return newTask;
  }, [addTask]);

  const handleDeleteTask = useCallback(async (id) => {
    const task = tasksRef.current.find((t) => t.id === id);
    await deleteTask(id);
    if (!isUndoRedoingRef.current && task) {
      if (!pendingDeletesRef.current) pendingDeletesRef.current = [];
      pendingDeletesRef.current.push(task);
      clearTimeout(commitDeleteTimerRef.current);
      commitDeleteTimerRef.current = setTimeout(commitPendingDeletes, 200);
    }
  }, [deleteTask, commitPendingDeletes]);

  const handleUndo = useCallback(async () => {
    if (histPast.current.length === 0) return;
    clearTimeout(commitTimerRef.current);
    clearTimeout(commitDeleteTimerRef.current);
    pendingBeforeMap.current  = null;
    pendingAfterMap.current   = null;
    pendingDeletesRef.current = null;
    const entry = histPast.current[histPast.current.length - 1];
    histPast.current   = histPast.current.slice(0, -1);
    histFuture.current = [entry, ...histFuture.current.slice(0, 19)];
    isUndoRedoingRef.current = true;
    try {
      if (entry.type === 'update') {
        for (const t of entry.before) await updateTask(t.id, t);
      } else if (entry.type === 'add') {
        for (const t of entry.tasks) await deleteTask(t.id);
      } else if (entry.type === 'delete') {
        for (const t of entry.tasks) await addTask(t);
      }
    } finally {
      isUndoRedoingRef.current = false;
      silentRefetch();
    }
    setHistVersion((v) => v + 1);
  }, [updateTask, deleteTask, addTask, silentRefetch]);

  const handleRedo = useCallback(async () => {
    if (histFuture.current.length === 0) return;
    clearTimeout(commitTimerRef.current);
    clearTimeout(commitDeleteTimerRef.current);
    pendingBeforeMap.current  = null;
    pendingAfterMap.current   = null;
    pendingDeletesRef.current = null;
    const entry = histFuture.current[0];
    histFuture.current = histFuture.current.slice(1);
    histPast.current   = [...histPast.current.slice(-19), entry];
    isUndoRedoingRef.current = true;
    try {
      if (entry.type === 'update') {
        for (const t of entry.after) await updateTask(t.id, t);
      } else if (entry.type === 'add') {
        for (const t of entry.tasks) await addTask(t);
      } else if (entry.type === 'delete') {
        for (const t of entry.tasks) await deleteTask(t.id);
      }
    } finally {
      isUndoRedoingRef.current = false;
      silentRefetch();
    }
    setHistVersion((v) => v + 1);
  }, [updateTask, deleteTask, addTask, silentRefetch]);

  // Keyboard shortcuts — Ctrl+Z / Ctrl+Y (Cmd+Z / Cmd+Y on Mac)
  // Skips when focus is inside an input/textarea so cell editing is unaffected
  useEffect(() => {
    const handler = (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (document.activeElement?.contentEditable === 'true') return;
      if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); handleUndo(); }
      else if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) { e.preventDefault(); handleRedo(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleUndo, handleRedo]);

  const canUndo = histVersion >= 0 && histPast.current.length > 0;
  const canRedo = histVersion >= 0 && histFuture.current.length > 0;

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  const handleNarrativeSave = useCallback((text) => {
    if (!selectedProject) return;
    updateProject(selectedProject.id, { ...selectedProject, narrative: text });
  }, [selectedProject, updateProject]);

  return (
    <div className="app-layout">
      <Sidebar
        projects={projects}
        selectedProjectId={selectedProjectId}
        onSelectProject={setSelectedProjectId}
        onCreateProject={createProject}
        onRenameProject={renameProject}
        onUpdateProject={updateProject}
        onDeleteProject={(id) => {
          deleteProject(id);
          if (selectedProjectId === id) setSelectedProjectId(null);
        }}
        templates={templates}
        onSaveAsTemplate={saveAsTemplate}
        onCreateFromTemplate={handleCreateFromTemplate}
        onDeleteTemplate={deleteTemplate}
        onRefetchTemplates={refetchTemplates}
      />

      <div className="main-content">
        <Header
          project={selectedProject}
          tasks={tasks}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          connected={connected}
          isMaster={isMaster}
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onProjectShareUpdated={syncProject}
        />

        <div className="view-container">
          {isMaster ? (
            masterLoading ? (
              <div className="loading">Loading all projects…</div>
            ) : (
              <>
                {activeTab === 'grid' && <MasterGrid tasks={allTasks} onUpdate={handleMasterUpdate} />}
                {activeTab === 'gantt' && <MasterGantt tasks={allTasks} onUpdate={handleMasterUpdate} />}
              </>
            )
          ) : !selectedProjectId ? (
            <div className="empty-state">
              <div className="icon">📁</div>
              <div>Select or create a project to get started.</div>
            </div>
          ) : loading ? (
            <div className="loading">Loading tasks…</div>
          ) : error ? (
            <div className="empty-state" style={{ color: 'var(--danger)' }}>
              <div>Error loading tasks: {error}</div>
            </div>
          ) : (
            <>
              {activeTab === 'grid' && (
                <TaskGrid
                  tasks={tasks}
                  projectId={selectedProjectId}
                  hourlyRate={selectedProject?.hourly_rate ?? 0}
                  onUpdate={handleUpdate}
                  onAdd={handleAddTask}
                  onDelete={handleDeleteTask}
                  onRefetch={silentRefetch}
                />
              )}
              {activeTab === 'gantt' && (
                <GanttView
                  tasks={tasks}
                  onUpdate={handleUpdate}
                />
              )}
            </>
          )}
        </div>

        {selectedProject && !isMaster && (
          <div style={{
            borderTop: '1px solid var(--border)',
            background: 'var(--surface)',
            padding: '10px 20px',
            flexShrink: 0,
          }}>
            <button
              onClick={() => setNarrativeOpen(true)}
              style={{
                cursor: 'pointer',
                background: 'var(--surface2)',
                color: 'var(--text)',
                border: '1px solid var(--border)',
                borderRadius: 7,
                padding: '8px 18px',
                fontSize: 13,
                fontFamily: 'inherit',
                display: 'flex',
                alignItems: 'center',
                gap: 7,
              }}
            >
              📝 View Project Narrative
            </button>
          </div>
        )}

        <NarrativeDialog
          project={selectedProject}
          onSave={handleNarrativeSave}
          open={narrativeOpen}
          onClose={() => setNarrativeOpen(false)}
        />
      </div>
    </div>
  );
}
