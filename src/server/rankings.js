// Gemeinsame Normalisierung fuer index.js (dev) und prod.js (prod).
// Die beiden Server-Dateien sind Near-Duplikate; alles, was hier liegt,
// kann nicht auseinanderlaufen.

// Der Merge matcht Server-Daten gegen Board-Daten ueber genau diesen Schluessel.
// Deshalb wird die Client-Funktion IMPORTIERT und nicht nachgebaut: eine zweite
// Implementierung wuerde frueher oder spaeter abweichen, und dann matcht nichts
// mehr. formatting.js ist abhaengigkeitsfrei und laedt unter node.
import { normalizePlayerName, toFiniteOrNull } from '../utils/formatting.js'

export const FFC_FORMATS = ['ppr', 'half-ppr', 'standard', '2qb']

export function normalizeFfcPos(pos) {
  const p = String(pos || '').toUpperCase()
  return p === 'PK' ? 'K' : p
}

export function normalizeFfcPlayer(raw) {
  const name = raw?.name || ''
  return {
    name,
    nname: normalizePlayerName(name),
    pos: normalizeFfcPos(raw?.position),
    team: raw?.team || '',
    adp: raw?.adp ?? null,
    adp_formatted: raw?.adp_formatted ?? null,
    bye: raw?.bye ?? null,
    stdev: raw?.stdev ?? null,
    high: raw?.high ?? null,
    low: raw?.low ?? null,
    times_drafted: raw?.times_drafted ?? null,
  }
}

// Default true: der Rookie-/Dynasty-Pfad ruft ohne Parameter auf und muss
// unveraendert weiterlaufen.
export function isDynastyFromQuery(v) {
  return String(v) !== 'false'
}

// ---------- Sleeper ADP (RotoWire, format-spezifisch) ----------
// Sleeper bettet in seinen Projections pro Spieler format-spezifische ADP-Felder
// ein (Quelle: RotoWire — NICHT gecrowdsourcte Sleeper-Draft-ADP). Wir nutzen
// dieselbe format-Whitelist wie FFC (FFC_FORMATS) und mappen auf das passende
// Stat-Feld. 999 ist der Sentinel fuer "in diesem Format ungerankt" (z. B. K/DEF,
// die RotoWire nicht mit ADP versieht) — der wird zu null.
export const SLEEPER_ADP_FIELD = {
  ppr: 'adp_ppr',
  'half-ppr': 'adp_half_ppr',
  standard: 'adp_std',
  '2qb': 'adp_2qb',
}

const SLEEPER_ADP_SENTINEL = 999

// Ein Sleeper-Projection-Objekt -> Board-Markt-Form (identisch zu normalizeFfcPlayer).
// adpField ist das pro Format aufgeloeste Stat-Feld (siehe SLEEPER_ADP_FIELD).
// Sleeper liefert nur die ADP-Zahl — bye/stdev/high/low/times_drafted kennt die
// Quelle nicht und bleiben null (der Tip-Engine degradiert dafuer sauber).
export function normalizeSleeperAdpPlayer(raw, adpField = 'adp_ppr') {
  const p = raw?.player || {}
  const name = [p?.first_name, p?.last_name].filter(Boolean).join(' ')
  const rawAdp = Number(raw?.stats?.[adpField])
  const adp = Number.isFinite(rawAdp) && rawAdp < SLEEPER_ADP_SENTINEL ? rawAdp : null
  return {
    name,
    nname: normalizePlayerName(name),
    pos: normalizeFfcPos(p?.position),
    team: p?.team || '',
    adp,
    adp_formatted: null,
    bye: null,
    stdev: null,
    high: null,
    low: null,
    times_drafted: null,
  }
}

// ---------- Sleeper Wochen-Projektionen (Pkt-Spalte im Redraft) ----------
// Bulk-Endpoint mit {season}/{week}-Pfad (live verifiziert 2026-09-08): ein
// Request liefert alle Skill-Positionen + DEF inkl. vorberechneter Punkte
// (pts_ppr/half/std, RotoWire-Basis). Schluessel ist die native Sleeper-ID
// (numerisch bzw. Teamkuerzel bei DEF) -- kein Name-Matching noetig.
const SLEEPER_WEEK_POSITIONS = ['QB', 'RB', 'WR', 'TE', 'DEF']

export function sleeperWeekProjectionsUrl(season, week) {
  const positions = SLEEPER_WEEK_POSITIONS.map((p) => `position%5B%5D=${p}`).join('&')
  return `https://api.sleeper.com/projections/nfl/${season}/${week}?season_type=regular&${positions}`
}

export function normalizeSleeperWeekPlayer(raw) {
  const p = raw?.player || {}
  return {
    sleeper_id: String(raw?.player_id ?? ''),
    pos: normalizeFfcPos(p?.fantasy_positions?.[0] || p?.position),
    team: raw?.team || p?.team || '',
    opponent: raw?.opponent || null,
    pts_ppr: toFiniteOrNull(raw?.stats?.pts_ppr),
    pts_half_ppr: toFiniteOrNull(raw?.stats?.pts_half_ppr),
    pts_std: toFiniteOrNull(raw?.stats?.pts_std),
  }
}


// ---------- FantasyPros Consensus-Rankings (Redraft, gescraped) ----------
// Der oeffentliche API-Key ist auf 10 Spieler/Position limitiert. Die
// Cheatsheet-Seiten betten dagegen die vollstaendige Rangliste als
// `var ecrData = {...}` ein — dieselbe Struktur, nur ungekuerzt. Wir ziehen
// diesen Blob heraus (wie der KTC-Scraper das HTML parst).

// App-Scoring -> Cheatsheet-Seite. std = Standard, half = Half-PPR, ppr = PPR.
export const FP_SCORING_URLS = {
  ppr: 'https://www.fantasypros.com/nfl/rankings/ppr-cheatsheets.php',
  half: 'https://www.fantasypros.com/nfl/rankings/half-point-ppr-cheatsheets.php',
  std: 'https://www.fantasypros.com/nfl/rankings/consensus-cheatsheets.php',
}

// Whitelist: nur Offensive + K/DST landen im Redraft-Board. Die Half-PPR-Seite
// liefert z. B. auch IDP-Positionen (LB/DB/DL) — die gehoeren nicht ins Board.
export const FP_POSITIONS = ['QB', 'RB', 'WR', 'TE', 'K', 'DST']

// ---------- FantasyPros Weekly + ROS je Position (Waiver-Wire) ----------
// Sleeper/App-Konvention ist "DEF", FantasyPros nennt dieselbe Position "DST".
const FP_POS_SLUG = { QB: 'qb', RB: 'rb', WR: 'wr', TE: 'te', DEF: 'dst' }

// Nur RB/WR/TE haben eine Scoring-Variante (PPR/Half/Standard aendert ihren
// Punktwert). QB und DST/DEF sind scoring-unabhaengig -- fuer die gibt es auf
// FantasyPros keine ppr-/half-point-ppr-Praefix-Seiten.
const FP_SCORING_HAS_VARIANT = new Set(['RB', 'WR', 'TE'])
const FP_SCORING_PREFIX = { ppr: 'ppr-', half: 'half-point-ppr-', std: '' }

// scope: 'week' (aktuelle Woche) | 'ros' (Rest of Season). Live gegen
// fantasypros.com verifiziert (siehe Global Constraints im Plan) -- Muster:
// [ros-][ppr-|half-point-ppr-]<pos>.php
export function fantasyProsPositionUrl(pos, scope, scoring = 'ppr') {
  const slug = FP_POS_SLUG[String(pos).toUpperCase()]
  if (!slug) throw new Error(`Unbekannte Position fuer FantasyPros: ${pos}`)
  const scopePrefix = scope === 'ros' ? 'ros-' : ''
  const scoringPrefix = FP_SCORING_HAS_VARIANT.has(String(pos).toUpperCase())
    ? (FP_SCORING_PREFIX[scoring] ?? FP_SCORING_PREFIX.ppr)
    : ''
  return `https://www.fantasypros.com/nfl/rankings/${scopePrefix}${scoringPrefix}${slug}.php`
}

// Zieht ein eingebettetes JS-Objekt/-Array aus HTML (`var X = {...}` oder
// `var X = [...]`), gesucht ueber einen Text-Marker (meist der Variablenname).
// Balanced-Brace-Scan statt Regex: der Inhalt enthaelt verschachtelte {}/[]
// und Klammern in Strings, ein `.*?\}` wuerde zu frueh abbrechen. Gibt den
// geparsten Wert oder null.
export function extractEmbeddedJson(html, marker, open = '{', close = '}') {
  const text = String(html || '')
  const markerIdx = text.indexOf(marker)
  if (markerIdx === -1) return null
  const start = text.indexOf(open, markerIdx)
  if (start === -1) return null

  let depth = 0
  let inString = false
  let escaped = false
  for (let i = start; i < text.length; i++) {
    const c = text[i]
    if (inString) {
      if (escaped) escaped = false
      else if (c === '\\') escaped = true
      else if (c === '"') inString = false
      continue
    }
    if (c === '"') inString = true
    else if (c === open) depth++
    else if (c === close) {
      depth--
      if (depth === 0) {
        try {
          return JSON.parse(text.slice(start, i + 1))
        } catch {
          return null
        }
      }
    }
  }
  return null
}

export function extractEcrData(html) {
  return extractEmbeddedJson(html, 'ecrData', '{', '}')
}

// FantasyPros-Spieler -> Board-Rang-Form (identisch zu FantasyCalc/KTC).
// FantasyPros ist eine reine Rang-Quelle: ADP kommt spaeter per FFC-Overlay,
// Dynasty/Alter gibt es hier nicht.
export function normalizeFantasyProsPlayer(raw) {
  const name = raw?.player_name || ''
  const ecr = toFiniteOrNull(raw?.rank_ecr)
  const fantasyPts = toFiniteOrNull(raw?.fantasy_pts)
  return {
    rk: String(raw?.rank_ecr ?? ''),
    ecr,
    tier: raw?.tier ?? '',
    name,
    team: raw?.player_team_id || '',
    pos: raw?.player_position_id || '',
    posRank: raw?.pos_rank || '',
    bye: raw?.player_bye_week ?? '',
    sos: '',
    ecrVsAdp: '',
    adp: null,
    dynasty_value: null,
    redraft_value: null,
    age: null,
    years_exp: null,
    nname: normalizePlayerName(name),
    // Nur auf Weekly-Seiten vorhanden (nicht ROS/Cheatsheet) -- dort bleibt's null.
    fantasy_pts: fantasyPts,
    opponent: raw?.player_opponent || null,
    // Experten-Panel-Streuung: wie uneins sich FantasyPros' Analysten beim
    // Gesamtrang sind -- unabhaengig von der FFC-Mock-Draft-Streuung (die
    // reale Drafter-ADP misst statt Analysten-Meinung). Kommt als String an.
    rank_min: toFiniteOrNull(raw?.rank_min),
    rank_max: toFiniteOrNull(raw?.rank_max),
    rank_std: toFiniteOrNull(raw?.rank_std),
  }
}

// ---------- KTC Dynasty-Werte (gescraped) ----------
// KTCs Rankings-Seite rendert serverseitig nur die ersten 50 Zeilen
// (".single-ranking") und laedt den Rest per Infinite-Scroll nach -- ein
// reiner HTML-Scrape dieser Zeilen liefert also nur 50 von ~500 Spielern.
// Dieselbe Seite embedded aber ein vollstaendiges `playersArray` im
// <script>-Tag (analog zu FantasyPros' ecrData), mit getrennten One-QB-
// und Superflex-Werten pro Spieler -- das ist die verlaessliche Quelle.
// rookie=true liest die rookie-spezifischen Rang-Felder (rookieRank statt
// rank etc.) -- auf der Rookie-Seite zaehlt "Rang 1" der beste Rookie, nicht
// der beste Spieler ueberhaupt (den Unterschied macht KTC selbst als eigene
// Feldgruppe verfuegbar, kein separater Request noetig).
export function normalizeKtcPlayer(raw, { superflex = false, rookie = false } = {}) {
  const vals = superflex ? raw?.superflexValues : raw?.oneQBValues
  const rank = toFiniteOrNull(rookie ? vals?.rookieRank : vals?.rank)
  const posRankNum = rookie ? vals?.rookiePositionalRank : vals?.positionalRank
  const tierNum = rookie ? vals?.rookieTier : vals?.overallTier
  const name = raw?.playerName || ''
  return {
    id: raw?.playerID ?? null,
    rk: rank != null ? String(rank) : '',
    ecr: rank,
    tier: tierNum != null ? `Tier ${tierNum}` : '',
    name,
    team: raw?.team || '',
    pos: raw?.position || '',
    posRank: posRankNum != null ? `${raw?.position || ''}${posRankNum}` : '',
    bye: raw?.byeWeek != null ? String(raw.byeWeek) : '',
    sos: '',
    ecrVsAdp: '',
    adp: null,
    dynasty_value: toFiniteOrNull(vals?.value),
    redraft_value: null,
    age: toFiniteOrNull(raw?.age),
    years_exp: toFiniteOrNull(raw?.seasonsExperience),
    nname: normalizePlayerName(name),
  }
}
