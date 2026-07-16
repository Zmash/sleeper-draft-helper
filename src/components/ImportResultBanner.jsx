import React, { useState } from 'react'
import Icon from './Icon'

// Ehrlich statt beruhigend: der Merge trifft nicht jeden Namen. Wer das
// verschweigt, laesst den Nutzer eine Luecke fuer einen Datenfehler halten.
export default function ImportResultBanner({
  stats, method, marketMissing = false, onUndo, onClose, onGoToBoard,
}) {
  const [showUnmatched, setShowUnmatched] = useState(false)
  if (!stats) return null

  return (
    <div className="import-done-banner">
      <div className="import-done-main">
        <span className="import-done-text">
          <Icon name="check" size={14} /> <strong>{stats.total} Spieler</strong> importiert ({method})
          {stats.withAdp > 0 && <> · <strong>{stats.withAdp} mit ADP</strong></>}
          {stats.withoutAdp > 0 && (
            <> · {stats.withoutAdp} ohne Marktdaten{' '}
              <button className="btn-link" onClick={() => setShowUnmatched((s) => !s)}>
                {showUnmatched ? 'ausblenden' : 'anzeigen'}
              </button>
            </>
          )}
        </span>
        {marketMissing && (
          <span className="import-done-warn">
            <Icon name="warning" size={13} /> Marktdaten nicht erreichbar — Rangliste ist da, ADP fehlt.
          </span>
        )}
      </div>

      {showUnmatched && !!stats.unmatchedNames?.length && (
        <ul className="import-unmatched">
          {stats.unmatchedNames.map((n) => <li key={n}>{n}</li>)}
        </ul>
      )}

      <div className="import-done-actions">
        {onGoToBoard && <button className="btn btn-primary btn-sm" onClick={onGoToBoard}>→ Board</button>}
        {onUndo && <button className="btn btn-secondary btn-sm" onClick={onUndo}>Rückgängig</button>}
        {onClose && (
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Schließen">
            <Icon name="x" size={14} />
          </button>
        )}
      </div>
    </div>
  )
}
