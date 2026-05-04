import Topbar from './Topbar'
import TabsNav from './TabsNav'
import Footer from './Footer'
import TipsDock from './TipsDock'

export default function AppShell({ themeMode, onToggleTheme, children, tips }) {
  return (
    <div className="wrap">
      <Topbar themeMode={themeMode} onToggleTheme={onToggleTheme} />
      <TabsNav />
      {children}
      <TipsDock tips={tips} />
      <Footer />
    </div>
  )
}
