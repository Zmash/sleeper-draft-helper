export const cx = (...classes) => classes.filter(Boolean).join(' ')

export const normalizePlayerName = (name) =>
  (name || '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .replace(/\b(jr|sr|iii|ii|iv)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()

export const normalizePos = (p = '') =>
  String(p || '')
    .toUpperCase()
    .replace(/\d+/g, '')
    .replace('D/ST', 'DEF')
    .replace('DST', 'DEF')
    .trim()

/**
 * Zahl oder null. Bewusst NICHT Number() allein: Number(null) und Number('')
 * sind 0 und damit endlich -- ein fehlender Wert wuerde als gueltige Null
 * durchgehen und z.B. als bester Rang gelten.
 */
export const toFiniteOrNull = (v) => {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/**
 * Slug fuer FantasyPros-URLs (/nfl/players/<slug>.php, /nfl/news/<slug>.php).
 *
 * Gepruefte Eigenheit: "Jr."/"Sr." gehoeren in den Slug, roemische Ziffern
 * nicht. marvin-harrison-jr ist der Sohn, marvin-harrison der Vater — das
 * Suffix wegzuwerfen liefert also den falschen Spieler. Umgekehrt gibt es
 * kenneth-walker-iii nicht, nur kenneth-walker.
 */
export const fantasyProsSlug = (name) =>
  String(name || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[''']/g, '')
    .toLowerCase()
    .replace(/(ii|iii|iv|v)\.?/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

/** Positionsfarbe als CSS-var mit Rueckfall, fuer inline styles. */
export const posColor = (pos) => `var(--pos-${String(pos || '').toLowerCase()}, #666)`

/** Zahl mit sichtbarem Vorzeichen, gerundet. 0 bleibt "0". */
export const signed = (n) => {
  const v = Math.round(Number(n) || 0)
  return v > 0 ? `+${v}` : String(v)
}
