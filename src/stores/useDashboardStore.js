import { create } from 'zustand'
import {
  SLEEPER_API_BASE,
  fetchJson,
  fetchNflState,
  fetchMatchups,
  fetchLeagueRosters,
  fetchLeagueDrafts,
  fetchLeagueUsers,
  fetchDraft,
} from '../services/api'
import { loadPlayersMetaCached } from '../services/playersMeta'

const INJURY_STATUSES = new Set(['Out', 'Doubtful', 'IR', 'Sus', 'PUP', 'NFI-R', 'DNR'])

function detectFormat(league) {
  // league_type is a string on enriched leagues; settings.type is a number (0=redraft,1=keeper,2=dynasty)
  const t = league?.league_type || league?.settings?.type
  if (t === 'dynasty' || t === 2) return 'dynasty'
  if (t === 'keeper'  || t === 1) return 'keeper'
  // Fallback: TAXI slot is dynasty-exclusive in Sleeper
  const pos = league?.roster_positions || []
  if (pos.includes('TAXI')) return 'dynasty'
  return 'redraft'
}

function detectScoringType(league) {
  const rec = Number(league?.scoring_settings?.rec ?? 1)
  return rec >= 0.95 ? 'ppr' : rec >= 0.45 ? 'half_ppr' : 'standard'
}

// Build a single league card, fetching all needed data in parallel
async function buildLeagueCard(league, sleeperUserId, currentWeek, isInSeason, playersMeta) {
  try {
    const [drafts, rosters, users, matchups] = await Promise.all([
      fetchLeagueDrafts(league.league_id).catch(() => []),
      fetchLeagueRosters(league.league_id).catch(() => []),
      fetchLeagueUsers(league.league_id).catch(() => []),
      isInSeason
        ? fetchMatchups(league.league_id, currentWeek).catch(() => [])
        : Promise.resolve([]),
    ])

    const myRoster = (rosters || []).find((r) => String(r.owner_id) === String(sleeperUserId))
    const myRosterId = myRoster?.roster_id ?? null

    // Active draft: prefer live, then most recent
    const activeDraft =
      (drafts || []).find((d) => d.status === 'drafting') ||
      (drafts || []).find((d) => d.status === 'pre_draft') ||
      (drafts || [])[0] ||
      null

    // Matchup for current week
    let matchup = null
    if (isInSeason && matchups.length && myRosterId != null) {
      const mine = matchups.find((m) => m.roster_id === myRosterId)
      if (mine) {
        const opp = matchups.find(
          (m) => m.matchup_id === mine.matchup_id && m.roster_id !== myRosterId
        )
        const oppRoster = opp ? (rosters || []).find((r) => r.roster_id === opp.roster_id) : null
        const oppUser = oppRoster
          ? (users || []).find((u) => String(u.user_id) === String(oppRoster.owner_id))
          : null
        matchup = {
          myPoints: mine.points || 0,
          opponentPoints: opp?.points || 0,
          opponentName:
            oppUser?.display_name ||
            oppUser?.username ||
            (opp ? `Team ${opp.roster_id}` : '—'),
        }
      }
    }

    // Injured starters
    let injuries = []
    if (isInSeason && myRoster && Object.keys(playersMeta).length) {
      injuries = (myRoster.starters || [])
        .map((id) => playersMeta[id])
        .filter((p) => p && INJURY_STATUSES.has(p.injury_status))
        .map((p) => ({
          name: p.full_name || `#${p.player_id}`,
          pos: (p.fantasy_positions?.[0] || p.position || '').toUpperCase(),
          team: p.team || '',
          status: p.injury_status,
        }))
    }

    return {
      type: 'league',
      leagueId: league.league_id,
      leagueName: league.name || league.league_id,
      format: detectFormat(league),
      scoringType: detectScoringType(league),
      totalRosters: league.total_rosters || 12,
      leagueStatus: league.status,
      draftId: activeDraft?.draft_id ?? null,
      draftStatus: activeDraft?.status ?? null,
      matchup,
      injuries,
      wins: myRoster?.settings?.wins ?? null,
      losses: myRoster?.settings?.losses ?? null,
      myRosterId,
      loading: false,
      error: null,
    }
  } catch (e) {
    return {
      type: 'league',
      leagueId: league.league_id,
      leagueName: league.name || league.league_id,
      format: detectFormat(league),
      scoringType: detectScoringType(league),
      loading: false,
      error: e.message || 'Fehler beim Laden',
    }
  }
}

// Standalone / mock draft: fetch fresh status from API
async function buildDraftCard(draft) {
  try {
    // Fetch live status if not already 'complete'
    const live =
      draft.status && draft.status !== 'pre_draft'
        ? draft
        : await fetchDraft(draft.draft_id).catch(() => draft)

    return {
      type: 'draft',
      draftId: draft.draft_id,
      draftName:
        draft.metadata?.name ||
        live.metadata?.name ||
        `Draft ${draft.draft_id}`,
      draftStatus: live.status || draft.status || null,
      draftType: live.type || draft.type || 'snake',
      draftTeams: Number(live.settings?.teams || draft.settings?.teams) || 12,
      draftRounds: Number(live.settings?.rounds || draft.settings?.rounds) || 16,
      draftSeason: live.season || draft.season || null,
      scoringType: live.metadata?.scoring_type || draft.metadata?.scoring_type || 'ppr',
      loading: false,
      error: null,
    }
  } catch (e) {
    return {
      type: 'draft',
      draftId: draft.draft_id,
      draftName: draft.metadata?.name || `Draft ${draft.draft_id}`,
      draftStatus: draft.status || null,
      loading: false,
      error: e.message || 'Fehler beim Laden',
    }
  }
}

function sortCards(cards) {
  return [...cards].sort((a, b) => {
    // 1. Live drafts always first
    const aLive = a.draftStatus === 'drafting' ? 0 : 1
    const bLive = b.draftStatus === 'drafting' ? 0 : 1
    if (aLive !== bLive) return aLive - bLive
    // 2. League cards before standalone drafts
    if (a.type !== b.type) return a.type === 'league' ? -1 : 1
    return 0
  })
}

export const useDashboardStore = create((set, get) => ({
  nflState: null,
  cards: [],
  loading: false,
  lastRefreshed: null,

  loadDashboard: async ({ leagues, availableDrafts, sleeperUserId, seasonYear }) => {
    if (!leagues?.length && !availableDrafts?.length) {
      set({ cards: [], loading: false })
      return
    }

    set({ loading: true })

    try {
      // NFL state (current week + season type)
      const nflState = await fetchNflState().catch(() => null)
      set({ nflState })

      const currentWeek = nflState?.week || 1
      const seasonType = nflState?.season_type || 'off'
      const isInSeason = seasonType === 'regular' || seasonType === 'post'

      // Player meta for injury checks (only during season)
      const playersMeta = isInSeason
        ? await loadPlayersMetaCached({
            season: Number(seasonYear) || new Date().getFullYear(),
          }).catch(() => ({}))
        : {}

      // Build league cards in parallel
      const leagueCardPromises = (leagues || []).map((l) =>
        buildLeagueCard(l, sleeperUserId, currentWeek, isInSeason, playersMeta)
      )

      // Standalone drafts: not tied to any of the user's loaded leagues
      const leagueIds = new Set((leagues || []).map((l) => l.league_id))
      const standaloneDrafts = (availableDrafts || []).filter((d) => {
        const draftLeagueId = d.league_id || d.metadata?.league_id
        return !draftLeagueId || !leagueIds.has(String(draftLeagueId))
      })
      const draftCardPromises = standaloneDrafts.map(buildDraftCard)

      const [leagueCards, draftCards] = await Promise.all([
        Promise.all(leagueCardPromises),
        Promise.all(draftCardPromises),
      ])

      set({
        cards: sortCards([...leagueCards, ...draftCards]),
        loading: false,
        lastRefreshed: new Date(),
      })
    } catch (e) {
      console.warn('[dashboard] loadDashboard failed', e)
      set({ loading: false })
    }
  },

  refresh: () => {
    // Caller re-invokes loadDashboard — resets loading
    set({ lastRefreshed: null })
  },
}))
