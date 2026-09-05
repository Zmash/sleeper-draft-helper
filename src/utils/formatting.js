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
    .replace(/[‘’']/g, '')
    .toLowerCase()
    .replace(/(ii|iii|iv|v)\.?/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
