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

