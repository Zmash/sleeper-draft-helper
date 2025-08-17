// 1:1 aus App.jsx übernommen (keine Logikänderungen)

// Basis-URL
export const SLEEPER_API_BASE = 'https://api.sleeper.app/v1'

// Fetch-Helper
export async function fetchJson(url) {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error('HTTP ' + res.status)
  }
  return res.json()
}

// Alle Drafts (inkl. Mock) eines Users im Jahr
export async function loadUserDraftsForYear(userId, year) {
  const url = `${SLEEPER_API_BASE}/user/${userId}/drafts/nfl/${year}`
  return fetchJson(url)
}

// Drafts der aktuellen Liga
export async function fetchLeagueDrafts(leagueId) {
  if (!leagueId) return []
  return fetchJson(`${SLEEPER_API_BASE}/league/${leagueId}/drafts`)
}

// Unique-Merge nach draft_id
export function mergeDraftsUnique(...arrays) {
  const map = new Map()
  arrays.flat().forEach(d => {
    if (d && d.draft_id && !map.has(d.draft_id)) {
      map.set(d.draft_id, d)
    }
  })
  return Array.from(map.values())
}

// Label für Dropdown: [Mock] / [Liga]
export function formatDraftLabel(d, leaguesById) {
  const isMock = !d.league_id
  const prefix = isMock ? '[Mock]' : '[Liga]'
  const name = d?.metadata?.name || d.draft_id
  const leagueName = !isMock ? (leaguesById.get(d.league_id)?.name || d.league_id) : ''
  return isMock ? `${prefix} ${name}` : `${prefix} ${name} – ${leagueName}`
}

// Einzelne Liga mit vollen Details (total_rosters, roster_positions, scoring_settings, ...)
export async function fetchLeague(leagueId) {
  if (!leagueId) return null
  return fetchJson(`${SLEEPER_API_BASE}/league/${leagueId}`)
}

// Optional: Users einer Liga (falls später benötigt)
export async function fetchLeagueUsers(leagueId) {
  if (!leagueId) return []
  return fetchJson(`${SLEEPER_API_BASE}/league/${leagueId}/users`)
}

// --- DRAFT META --------------------------------------------------------------

export async function fetchDraft(draftId) {
  return fetchJson(`${SLEEPER_API_BASE}/v1/draft/${draftId}`)
}

export async function fetchDraftPicks(draftId) {
  return fetchJson(`${SLEEPER_API_BASE}/v1/draft/${draftId}/picks`)
}

/**
 * Convert Sleeper draft.settings 'slots_*' into roster positions array like:
 * ["QB","RB","RB","WR","WR","TE","FLEX","SUPER_FLEX", ...]
 * Falls back to league.roster_positions if needed.
 */
export function rosterPositionsFromDraft(draft = {}, league = null) {
  const s = draft?.settings || {}
  const map = {
    slots_qb: 'QB',
    slots_rb: 'RB',
    slots_wr: 'WR',
    slots_te: 'TE',
    slots_k: 'K',
    slots_def: 'DEF',
    slots_flex: 'FLEX',               // WR/RB/TE
    slots_wr_rb: 'WR/RB',
    slots_wr_te: 'WR/TE',
    slots_rb_te: 'RB/TE',
    slots_super_flex: 'SUPER_FLEX',
    slots_bn: 'BN',
    slots_idp_flex: 'IDP_FLEX',
    slots_dl: 'DL',
    slots_lb: 'LB',
    slots_db: 'DB',
  }
  const out = []
  for (const [k, v] of Object.entries(s)) {
    if (!k.startsWith('slots_')) continue
    const name = map[k]
    const n = Number(v)
    if (!name || !Number.isFinite(n) || n <= 0) continue
    for (let i=0;i<n;i++) out.push(name)
  }
  if (out.length) return out
  // Fallback to league (rarely needed)
  return Array.isArray(league?.roster_positions) ? league.roster_positions : []
}

/** Basic scoring meta from draft metadata; fallback to league.scoring_settings */
export function scoringFromDraft(draft = {}, league = null) {
  const scoring_type = String(draft?.metadata?.scoring_type || '').toLowerCase() || null
  const scoring_settings = league?.scoring_settings || null
  return { scoring_type, scoring_settings }
}

/** Teams & rounds from draft.settings */
export function teamsAndRoundsFromDraft(draft = {}) {
  const teams = Number(draft?.settings?.teams) || null
  const rounds = Number(draft?.settings?.rounds) || null
  const type = String(draft?.type || 'snake').toLowerCase()
  return { teams, rounds, type }
}

/**
 * Best effort: determine my draft slot.
 * 1) Try draft.draft_order (user_id -> slot)
 * 2) Else, deduce from my earliest pick_no (snake parity).
 */
export function inferMyDraftSlot({ draft, picks, meUserId }) {
  const order = draft?.draft_order
  if (order && meUserId && order[meUserId]) {
    return Number(order[meUserId]) || null
  }
  const { teams, type } = teamsAndRoundsFromDraft(draft)
  if ((type !== 'snake') || !Number.isFinite(teams) || teams <= 0) return null
  // earliest pick by me
  const mine = (picks || []).filter(p => String(p?.picked_by) === String(meUserId))
  if (!mine.length) return null
  const earliest = mine.reduce((a,b) => (a.pick_no < b.pick_no ? a : b))
  const pickNo = Number(earliest?.pick_no)
  if (!Number.isFinite(pickNo)) return null
  const round = Math.ceil(pickNo / teams)
  const inRound = ((pickNo - 1) % teams) + 1
  return (round % 2 === 1) ? inRound : (teams - inRound + 1)
}

