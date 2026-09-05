import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Icon from './Icon'
import { cx } from '../utils/formatting'
import { useSessionStore } from '../stores/useSessionStore'
import { useLiveStore } from '../stores/useLiveStore'
import MobileMoreSheet from './MobileMoreSheet'

// Mobile Bottom-Navigation fuer alle Seiten ausser dem Board — dort uebernimmt
// BoardMobileBar dieselbe Leiste mit board-spezifischen Aktionen. Gleiche
// Klassen, damit beide identisch aussehen und sich beim Seitenwechsel nichts
// unter dem Daumen verschiebt.
//
// Die Plaetze sind bewusst fest und nicht je Seite anders belegt: eine
// Bottom-Bar lebt davon, dass der Daumen die Ziele blind trifft. Trade sitzt
// im Mehr-Sheet, weil es bisher nur fuer Dynasty umgesetzt ist.
export default function MobileNav() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { selectedDraftId } = useSessionStore()
  const { loadPicks, autoRefreshEnabled } = useLiveStore()
  const [moreOpen, setMoreOpen] = useState(false)

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
        {item('roster', 'Roster', '/roster')}

        <button
          type="button"
          className="bmb-fab"
          onClick={() => selectedDraftId && loadPicks(selectedDraftId).catch(() => {})}
          disabled={!selectedDraftId}
          aria-label="Picks synchronisieren"
          title="Picks synchronisieren"
        >
          <Icon name="refresh" size={26} />
          {autoRefreshEnabled && selectedDraftId && <span className="bmb-fab-auto" aria-hidden />}
        </button>

        {item('home', 'Start', '/dashboard')}
        <button type="button" className={cx('bmb-item', moreOpen && 'is-active')} onClick={() => setMoreOpen(true)}>
          <Icon name="menu" size={20} /><span>Mehr</span>
        </button>
      </nav>

      <MobileMoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} />
    </>
  )
}
