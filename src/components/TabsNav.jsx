import { useNavigate, useLocation } from 'react-router-dom'
import { cx } from '../utils/formatting'
import Icon from './Icon'

const TABS = [
  { path: '/dashboard', label: 'Home', icon: 'home' },
  { path: '/board', label: 'Board', icon: 'board' },
  { path: '/roster', label: 'Roster', icon: 'roster' },
  { path: '/trade', label: 'Trade', icon: 'swap' },
]

export default function TabsNav() {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  return (
    <nav className="tabs">
      {TABS.map(({ path, label, icon }) => {
        const active = pathname === path
        return (
          <button
            key={path}
            className={cx('tab', active && 'active')}
            aria-current={active ? 'page' : undefined}
            onClick={() => navigate(path)}
          >
            <Icon name={icon} size={16} />
            {label}
          </button>
        )
      })}
    </nav>
  )
}
