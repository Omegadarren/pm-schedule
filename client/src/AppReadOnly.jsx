import React, { useState, useEffect } from 'react';
import Sidebar   from './components/Layout/Sidebar.jsx';
import Header    from './components/Layout/Header.jsx';
import TaskGrid  from './components/Grid/TaskGrid.jsx';
import GanttView from './components/Gantt/GanttView.jsx';
import { useStaticData } from './hooks/useStaticData.js';

// ── Device detection ─────────────────────────────────────────────────────────
function useDevice() {
  const getDevice = () => {
    const w = window.innerWidth;
    if (w <= 640)  return 'mobile';
    if (w <= 1024) return 'tablet';
    return 'desktop';
  };
  const [device, setDevice] = useState(getDevice);
  useEffect(() => {
    const handler = () => setDevice(getDevice());
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return device;
}

// ── Read-only banner shown at the top of the page ────────────────────────────
function ReadOnlyBanner({ exportedAt }) {
  const dateStr = exportedAt
    ? new Date(exportedAt).toLocaleString()
    : 'unknown';
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
      background: 'rgba(16,185,129,0.12)', borderBottom: '1px solid rgba(16,185,129,0.35)',
      padding: '5px 16px', display: 'flex', alignItems: 'center', gap: 10,
      fontSize: 12, color: '#6ee7b7',
    }}>
      <span style={{ fontWeight: 700 }}>👁 View Only</span>
      <span style={{ color: 'var(--text-muted)' }}>·</span>
      <span style={{ color: 'var(--text-muted)' }}>Data snapshot from {dateStr}</span>
    </div>
  );
}

// ── Read-only narrative display ────────────────────────────────────────
function NarrativePanel({ narrative }) {
  if (!narrative) return null;
  return (
    <div style={{
      borderTop: '1px solid var(--border)',
      background: 'var(--surface)',
      padding: '14px 20px 18px',
      flexShrink: 0,
    }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 8, letterSpacing: 0.3 }}>
        📝 Project Narrative
      </div>
      <div style={{
        background: 'var(--surface2)',
        border: '1px solid var(--border)',
        borderRadius: 6,
        padding: '10px 14px',
        fontSize: 13,
        lineHeight: 1.7,
        color: 'var(--text)',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}>
        {narrative}
      </div>
    </div>
  );
}

// ── Mobile project picker bar ───────────────────────────────────────────────
function MobileProjectPicker({ projects, selectedProjectId, onSelect }) {
  if (!projects.length) return null;
  return (
    <div className="mobile-project-picker">
      {projects.map((p) => (
        <button
          key={p.id}
          className={`mobile-project-chip${p.id === selectedProjectId ? ' active' : ''}`}
          onClick={() => onSelect(p.id)}
        >
          {p.name}
        </button>
      ))}
    </div>
  );
}

export default function AppReadOnly() {
  const { projects, allTasks, resources, loading, error, exportedAt, colState } = useStaticData();
  const device = useDevice();

  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [activeTab, setActiveTab]                 = useState('grid');

  // Auto-select first project once data loads
  React.useEffect(() => {
    if (!selectedProjectId && projects.length > 0) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId]);

  const selectedProject = projects.find((p) => p.id === selectedProjectId) ?? null;
  const tasks           = allTasks[selectedProjectId]  ?? [];

  return (
    <>
      <ReadOnlyBanner exportedAt={exportedAt} />

      {/* Push content down by banner height */}
      <div className="app-layout" style={{ paddingTop: 28 }}>
        {/* Sidebar — hidden on mobile via CSS, shown on tablet/desktop */}
        <Sidebar
          projects={projects}
          selectedProjectId={selectedProjectId}
          onSelectProject={setSelectedProjectId}
          readOnly
        />

        <div className="main-content">
          <Header
            project={selectedProject}
            tasks={tasks}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            connected={false}
            readOnly
          />

          {/* Mobile-only: project chips instead of sidebar */}
          {device === 'mobile' && (
            <MobileProjectPicker
              projects={projects}
              selectedProjectId={selectedProjectId}
              onSelect={setSelectedProjectId}
            />
          )}

          <div className="view-container">
            {loading ? (
              <div className="loading">Loading snapshot…</div>
            ) : error ? (
              <div className="empty-state" style={{ color: 'var(--danger)' }}>
                <div>Failed to load data: {error}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 8 }}>
                  Make sure web-data.json was exported and the build is deployed correctly.
                </div>
              </div>
            ) : !selectedProjectId ? (
              <div className="empty-state">
                <div className="icon">📁</div>
                <div>Select a project to view it.</div>
              </div>
            ) : (
              <>
                {activeTab === 'grid' && (
                  <TaskGrid
                    tasks={tasks}
                    projectId={selectedProjectId}
                    hourlyRate={selectedProject?.hourly_rate ?? 0}
                    readOnly
                    colState={colState}
                    /* no onUpdate / onAdd / onDelete / onRefetch in read-only mode */
                  />
                )}
                {activeTab === 'gantt' && (
                  <GanttView
                    tasks={tasks}
                    onUpdate={() => {}}
                  />
                )}
              </>
            )}
          </div>

          <NarrativePanel narrative={selectedProject?.narrative} />
        </div>
      </div>
    </>
  );
}
