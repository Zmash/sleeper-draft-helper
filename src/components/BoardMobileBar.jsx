import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from './Icon'
import { cx } from '../utils/formatting'

// Presets fuer den Auto-Sync (Long-Press auf den Sync-Button). „Aus" schaltet
// den Auto-Refresh ab, eine Zahl aktiviert ihn mit diesem Intervall.
const SYNC_PRESETS = [
  { label: 'Aus', off: true },
  { label: '30 s', seconds: 30 },
  { label: '60 s', seconds: 60 },
  { label: '120 s', seconds: 120 },
]

const sevClass = (s) => ({
  info: 'tip tip--info',
  warn: 'tip tip--warn',
  critical: 'tip tip--critical',
  success: 'tip tip--success',
}[s] || 'tip')

// Mobile-only Aktionsleiste im Stil einer App-Bottom-Bar: ein grosser, erhoehter
// Center-Button (nur Symbol) fuer den manuellen Sync, flankiert von je zwei
// Items — links Setup + Filter, rechts AI + Tipps. Sichtbar erst unter dem
// Mobile-Breakpoint (siehe .board-mobile-bar in style.css). Navigation zu den
// anderen Seiten laeuft ueber den Setup-Button (die Setup-Seite blendet die
// Haupt-Tabs wieder ein) sowie ueber die Sprungziele im Filter-Sheet.
export default function BoardMobileBar({
  onSync,
  onFilter,
  onAiAdvice,
  aiDisabled = false,
  tips = [],
  autoRefreshEnabled = true,
  refreshIntervalSeconds = 30,
  onToggleAutoRefresh,
  onChangeInterval,
}) {
  const navigate = useNavigate()
  const [tipsOpen, setTipsOpen] = useState(false)
  const [syncOpen, setSyncOpen] = useState(false)

  // tips kann null sein (BoardSection reicht es teils ungesetzt durch) — der
  // Default-Param greift nur bei undefined, daher hier explizit normalisieren.
  const tipList = Array.isArray(tips) ? tips : []

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
          className="bmb-item"
          onClick={() => navigate('/setup', { state: { mode: 'edit' } })}
        >
          <Icon name="settings" size={20} /><span>Setup</span>
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
          onClick={onAiAdvice}
          disabled={aiDisabled}
          title={aiDisabled ? 'Picks werden geladen — gleich verfügbar' : 'AI-Empfehlung für den nächsten Pick'}
        >
          <Icon name="bot" size={20} /><span>AI</span>
        </button>
        <button type="button" className="bmb-item" onClick={() => setTipsOpen(true)}>
          <span className="bmb-badge-wrap">
            <Icon name="message" size={20} />
            {tipList.length > 0 && <span className="bmb-badge">{tipList.length}</span>}
          </span>
          <span>Tipps</span>
        </button>
      </nav>

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

      {/* Tipps-Sheet: uebernimmt die Rolle des Floating-TipsDock auf dem Board */}
      <div className={cx('board-sheet-scrim', tipsOpen && 'is-open')} onClick={() => setTipsOpen(false)} />
      <div className={cx('board-sheet bmb-tips-sheet', tipsOpen && 'is-open')} role="dialog" aria-label="Live-Tipps">
        <div className="board-sheet-head">
          <strong>Live-Tipps</strong>
          <button type="button" className="board-sheet-close" onClick={() => setTipsOpen(false)} aria-label="Schließen">
            <Icon name="x" size={18} />
          </button>
        </div>
        <div className="tips-dock-list">
          {tipList.length === 0 && <div className="muted">Keine Tipps aktuell.</div>}
          {tipList.map((t) => (
            <div key={t.id} className={sevClass(t.severity)}>
              <span className="tip-dot" />
              <span>{t.text}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
