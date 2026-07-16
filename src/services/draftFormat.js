// Eine einzige Quelle der Wahrheit fuer das Draft-Format.
// Vorher lag dieselbe Logik in App.jsx, SetupForm.jsx und BoardSection.jsx —
// zwei der drei Kopien lasen nur die Liga, wodurch Mocks (die keine Liga haben)
// still auf 12 Teams / PPR / 1QB zurueckfielen.

const SLOT_MAP = {
  slots_qb: 'QB', slots_rb: 'RB', slots_wr: 'WR', slots_te: 'TE',
  slots_k: 'K', slots_def: 'DEF', slots_flex: 'FLEX',
  slots_wr_rb: 'WR/RB', slots_wr_te: 'WR/TE', slots_rb_te: 'RB/TE',
  slots_super_flex: 'SUPER_FLEX', slots_idp_flex: 'IDP_FLEX',
  slots_dl: 'DL', slots_lb: 'LB', slots_db: 'DB', slots_bn: 'BN',
}

export const FORMAT_DEFAULTS = {
  teams: 12,
  rounds: 16,
  type: 'snake',
  scoringType: 'ppr',
  rosterPositions: ['QB','RB','RB','WR','WR','TE','FLEX','DEF','BN','BN','BN','BN','BN','BN'],
}

export function rosterFromDraftSettings(settings = {}) {
  const out = []
  for (const [k, v] of Object.entries(settings || {})) {
    if (!k.startsWith('slots_')) continue
    const name = SLOT_MAP[k]
    const n = Number(v)
    if (!name || !Number.isFinite(n) || n <= 0) continue
    for (let i = 0; i < n; i++) out.push(name)
  }
  return out
}

export function scoringTypeFromRec(rec) {
  const r = Number(rec)
  if (!Number.isFinite(r)) return null
  return r >= 0.95 ? 'ppr' : r >= 0.45 ? 'half_ppr' : 'standard'
}

function scoringTypeFromDraft(draft) {
  const t = String(draft?.metadata?.scoring_type || '').toLowerCase()
  return (t === 'ppr' || t === 'half_ppr' || t === 'standard') ? t : null
}

function hasSuper(roster) {
  return (roster || []).some(r => String(r).toUpperCase().includes('SUPER'))
}

export function deriveFormat({ draft = null, league = null, overrides = {} } = {}) {
  const o = overrides || {}
  const draftRoster = draft?.settings ? rosterFromDraftSettings(draft.settings) : []
  const leagueRoster = league?.roster_positions || league?.settings?.roster_positions || []

  const rosterPositions =
    o.roster_positions ??
    (draftRoster.length ? draftRoster : null) ??
    (leagueRoster.length ? leagueRoster : null) ??
    FORMAT_DEFAULTS.rosterPositions

  const scoringType =
    o.scoring_type ??
    scoringTypeFromDraft(draft) ??
    scoringTypeFromRec(league?.scoring_settings?.rec) ??
    FORMAT_DEFAULTS.scoringType

  const teams =
    Number(o.teams) ||
    Number(draft?.settings?.teams) || Number(draft?.teams) ||
    Number(league?.total_rosters) || Number(league?.league_size) ||
    FORMAT_DEFAULTS.teams

  const rounds =
    Number(o.rounds) ||
    Number(draft?.settings?.rounds) || Number(draft?.rounds) ||
    FORMAT_DEFAULTS.rounds

  const type = String(o.type ?? draft?.type ?? FORMAT_DEFAULTS.type).toLowerCase()

  const isSuperflex = o.superflex != null ? !!o.superflex : hasSuper(rosterPositions)

  // Woher stammt das Bild? Wird angezeigt (Herkunfts-Zeile), nicht nur intern genutzt.
  const source =
    (o.roster_positions || o.scoring_type || o.teams || o.rounds || o.type || o.superflex != null)
      ? 'override'
      : (draftRoster.length || draft?.settings?.teams || scoringTypeFromDraft(draft)) ? 'draft'
      : (leagueRoster.length || league?.total_rosters) ? 'league'
      : 'default'

  return { rosterPositions, scoringType, isSuperflex, teams, rounds, type, source }
}
