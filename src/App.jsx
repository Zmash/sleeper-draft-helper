import React, { useEffect, useMemo, useRef, useState } from 'react'
import Papa from 'papaparse'
import { getTeamsCount } from './services/derive'

// Hooks / Utils / Services / Actions
import useDebouncedEffect from './hooks/useDebouncedEffect'
import { cx, normalizePlayerName } from './utils/formatting'
import { parseDraftId } from './utils/parse'
import { STORAGE_KEY, THEME_STORAGE_KEY, saveToLocalStorage, loadFromLocalStorage } from './services/storage'
import { parseFantasyProsCsv } from './services/csv'

import { enrichBoardPlayersWithSleeper } from './services/enrichBoardWithSleeper'
import { useDraftTips } from './hooks/useDraftTips'
import DraftAnalysis from './components/DraftAnalysis'
import Modal from './components/Modal'
import { computeTeamScores, isDraftComplete } from './services/analysis'
import { prioritizeTips } from './services/tipsPrioritizer'

import {
  SLEEPER_API_BASE,
  fetchJson,
  loadUserDraftsForYear,
  fetchLeagueDrafts,
  mergeDraftsUnique,
  formatDraftLabel,
} from './services/api'

import {
    resolveUserIdAction,
    loadLeaguesAction,
    loadLeagueUsersAction,
    loadPicksAction,
    loadDraftOptionsAction,
    attachDraftByIdOrUrlAction,
  } from './services/actions'

// Components
import AppShell from './components/AppShell'
import SetupForm from './components/SetupForm'
import BoardSection from './components/BoardSection'
import RosterSection from './components/RosterSection'
import { CURRENT_YEAR } from './constants'


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
  const [teamFilter, setTeamFilter] = useState(persisted.teamFilter || 'ALL')

  // Live picks
  const [livePicks, setLivePicks] = useState([])
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(
    typeof persisted.autoRefreshEnabled === 'boolean' ? persisted.autoRefreshEnabled : true
  )
  const [refreshIntervalSeconds, setRefreshIntervalSeconds] = useState(
    Number.isFinite(persisted.refreshIntervalSeconds) ? persisted.refreshIntervalSeconds : 10
  )
  const [lastSyncAt, setLastSyncAt] = useState(null)

    // Map der Ligen (für Labels im Draft-Select)
  const leaguesById = useMemo(() => {
      const m = new Map()
      ;(availableLeagues || []).forEach(l => m.set(l.league_id, l))
      return m
  }, [availableLeagues])

  const selectedLeague = useMemo(
    () =>
      (leaguesById && typeof leaguesById.get === 'function')
        ? leaguesById.get(selectedLeagueId) || null
        : null,
    [leaguesById, selectedLeagueId]
  )

  const selectedDraft = useMemo(
    () =>
      (Array.isArray(availableDrafts))
        ? availableDrafts.find(d => d.draft_id === selectedDraftId) || null
        : null,
    [availableDrafts, selectedDraftId]
  )

  const teamsCount = useMemo(() => getTeamsCount({
    draft: selectedDraft,
    picks: livePicks,
    league: selectedLeague
  }), [selectedDraft, livePicks, selectedLeague])

  // Tabs
  const [activeTab, setActiveTab] = useState(persisted.activeTab || (persisted.leagueId ? 'board' : 'setup'))

  // Misc
  const isAndroid = /Android/i.test(navigator.userAgent)
  const [manualDraftInput, setManualDraftInput] = useState(persisted.manualDraftInput || '')
  const prevConfigRef = useRef({ sleeperUserId, selectedLeagueId, selectedDraftId })
  const pollingIntervalRef = useRef(null)
  const [analysisOpen, setAnalysisOpen] = useState(false)

  // Owner-Label-Map (user_id -> display_name/username)
  // Owner-Label-Map (user_id/slot -> display label)
  const ownerLabels = useMemo(() => {
    const m = new Map();

  // 1) aus League-Users (falls vorhanden)
  for (const u of (leagueUsers || [])) {
    m.set(`user:${u.user_id}`, u.display_name || u.username || u.user_id);
  }

  // kleine Helper, um stabile Keys + Labels auch ohne leagueUsers zu bauen
  const teamKeyFromPick = (p) => {
    // Primär: tatsächliche Sleeper user_id
    if (p?.picked_by) return `user:${p.picked_by}`;
    // Liga-Drafts: roster_id ist stabil pro Team
    if (p?.roster_id != null) return `roster:${p.roster_id}`;
    // Mock-Drafts: notfalls Draft-Slot (1..teamsCount) oder Slot aus pick_no ableiten
    if (p?.draft_slot != null) return `slot:${p.draft_slot}`;
    if (teamsCount && p?.pick_no) {
      const slot = ((p.pick_no - 1) % teamsCount) + 1;
      return `slot:${slot}`;
    }
    return `slot:unknown`;
  };

  const teamLabelFromPick = (p) => {
    // Falls später mal Namen aus Draft-Meta auftauchen:
    const metaLabel =
      p?.metadata?.team_name ||
      p?.metadata?.owner ||
      null;

    if (metaLabel) return metaLabel;

    if (p?.picked_by && m.has(`user:${p.picked_by}`)) {
      return m.get(`user:${p.picked_by}`);
    }
    if (p?.roster_id != null) return `Team ${p.roster_id}`;
    if (p?.draft_slot != null) return `Slot ${p.draft_slot}`;
    if (teamsCount && p?.pick_no) {
      const slot = ((p.pick_no - 1) % teamsCount) + 1;
      return `Slot ${slot}`;
    }
    return `Unknown`;
  };

  // 2) Fallback: aus Picks (wichtig für Mock-Drafts / Bots)
  for (const p of (livePicks || [])) {
    const key = teamKeyFromPick(p);
    if (!m.has(key)) m.set(key, teamLabelFromPick(p));
  }

  return m;
}, [leagueUsers, livePicks, teamsCount]);



  // --- Sleeper Enrichment after CSV import / on start (non-blocking) ---
  const [enriching, setEnriching] = useState(false)

  useEffect(() => {
    async function maybeEnrich() {
      if (!Array.isArray(boardPlayers) || boardPlayers.length === 0) return
      if (enriching) return
      setEnriching(true)
      try {
        // Saison & Format ableiten
        const season = selectedDraft?.season || Number(seasonYear) || new Date().getFullYear()
        const format = selectedLeague?.scoring_settings?.ppr === 0.5 ? 'half'
          : (selectedLeague?.scoring_settings?.ppr ?? 1) >= 1 ? 'ppr'
          : 'ppr'

        // ⚠️ WICHTIG: hier NICHT 'fresh' verwenden, sondern den aktuellen State
        const enriched = await enrichBoardPlayersWithSleeper(boardPlayers, { season })

        if (JSON.stringify(enriched) !== JSON.stringify(boardPlayers)) {
          setBoardPlayers(enriched)
          saveToLocalStorage({ boardPlayers: enriched })
        }
      } catch (e) {
        console.warn('Enrichment failed', e)
      } finally {
        setEnriching(false)
      }
    }
    maybeEnrich()
    // dependencies so wählen, dass bei CSV/League-Format-Änderungen neu angereichert wird
  }, [JSON.stringify(boardPlayers), selectedDraft?.season, selectedLeague?.scoring_settings?.ppr])


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
      teamFilter,
      autoRefreshEnabled,
      refreshIntervalSeconds,
      activeTab,
      manualDraftInput,
    })
  }, [
    sleeperUsername, sleeperUserId, seasonYear,
    selectedLeagueId, selectedDraftId,
    csvRawText, boardPlayers,
    searchQuery, positionFilter, teamFilter,
    autoRefreshEnabled, refreshIntervalSeconds,
    activeTab, manualDraftInput,
  ], 200)

  // Networking helpers (bleiben hier, greifen auf State zu)
  async function resolveUserId() {
    return resolveUserIdAction({
      sleeperUserId,
      sleeperUsername,
      setSleeperUserId,
      saveToLocalStorage,
    })
  }

  async function loadLeagues() {
    return loadLeaguesAction({
      seasonYear,
      setAvailableLeagues,
      setSelectedLeagueId,
      saveToLocalStorage,
      resolveUserId,      // als Funktion referenzieren
      loadDraftOptions,   // als Funktion referenzieren
    })
  }

  async function loadLeagueUsers(leagueId) {
    return loadLeagueUsersAction({ leagueId, setLeagueUsers })
  }

  async function loadPicks(draftId) {
    return loadPicksAction({ draftId, setLivePicks, setLastSyncAt })
  }  

  async function loadDraftOptions(leagueId) {
    return loadDraftOptionsAction({
      leagueId,
      seasonYear,
      selectedDraftId,
      setAvailableDrafts,
      setSelectedDraftId,
      saveToLocalStorage,
      resolveUserId, // Dependency
    })
  }  

  async function attachDraftByIdOrUrl(input) {
    return attachDraftByIdOrUrlAction({
      input,
      parseDraftId,
      availableDrafts,
      setAvailableDrafts,
      setSelectedDraftId,
      saveToLocalStorage,
      loadPicks, // Dependency
    })
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
        const sleeperBye = pick?.metadata?.bye_week
        if (sleeperBye !== undefined && sleeperBye !== null && String(sleeperBye).trim() !== '') {
          player.bye = sleeperBye
        }
        // sonst: CSV-Bye unverändert lassen

      }
    }
    const updated = [...byNormalizedName.values()].sort((a, b) => Number(a.rk) - Number(b.rk))
      setBoardPlayers(updated)
      saveToLocalStorage({ boardPlayers: updated })
    }, [livePicks]) // eslint-disable-line

    // Team-Key wie in ownerLabels/analysis ableiten (für Spieler, die bereits gepickt sind)
    const teamKeyForPlayer = (p) => {
      if (!p?.pick_no) return null            // nicht gepickt -> kein Team
      if (p?.picked_by) return `user:${p.picked_by}`
      if (teamsCount) {
        const slot = ((Number(p.pick_no) - 1) % Number(teamsCount)) + 1
        return `slot:${slot}`
      }
      return 'slot:unknown'
    }

  // Derived UI
  const filteredPlayers = useMemo(() => {
    const q = normalizePlayerName(searchQuery)
    return boardPlayers.filter(p => {
      if (positionFilter !== 'ALL' && p.pos !== positionFilter) return false
      // Team-Filter: zeige nur Spieler, die von diesem Team gepickt wurden
      if (teamFilter && teamFilter !== 'ALL') {
        const key = (() => {
          if (p?.picked_by) return `user:${p.picked_by}`
          if (teamsCount && p?.pick_no) {
            const slot = ((Number(p.pick_no) - 1) % Number(teamsCount)) + 1
            return `slot:${slot}`
          }
          return null
        })()
        if (key !== teamFilter) return false
      }
      if (!q) return true
      return normalizePlayerName(p.name).includes(q)
    })
  }, [boardPlayers, searchQuery, positionFilter, teamFilter, teamsCount]) 

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

  const rawTips = useDraftTips({
    picks: livePicks,
    boardPlayers,
    meUserId: sleeperUserId,
    teamsCount,
    playerPrefs: {},
    rosterPositions: selectedLeague?.roster_positions || null,
  })

    // Wichtig: currentPickNumber hast du bereits oben berechnet
  const tips = prioritizeTips(rawTips, {
    boardPlayers,
    picks: livePicks,
    meUserId: sleeperUserId,
    teamsCount,
    rosterPositions: selectedLeague?.roster_positions || [],
    currentPickNumber,
    maxTips: 7,   // kannst du als Setting persistieren
    minScore: 10, // Schwelle, ab wann es “wichtig” ist
  })

  // Render
  return (
    <AppShell tips={tips}
      themeMode={themeMode}
      onToggleTheme={() => setThemeMode(themeMode === 'dark' ? 'light' : 'dark')}
      activeTab={activeTab}
      onSetupClick={() => { setActiveTab('setup'); saveToLocalStorage({ activeTab: 'setup' }) }}
      onBoardClick={() => { setActiveTab('board'); saveToLocalStorage({ activeTab: 'board' }) }}
      onRosterClick={() => { setActiveTab('roster'); saveToLocalStorage({ activeTab: 'roster' }) }}
    >
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
          ownerLabels={ownerLabels}
          teamFilter={teamFilter}
          onTeamFilterChange={(e) => { 
            setTeamFilter(e.target.value)
            saveToLocalStorage({ teamFilter: e.target.value })
          }}
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
          boardPlayers={boardPlayers}
          livePicks={livePicks}
          meUserId={sleeperUserId}
          league={selectedLeague}
          draft={selectedDraft}
        />
      )}
  
      {activeTab === 'roster' && (
        <RosterSection
          picks={livePicks}
          me={sleeperUserId}
          boardPlayers={boardPlayers}
          league={selectedLeague}
          draft={selectedDraft}
          teamsCount={teamsCount}
        />
      )}
    
      {/* Draft Analysis Trigger (Floating Button) */}
      {isDraftComplete(livePicks, teamsCount, selectedDraft?.settings?.rounds) && (
        <button
          type="button"
          className="dock-toggle dock-toggle--right"
          title="Draft Analysis"
          onClick={() => setAnalysisOpen(true)}
        >
          📊 Draft Analysis
        </button>
      )}

      {/* Draft Analysis Modal */}
      <Modal
        open={analysisOpen}
        onClose={() => setAnalysisOpen(false)}
        title="Team Rankings"
      >
          <div className="draft-analysis">
          <DraftAnalysis
              scores={computeTeamScores({
                boardPlayers,
                livePicks,
                teamsCount,
                rosterPositions: selectedLeague?.roster_positions || null
              })}
              ownerLabels={ownerLabels}
            />
          </div>
      </Modal>


    </AppShell>
  )  
}
