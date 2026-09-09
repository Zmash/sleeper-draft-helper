import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import ThemeSelect from './ThemeSelect'
import Modal from './Modal'
import Icon from './Icon'
import MobileDraftSwitch from './MobileDraftSwitch'
import { createTapCounter, EGG_TAP_COUNT, EGG_TAP_WINDOW_MS, openFootballEgg } from '../utils/easterEgg.js'

export default function Topbar({ themeId, setTheme }) {
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  // Easter Egg (mobil): Brand-Logo 5x schnell antippen oeffnet das
  // Field-Goal-Spiel. Das Logo ist in jeder Shell sichtbar, auch mobil.
  const handleBrandTap = useMemo(
    () => createTapCounter(EGG_TAP_COUNT, EGG_TAP_WINDOW_MS, openFootballEgg),
    [],
  )

  function go(path) {
    setMenuOpen(false)
    navigate(path)
  }

  return (
    <header className="topbar">
      <Link to="/dashboard" className="brand" aria-label="Zur Startseite" onClick={handleBrandTap}>
        <b>Draft<span className="brand-accent">Helper</span></b>
        <small>Sleeper</small>
      </Link>
      <div className="row topbar-actions" style={{ gap: 8, alignItems: 'center' }}>
        <MobileDraftSwitch />
        <ThemeSelect themeId={themeId} setTheme={setTheme} />
        <button className="btn btn-ghost btn-sm" onClick={() => setMenuOpen(true)} aria-label="Einstellungen" title="Einstellungen">
          <Icon name="settings" size={18} />
        </button>
      </div>
      <Modal open={menuOpen} onClose={() => setMenuOpen(false)} title="Einstellungen">
        <div className="settings-menu">
          <button className="btn btn-secondary settings-menu-item" onClick={() => go('/setup')}>
            Liga/Mock-Setup
          </button>
          <button className="btn btn-secondary settings-menu-item" onClick={() => go('/profiles')}>
            Profile verwalten
          </button>
        </div>
      </Modal>
    </header>
  )
}
