import { useLocation, useNavigate } from 'react-router-dom'
import Icon from './Icon'
import { cx } from '../utils/formatting'
import { useGamesLiveStore } from '../stores/useGamesLiveStore'

// Untermenue der mobilen Bottom-Bar: nur die Bereiche, die gerade nicht in
// der Leiste stehen. Theme haengt in der Topbar, Setup und Profile im
// Zahnrad-Menue — beides hier zu wiederholen waere Doppelung.
const NAV = [
  { icon: 'home', label: 'Dashboard', path: '/dashboard' },
  { icon: 'board', label: 'Board', path: '/board' },
  { icon: 'chart', label: 'Analyse', path: '/analyse' },
  { icon: 'roster', label: 'Lineup', path: '/lineup' },
  { icon: 'clipboard-check', label: 'Wochenrückblick', path: '/weekly' },
  { icon: 'scoreboard', label: 'NFL', path: '/scores' },
  { icon: 'swap', label: 'Trade', path: '/trade' },
]

export default function MobileMoreSheet({ open, onClose }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const liveCount = useGamesLiveStore((s) => s.liveCount)
  const nav = liveCount > 0 || pathname === '/redzone'
    ? [{ icon: 'radio', label: liveCount > 0 ? `Redzone · ${liveCount} live` : 'Redzone', path: '/redzone', live: liveCount > 0 }, ...NAV]
    : NAV

  function go(item) {
    onClose?.()
    navigate(item.path, item.state ? { state: item.state } : undefined)
  }

  return (
    <>
      <div className={cx('board-sheet-scrim', open && 'is-open')} onClick={onClose} />
      <div className={cx('board-sheet mob-more-sheet', open && 'is-open')} role="dialog" aria-label="Menü">
        <div className="board-sheet-head">
          <strong>Menü</strong>
          <button type="button" className="board-sheet-close" onClick={onClose} aria-label="Schließen">
            <Icon name="x" size={18} />
          </button>
        </div>

        <div className="mob-more-group">Bereiche</div>
        <div className="mob-more-grid">
          {nav.map((n) => (
            <button
              key={n.path}
              type="button"
              className={cx('mob-more-tile', pathname === n.path && 'is-active', n.live && 'mob-more-tile--live')}
              onClick={() => go(n)}
            >
              <Icon name={n.icon} size={20} />
              <span>{n.label}</span>
            </button>
          ))}
        </div>

      </div>
    </>
  )
}
