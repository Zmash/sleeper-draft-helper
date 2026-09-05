import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import ThemeSelect from './ThemeSelect'
import Modal from './Modal'
import Icon from './Icon'
import { useUIStore } from '../stores/useUIStore'

export default function Topbar({ themeId, setTheme }) {
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const setShellVersion = useUIStore((s) => s.setShellVersion)

  function go(path) {
    setMenuOpen(false)
    navigate(path)
  }

  return (
    <header className="topbar">
      <Link to="/dashboard" className="brand" aria-label="Zur Startseite">
        <b>Draft<span className="brand-accent">Helper</span></b>
        <small>Sleeper</small>
      </Link>
      <div className="row" style={{ gap: 8, alignItems: 'center' }}>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => { setShellVersion('next'); navigate('/board') }}
          title="Neue Oberfläche ausprobieren"
        >
          <Icon name="zap" size={16} /> Neu
        </button>
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
