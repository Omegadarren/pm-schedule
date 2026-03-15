import React, { useState, useCallback, useRef, useEffect } from 'react';
import Sidebar from './components/Layout/Sidebar.jsx';
import Header from './components/Layout/Header.jsx';
import TaskGrid from './components/Grid/TaskGrid.jsx';
import GanttView from './components/Gantt/GanttView.jsx';
import { useTasks, useProjects } from './hooks/useTasks.js';
import { useSocket } from './hooks/useSocket.js';

// ── Project Narrative panel ────────────────────────────────────
function NarrativePanel({ project, onSave }) {
  const [text, setText] = useState(project?.narrative ?? '');
  const [saved, setSaved] = useState(false);
  const saveTimer = useRef(null);

  // Sync when project changes
  useEffect(() => {
    setText(project?.narrative ?? '');
    setSaved(false);
  }, [project?.id]);

  const handleChange = (e) => {
    setText(e.target.value);
    setSaved(false);
    // Debounce auto-save: 1.5s after last keystroke
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      onSave(e.target.value);
      setSaved(true);
    }, 1500);
  };

  const handleBlur = () => {
    clearTimeout(saveTimer.current);
    onSave(text);
    setSaved(true);
  };

  if (!project) return null;

  return (
    <div style={{
      borderTop: '1px solid var(--border)',
      background: 'var(--surface)',
      padding: '12px 20px 16px',
      flexShrink: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', letterSpacing: 0.3 }}>
          📝 Project Narrative
        </span>
        {saved && (
          <span style={{ fontSize: 11, color: '#34d399', opacity: 0.85 }}>Saved ✔</span>
        )}
      </div>
      <textarea
        value={text}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder="Write a project description, status update, or notes for anyone viewing the published report…"
        style={{
          width: '100%',
          minHeight: 90,
          resize: 'vertical',
          background: 'var(--surface2)',
          color: 'var(--text)',
          border: '1px solid var(--border)',
          borderRadius: 6,
          padding: '8px 12px',
          fontSize: 13,
          lineHeight: 1.6,
          fontFamily: 'inherit',
          outline: 'none',
          boxSizing: 'border-box',
        }}
        onFocus={(e) => { e.target.style.borderColor = '#3b82f6'; }}
        onBlurCapture={(e) => { e.target.style.borderColor = 'var(--border)'; }}
      />
    </div>
  );
}

export default function App() {
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [activeTab, setActiveTab] = useState('grid');

  // Projects
  const { projects, createProject, renameProject, updateProject, deleteProject } = useProjects();

  // Auto-select first project if none selected
  React.useEffect(() => {
    if (!selectedProjectId && projects.length > 0) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId]);

  // Tasks for selected project
  const {
    tasks, loading, error,
    addTask, updateTask, deleteTask, refetch,
    applyRemoteUpdate, applyRemoteAdd, applyRemoteDelete,
  } = useTasks(selectedProjectId);

  // Realtime Socket.IO
  const { connected } = useSocket(selectedProjectId, {
    onTaskUpdated: applyRemoteUpdate,
    onTaskAdded: applyRemoteAdd,
    onTaskDeleted: applyRemoteDelete,
  });

  // Handlers for TaskGrid updates
  const handleUpdate = useCallback(async (id, data) => {
    const existing = tasks.find((t) => t.id === id);
    if (!existing) return;
    return updateTask(id, { ...existing, ...data });
  }, [tasks, updateTask]);

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
      />

      <div className="main-content">
        <Header
          project={selectedProject}
          tasks={tasks}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          connected={connected}
        />

        <div className="view-container">
          {!selectedProjectId ? (
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
                  onAdd={addTask}
                  onDelete={deleteTask}
                  onRefetch={refetch}
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

        <NarrativePanel project={selectedProject} onSave={handleNarrativeSave} />
      </div>
    </div>
  );
}
