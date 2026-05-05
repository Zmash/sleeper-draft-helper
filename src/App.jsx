import React, { useEffect, useMemo, useRef } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'

import { useSessionStore } from './stores/useSessionStore'
import { useBoardStore } from './stores/useBoardStore'
import { useLiveStore } from './stores/useLiveStore'
import { useDynastyStore } from './stores/useDynastyStore'
import { useUIStore } from './stores/useUIStore'

import { getTeamsCount } from './services/derive'
import { prioritizeTips } from './services/tipsPrioritizer'
import { useDraftTips } from './hooks/useDraftTips'
import { useRookieDraftTips } from './hooks/useRookieDraftTips'
import { loadSetup } from './services/storage'
import { computeTeamScores, isDraftComplete } from './services/analysis'
import { inferMyDraftSlot } from './services/api'

import AppShell from './components/AppShell'
import DraftAnalysis from './components/DraftAnalysis'
import Modal from './components/Modal'

import SetupPage from './pages/SetupPage'
import BoardPage from './pages/BoardPage'
import RosterPage from './pages/RosterPage'
import DashboardPage from './pages/DashboardPage'
import TradePage from './pages/TradePage'

// ── Redirect from / based on account state ───────────────────────────────────
function RootRedirect() {
  const { sleeperUserId } = useSessionStore()
  return <Navigate to={sleeperUserId ? '/dashboard' : '/setup'} replace />
}

export default function App() {
  const isAndroid = /Android/i.test(navigator.userAgent)

  // ── Store reads ────────────────────────────────────────────────────────────
  const {
    sleeperUserId, selectedLeagueId, selectedDraftId, seasonYear,
    availableLeagues, leagueUsers, availableDrafts,
    loadDraftOptions, loadLeagueUsers,
  } = useSessionStore()

  const { boardPlayers, draftMode, setDraftMode } = useBoardStore()

  const { livePicks, autoRefreshEnabled, refreshIntervalSeconds, loadPicks } = useLiveStore()

  const {
    dynastyRoster, mySleeperRosterId, rosterToUserMap, tradedPicks,
    loadDynastyRoster, loadTradedPicks,
  } = useDynastyStore()

  const { themeMode, toggleTheme, analysisOpen, setAnalysisOpen, setupVersion, incrementSetupVersion } = useUIStore()

  // ── Derived values ─────────────────────────────────────────────────────────
  const selectedLeague = useMemo(
    () => (availableLeagues || []).find((l) => l.league_id === selectedLeagueId) || null,
    [availableLeagues, selectedLeagueId]
  )
  const selectedDraft = useMemo(
    () => (availableDrafts || []).find((d) => d.draft_id === selectedDraftId) || null,
    [availableDrafts, selectedDraftId]
  )
  const teamsCount = useMemo(
    () => getTeamsCount({ draft: selectedDraft, picks: livePicks, league: selectedLeague }),
    [selectedDraft, livePicks, selectedLeague]
  )

  const ownerLabels = useMemo(() => {
    const m = new Map()
    for (const u of leagueUsers || []) {
      m.set(`user:${u.user_id}`, u.display_name || u.username || u.user_id)
    }
    const teamKeyFromPick = (p) => {
      if (p?.picked_by) return `user:${p.picked_by}`
      if (p?.roster_id != null) return `roster:${p.roster_id}`
      if (p?.draft_slot != null) return `slot:${p.draft_slot}`
      if (teamsCount && p?.pick_no) return `slot:${((p.pick_no - 1) % teamsCount) + 1}`
      return 'slot:unknown'
    }
    const teamLabelFromPick = (p) => {
      const metaLabel = p?.metadata?.team_name || p?.metadata?.owner || null
      if (metaLabel) return metaLabel
      if (p?.picked_by && m.has(`user:${p.picked_by}`)) return m.get(`user:${p.picked_by}`)
      if (p?.roster_id != null) return `Team ${p.roster_id}`
      if (p?.draft_slot != null) return `Slot ${p.draft_slot}`
      if (teamsCount && p?.pick_no) return `Slot ${((p.pick_no - 1) % teamsCount) + 1}`
      return 'Unknown'
    }
    for (const p of livePicks || []) {
      const key = teamKeyFromPick(p)
      if (!m.has(key)) m.set(key, teamLabelFromPick(p))
    }
    return m
  }, [leagueUsers, livePicks, teamsCount])

  const setupOverrides = useMemo(() => loadSetup()?.overrides || {}, [setupVersion])

  const effRoster = useMemo(() => {
    if (setupOverrides.roster_positions) return setupOverrides.roster_positions
    if (selectedDraft?.settings) {
      const m = {
        slots_qb:'QB', slots_rb:'RB', slots_wr:'WR', slots_te:'TE', slots_k:'K', slots_def:'DEF',
        slots_flex:'FLEX', slots_wr_rb:'WR/RB', slots_wr_te:'WR/TE', slots_rb_te:'RB/TE',
        slots_super_flex:'SUPER_FLEX', slots_idp_flex:'IDP_FLEX',
        slots_dl:'DL', slots_lb:'LB', slots_db:'DB', slots_bn:'BN',
      }
      const out = []
      for (const [k, v] of Object.entries(selectedDraft.settings || {})) {
        if (!k.startsWith('slots_')) continue
        const name = m[k]; const n = Number(v)
        if (!name || !Number.isFinite(n) || n <= 0) continue
        for (let i = 0; i < n; i++) out.push(name)
      }
      return out
    }
    return selectedLeague?.roster_positions || []
  }, [setupOverrides.roster_positions, selectedDraft, selectedLeague])

  const effScoringType = useMemo(() => {
    if (setupOverrides.scoring_type) return setupOverrides.scoring_type
    const rec = selectedLeague?.scoring_settings?.rec ?? 1
    return rec >= 0.95 ? 'ppr' : rec >= 0.45 ? 'half_ppr' : 'standard'
  }, [setupOverrides.scoring_type, selectedLeague])

  const strategies = useMemo(
    () =>
      Array.isArray(setupOverrides.strategies) && setupOverrides.strategies.length
        ? setupOverrides.strategies
        : ['balanced'],
    [setupOverrides.strategies]
  )

  const isSuperflex = useMemo(
    () =>
      setupOverrides.superflex != null
        ? !!setupOverrides.superflex
        : effRoster.some((r) => String(r).toUpperCase().includes('SUPER')),
    [setupOverrides.superflex, effRoster]
  )

  const isRookieMode = draftMode === 'rookie'
  const currentPickNumber = livePicks?.length ? Math.max(...livePicks.map((p) => p.pick_no || 0)) : 0
  const draftFinished = isDraftComplete(livePicks, teamsCount, selectedDraft?.settings?.rounds)
  const pickedCount = useMemo(() => boardPlayers.filter((p) => p.status).length, [boardPlayers])

  // ── DraftAnalysis data (only computed when modal open) ─────────────────────
  const teamByRosterId = useMemo(() => {
    const playersByKey = {}
    for (const p of boardPlayers || []) {
      if (!p?.pick_no) continue
      const key = p?.picked_by
        ? `user:${p.picked_by}`
        : teamsCount
        ? `slot:${((Number(p.pick_no) - 1) % Number(teamsCount)) + 1}`
        : 'slot:unknown'
      if (!playersByKey[key]) playersByKey[key] = []
      playersByKey[key].push({ id: p.id, name: p.name, pos: p.pos, team: p.team, bye: p.bye, tier: p.tier ?? null, rk: p.rk ?? null })
    }
    const teamIds = new Set((livePicks || []).map((p) => {
      if (p?.picked_by) return `user:${p.picked_by}`
      if (teamsCount && p?.pick_no) return `slot:${((Number(p.pick_no) - 1) % Number(teamsCount)) + 1}`
      return 'slot:unknown'
    }))
    const out = {}
    for (const teamKey of teamIds) {
      const ownerId = teamKey.startsWith('user:') ? teamKey.slice(5) : teamKey
      out[`roster:${teamKey}`] = {
        owner_id: String(ownerId),
        display_name: ownerLabels?.get?.(teamKey) || ownerId,
        players: playersByKey[teamKey] || [],
      }
    }
    return out
  }, [boardPlayers, livePicks, teamsCount, ownerLabels])

  const myOwnerId = sleeperUserId ? String(sleeperUserId) : null
  const myRosterId = useMemo(() => {
    for (const p of livePicks || []) {
      if (p?.picked_by && String(p.picked_by) === String(sleeperUserId)) return `roster:user:${p.picked_by}`
    }
    return null
  }, [livePicks, sleeperUserId])

  const scores = useMemo(() => {
    try {
      return computeTeamScores({ boardPlayers, rosterPositions: effRoster, teamsCount, livePicks })
    } catch {
      try { return computeTeamScores(boardPlayers, effRoster, teamsCount, livePicks) } catch { return [] }
    }
  }, [boardPlayers, effRoster, teamsCount, livePicks])

  // ── Tips ───────────────────────────────────────────────────────────────────
  const draftSlot = useMemo(
    () => inferMyDraftSlot({ draft: selectedDraft, picks: livePicks, meUserId: sleeperUserId }),
    [selectedDraft, livePicks, sleeperUserId]
  )

  const myDraftPicksForTips = useMemo(() => {
    if (draftMode !== 'rookie' || !selectedDraft || mySleeperRosterId == null) return []
    const rounds = Number(selectedDraft.settings?.rounds) || 3
    const teams = Number(selectedDraft.settings?.teams) || 12
    const order = selectedDraft.draft_order || {}
    const mySlot = Number(order[sleeperUserId]) || null
    const pickPos = (slot, round) => (!slot || !teams ? null : round % 2 === 1 ? slot : teams - slot + 1)
    const slotForRoster = (rid) => Number(order[rosterToUserMap[String(rid)]]) || null
    const traded = tradedPicks || []
    const tradedAway = new Set(traded.filter(p => String(p.roster_id) === String(mySleeperRosterId) && String(p.owner_id) !== String(mySleeperRosterId)).map(p => p.round))
    const tradedToMe = traded.filter(p => String(p.owner_id) === String(mySleeperRosterId) && String(p.roster_id) !== String(mySleeperRosterId))
    const result = []
    for (let r = 1; r <= rounds; r++) {
      if (!tradedAway.has(r)) result.push({ round: r, type: 'own', pick_pos: pickPos(mySlot, r) })
    }
    for (const tp of tradedToMe) result.push({ round: tp.round, type: 'acquired', fromRosterId: tp.roster_id, pick_pos: pickPos(slotForRoster(tp.roster_id), tp.round) })
    return result.sort((a, b) => a.round - b.round || (a.pick_pos || 99) - (b.pick_pos || 99))
  }, [draftMode, selectedDraft, mySleeperRosterId, tradedPicks, rosterToUserMap, sleeperUserId])

  const redraftTips = useDraftTips({
    picks: livePicks, boardPlayers, meUserId: sleeperUserId, teamsCount,
    playerPrefs: {}, rosterPositions: effRoster,
    scoringSettings: selectedLeague?.scoring_settings || null,
    scoringType: effScoringType, draftType: selectedDraft?.type || 'snake',
    strategies, enabled: !isRookieMode,
  })
  const rookieTips = useRookieDraftTips({
    picks: livePicks, boardPlayers, meUserId: sleeperUserId,
    dynastyRoster, teamsCount, draftSlot, myDraftPicks: myDraftPicksForTips,
    enabled: isRookieMode,
  })
  const rawTips = isRookieMode ? rookieTips : redraftTips
  const tips = draftFinished ? [] : prioritizeTips(rawTips, {
    boardPlayers, picks: livePicks, meUserId: sleeperUserId, teamsCount,
    rosterPositions: effRoster, isSuperflex, currentPickNumber, maxTips: 7, minScore: 10,
  })

  // ── Global effects ─────────────────────────────────────────────────────────

  // Theme sync
  useEffect(() => {
    document.documentElement.dataset.theme = themeMode
    localStorage.setItem('draft-helper-theme', themeMode)
  }, [themeMode])

  // Setup change listener (SetupForm writes sdh.setup.v2 and fires this event)
  useEffect(() => {
    const onSetup = () => incrementSetupVersion()
    const onStorage = (e) => { if (e.key === 'sdh.setup.v2') onSetup() }
    window.addEventListener('sdh:setup-changed', onSetup)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener('sdh:setup-changed', onSetup)
      window.removeEventListener('storage', onStorage)
    }
  }, []) // eslint-disable-line

  // League change → reload draft options + users
  useEffect(() => {
    loadDraftOptions(selectedLeagueId).catch(() => {})
    if (selectedLeagueId) loadLeagueUsers(selectedLeagueId).catch(() => {})
  }, [selectedLeagueId]) // eslint-disable-line

  // Draft mode auto-detection from league type
  useEffect(() => {
    const lt = selectedLeague?.league_type
    if (lt === 'dynasty' || lt === 'keeper') setDraftMode('rookie')
    else if (lt === 'redraft') setDraftMode('redraft')
  }, [selectedLeague?.league_type]) // eslint-disable-line

  // Dynasty roster + traded picks
  useEffect(() => {
    if (draftMode !== 'rookie' || !selectedLeagueId || !sleeperUserId) {
      useDynastyStore.getState().setDynastyRoster([])
      return
    }
    loadDynastyRoster({ selectedLeagueId, sleeperUserId, seasonYear })
  }, [draftMode, selectedLeagueId, sleeperUserId, seasonYear]) // eslint-disable-line

  useEffect(() => {
    if (draftMode !== 'rookie' || !selectedDraftId) { loadTradedPicks(null); return }
    loadTradedPicks(selectedDraftId)
  }, [draftMode, selectedDraftId]) // eslint-disable-line

  // Polling
  const pollingRef = useRef(null)
  useEffect(() => {
    if (!autoRefreshEnabled || !selectedDraftId) return
    clearInterval(pollingRef.current)
    pollingRef.current = setInterval(() => {
      loadPicks(selectedDraftId).catch(() => {})
    }, Math.max(4, Number(refreshIntervalSeconds)) * 1000)
    return () => clearInterval(pollingRef.current)
  }, [autoRefreshEnabled, selectedDraftId, refreshIntervalSeconds]) // eslint-disable-line

  // Draft change → auto-reset picks + board statuses, then load fresh
  const prevDraftIdRef = useRef(selectedDraftId)
  useEffect(() => {
    const prev = prevDraftIdRef.current
    prevDraftIdRef.current = selectedDraftId
    if (prev === selectedDraftId) return   // no change (incl. initial mount)
    // Clear stale live picks immediately so board shows clean state
    useLiveStore.getState().setLivePicks([])
    // Clear pick status markings on board players
    const bp = useBoardStore.getState().boardPlayers
    if (bp.some((p) => p.status)) {
      useBoardStore.getState().setBoardPlayers(
        bp.map((p) => ({ ...p, status: null, pick_no: null, picked_by: null }))
      )
    }
    // Load picks for the new draft
    if (selectedDraftId) loadPicks(selectedDraftId).catch(() => {})
  }, [selectedDraftId]) // eslint-disable-line

  // ── Shared page props ──────────────────────────────────────────────────────
  const pageProps = { selectedLeague, selectedDraft, teamsCount, ownerLabels, effRoster, isSuperflex, effScoringType }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <AppShell tips={tips} themeMode={themeMode} onToggleTheme={toggleTheme}>
      <Routes>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/setup" element={<SetupPage {...pageProps} isAndroid={isAndroid} />} />
        <Route path="/board" element={<BoardPage {...pageProps} />} />
        <Route path="/roster" element={<RosterPage {...pageProps} />} />
        <Route path="/trade" element={<TradePage selectedLeague={selectedLeague} />} />
        <Route path="*" element={<RootRedirect />} />
      </Routes>

      {draftFinished && (
        <button
          type="button"
          className="dock-toggle dock-toggle--right"
          title="Draft Analysis"
          onClick={() => setAnalysisOpen(true)}
        >
          📊 Draft Analysis
        </button>
      )}

      <Modal open={analysisOpen} onClose={() => setAnalysisOpen(false)} title="Team Rankings">
        <DraftAnalysis
          scores={scores}
          ownerLabels={ownerLabels}
          league={selectedLeague}
          picks={livePicks}
          teamByRosterId={teamByRosterId}
          myOwnerId={myOwnerId}
          myRosterId={myRosterId}
          board={{ players: boardPlayers, metadata: { season: selectedLeague?.season } }}
        />
      </Modal>
    </AppShell>
  )
}
