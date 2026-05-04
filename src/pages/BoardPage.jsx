import { useEffect, useMemo, useRef } from 'react'
import { useSessionStore } from '../stores/useSessionStore'
import { useBoardStore } from '../stores/useBoardStore'
import { useLiveStore } from '../stores/useLiveStore'
import { useDynastyStore } from '../stores/useDynastyStore'
import { enrichBoardPlayersWithSleeper } from '../services/enrichBoardWithSleeper'
import { normalizePos, normalizePlayerName } from '../utils/formatting'
import BoardSection from '../components/BoardSection'

export default function BoardPage({
  ownerLabels,
  teamsCount,
  selectedLeague,
  selectedDraft,
  effRoster,
  isSuperflex,
  effScoringType,
}) {

  const { sleeperUserId } = useSessionStore()
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

  // Merge live picks into board whenever picks change
  useEffect(() => {
    mergeLivePicksWithBoard(livePicks, sleeperUserId)
  }, [livePicks]) // eslint-disable-line

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
  const { selectedDraftId } = useSessionStore()
  const myDraftPicks = useMemo(() => {
    if (draftMode !== 'rookie' || !selectedDraft || mySleeperRosterId == null) return []
    const rounds = Number(selectedDraft.settings?.rounds) || 3
    const teams = Number(selectedDraft.settings?.teams) || 12
    const order = selectedDraft.draft_order || {}
    const mySlot = Number(order[sleeperUserId]) || null
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
  }, [draftMode, selectedDraft, mySleeperRosterId, tradedPicks, rosterToUserMap, sleeperUserId])

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
    />
    </>
  )
}
