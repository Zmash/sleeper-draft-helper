import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Icon from './Icon'
import { cx } from '../utils/formatting'
import MobileMoreSheet from './MobileMoreSheet'
import { useGamesLiveStore } from '../stores/useGamesLiveStore'
import { useSyncDot } from '../hooks/useSyncDot'
import { useUIStore } from '../stores/useUIStore'

// Mobile Bottom-Navigation fuer alle Seiten ausser dem Board — dort uebernimmt
// BoardMobileBar dieselbe Leiste mit board-spezifischen Aktionen. Gleiche
// Klassen, damit beide identisch aussehen und sich beim Seitenwechsel nichts
// unter dem Daumen verschiebt.
//
// Die Plaetze sind bewusst fest und nicht je Seite anders belegt: eine
// Bottom-Bar lebt davon, dass der Daumen die Ziele blind trifft. Trade sitzt
// im Mehr-Sheet, weil es bisher nur fuer Dynasty umgesetzt ist.
//
// Props:
//   onSync        – Callback fuer den Sync-Button (je nach aktueller Seite)
//   syncLabel     – Aria-Label / Title fuer den Sync-Button
//   showSync      – Button anzeigen (false z.B. auf /setup, /profiles)
//   autoRefreshActive – Auto-Sync laeuft fuer diese Seite (gruener Punkt)
//   lastSyncAt / staleSeconds – ab wann der Stand als veraltet gilt; dann
//     wird derselbe Punkt rot, auch bei ausgeschaltetem Auto-Sync
//   autoSeconds – Takt dieser Seite, nur zur Anzeige im Auto-Sync-Sheet
//
// Kurzer Tap auf den FAB = jetzt aktualisieren, langer Druck = Auto-Sync-Sheet.
// Gleiches Muster wie in BoardMobileBar — dort regelt es das Pick-Intervall,
// hier den seitenuebergreifenden Hauptschalter.
export default function MobileNav({
  onSync, syncLabel = 'Daten aktualisieren', showSync = true, autoRefreshActive = false,
  lastSyncAt = null, staleSeconds = null, autoSeconds = null,
}) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const liveCount = useGamesLiveStore((s) => s.liveCount)
  const [moreOpen, setMoreOpen] = useState(false)
  const dot = useSyncDot({ lastAt: lastSyncAt, staleSeconds, autoOn: autoRefreshActive })
  const [syncOpen, setSyncOpen] = useState(false)
  const autoSyncEnabled = useUIStore((s) => s.autoSyncEnabled)
  const setAutoSyncEnabled = useUIStore((s) => s.setAutoSyncEnabled)

  // Langer Druck (>=500 ms) oeffnet das Sheet; der longPress-Ref verhindert,
  // dass der nachfolgende click zusaetzlich synchronisiert.
  const pressTimer = useRef(null)
  const longPressed = useRef(false)
  function fabPressStart() {
    longPressed.current = false
    clearTimeout(pressTimer.current)
    pressTimer.current = setTimeout(() => { longPressed.current = true; setSyncOpen(true) }, 500)
  }
  function fabPressEnd() { clearTimeout(pressTimer.current) }
  function fabClick() {
    if (longPressed.current) { longPressed.current = false; return }
    onSync?.()
  }
  useEffect(() => () => clearTimeout(pressTimer.current), [])

  // Wie board-mobile-active: die Seite braucht unten Platz fuer die Bar.
  useEffect(() => {
    document.body.classList.add('mobile-nav-active')
    return () => document.body.classList.remove('mobile-nav-active')
  }, [])

  const item = (icon, label, path) => (
    <button
      type="button"
      className={cx('bmb-item', pathname === path && 'is-active')}
      onClick={() => navigate(path)}
    >
      <Icon name={icon} size={20} /><span>{label}</span>
    </button>
  )

  return (
    <>
      <nav className="board-mobile-bar" aria-label="Navigation">
        {item('board', 'Board', '/board')}
        {item('chart', 'Analyse', '/analyse')}

        {showSync && (
          <button
            type="button"
            className="bmb-fab"
            onClick={fabClick}
            onPointerDown={fabPressStart}
            onPointerUp={fabPressEnd}
            onPointerLeave={fabPressEnd}
            onContextMenu={(e) => e.preventDefault()}
            disabled={!onSync}
            aria-label={dot === 'stale' ? `${syncLabel} — Stand veraltet` : syncLabel}
            title={dot === 'stale' ? `${syncLabel} — Stand veraltet` : syncLabel}
          >
            <Icon name="refresh" size={26} />
            {dot !== 'none' && <span className={cx('bmb-fab-auto', dot === 'stale' && 'is-stale')} aria-hidden />}
          </button>
        )}

        {item('home', 'Start', '/dashboard')}
        <button
          type="button"
          className={cx('bmb-item', moreOpen && 'is-active')}
          onClick={() => setMoreOpen(true)}
          aria-label={liveCount > 0 ? 'Mehr – Spiele laufen' : 'Mehr'}
        >
          <span className="bmb-badge-wrap">
            <Icon name="menu" size={20} />
            {liveCount > 0 && <span className="bmb-live-dot" aria-hidden="true" />}
          </span>
          <span>Mehr</span>
        </button>
      </nav>

      <MobileMoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} />

      {/* Auto-Sync-Sheet: per Long-Press auf den Sync-Knopf. Die Takte selbst
          stehen fest je Seite (services/pageSync.js) — hier steht nur, ob sie
          ueberhaupt laufen. */}
      <div className={cx('board-sheet-scrim', syncOpen && 'is-open')} onClick={() => setSyncOpen(false)} />
      <div className={cx('board-sheet bmb-tips-sheet', syncOpen && 'is-open')} role="dialog" aria-label="Auto-Sync">
        <div className="board-sheet-head">
          <strong>Auto-Sync</strong>
          <button type="button" className="board-sheet-close" onClick={() => setSyncOpen(false)} aria-label="Schließen">
            <Icon name="x" size={18} />
          </button>
        </div>
        <label className="row items-center" style={{ gap: 8, marginBottom: 8 }}>
          <input
            type="checkbox"
            checked={autoSyncEnabled}
            onChange={(e) => setAutoSyncEnabled(e.target.checked)}
          />
          <span>Seiten automatisch aktualisieren</span>
        </label>
        <p className="muted text-xs" style={{ marginBottom: 0 }}>
          {autoSyncEnabled && autoSeconds
            ? `Diese Seite: alle ${autoSeconds % 60 === 0 ? `${autoSeconds / 60} min` : `${autoSeconds} s`}.`
            : 'Diese Seite lädt nur auf Knopfdruck.'}
          {' '}Der Punkt am Knopf wird rot, sobald der Stand veraltet ist.
        </p>
      </div>
    </>
  )
}
