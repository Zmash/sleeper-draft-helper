// Gemeinsame Normalisierung fuer index.js (dev) und prod.js (prod).
// Die beiden Server-Dateien sind Near-Duplikate; alles, was hier liegt,
// kann nicht auseinanderlaufen.

// Der Merge matcht Server-Daten gegen Board-Daten ueber genau diesen Schluessel.
// Deshalb wird die Client-Funktion IMPORTIERT und nicht nachgebaut: eine zweite
// Implementierung wuerde frueher oder spaeter abweichen, und dann matcht nichts
// mehr. formatting.js ist abhaengigkeitsfrei und laedt unter node.
import { normalizePlayerName } from '../utils/formatting.js'

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

// Zieht das `ecrData`-Objekt aus dem HTML. Balanced-Brace-Scan statt Regex:
// das Objekt enthaelt verschachtelte {} und geschweifte Klammern in Strings,
// ein `.*?\}` wuerde zu frueh abbrechen. Gibt das geparste Objekt oder null.
export function extractEcrData(html) {
  const text = String(html || '')
  const marker = text.indexOf('ecrData')
  if (marker === -1) return null
  const start = text.indexOf('{', marker)
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
    else if (c === '{') depth++
    else if (c === '}') {
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

// FantasyPros-Spieler -> Board-Rang-Form (identisch zu FantasyCalc/KTC).
// FantasyPros ist eine reine Rang-Quelle: ADP kommt spaeter per FFC-Overlay,
// Dynasty/Alter gibt es hier nicht.
export function normalizeFantasyProsPlayer(raw) {
  const name = raw?.player_name || ''
  const ecr = Number(raw?.rank_ecr)
  return {
    rk: String(raw?.rank_ecr ?? ''),
    ecr: Number.isFinite(ecr) ? ecr : null,
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
  }
}
