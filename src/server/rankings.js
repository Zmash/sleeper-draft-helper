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
