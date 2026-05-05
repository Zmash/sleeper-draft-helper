import { useEffect, useState, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import TradeAnalyzer from '../components/TradeAnalyzer'
import { useSessionStore } from '../stores/useSessionStore'
import { useDynastyStore } from '../stores/useDynastyStore'
import { useBoardStore } from '../stores/useBoardStore'
import { normalizePlayerName } from '../utils/formatting'
import { pickDynastyValue } from '../services/tradeValue'
import { loadPlayersMetaCached } from '../services/playersMeta'
import {
  fetchLeagueRosters, fetchLeagueDrafts, fetchTradedPicks, fetchLeagueUsers, fetchDraft, fetchDraftPicks,
} from '../services/api'

// ── Daily FantasyCalc cache ───────────────────────────────────────────────────
const FC_CACHE_KEY = 'sdh-fc-dynasty-v1'
const FC_CACHE_TTL = 24 * 60 * 60 * 1000

function loadFcCache(numQbs) {
  try {
    const raw = localStorage.getItem(FC_CACHE_KEY)
    if (!raw) return null
    const { ts, nq, entries } = JSON.parse(raw)
    if (Date.now() - ts > FC_CACHE_TTL) return null
    if (nq !== numQbs) return null
    return new Map(entries)
  } catch { return null }
}

function saveFcCache(map, numQbs) {
  try {
    localStorage.setItem(FC_CACHE_KEY, JSON.stringify({
      ts: Date.now(), nq: numQbs, entries: [...map.entries()],
    }))
  } catch {}
}

// ── Build manager rosters from Sleeper data ───────────────────────────────────
function buildManagerRosters(rosters, playersMeta, users, tradedPicks, draftOrder, activeDraftPicks, { rounds = 3, year = 2026, numTeams } = {}) {
  const userNameById = new Map(
    (users || []).map(u => [String(u.user_id), u.display_name || u.username || `User ${u.user_id}`])
  )
  const SKILL_POS = new Set(['QB', 'RB', 'WR', 'TE', 'K', 'DL', 'LB', 'DB'])
  const teamCount = numTeams || rosters.length || 12

  // draft_order maps userId → slot number
  const slotByUserId = draftOrder
    ? new Map(Object.entries(draftOrder).map(([uid, slot]) => [String(uid), slot]))
    : new Map()

  // Build set of (round, slot) pairs already picked in the live draft.
  // slot = pick_no − (round−1) × numTeams  (1-indexed)
  const usedSlots = new Set()
  for (const pick of (activeDraftPicks || [])) {
    if (!pick.pick_no || !pick.round) continue
    const slot = pick.pick_no - (pick.round - 1) * teamCount
    usedSlots.add(`${pick.round}_${slot}`)
  }

  // Map rosterId → Map<player_id, pickLabel> for live draft picks not yet in official roster
  const livePicksByRoster = new Map()
  for (const pick of (activeDraftPicks || [])) {
    if (!pick.player_id) continue
    const rid = String(pick.roster_id)
    if (!livePicksByRoster.has(rid)) livePicksByRoster.set(rid, new Map())
    const slot = pick.pick_no - (pick.round - 1) * teamCount
    livePicksByRoster.get(rid).set(pick.player_id, `${pick.round}.${String(slot).padStart(2, '0')}`)
  }

  const result = {}
  for (const roster of (rosters || [])) {
    const rid = String(roster.roster_id)
    const ownerId = String(roster.owner_id || '')
    const displayName = userNameById.get(ownerId) || `Team ${rid}`
    const mySlot = slotByUserId.get(ownerId) ?? null

    // Official roster players
    const existingIds = new Set(roster.players || [])
    const players = (roster.players || []).map(id => {
      const meta = playersMeta[id] || {}
      const name = meta.full_name || `#${id}`
      const pos = (meta.fantasy_positions?.[0] || meta.position || '').toUpperCase()
      return {
        type: 'player',
        id: `player_${id}`,
        sleeper_id: id,
        name,
        nname: normalizePlayerName(name),
        pos,
        team: meta.team || '',
        age: meta.age || null,
        source: 'roster',
        dynasty_value: 0,
        has_value: false,
      }
    }).filter(p => SKILL_POS.has(p.pos) || !p.pos)

    // Merge players drafted live that haven't hit the official roster yet
    for (const [playerId, pickLabel] of (livePicksByRoster.get(rid) || [])) {
      if (existingIds.has(playerId)) continue
      const meta = playersMeta[playerId] || {}
      const name = meta.full_name || `#${playerId}`
      const pos = (meta.fantasy_positions?.[0] || meta.position || '').toUpperCase()
      if (!SKILL_POS.has(pos) && pos) continue
      players.push({
        type: 'player',
        id: `player_${playerId}`,
        sleeper_id: playerId,
        name,
        nname: normalizePlayerName(name),
        pos,
        team: meta.team || '',
        age: meta.age || null,
        source: 'drafted',
        draftedAt: pickLabel,
        dynasty_value: 0,
        has_value: false,
      })
    }

    // Determine pick ownership for current draft year
    const tradedAwayRounds = new Set(
      (tradedPicks || [])
        .filter(p => String(p.roster_id) === rid && String(p.owner_id) !== rid)
        .map(p => p.round)
    )
    const tradedToHere = (tradedPicks || [])
      .filter(p => String(p.owner_id) === rid && String(p.roster_id) !== rid)

    const picks = []

    // Current draft year — own picks (skip slots already used in live draft)
    for (let r = 1; r <= rounds; r++) {
      if (!tradedAwayRounds.has(r)) {
        const slotKey = mySlot ? `${r}_${mySlot}` : null
        if (slotKey && usedSlots.has(slotKey)) continue
        const roundLabel = r === 1 ? '1st' : r === 2 ? '2nd' : r === 3 ? '3rd' : `${r}th`
        const label = mySlot
          ? `${year} - ${r}.${String(mySlot).padStart(2, '0')}`
          : `${year} ${roundLabel}`
        picks.push({
          type: 'pick',
          id: `pick_own_${rid}_r${r}_${year}`,
          label,
          year: String(year),
          round: r,
          tier: 'mid',
          dynasty_value: pickDynastyValue(r, 'mid', { slot: mySlot ?? undefined, numTeams: teamCount, yearOffset: 0 }),
          pos: null, age: null,
          isOwn: true,
          originalRosterId: rid,
        })
      }
    }

    // Current draft year — received traded picks (skip slots already used)
    for (const tp of tradedToHere) {
      const origRoster = rosters.find(r => String(r.roster_id) === String(tp.roster_id))
      const origOwnerId = String(origRoster?.owner_id || '')
      const origSlot = slotByUserId.get(origOwnerId) ?? null
      const slotKey = origSlot ? `${tp.round}_${origSlot}` : null
      if (slotKey && usedSlots.has(slotKey)) continue
      const origOwner = userNameById.get(origOwnerId) || `Team ${tp.roster_id}`
      const label = origSlot
        ? `${year} - ${tp.round}.${String(origSlot).padStart(2, '0')}`
        : `${year} ${tp.round === 1 ? '1st' : tp.round === 2 ? '2nd' : tp.round === 3 ? '3rd' : `${tp.round}th`} (${origOwner})`
      picks.push({
        type: 'pick',
        id: `pick_trade_${rid}_from${tp.roster_id}_r${tp.round}_${year}`,
        label,
        year: String(year),
        round: tp.round,
        tier: 'mid',
        dynasty_value: pickDynastyValue(tp.round, 'mid', { slot: origSlot ?? undefined, numTeams: teamCount, yearOffset: 0 }),
        pos: null, age: null,
        isOwn: false,
        originalRosterId: String(tp.roster_id),
      })
    }

    // Next draft year — own picks only (no live draft or trade data yet)
    const nextYear = year + 1
    for (let r = 1; r <= rounds; r++) {
      picks.push({
        type: 'pick',
        id: `pick_own_${rid}_r${r}_${nextYear}`,
        label: `${nextYear} ${r === 1 ? '1st' : r === 2 ? '2nd' : r === 3 ? '3rd' : `${r}th`}`,
        year: String(nextYear),
        round: r,
        tier: 'mid',
        dynasty_value: pickDynastyValue(r, 'mid', { numTeams: teamCount, yearOffset: 1 }),
        pos: null, age: null,
        isOwn: true,
        originalRosterId: rid,
      })
    }

    result[rid] = { displayName, ownerId, players, picks }
  }
  return result
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function TradePage({ selectedLeague }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { sleeperUserId, selectedLeagueId, seasonYear } = useSessionStore()
  const { dynastyRoster, loadDynastyRoster } = useDynastyStore()
  const { boardPlayers } = useBoardStore()

  // League context from router state (from Dashboard Trade button)
  const stateLeagueId = location.state?.leagueId || selectedLeagueId
  const stateLeagueName = location.state?.leagueName || selectedLeague?.name

  // FantasyCalc dynasty values
  const [extraValuesMap, setExtraValuesMap] = useState(null)
  const [ktcLoading, setKtcLoading] = useState(true)

  // All manager rosters for this league
  const [rostersByRosterId, setRostersByRosterId] = useState(null)
  const [myRosterId, setMyRosterId] = useState(null)
  const [rosterLoading, setRosterLoading] = useState(false)
  const [rosterError, setRosterError] = useState(null)

  const league = selectedLeague || null
  const rosterPos = league?.roster_positions || []
  const isSuperflex = rosterPos.some(p => String(p).toUpperCase().includes('SUPER'))

  const numQbs = isSuperflex ? 2 : 1
  const numTeams = league?.total_rosters || 12
  const scoringRec = Number(league?.scoring_settings?.rec ?? 1)
  const ppr = scoringRec >= 0.95 ? 1 : scoringRec >= 0.45 ? 0.5 : 0

  // Load dynasty roster for current user (fallback / AI context)
  useEffect(() => {
    if (stateLeagueId && sleeperUserId) {
      loadDynastyRoster({ selectedLeagueId: stateLeagueId, sleeperUserId, seasonYear })
    }
  }, [stateLeagueId, sleeperUserId, seasonYear]) // eslint-disable-line

  // Load FantasyCalc dynasty values (daily cache)
  useEffect(() => {
    const cached = loadFcCache(numQbs)
    if (cached) { setExtraValuesMap(cached); setKtcLoading(false); return }
    setKtcLoading(true)
    fetch(`/api/rankings/fantasycalc?numQbs=${numQbs}&numTeams=${numTeams}&ppr=${ppr}`)
      .then(r => r.json())
      .then(data => {
        if (!data.ok) return
        const map = new Map()
        for (const p of data.players) {
          if (!p.name || !p.dynasty_value) continue
          map.set(normalizePlayerName(p.name), p.dynasty_value)
        }
        saveFcCache(map, numQbs)
        setExtraValuesMap(map)
      })
      .catch(() => {})
      .finally(() => setKtcLoading(false))
  }, [isSuperflex]) // eslint-disable-line

  // Load all league rosters + manager info
  const loadLeagueRosters = useCallback(async () => {
    if (!stateLeagueId) return
    setRosterLoading(true)
    setRosterError(null)
    try {
      const season = Number(seasonYear) || new Date().getFullYear()
      const [rosters, users, drafts, playersMeta] = await Promise.all([
        fetchLeagueRosters(stateLeagueId),
        fetchLeagueUsers(stateLeagueId),
        fetchLeagueDrafts(stateLeagueId),
        loadPlayersMetaCached({ season }),
      ])

      // Find upcoming or active rookie draft for pick ownership
      const upcomingDraft = drafts.find(d => ['drafting', 'pre_draft', 'paused'].includes(d.status))
        || drafts.find(d => d.status !== 'complete')
      const rounds = Number(upcomingDraft?.settings?.rounds) || 3
      // Use draft season directly — no +1 offset
      const draftYear = upcomingDraft?.season
        ? Number(upcomingDraft.season)
        : new Date().getFullYear()

      let tradedPicks = []
      let draftOrder = null
      let activeDraftPicks = []
      let draftNumTeams = rosters.length
      if (upcomingDraft?.draft_id) {
        const isDraftActive = ['drafting', 'paused'].includes(upcomingDraft.status)
        try {
          const [tp, fullDraft, dp] = await Promise.all([
            fetchTradedPicks(upcomingDraft.draft_id),
            fetchDraft(upcomingDraft.draft_id),
            isDraftActive ? fetchDraftPicks(upcomingDraft.draft_id) : Promise.resolve([]),
          ])
          tradedPicks = tp
          draftOrder = fullDraft?.draft_order || null
          activeDraftPicks = dp || []
          draftNumTeams = fullDraft?.settings?.teams || rosters.length
        } catch {}
      }

      const rosters_ = buildManagerRosters(rosters, playersMeta, users, tradedPicks, draftOrder, activeDraftPicks, { rounds, year: draftYear, numTeams: draftNumTeams })
      setRostersByRosterId(rosters_)

      // Find current user's roster
      const myRoster = (rosters || []).find(r => String(r.owner_id) === String(sleeperUserId))
      setMyRosterId(myRoster ? String(myRoster.roster_id) : null)
    } catch (e) {
      setRosterError('Could not load roster data: ' + (e.message || e))
    } finally {
      setRosterLoading(false)
    }
  }, [stateLeagueId, sleeperUserId, seasonYear]) // eslint-disable-line

  useEffect(() => { loadLeagueRosters() }, [stateLeagueId]) // eslint-disable-line

  // ── No league context ─────────────────────────────────────────────────────
  if (!stateLeagueId) {
    return (
      <section className="card trade-no-league">
        <div className="trade-no-league-icon">🏈</div>
        <h2>No League Selected</h2>
        <p className="muted">Open the Trade Analyzer via the "Trade" button on a league in the Dashboard.</p>
        <button className="btn btn-primary" onClick={() => navigate('/dashboard')}>
          Go to Dashboard
        </button>
      </section>
    )
  }

  return (
    <section className="card">
      <div className="trade-page-header">
        <h2 className="section-title">Trade Analyzer</h2>
        {stateLeagueName && <span className="trade-league-name muted">{stateLeagueName}</span>}
      </div>
      <TradeAnalyzer
        dynastyRoster={dynastyRoster}
        boardPlayers={boardPlayers}
        league={league}
        extraValuesMap={extraValuesMap}
        ktcLoading={ktcLoading}
        rostersByRosterId={rostersByRosterId}
        rosterLoading={rosterLoading}
        rosterError={rosterError}
        myRosterId={myRosterId}
      />
    </section>
  )
}
