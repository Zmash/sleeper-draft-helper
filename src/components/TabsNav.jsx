import { useNavigate, useLocation } from 'react-router-dom'
import { cx } from '../utils/formatting'

const TABS = [
  { path: '/dashboard', label: 'Home' },
  { path: '/board',     label: 'Board' },
  { path: '/roster',    label: 'Roster' },
]

export default function TabsNav() {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  return (
    <nav className="tabs">
      {TABS.map(({ path, label }) => (
        <button
          key={path}
          className={cx('tab', pathname === path && 'active')}
          onClick={() => navigate(path)}
        >
          {label}
        </button>
      ))}
    </nav>
  )
}
