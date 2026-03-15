import React, { useState } from 'react';
import { generateProjectReport } from '../../utils/generateReport.js';

const TABS = [
  { id: 'grid', label: '⊞ Grid' },
  { id: 'gantt', label: '📊 Gantt' },
];

export default function Header({ project, tasks, activeTab, onTabChange, connected }) {
  const [printing, setPrinting] = useState(false);

  const handlePrint = async () => {
    if (!project || !tasks) return;
    setPrinting(true);
    try {
      await generateProjectReport(project, tasks);
    } finally {
      setPrinting(false);
    }
  };

  return (
    <header className="app-header">
      {project ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Project:</span>
            <h1>{project.name}</h1>
            {project.status && (
              <span className={`badge badge-${project.status}`} style={{ marginLeft: 4 }}>
                {project.status.replace('_', ' ')}
              </span>
            )}
          </div>

          <div className="header-tabs">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => onTabChange(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </>
      ) : (
        <h1 style={{ color: 'var(--text-muted)' }}>Select a project</h1>
      )}

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
        {project && (
          <button
            onClick={handlePrint}
            disabled={printing}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: printing ? 'rgba(59,130,246,0.3)' : 'rgba(59,130,246,0.15)',
              border: '1px solid rgba(59,130,246,0.4)',
              borderRadius: 6, color: '#93c5fd', cursor: printing ? 'default' : 'pointer',
              padding: '5px 12px', fontSize: 12, fontWeight: 500,
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => { if (!printing) e.currentTarget.style.background = 'rgba(59,130,246,0.28)'; }}
            onMouseLeave={(e) => { if (!printing) e.currentTarget.style.background = 'rgba(59,130,246,0.15)'; }}
          >
            {printing ? '⏳ Generating…' : '⬇ Export PDF'}
          </button>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}>
          <span className={`connection-dot ${connected ? 'connected' : 'disconnected'}`} />
          {connected ? 'Live sync on' : 'Reconnecting…'}
        </div>
      </div>
    </header>
  );
}
