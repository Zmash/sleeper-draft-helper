import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from './Icon'
import { cx } from '../utils/formatting'
import MobileMoreSheet from './MobileMoreSheet'

// Presets fuer den Auto-Sync (Long-Press auf den Sync-Button). „Aus" schaltet
// den Auto-Refresh ab, eine Zahl aktiviert ihn mit diesem Intervall.
const SYNC_PRESETS = [
  { label: 'Aus', off: true },
  { label: '10 s', seconds: 10 },
  { label: '30 s', seconds: 30 },
  { label: '60 s', seconds: 60 },
  { label: '120 s', seconds: 120 },
]

// Mobile-only Aktionsleiste im Stil einer App-Bottom-Bar: ein grosser, erhoehter
// Center-Button (nur Symbol) fuer den manuellen Sync, flankiert von je zwei
// Items — links Setup + Filter, rechts AI + Board/Liste-Umschalter. Sichtbar
// erst unter dem Mobile-Breakpoint (siehe .board-mobile-bar in style.css).
// Navigation zu den anderen Seiten laeuft ueber den Mehr-Button
// (MobileMoreSheet) sowie ueber die Sprungziele im Filter-Sheet.
export default function BoardMobileBar({
  onSync,
  onFilter,
  onAiAdvice,
  aiDisabled = false,
  boardView = 'list',
  onToggleBoardView,
  autoRefreshEnabled = true,
  refreshIntervalSeconds = 30,
  onToggleAutoRefresh,
  onChangeInterval,
  reviewMode = false,
  onOpenDraftReview,
}) {
  const navigate = useNavigate() // eslint-disable-line no-unused-vars -- bleibt fuer kuenftige Direktziele
  const [syncOpen, setSyncOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)

  // Kurzer Tap = Sync, langer Druck (>=500ms) = Auto-Sync-Sheet. Der
  // longPress-Ref verhindert, dass der nachfolgende click nochmal synchronisiert.
  const pressTimer = useRef(null)
  const longPressed = useRef(false)
  function fabPressStart() {
    longPressed.current = false
    clearTimeout(pressTimer.current)
    pressTimer.current = setTimeout(() => {
      longPressed.current = true
      setSyncOpen(true)
    }, 500)
  }
  function fabPressEnd() {
    clearTimeout(pressTimer.current)
  }
  function fabClick() {
    if (longPressed.current) { longPressed.current = false; return }
    onSync?.()
  }

  // Presets auf die vorhandenen Event-Handler abbilden (gleiches Muster wie
  // FiltersRow: synthetische {target:{...}}-Objekte).
  function applySyncPreset(preset) {
    if (preset.off) {
      onToggleAutoRefresh?.({ target: { checked: false } })
    } else {
      onChangeInterval?.({ target: { value: preset.seconds } })
      onToggleAutoRefresh?.({ target: { checked: true } })
    }
    setSyncOpen(false)
  }
  const activePreset = !autoRefreshEnabled
    ? 'Aus'
    : SYNC_PRESETS.find((p) => p.seconds === Number(refreshIntervalSeconds))?.label || null

  return (
    <>
      <nav className="board-mobile-bar" aria-label="Board-Aktionen">
        <button
          type="button"
          className={cx('bmb-item', moreOpen && 'is-active')}
          onClick={() => setMoreOpen(true)}
        >
          <Icon name="menu" size={20} /><span>Mehr</span>
        </button>
        <button type="button" className="bmb-item" onClick={onFilter}>
          <Icon name="filter" size={20} /><span>Filter</span>
        </button>

        <button
          type="button"
          className="bmb-fab"
          onClick={fabClick}
          onPointerDown={fabPressStart}
          onPointerUp={fabPressEnd}
          onPointerLeave={fabPressEnd}
          onContextMenu={(e) => e.preventDefault()}
          aria-label="Picks synchronisieren — lange drücken für Auto-Sync"
          title="Tippen: synchronisieren · Lange drücken: Auto-Sync"
        >
          <Icon name="refresh" size={26} />
          {autoRefreshEnabled && <span className="bmb-fab-auto" aria-hidden />}
        </button>

        <button
          type="button"
          className="bmb-item"
          onClick={reviewMode ? onOpenDraftReview : onAiAdvice}
          disabled={!reviewMode && aiDisabled}
          title={
            reviewMode
              ? 'Draft ist fertig — AI Draft Review öffnen'
              : aiDisabled
                ? 'Picks werden geladen — gleich verfügbar'
                : 'AI-Empfehlung für den nächsten Pick'
          }
        >
          <Icon name="bot" size={20} /><span>AI</span>
        </button>
        <button type="button" className="bmb-item" onClick={onToggleBoardView}>
          <Icon name="board" size={20} /><span>{boardView === 'list' ? 'Board' : 'Liste'}</span>
        </button>
      </nav>

      <MobileMoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} />

      {/* Auto-Sync-Sheet: per Long-Press auf den Sync-Button */}
      <div className={cx('board-sheet-scrim', syncOpen && 'is-open')} onClick={() => setSyncOpen(false)} />
      <div className={cx('board-sheet bmb-tips-sheet', syncOpen && 'is-open')} role="dialog" aria-label="Auto-Sync">
        <div className="board-sheet-head">
          <strong>Auto-Sync</strong>
          <button type="button" className="board-sheet-close" onClick={() => setSyncOpen(false)} aria-label="Schließen">
            <Icon name="x" size={18} />
          </button>
        </div>
        <p className="muted text-xs" style={{ marginBottom: 10 }}>
          Wie oft die Picks automatisch geladen werden.
        </p>
        <div className="bmb-sync-presets">
          {SYNC_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              className={cx('bmb-sync-preset', activePreset === preset.label && 'active')}
              aria-pressed={activePreset === preset.label}
              onClick={() => applySyncPreset(preset)}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>
    </>
  )
}
