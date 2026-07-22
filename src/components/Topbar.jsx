import { Link } from 'react-router-dom'
import ThemeSelect from './ThemeSelect'

export default function Topbar({ themeId, setTheme }) {
  return (
    <header className="topbar">
      <Link to="/dashboard" className="brand" aria-label="Zur Startseite">
        <b>Draft<span className="brand-accent">Helper</span></b>
        <small>Sleeper</small>
      </Link>
      <ThemeSelect themeId={themeId} setTheme={setTheme} />
    </header>
  )
}
