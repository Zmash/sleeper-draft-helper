import React, { useEffect, useMemo, useRef, useState } from 'react'
import Papa from 'papaparse'

// Hooks / Utils / Services
import useDebouncedEffect from './hooks/useDebouncedEffect'
import { cx, normalizePlayerName } from './utils/formatting'
import { parseDraftId } from './utils/parse'
import { STORAGE_KEY, THEME_STORAGE_KEY, saveToLocalStorage, loadFromLocalStorage } from './services/storage'
import { parseFantasyProsCsv } from './services/csv'
import {
  SLEEPER_API_BASE,
  fetchJson,
  loadUserDraftsForYear,
  fetchLeagueDrafts,
  mergeDraftsUnique,
  formatDraftLabel,
} from './services/api'

// Components
import Topbar from './components/Topbar'
import TabsNav from './components/TabsNav'
import SetupForm from './components/SetupForm'
import BoardSection from './components/BoardSection'
import RosterSection from './components/RosterSection'

const CURRENT_YEAR = new Date().getFullYear()

export default function App() {
  // Theme
  const initialTheme = localStorage.getItem(THEME_STORAGE_KEY) || 'dark'
  const [themeMode, setThemeMode] = useState(initialTheme)
  useEffect(() => {
    document.documentElement.dataset.theme = themeMode
    localStorage.setItem(THEME_STORAGE_KEY, themeMode)
  }, [themeMode])

  // Persisted state (user + league)
  const persisted = loadFromLocalStorage()
  const [sleeperUsername, setSleeperUsername] = useState(persisted.username || '')
  const [sleeperUserId, setSleeperUserId] = useState(persisted.userId || '')
  const [seasonYear, setSeasonYear] = useState(String(persisted.year || CURRENT_YEAR))
  const [availableLeagues, setAvailableLeagues] = useState([])
  const [selectedLeagueId, setSelectedLeagueId] = useState(persisted.leagueId || '')
  const [availableDrafts, setAvailableDrafts] = useState([])
  const [selectedDraftId, setSelectedDraftId] = useState(persisted.draftId || '')
  const [leagueUsers, setLeagueUsers] = useState([])

  // CSV + Board
  const [csvRawText, setCsvRawText] = useState(persisted.csvRawText || '')
  const [boardPlayers, setBoardPlayers] = useState(Array.isArray(persisted.boardPlayers) ? persisted.boardPlayers : [])
  const [searchQuery, setSearchQuery] = useState(persisted.searchQuery || '')
  const [positionFilter, setPositionFilter] = useState(persisted.positionFilter || 'ALL')

  // Live picks
  const [livePicks, setLivePicks] = useState([])
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(
    typeof persisted.autoRefreshEnabled === 'boolean' ? persisted.autoRefreshEnabled : true
  )
  const [refreshIntervalSeconds, setRefreshIntervalSeconds] = useState(
    Number.isFinite(persisted.refreshIntervalSeconds) ? persisted.refreshIntervalSeconds : 10
  )
  const [lastSyncAt, setLastSyncAt] = useState(null)

  // Tabs
  const [activeTab, setActiveTab] = useState(persisted.activeTab || (persisted.leagueId ? 'board' : 'setup'))

  // Misc
  const isAndroid = /Android/i.test(navigator.userAgent)
  const [manualDraftInput, setManualDraftInput] = useState(persisted.manualDraftInput || '')
  const prevConfigRef = useRef({ sleeperUserId, selectedLeagueId, selectedDraftId })
  const pollingIntervalRef = useRef(null)

  // Persist (debounced)
  useDebouncedEffect(() => {
    saveToLocalStorage({
      username: sleeperUsername,
      userId: sleeperUserId,
      year: seasonYear,
      leagueId: selectedLeagueId,
      draftId: selectedDraftId,
      csvRawText,
      boardPlayers,
      searchQuery,
      positionFilter,
      autoRefreshEnabled,
      refreshIntervalSeconds,
      activeTab,
      manualDraftInput,
    })
  }, [
    sleeperUsername, sleeperUserId, seasonYear,
    selectedLeagueId, selectedDraftId,
    csvRawText, boardPlayers,
    searchQuery, positionFilter,
    autoRefreshEnabled, refreshIntervalSeconds,
    activeTab, manualDraftInput,
  ], 200)

  // Networking helpers (bleiben hier, greifen auf State zu)
  async function resolveUserId() {
    if (sleeperUserId) return sleeperUserId
    if (!sleeperUsername) throw new Error('Bitte Benutzername eingeben')
    const data = await fetchJson(`${SLEEPER_API_BASE}/user/${encodeURIComponent(sleeperUsername)}`)
    setSleeperUserId(data.user_id)
    saveToLocalStorage({ userId: data.user_id })
    return data.user_id
  }

  async function loadLeagues() {
    const userId = await resolveUserId()
    const leagues = await fetchJson(`${SLEEPER_API_BASE}/user/${userId}/leagues/nfl/${seasonYear}`)
    setAvailableLeagues(leagues)
    const preferred = leagues.find(l => l.status === 'drafting' || l.status === 'in_season') || leagues[0]
    if (preferred) {
      setSelectedLeagueId(preferred.league_id)
      saveToLocalStorage({ leagueId: preferred.league_id })
      await loadDraftOptions(preferred.league_id)
    } else {
      await loadDraftOptions('')
    }
  }

  async function loadLeagueUsers(leagueId) {
    if (!leagueId) return
    const users = await fetchJson(`${SLEEPER_API_BASE}/league/${leagueId}/users`)
    setLeagueUsers(users)
  }

  async function loadPicks(draftId) {
    if (!draftId) return []
    const ps = await fetchJson(`${SLEEPER_API_BASE}/draft/${draftId}/picks`)
    setLivePicks(ps)
    setLastSyncAt(new Date())
    return ps
  }

  async function loadDraftOptions(leagueId) {
    const userId = await resolveUserId()
    const [userDrafts, leagueDrafts] = await Promise.all([
      loadUserDraftsForYear(userId, seasonYear),
      fetchLeagueDrafts(leagueId),
    ])
    const merged = mergeDraftsUnique(userDrafts, leagueDrafts)
    merged.sort(
      (a, b) =>
        (b.start_time || 0) - (a.start_time || 0) ||
        String(b.draft_id).localeCompare(String(a.draft_id))
    )
    setAvailableDrafts(merged)
    if (!selectedDraftId && merged.length) {
      setSelectedDraftId(merged[0].draft_id)
      saveToLocalStorage({ draftId: merged[0].draft_id })
    }
  }

  async function attachDraftByIdOrUrl(input) {
    const id = parseDraftId(input)
    if (!id) throw new Error('Bitte gültige Draft-ID oder URL eingeben.')
    await loadPicks(id)
    const exists = availableDrafts.some(d => d.draft_id === id)
    if (!exists) {
      setAvailableDrafts(prev => [{ draft_id: id, metadata: { name: `Draft ${id}` } }, ...prev])
    }
    setSelectedDraftId(id)
    saveToLocalStorage({ draftId: id })
    alert('Draft per ID/URL gesetzt.')
  }

  // CSV → Live-Picks remap
  useEffect(() => {
    if (!boardPlayers.length) return
    const byNormalizedName = new Map(boardPlayers.map(p => [p.nname, p]))
    for (const pick of (livePicks || [])) {
      const fullName = normalizePlayerName(`${pick?.metadata?.first_name || ''} ${pick?.metadata?.last_name || ''}`)
      const player = byNormalizedName.get(fullName)
      if (player) {
        player.status = pick.picked_by === sleeperUserId ? 'me' : 'other'
        player.pick_no = pick.pick_no
        player.picked_by = pick.picked_by
      }
    }
    const updated = [...byNormalizedName.values()].sort((a, b) => Number(a.rk) - Number(b.rk))
    setBoardPlayers(updated)
    saveToLocalStorage({ boardPlayers: updated })
  }, [livePicks]) // eslint-disable-line

  // Derived UI
  const filteredPlayers = useMemo(() => {
    const q = normalizePlayerName(searchQuery)
    return boardPlayers.filter(p => {
      if (positionFilter !== 'ALL' && p.pos !== positionFilter) return false
      if (!q) return true
      return normalizePlayerName(p.name).includes(q)
    })
  }, [boardPlayers, searchQuery, positionFilter])

    // Map der Ligen (für Labels im Draft-Select)
    const leaguesById = useMemo(() => {
        const m = new Map()
        ;(availableLeagues || []).forEach(l => m.set(l.league_id, l))
        return m
    }, [availableLeagues])

  const pickedCount = useMemo(() => boardPlayers.filter(p => p.status).length, [boardPlayers])
  const currentPickNumber = livePicks?.length ? Math.max(...livePicks.map(p => p.pick_no || 0)) : 0
  const progressPercent = boardPlayers.length ? Math.round((pickedCount / boardPlayers.length) * 100) : 0

  // Polling
  useEffect(() => {
    if (!autoRefreshEnabled || !selectedDraftId) return
    clearInterval(pollingIntervalRef.current)
    pollingIntervalRef.current = setInterval(() => {
      loadPicks(selectedDraftId).catch(() => {})
    }, Math.max(4, Number(refreshIntervalSeconds)) * 1000)
    return () => clearInterval(pollingIntervalRef.current)
  }, [autoRefreshEnabled, selectedDraftId, refreshIntervalSeconds]) // eslint-disable-line

  // League change effects
  useEffect(() => {
    loadDraftOptions(selectedLeagueId).catch(() => {})
    if (selectedLeagueId) {
      loadLeagueUsers(selectedLeagueId).catch(() => {})
    }
  }, [selectedLeagueId]) // eslint-disable-line

  // Detect config changes → re-mark
  useEffect(() => {
    const prev = prevConfigRef.current
    const changed =
      prev.sleeperUserId !== sleeperUserId ||
      prev.selectedLeagueId !== selectedLeagueId ||
      prev.selectedDraftId !== selectedDraftId

    if (changed && boardPlayers.length) {
      const ok = window.confirm('Konfiguration geändert. Markierungen zurücksetzen und neu synchronisieren?')
      if (ok) {
        const cleared = boardPlayers.map(p => ({ ...p, status: null, pick_no: null, picked_by: null }))
        setBoardPlayers(cleared)
        saveToLocalStorage({ boardPlayers: cleared })
        if (selectedDraftId) loadPicks(selectedDraftId)
        setActiveTab('board')
        saveToLocalStorage({ activeTab: 'board' })
      }
    }
    prevConfigRef.current = { sleeperUserId, selectedLeagueId, selectedDraftId }
  }, [sleeperUserId, selectedLeagueId, selectedDraftId]) // eslint-disable-line

  // CSV laden
  async function handleCsvLoad() {
    try {
      if (!csvRawText.trim()) { alert('Bitte CSV einfügen oder Datei wählen.'); return }
      if (boardPlayers.length) {
        const ok = window.confirm('Es ist bereits eine CSV geladen. Aktuelle Daten überschreiben?')
        if (!ok) return
      }
      const rows = parseFantasyProsCsv(csvRawText)
      if (!rows.length) { alert('CSV konnte nicht gelesen werden.'); return }
      const fresh = rows.map(r => ({ ...r, status: null, pick_no: null, picked_by: null }))
      setBoardPlayers(fresh)
      saveToLocalStorage({ csvRawText, boardPlayers: fresh })
      if (selectedDraftId) await loadPicks(selectedDraftId)
      setActiveTab('board')
      saveToLocalStorage({ activeTab: 'board' })
      alert('CSV erfolgreich geladen.')
    } catch (e) {
      alert('Fehler beim Laden der CSV: ' + (e.message || e))
    }
  }

  // Render
  return (
    <div className="wrap">
      <Topbar
        themeMode={themeMode}
        onToggleTheme={() => setThemeMode(themeMode === 'dark' ? 'light' : 'dark')}
      />

      <TabsNav
        activeTab={activeTab}
        onSetupClick={() => { setActiveTab('setup'); saveToLocalStorage({ activeTab: 'setup' }) }}
        onBoardClick={() => { setActiveTab('board'); saveToLocalStorage({ activeTab: 'board' }) }}
        onRosterClick={() => { setActiveTab('roster'); saveToLocalStorage({ activeTab: 'roster' }) }}
      />

      {activeTab === 'setup' && (
        <SetupForm
          sleeperUsername={sleeperUsername}
          sleeperUserId={sleeperUserId}
          seasonYear={seasonYear}
          availableLeagues={availableLeagues}
          selectedLeagueId={selectedLeagueId}
          availableDrafts={availableDrafts}
          selectedDraftId={selectedDraftId}
          leaguesById={leaguesById}
          manualDraftInput={manualDraftInput}
          csvRawText={csvRawText}
          isAndroid={isAndroid}
          lastSyncAt={lastSyncAt}
          setSleeperUsername={setSleeperUsername}
          setSleeperUserId={setSleeperUserId}
          setSeasonYear={setSeasonYear}
          setSelectedLeagueId={setSelectedLeagueId}
          setSelectedDraftId={setSelectedDraftId}
          setManualDraftInput={setManualDraftInput}
          setCsvRawText={setCsvRawText}
          saveToLocalStorage={saveToLocalStorage}
          resolveUserId={resolveUserId}
          loadLeagues={loadLeagues}
          loadDraftOptions={loadDraftOptions}
          attachDraftByIdOrUrl={attachDraftByIdOrUrl}
          handleCsvLoad={handleCsvLoad}
          formatDraftLabel={formatDraftLabel}
        />
      )}

      {activeTab === 'board' && (
        <BoardSection
          currentPickNumber={currentPickNumber}
          autoRefreshEnabled={autoRefreshEnabled}
          refreshIntervalSeconds={refreshIntervalSeconds}
          lastSyncAt={lastSyncAt}
          searchQuery={searchQuery}
          positionFilter={positionFilter}
          filteredPlayers={filteredPlayers}
          pickedCount={pickedCount}
          totalCount={boardPlayers.length}
          onToggleAutoRefresh={(e) => setAutoRefreshEnabled(e.target.checked)}
          onChangeInterval={(e) => setRefreshIntervalSeconds(Number(e.target.value || 10))}
          onSync={() => selectedDraftId && loadPicks(selectedDraftId)}
          onSearchChange={(e) => setSearchQuery(e.target.value)}
          onPositionChange={(e) => setPositionFilter(e.target.value)}
        />
      )}

      {activeTab === 'roster' && (
        <RosterSection picks={livePicks} me={sleeperUserId} />
      )}

      <footer className="muted text-xs mt-6">
        SleeperDarftHelper byZmash
      </footer>
    </div>
  )
}
