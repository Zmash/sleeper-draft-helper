import { useLocation, useNavigate } from 'react-router-dom'
import Icon from './Icon'
import { cx } from '../utils/formatting'
import { useUIStore } from '../stores/useUIStore'
import { THEMES } from '../theme/themes'

// Untermenue der mobilen Bottom-Bar. Die Bar selbst hat nur fuenf Plaetze —
// alles Weitere (Navigation, Setup, Profile, Theme) haengt hier dran, damit
// mobil nichts mehr nur ueber die Desktop-Tabs erreichbar ist.
const NAV = [
  { icon: 'home', label: 'Dashboard', path: '/dashboard' },
  { icon: 'board', label: 'Board', path: '/board' },
  { icon: 'roster', label: 'Roster', path: '/roster' },
  { icon: 'swap', label: 'Trade', path: '/trade' },
]

const VERWALTUNG = [
  { icon: 'settings', label: 'Liga & Mock-Setup', path: '/setup', state: { mode: 'edit' } },
  { icon: 'clipboard', label: 'Profile verwalten', path: '/profiles' },
]

export default function MobileMoreSheet({ open, onClose }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const themeId = useUIStore((s) => s.themeId)
  const setTheme = useUIStore((s) => s.setTheme)

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

        <div className="mob-more-group">Verwaltung</div>
        {VERWALTUNG.map((n) => (
          <button key={n.path} type="button" className="mob-more-row" onClick={() => go(n)}>
            <Icon name={n.icon} size={17} />
            <span>{n.label}</span>
          </button>
        ))}

        <div className="mob-more-group">Design</div>
        <div className="mob-more-themes">
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              className={cx('mob-more-theme', t.id === themeId && 'is-active')}
              onClick={() => setTheme(t.id)}
            >
              {t.label}
              {t.id === themeId && <Icon name="check" size={13} />}
            </button>
          ))}
        </div>
      </div>
    </>
  )
}
