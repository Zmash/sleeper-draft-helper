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

// Sleeper liefert fuer Standard-Scoring 'std', nicht 'standard' (belegt an
// GET /v1/draft/1383717351475662848 -> metadata.scoring_type === 'std').
// 'standard' bleibt als Alias, falls Sleeper es doch mal so schickt. Nur
// belegte Werte mappen -- unbekannte bleiben null, damit der Liga-Fallback greift.
const SLEEPER_SCORING_TYPE_MAP = { ppr: 'ppr', half_ppr: 'half_ppr', std: 'standard', standard: 'standard' }

function scoringTypeFromDraft(draft) {
  const t = String(draft?.metadata?.scoring_type || '').toLowerCase()
  return SLEEPER_SCORING_TYPE_MAP[t] || null
}

// Ein Standalone-Draft (z.B. ein Sleeper-Mock) traegt league_id: null -- er
// gehoert zu keiner Liga. Eine im UI noch ausgewaehlte Liga darf dann weder
// Format noch Modus dieses Drafts bestimmen (Bug B, empirisch am echten Mock
// 1383717351475662848 nachgewiesen: league_id war null).
export function isStandaloneDraft(draft) {
  return !!(draft && ('league_id' in draft) && draft.league_id == null)
}

function hasSuper(roster) {
  return (roster || []).some(r => String(r).toUpperCase().includes('SUPER'))
}

export function deriveFormat({ draft = null, league = null, overrides = {} } = {}) {
  const o = overrides || {}
  // Standalone-Draft: eine noch ausgewaehlte Liga (z.B. vom vorherigen Draft)
  // darf nicht durchschlagen -- siehe isStandaloneDraft oben.
  const effLeague = isStandaloneDraft(draft) ? null : league
  const draftRoster = draft?.settings ? rosterFromDraftSettings(draft.settings) : []
  const leagueRoster = effLeague?.roster_positions || effLeague?.settings?.roster_positions || []

  const rosterPositions =
    o.roster_positions ??
    (draftRoster.length ? draftRoster : null) ??
    (leagueRoster.length ? leagueRoster : null) ??
    FORMAT_DEFAULTS.rosterPositions

  const scoringType =
    o.scoring_type ??
    scoringTypeFromDraft(draft) ??
    scoringTypeFromRec(effLeague?.scoring_settings?.rec) ??
    FORMAT_DEFAULTS.scoringType

  const teams =
    Number(o.teams) ||
    Number(draft?.settings?.teams) || Number(draft?.teams) ||
    Number(effLeague?.total_rosters) || Number(effLeague?.league_size) ||
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
      : (leagueRoster.length || effLeague?.total_rosters) ? 'league'
      : 'default'

  return { rosterPositions, scoringType, isSuperflex, teams, rounds, type, source }
}

// Ein Mock hat keine Liga. Vorher griff die Erkennung dann gar nicht und der
// Modus blieb still auf dem alten Wert stehen — nach einem Rookie-Draft lief
// der Redraft-Mock mit der Rookie-Tipplogik.
export function resolveDraftMode({ league = null, draft = null, current = 'redraft' } = {}) {
  // Standalone-Draft (league_id: null): eine noch ausgewaehlte Liga darf den
  // Modus nicht bestimmen -- siehe isStandaloneDraft oben (Bug B).
  const effLeague = isStandaloneDraft(draft) ? null : league
  // Rohe Sleeper-Ligen tragen settings.type als Zahl (0=redraft, 1=keeper, 2=dynasty) --
  // das ist die Konvention, die Produktionsdaten liefern (Muster aus useDashboardStore.js).
  // Nie gegen String-Literale vergleichen. league_type als String bleibt Fallback fuer
  // angereicherte Ligen, die das Feld zusaetzlich mitschicken.
  const t = effLeague?.settings?.type
  if (t === 2 || t === 1) return 'rookie'
  if (t === 0) return 'redraft'
  const lt = effLeague?.league_type
  if (lt === 'dynasty' || lt === 'keeper') return 'rookie'
  if (lt === 'redraft') return 'redraft'
  if (draft && !effLeague) return 'redraft'
  return current
}
