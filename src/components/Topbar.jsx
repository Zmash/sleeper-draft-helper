export default function Topbar({ themeMode, onToggleTheme }) {
    return (
      <header className="topbar">
        <h1>Sleeper Draft Helper</h1>
        <button
          className="btn"
          onClick={onToggleTheme}
          title={themeMode === 'dark' ? 'Light Mode' : 'Dark Mode'}
        >
          {themeMode === 'dark' ? '☀️ Light' : '🌙 Dark'}
        </button>
      </header>
    )
  }
  