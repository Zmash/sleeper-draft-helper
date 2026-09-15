import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// vi.mock wird an den Dateianfang gehoistet -- der Helfer muss ueber
// vi.hoisted mitwandern, sonst existiert er im Factory-Aufruf noch nicht.
const { hook } = vi.hoisted(() => ({
  hook: (s) => { const h = (sel) => (sel ? sel(s) : s); h.getState = () => s; return h },
}))
vi.mock('../stores/useSessionStore', () => ({ useSessionStore: hook({
  availableLeagues: [], availableDrafts: [], cardNicknames: {},
  selectedDraftId: null, selectedLeagueId: null, setSelectedDraftId: vi.fn(), setSelectedLeagueId: vi.fn(),
}) }))
vi.mock('../stores/useUIStore', () => ({ useUIStore: hook({
  themeId: 'broadcast-dark', setTheme: vi.fn(), boardDensity: 'normal', setBoardDensity: vi.fn(),
}) }))
vi.mock('../stores/useLiveStore', () => ({ useLiveStore: hook({
  livePicks: [], lastSyncAt: null, picksLoading: false, autoRefreshEnabled: true,
  refreshIntervalSeconds: 30, loadPicks: vi.fn(), setAutoRefreshEnabled: vi.fn(),
}) }))
vi.mock('../stores/useBoardStore', () => ({ useBoardStore: hook({
  boardPlayers: [], rankingSource: null, marketMeta: null, draftMode: 'redraft', setSearchQuery: vi.fn(),
}) }))
vi.mock('../stores/useGamesLiveStore', () => ({ useGamesLiveStore: hook({ liveCount: 0 }) }))
vi.mock('../hooks/useMarketRefresh', () => ({ useMarketRefresh: () => ({ refreshing: false, error: null, refresh: vi.fn() }) }))
vi.mock('../hooks/useFootballEgg', () => ({ useFootballEgg: () => {} }))

import NextShell from './NextShell'

const at = (path) => render(
  <MemoryRouter initialEntries={[path]}><NextShell pageProps={{}}><p>Inhalt</p></NextShell></MemoryRouter>
).container.querySelector('.ns-content')

describe('NextShell — Seitenabstand der Desktop-Huelle', () => {
  // Der Abstand haengt am Container, damit jede neue Seite ihn bekommt, ohne
  // eine Zeile CSS mitzubringen.
  it('polstert normale Seiten', () => {
    for (const path of ['/scores', '/dashboard', '/analyse', '/weekly', '/setup', '/trade']) {
      expect(at(path), path).not.toHaveClass('ns-content--flush')
    }
  })

  it('laesst das Board randlos — dessen Panes rechnen mit height:100%', () => {
    expect(at('/board')).toHaveClass('ns-content--flush')
  })
})
