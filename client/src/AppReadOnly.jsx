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

// ── Helpers ──────────────────────────────────────────────────────────────────
function parseNarrativeEntries(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch (_) {}
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

// ── Read-only narrative dialog ────────────────────────────────────────────────
function NarrativeDialog({ narrative, projectName, open, onClose }) {
  const entries = parseNarrativeEntries(narrative);

  if (!open) return null;

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
    maxHeight: '85vh',
    display: 'flex', flexDirection: 'column',
    boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
    overflow: 'hidden',
  };
  const btnBase = {
    cursor: 'pointer', border: 'none', borderRadius: 5,
    fontSize: 12, padding: '5px 11px', fontFamily: 'inherit',
  };

  return (
    <div style={overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={dialog}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 18px', borderBottom: '1px solid var(--border)', flexShrink: 0,
        }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
            📝 Project Narrative — {projectName}
          </span>
          <button
            onClick={onClose}
            style={{ ...btnBase, background: 'transparent', color: 'var(--text-muted)', fontSize: 18, padding: '2px 8px' }}
            title="Close"
          >✕</button>
        </div>

        {/* Scrollable log */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {entries.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>
              No narrative entries recorded for this project.
            </div>
          ) : (
            entries.map((entry) => (
              <div key={entry.id} style={{
                background: 'var(--surface2)',
                border: '1px solid var(--border)',
                borderRadius: 7,
                padding: '10px 12px',
              }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 5, letterSpacing: 0.2 }}>
                  🕐 {formatTimestamp(entry.timestamp)}
                </div>
                <div style={{ fontSize: 13, lineHeight: 1.65, color: 'var(--text)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {entry.text}
                </div>
              </div>
            ))
          )}
        </div>
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
  const [narrativeOpen, setNarrativeOpen]         = useState(false);

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

          {selectedProject && (
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
            narrative={selectedProject?.narrative}
            projectName={selectedProject?.name}
            open={narrativeOpen}
            onClose={() => setNarrativeOpen(false)}
          />
        </div>
      </div>
    </>
  );
}
