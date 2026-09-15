import { useNavigate, useLocation } from 'react-router-dom'
import { cx } from '../utils/formatting'
import Icon from './Icon'
import { useGamesLiveStore } from '../stores/useGamesLiveStore'

const TABS = [
  { path: '/dashboard', label: 'Home', icon: 'home' },
  { path: '/board', label: 'Board', icon: 'board' },
  { path: '/analyse', label: 'Analyse', icon: 'chart' },
  { path: '/lineup', label: 'Lineup', icon: 'roster' },
  { path: '/weekly', label: 'Woche', icon: 'clipboard-check' },
  { path: '/nfl', label: 'NFL', icon: 'calendar' },
  { path: '/trade', label: 'Trade', icon: 'swap' },
]

export default function TabsNav() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const liveCount = useGamesLiveStore((s) => s.liveCount)
  const tabs = liveCount > 0 || pathname === '/redzone'
    ? [...TABS, { path: '/redzone', label: 'Redzone', icon: 'radio', live: liveCount > 0 }]
    : TABS

  return (
    <nav className="tabs">
      {tabs.map(({ path, label, icon, live }) => {
        const active = pathname === path
        return (
          <button
            key={path}
            className={cx('tab', active && 'active', live && 'tab--live')}
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
