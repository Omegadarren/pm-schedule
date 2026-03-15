import React, { useState, useCallback } from 'react';
import Sidebar from './components/Layout/Sidebar.jsx';
import Header from './components/Layout/Header.jsx';
import TaskGrid from './components/Grid/TaskGrid.jsx';
import GanttView from './components/Gantt/GanttView.jsx';
import { useTasks, useProjects } from './hooks/useTasks.js';
import { useSocket } from './hooks/useSocket.js';

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
      </div>
    </div>
  );
}
