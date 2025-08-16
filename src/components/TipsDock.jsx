// src/components/TipsDock.jsx
import React, { useState, useMemo } from 'react'

const sevClass = (s) => ({
  info: 'tip tip--info',
  warn: 'tip tip--warn',
  critical: 'tip tip--critical',
  success: 'tip tip--success',
}[s] || 'tip')

export default function TipsDock({ tips = [] }) {
  const [open, setOpen] = useState(false)
  const unread = tips.length

  return (
    <>
      <button
        className="tips-dock-toggle"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        title="Tipps"
      >
        💬 Tipps{unread ? ` (${unread})` : ''}
      </button>

      {open && (
        <div className="tips-dock-panel">
          <div className="tips-dock-header">
            <strong>Live-Tipps</strong>
            <button onClick={() => setOpen(false)} aria-label="schließen">✕</button>
          </div>
          <div className="tips-dock-list">
            {tips.length === 0 && <div className="muted">Keine Tipps aktuell.</div>}
            {tips.map(t => (
              <div key={t.id} className={sevClass(t.severity)}>
                <span className="tip-dot" />
                <span>{t.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <style>{`
        .tips-dock-toggle {
          position: fixed;
          left: 16px;
          bottom: 16px;
          z-index: 40;
          border: 1px solid var(--border);
          background: var(--card);
          color: var(--text);
          padding: 8px 12px;
          border-radius: 999px;
          box-shadow: 0 6px 20px rgba(0,0,0,.25);
        }
        .tips-dock-panel {
          position: fixed;
          left: 16px;
          bottom: 60px;
          width: 280px;
          max-height: 360px;
          z-index: 41;
          border: 1px solid var(--border);
          background: var(--card);
          color: var(--text);
          border-radius: 12px;
          padding: 10px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }
        .tips-dock-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }
        .tips-dock-list {
          overflow: auto;
          display: grid;
          gap: 8px;
        }
        .tip {
          display: grid;
          grid-template-columns: 10px 1fr;
          gap: 8px;
          font-size: 12px;
          padding: 8px;
          border-radius: 8px;
          background: rgba(255,255,255,0.02);
          border: 1px dashed var(--border);
        }
        .tip-dot { width: 10px; height: 10px; border-radius: 50%; margin-top: 4px; background: var(--muted); }
        .tip--info .tip-dot { background: #5dade2; }
        .tip--warn .tip-dot { background: #f1c40f; }
        .tip--critical .tip-dot { background: #e74c3c; }
        .tip--success .tip-dot { background: #2ecc71; }
        @media (max-width: 480px) {
          .tips-dock-panel {
            width: 90vw;
            height: 40vh;
            max-height: unset;
          }
        }
      `}</style>
    </>
  )
}