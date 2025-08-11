import { cx } from '../utils/formatting'

export default function TabsNav({
  activeTab,
  onSetupClick,
  onBoardClick,
  onRosterClick,
}) {
  return (
    <nav className="tabs">
      <button className={cx('tab', activeTab === 'setup' && 'active')} onClick={onSetupClick}>
        Setup
      </button>
      <button className={cx('tab', activeTab === 'board' && 'active')} onClick={onBoardClick}>
        Board
      </button>
      <button className={cx('tab', activeTab === 'roster' && 'active')} onClick={onRosterClick}>
        Roster
      </button>
    </nav>
  )
}
