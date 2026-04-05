import React, { useState, useRef, useEffect } from 'react';
import { generateProjectReport } from '../../utils/generateReport.js';
import ShareLinksModal from '../ShareLinksModal.jsx';

const TABS = [
  { id: 'grid', label: '⊞ Grid' },
  { id: 'gantt', label: '📊 Gantt' },
];

// ── Publish modal ─────────────────────────────────────────────────────────────
function PublishModal({ onClose }) {
  const [logs, setLogs]     = useState([]);
  const [status, setStatus] = useState('running'); // 'running' | 'success' | 'error'
  const logRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const colState = (() => {
          try { const s = localStorage.getItem('pm_col_state_v2'); return s ? JSON.parse(s) : null; } catch (_) { return null; }
        })();

        const res = await fetch('/api/publish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ colState }),
        });
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });

          // SSE lines look like: data: {...}\n\n
          const parts = buf.split('\n\n');
          buf = parts.pop(); // keep incomplete chunk

          for (const part of parts) {
            const line = part.trim();
            if (!line.startsWith('data:')) continue;
            try {
              const { type, data } = JSON.parse(line.slice(5).trim());
              if (cancelled) return;
              if (type === 'log') {
                setLogs((prev) => [...prev, data]);
              } else if (type === 'done') {
                setStatus(data); // 'success' or 'error'
              }
            } catch (_) {}
          }
        }

        // Flush any data that arrived alongside the stream-end signal
        if (buf.trim()) {
          for (const part of buf.split('\n\n')) {
            const line = part.trim();
            if (!line.startsWith('data:')) continue;
            try {
              const { type, data } = JSON.parse(line.slice(5).trim());
              if (!cancelled && type === 'done') setStatus(data);
            } catch (_) {}
          }
        }
      } catch (err) {
        if (!cancelled) {
          setLogs((prev) => [...prev, `Network error: ${err.message}\n`]);
          setStatus('error');
        }
      }
    })();

    return () => { cancelled = true; };
  }, []);

  // Auto-scroll log
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  const statusColor   = status === 'success' ? '#34d399' : status === 'error' ? '#f87171' : '#60a5fa';
  const statusLabel   = status === 'running' ? '⏳ Publishing…' : status === 'success' ? '✅ Published!' : '❌ Failed';

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10000,
      background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={(e) => e.target === e.currentTarget && status !== 'running' && onClose()}>
      <div style={{
        background: 'var(--bg-secondary, #1e293b)', borderRadius: 10,
        border: '1px solid var(--border)', width: 560, maxWidth: '94vw',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      }}>
        {/* Header */}
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>🌐 Publish to Web</span>
          <span style={{ fontSize: 13, color: statusColor, fontWeight: 600 }}>{statusLabel}</span>
        </div>

        {/* Log */}
        <pre ref={logRef} style={{
          margin: 0, padding: '12px 16px',
          maxHeight: 320, overflowY: 'auto',
          background: '#0f172a', color: '#94a3b8',
          fontSize: 12, fontFamily: 'monospace', lineHeight: 1.6,
          whiteSpace: 'pre-wrap', wordBreak: 'break-all',
        }}>
          {logs.join('') || '  Starting…\n'}
        </pre>

        {/* Footer */}
        <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          {status === 'success' && (
            <a
              href={`https://omegadarren.github.io/pm-schedule`}
              target="_blank"
              rel="noreferrer"
              style={{ padding: '6px 14px', borderRadius: 6, background: 'rgba(52,211,153,0.15)', border: '1px solid rgba(52,211,153,0.4)', color: '#34d399', fontSize: 12, textDecoration: 'none', fontWeight: 600 }}
            >
              Open Site ↗
            </a>
          )}
          <button
            onClick={onClose}
            disabled={status === 'running'}
            style={{
              padding: '6px 16px', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: status === 'running' ? 'not-allowed' : 'pointer',
              background: status === 'running' ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.08)',
              border: '1px solid var(--border)', color: status === 'running' ? 'var(--text-muted)' : 'var(--text)',
            }}
          >
            {status === 'running' ? 'Please wait…' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Header({ project, tasks, activeTab, onTabChange, connected, readOnly = false, isMaster = false, canUndo = false, canRedo = false, onUndo, onRedo, onProjectShareUpdated }) {
  const [printing, setPrinting]         = useState(false);
  const [showPublish, setShowPublish]   = useState(false);
  const [showShareLinks, setShowShareLinks] = useState(false);
  const [webUrl, setWebUrl]             = useState(null);

  useEffect(() => {
    fetch('/api/config')
      .then((r) => r.json())
      .then((d) => { if (d.webUrl) setWebUrl(d.webUrl); })
      .catch(() => {});
  }, []);

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
    <>
      <header className="app-header">
        {isMaster ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h1>📊 Master Schedule</h1>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 4 }}>
                Read-only — select a project to edit
              </span>
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
        ) : project ? (
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
              {TABS.filter((tab) => !(readOnly && tab.id === 'gantt')).map((tab) => (
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
          {/* Undo / Redo */}
          {!readOnly && !isMaster && project && (
            <div style={{ display: 'flex', gap: 2 }}>
              {[{ label: '↩ Undo', can: canUndo, fn: onUndo, title: 'Undo (Ctrl+Z)' }, { label: '↪ Redo', can: canRedo, fn: onRedo, title: 'Redo (Ctrl+Y)' }].map(({ label, can, fn, title }) => (
                <button
                  key={label}
                  onClick={fn}
                  disabled={!can}
                  title={title}
                  style={{
                    display: 'flex', alignItems: 'center',
                    background: can ? 'rgba(255,255,255,0.07)' : 'transparent',
                    border: `1px solid ${can ? 'var(--border)' : 'transparent'}`,
                    borderRadius: 6,
                    color: can ? 'var(--text)' : 'var(--text-muted)',
                    cursor: can ? 'pointer' : 'not-allowed',
                    padding: '5px 10px', fontSize: 12,
                    opacity: can ? 1 : 0.35,
                    transition: 'all 0.15s',
                    fontFamily: 'inherit',
                  }}
                  onMouseEnter={(e) => { if (can) e.currentTarget.style.background = 'rgba(255,255,255,0.13)'; }}
                  onMouseLeave={(e) => { if (can) e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; }}
                >{label}</button>
              ))}
            </div>
          )}

          {!isMaster && project && (
            <button
              onClick={handlePrint}
              disabled={printing}
              className="header-hide-mobile"
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

          {/* Go to web page button */}
          {webUrl && (
            <a
              href={webUrl}
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: 'rgba(99,102,241,0.12)',
                border: '1px solid rgba(99,102,241,0.35)',
                borderRadius: 6, color: '#a5b4fc', cursor: 'pointer',
                padding: '5px 12px', fontSize: 12, fontWeight: 500,
                textDecoration: 'none', transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(99,102,241,0.22)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(99,102,241,0.12)'; }}
            >
              ↗ Web Page
            </a>
          )}

          {/* Share Link button */}
          {!readOnly && !isMaster && project && (
            <button
              onClick={() => setShowShareLinks(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: 'rgba(251,191,36,0.12)',
                border: '1px solid rgba(251,191,36,0.35)',
                borderRadius: 6, color: '#fcd34d', cursor: 'pointer',
                padding: '5px 12px', fontSize: 12, fontWeight: 500,
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(251,191,36,0.22)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(251,191,36,0.12)'; }}
            >
              🔗 Share Link
            </button>
          )}

          {/* Publish button — only in the live (non-read-only) app */}
          {!readOnly && (
            <button
              onClick={() => setShowPublish(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: 'rgba(52,211,153,0.12)',
                border: '1px solid rgba(52,211,153,0.35)',
                borderRadius: 6, color: '#6ee7b7', cursor: 'pointer',
                padding: '5px 12px', fontSize: 12, fontWeight: 500,
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(52,211,153,0.22)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(52,211,153,0.12)'; }}
            >
              🌐 Publish to Web
            </button>
          )}

          {!readOnly && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}>
              <span className={`connection-dot ${connected ? 'connected' : 'disconnected'}`} />
              {connected ? 'Live sync on' : 'Reconnecting…'}
            </div>
          )}
        </div>
      </header>

      {showPublish && <PublishModal onClose={() => setShowPublish(false)} />}
      {showShareLinks && project && (
        <ShareLinksModal
          project={project}
          onProjectUpdated={(updated) => { onProjectShareUpdated?.(updated); }}
          onClose={() => setShowShareLinks(false)}
        />
      )}
    </>
  );
}
