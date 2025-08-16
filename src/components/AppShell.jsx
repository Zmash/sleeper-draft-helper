import Topbar from './Topbar'
import TabsNav from './TabsNav'
import Footer from './Footer'
import TipsDock from './TipsDock'

export default function AppShell({ // Topbar
  themeMode,
  onToggleTheme,

  // Tabs
  activeTab,
  onSetupClick,
  onBoardClick,
  onRosterClick,

  // Inhalt
  children, tips }) {
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

      <TipsDock tips={tips} />
      <Footer />
    </div>
  )
}
