import { useLocation, useNavigate } from 'react-router-dom'
import Icon from './Icon'
import { cx } from '../utils/formatting'

// Untermenue der mobilen Bottom-Bar: nur die Bereiche, die gerade nicht in
// der Leiste stehen. Theme haengt in der Topbar, Setup und Profile im
// Zahnrad-Menue — beides hier zu wiederholen waere Doppelung.
const NAV = [
  { icon: 'home', label: 'Dashboard', path: '/dashboard' },
  { icon: 'board', label: 'Board', path: '/board' },
  { icon: 'chart', label: 'Analyse', path: '/analyse' },
  { icon: 'swap', label: 'Trade', path: '/trade' },
]

export default function MobileMoreSheet({ open, onClose }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()

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
          {NAV.map((n) => (
            <button
              key={n.path}
              type="button"
              className={cx('mob-more-tile', pathname === n.path && 'is-active')}
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
