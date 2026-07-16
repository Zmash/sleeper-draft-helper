import Topbar from './Topbar'
import TabsNav from './TabsNav'
import Footer from './Footer'
import TipsDock from './TipsDock'

export default function AppShell({ themeId, setTheme, children, tips, clockBar }) {
  return (
    <div className="wrap">
      <Topbar themeId={themeId} setTheme={setTheme} />
      <TabsNav />
      {clockBar}
      {children}
      <TipsDock tips={tips} />
      <Footer />
    </div>
  )
}
