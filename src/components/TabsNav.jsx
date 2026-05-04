import { useNavigate, useLocation } from 'react-router-dom'
import { cx } from '../utils/formatting'

export default function TabsNav() {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  return (
    <nav className="tabs">
      <button className={cx('tab', pathname === '/setup' && 'active')} onClick={() => navigate('/setup')}>
        Setup
      </button>
      <button className={cx('tab', pathname === '/board' && 'active')} onClick={() => navigate('/board')}>
        Board
      </button>
      <button className={cx('tab', pathname === '/roster' && 'active')} onClick={() => navigate('/roster')}>
        Roster
      </button>
    </nav>
  )
}
