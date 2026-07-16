import ThemeSelect from './ThemeSelect'

export default function Topbar({ themeId, setTheme }) {
  return (
    <header className="topbar">
      <div className="brand">
        <b>Draft<span className="brand-accent">Helper</span></b>
        <small>Sleeper</small>
      </div>
      <ThemeSelect themeId={themeId} setTheme={setTheme} />
    </header>
  )
}
