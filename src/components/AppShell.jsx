import Topbar from './Topbar'
import TabsNav from './TabsNav'
import Footer from './Footer'

export default function AppShell({
  // Topbar
  themeMode,
  onToggleTheme,

  // Tabs
  activeTab,
  onSetupClick,
  onBoardClick,
  onRosterClick,

  // Inhalt
  children,
}) {
  return (
    <div className="wrap">
      <Topbar themeMode={themeMode} onToggleTheme={onToggleTheme} />

      <TabsNav
        activeTab={activeTab}
        onSetupClick={onSetupClick}
        onBoardClick={onBoardClick}
        onRosterClick={onRosterClick}
      />

      {children}

      <Footer />
    </div>
  )
}
