import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useSessionStore } from '../stores/useSessionStore'
import { buildBoardSearch, parseBoardParams } from '../utils/urlState'
import { useBoardStore } from '../stores/useBoardStore'
import { useLiveStore } from '../stores/useLiveStore'
import { useDynastyStore } from '../stores/useDynastyStore'
import { enrichBoardPlayersWithSleeper } from '../services/enrichBoardWithSleeper'
import { normalizePos, normalizePlayerName } from '../utils/formatting'
import BoardSection from '../components/BoardSection'
import NextBoard from '../components/NextBoard'
import { useUIStore } from '../stores/useUIStore'

export default function BoardPage({
  ownerLabels,
  teamsCount,
  selectedLeague,
  selectedDraft,
  effRoster,
  isSuperflex,
  effScoringType,
  draftSlot,
  tips,
  draftFinished,
  onOpenDraftReview,
}) {

  const { sleeperUserId, selectedDraftId, draftViewAs } = useSessionStore()
  const shellVersion = useUIStore((s) => s.shellVersion)
  // Muss zur Shell-Wahl in App.jsx passen: unter 900px gilt immer die mobil
  // optimierte Ansicht, sonst saesse NextBoard ohne seine Huelle in der
  // alten Seite.
  const [wideViewport, setWideViewport] = useState(
    () => typeof window === 'undefined' || window.matchMedia('(min-width: 900px)').matches
  )
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 900px)')
    const onChange = (e) => setWideViewport(e.matches)
    mq.addEventListener('change', onChange)
    setWideViewport(mq.matches)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  const {
    boardPlayers, searchQuery, positionFilter, teamFilter, draftMode,
    setBoardPlayers, setEnriching,
    mergeLivePicksWithBoard, onBoardReorder,
    setSearchQuery, setPositionFilter, setTeamFilter,
  } = useBoardStore()

  const {
    livePicks, autoRefreshEnabled, refreshIntervalSeconds, lastSyncAt, picksLoading,
    setAutoRefreshEnabled, setRefreshIntervalSeconds, loadPicks,
  } = useLiveStore()

  const { dynastyRoster, mySleeperRosterId, rosterToUserMap, tradedPicks } = useDynastyStore()

  // Freundes-Draft: angepinntes Team gilt als "meins" (row-me in der Liste),
  // genau wie draftSlot/Tips in App.jsx -- vgl. Kommentar dort.
  const effectiveMeUserId = draftViewAs?.[selectedDraftId]?.userId || sleeperUserId

  // Merge live picks into board whenever picks change
  useEffect(() => {
    mergeLivePicksWithBoard(livePicks, effectiveMeUserId)
  }, [livePicks]) // eslint-disable-line

  // ── Deep-link board filters (position + search) via URL query ──────────────
  const [searchParams, setSearchParams] = useSearchParams()
  const hydratedRef = useRef(false)
  // Hydrate store from URL once on mount
  useEffect(() => {
    const { pos, q } = parseBoardParams(window.location.search)
    if (pos) setPositionFilter(pos)
    if (q) setSearchQuery(q)
    hydratedRef.current = true
  }, []) // eslint-disable-line
  // Reflect store changes back into the URL (shareable, restored on back)
  useEffect(() => {
    if (!hydratedRef.current) return
    const next = buildBoardSearch({ positionFilter, searchQuery })
    if (next !== searchParams.toString()) setSearchParams(next, { replace: true })
  }, [positionFilter, searchQuery]) // eslint-disable-line

  // Enrichment: fetch Sleeper metadata for imported players
  const enrichingRef = useRef(false)
  useEffect(() => {
    async function maybeEnrich() {
      if (!Array.isArray(boardPlayers) || !boardPlayers.length) return
      if (enrichingRef.current) return
      enrichingRef.current = true
      setEnriching(true)
      try {
        const season =
          selectedDraft?.season || Number(useSessionStore.getState().seasonYear) || new Date().getFullYear()
        const enriched = await enrichBoardPlayersWithSleeper(boardPlayers, { season })
        if (JSON.stringify(enriched) !== JSON.stringify(boardPlayers)) {
          setBoardPlayers(enriched)
        }
      } catch (e) {
        console.warn('Enrichment failed', e)
      } finally {
        enrichingRef.current = false
        setEnriching(false)
      }
    }
    maybeEnrich()
  }, [JSON.stringify(boardPlayers), selectedDraft?.season, selectedLeague?.scoring_settings?.ppr]) // eslint-disable-line

  // My draft picks for rookie mode
  const myDraftPicks = useMemo(() => {
    if (draftMode !== 'rookie' || !selectedDraft || mySleeperRosterId == null) return []
    const rounds = Number(selectedDraft.settings?.rounds) || 3
    const teams = Number(selectedDraft.settings?.teams) || 12
    const order = selectedDraft.draft_order || {}
    const mySlot = Number(order[effectiveMeUserId]) || null
    const pickPos = (slot, round) => {
      if (!slot || !teams) return null
      return round % 2 === 1 ? slot : teams - slot + 1
    }
    const slotForRoster = (rosterId) => {
      const uid = rosterToUserMap[String(rosterId)]
      if (!uid) return null
      return Number(order[uid]) || null
    }
    const traded = tradedPicks || []
    const tradedAway = new Set(
      traded
        .filter(
          (p) =>
            String(p.roster_id) === String(mySleeperRosterId) &&
            String(p.owner_id) !== String(mySleeperRosterId)
        )
        .map((p) => p.round)
    )
    const tradedToMe = traded.filter(
      (p) =>
        String(p.owner_id) === String(mySleeperRosterId) &&
        String(p.roster_id) !== String(mySleeperRosterId)
    )
    const result = []
    for (let r = 1; r <= rounds; r++) {
      if (!tradedAway.has(r)) result.push({ round: r, type: 'own', pick_pos: pickPos(mySlot, r) })
    }
    for (const tp of tradedToMe) {
      result.push({
        round: tp.round,
        type: 'acquired',
        fromRosterId: tp.roster_id,
        pick_pos: pickPos(slotForRoster(tp.roster_id), tp.round),
      })
    }
    return result.sort(
      (a, b) => a.round - b.round || (a.pick_pos || 99) - (b.pick_pos || 99)
    )
  }, [draftMode, selectedDraft, mySleeperRosterId, tradedPicks, rosterToUserMap, effectiveMeUserId])

  // Filtered players
  const filteredPlayers = useMemo(() => {
    const q = normalizePlayerName(searchQuery)
    return boardPlayers.filter((p) => {
      if (positionFilter !== 'ALL' && normalizePos(p.pos) !== normalizePos(positionFilter)) return false
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

  const pickedCount = useMemo(() => boardPlayers.filter((p) => p.status).length, [boardPlayers])
  const currentPickNumber = livePicks?.length
    ? Math.max(...livePicks.map((p) => p.pick_no || 0))
    : 0

  // Die neue Shell zeigt dieselben Daten in ihrer eigenen Arbeitsflaeche.
  // Alle Effekte oben (Merge, Enrichment, URL-Deeplink) laufen unveraendert.
  if (shellVersion === 'next' && wideViewport) {
    return (
      <NextBoard
        filteredPlayers={filteredPlayers}
        boardPlayers={boardPlayers}
        livePicks={livePicks}
        searchQuery={searchQuery}
        positionFilter={positionFilter}
        teamFilter={teamFilter}
        onSearchChange={(e) => setSearchQuery(e.target.value)}
        onPositionChange={(e) => setPositionFilter(e.target.value)}
        onTeamFilterChange={(e) => setTeamFilter(e.target.value)}
        ownerLabels={ownerLabels}
        draft={selectedDraft}
        draftSlot={draftSlot}
        teamsCount={teamsCount}
        meUserId={effectiveMeUserId}
        effRoster={effRoster}
        draftMode={draftMode}
        league={selectedLeague}
        isSuperflex={isSuperflex}
        scoringType={effScoringType}
        currentPickNumber={currentPickNumber}
        tips={tips}
        dynastyRoster={dynastyRoster}
        myDraftPicks={myDraftPicks}
        draftFinished={draftFinished}
        onOpenDraftReview={onOpenDraftReview}
      />
    )
  }

  return (
    <>
      {picksLoading && (
        <div className="picks-loading-bar">
          Picks werden geladen…
        </div>
      )}
    <BoardSection
      ownerLabels={ownerLabels}
      setupVersion={0}
      teamFilter={teamFilter}
      onTeamFilterChange={(e) => setTeamFilter(e.target.value)}
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
      draftMode={draftMode}
      myDraftPicks={myDraftPicks}
      dynastyRoster={dynastyRoster}
      onBoardReorder={onBoardReorder}
      draftSlot={draftSlot}
      tips={tips}
      draftFinished={draftFinished}
      onOpenDraftReview={onOpenDraftReview}
    />
    </>
  )
}
