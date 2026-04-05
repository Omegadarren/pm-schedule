import React, { useState, useEffect } from 'react';
import axios from 'axios';

export default function ShareLinksModal({ project, onProjectUpdated, onClose }) {
  const [webUrl, setWebUrl]       = useState(null);
  const [working, setWorking]     = useState(false);
  const [copied, setCopied]       = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);

  // Fetch the GitHub Pages base URL from server config
  useEffect(() => {
    fetch('/api/config')
      .then((r) => r.json())
      .then((d) => { if (d.webUrl) setWebUrl(d.webUrl); })
      .catch(() => {});
  }, []);

  const shareUrl = project?.share_token && webUrl
    ? `${webUrl}/projects/${project.share_token}/`
    : null;

  const handleGenerate = async () => {
    setWorking(true);
    try {
      const { data } = await axios.post(`/api/projects/${project.id}/share-token`);
      onProjectUpdated(data);
    } finally {
      setWorking(false);
    }
  };

  const handleRevoke = async () => {
    setWorking(true);
    setConfirmRevoke(false);
    try {
      const { data } = await axios.delete(`/api/projects/${project.id}/share-token`);
      onProjectUpdated(data);
    } finally {
      setWorking(false);
    }
  };

  const handleCopy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (_) {
      // Fallback for older browsers
      const el = document.createElement('textarea');
      el.value = shareUrl;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // ── Styles ──────────────────────────────────────────────────────────────────
  const overlay = {
    position: 'fixed', inset: 0, zIndex: 10000,
    background: 'rgba(0,0,0,0.6)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 16,
  };
  const dialog = {
    background: 'var(--bg-secondary, #1e293b)',
    border: '1px solid var(--border, #334155)',
    borderRadius: 10,
    width: '100%', maxWidth: 520,
    boxShadow: '0 20px 60px rgba(0,0,0,0.55)',
    overflow: 'hidden',
  };
  const hdr = {
    padding: '14px 18px',
    borderBottom: '1px solid var(--border, #334155)',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  };
  const body = { padding: '20px 20px 0' };
  const footer = { padding: '16px 20px 20px' };

  const btnBase = {
    cursor: 'pointer', border: 'none', borderRadius: 6,
    fontSize: 13, padding: '8px 16px', fontFamily: 'inherit',
    display: 'flex', alignItems: 'center', gap: 6,
    transition: 'background 0.15s',
  };

  return (
    <div style={overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={dialog}>
        {/* Header */}
        <div style={hdr}>
          <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text, #f1f5f9)' }}>
            🔗 Share Link — {project?.name}
          </span>
          <button
            onClick={onClose}
            style={{ ...btnBase, background: 'transparent', color: 'var(--text-muted, #94a3b8)', fontSize: 18, padding: '2px 8px' }}
          >✕</button>
        </div>

        {/* Body */}
        <div style={body}>
          {!project?.share_token ? (
            /* ── No token yet ── */
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text, #f1f5f9)', marginBottom: 8 }}>
                No share link for this project yet
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted, #94a3b8)', marginBottom: 24, lineHeight: 1.6 }}>
                Generating a link creates a unique private URL for your customer.<br />
                Only someone with the exact URL can view this schedule.
              </div>
              <button
                onClick={handleGenerate}
                disabled={working}
                style={{
                  ...btnBase,
                  background: '#3b82f6', color: '#fff',
                  justifyContent: 'center',
                  padding: '10px 28px', fontSize: 14,
                  opacity: working ? 0.7 : 1,
                }}
              >
                {working ? '⏳ Generating…' : '🔗 Generate Share Link'}
              </button>
            </div>
          ) : (
            /* ── Token exists ── */
            <>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)', marginBottom: 6 }}>
                  Customer URL
                </div>

                {/* URL box + copy button */}
                <div style={{
                  display: 'flex', gap: 8, alignItems: 'center',
                  background: 'var(--bg, #0f172a)',
                  border: '1px solid var(--border, #334155)',
                  borderRadius: 7, padding: '8px 12px',
                }}>
                  <span style={{
                    flex: 1, fontSize: 12, color: '#93c5fd',
                    wordBreak: 'break-all', fontFamily: 'monospace',
                  }}>
                    {shareUrl ?? '(publish first to get a URL)'}
                  </span>
                  {shareUrl && (
                    <button
                      onClick={handleCopy}
                      style={{
                        ...btnBase,
                        padding: '5px 12px', fontSize: 12,
                        background: copied ? 'rgba(52,211,153,0.18)' : 'rgba(59,130,246,0.18)',
                        color: copied ? '#34d399' : '#93c5fd',
                        border: `1px solid ${copied ? 'rgba(52,211,153,0.35)' : 'rgba(59,130,246,0.35)'}`,
                        flexShrink: 0, whiteSpace: 'nowrap',
                      }}
                    >
                      {copied ? '✓ Copied!' : '📋 Copy'}
                    </button>
                  )}
                </div>
              </div>

              {/* Token info */}
              <div style={{
                background: 'rgba(59,130,246,0.08)',
                border: '1px solid rgba(59,130,246,0.2)',
                borderRadius: 7, padding: '10px 14px',
                fontSize: 12, color: 'var(--text-muted, #94a3b8)',
                lineHeight: 1.7, marginBottom: 16,
              }}>
                <strong style={{ color: '#93c5fd' }}>ℹ How it works:</strong><br />
                This URL only shows <strong style={{ color: 'var(--text, #f1f5f9)' }}>{project.name}</strong> — no other projects are visible.<br />
                Data is a snapshot updated each time you <strong style={{ color: 'var(--text, #f1f5f9)' }}>Publish to Web</strong>.
              </div>

              {/* Danger zone: revoke */}
              {!confirmRevoke ? (
                <div style={{ marginBottom: 4 }}>
                  <button
                    onClick={() => setConfirmRevoke(true)}
                    disabled={working}
                    style={{
                      ...btnBase,
                      background: 'transparent',
                      color: '#f87171',
                      border: '1px solid rgba(248,113,113,0.35)',
                      fontSize: 12,
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(248,113,113,0.1)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    🔄 Rotate Link &nbsp;·&nbsp; 🗑 Revoke
                  </button>
                </div>
              ) : (
                <div style={{
                  background: 'rgba(248,113,113,0.08)',
                  border: '1px solid rgba(248,113,113,0.3)',
                  borderRadius: 7, padding: '12px 14px',
                  marginBottom: 4,
                }}>
                  <div style={{ fontSize: 13, color: '#fca5a5', marginBottom: 10 }}>
                    ⚠ Revoking invalidates the current URL immediately. Your customer will lose access until you generate a new link and publish again.
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={handleRevoke}
                      disabled={working}
                      style={{ ...btnBase, background: '#ef4444', color: '#fff', fontSize: 12 }}
                    >
                      {working ? '⏳ Revoking…' : '✕ Yes, Revoke'}
                    </button>
                    <button
                      onClick={() => setConfirmRevoke(false)}
                      style={{
                        ...btnBase,
                        background: 'transparent',
                        color: 'var(--text-muted, #94a3b8)',
                        border: '1px solid var(--border, #334155)',
                        fontSize: 12,
                      }}
                    >Cancel</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ ...footer, borderTop: '1px solid var(--border, #334155)', marginTop: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted, #94a3b8)' }}>
            {project?.share_token
              ? '💡 Remember to Publish to Web after any changes'
              : ''}
          </span>
          <button
            onClick={onClose}
            style={{
              ...btnBase,
              background: 'var(--bg, #0f172a)',
              color: 'var(--text-muted, #94a3b8)',
              border: '1px solid var(--border, #334155)',
              fontSize: 12,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--bg, #0f172a)'; }}
          >Close</button>
        </div>
      </div>
    </div>
  );
}
