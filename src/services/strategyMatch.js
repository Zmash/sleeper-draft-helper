// Ordnet einer Liga/einem Draft die passende gespeicherte Draft-Strategie zu.
// Reine Funktionen ohne React- oder Storage-Abhaengigkeit, damit testbar.

const MAX_STRATEGY_CHARS = 4000

// Rundenzahl und Draft-Typ (snake/auction) fehlen hier bewusst: sie aendern die
// Strategie kaum, wuerden aber laufend falsche Nicht-Treffer erzeugen.
export function makeFingerprint({ format = {}, season, draftMode } = {}) {
  const roster = Array.isArray(format.rosterPositions) ? format.rosterPositions : []
  return {
    draftMode: String(draftMode || 'redraft'),
    scoringType: String(format.scoringType || 'ppr'),
    // Normalisierung ist Pflicht: season kommt je nach Herkunft als Zahl oder
    // String, teams ebenso. Ohne sie scheitert der harte Filter still.
    superflex: !!format.superflex,
    season: String(season ?? ''),
    teams: Number(format.teams) || 0,
    starters: roster
      .map(s => String(s).toUpperCase())
      .filter(s => s !== 'BN')
      .sort(),
  }
}

function sameStarters(a = [], b = []) {
  return a.length === b.length && a.every((s, i) => s === b[i])
}

function deviationsBetween(itemFp, fp) {
  const out = []
  if (itemFp.teams !== fp.teams) {
    out.push(`aus einer ${itemFp.teams}er-Liga, du draftest in einer ${fp.teams}er`)
  }
  if (!sameStarters(itemFp.starters, fp.starters)) {
    out.push(`andere Starter-Slots (${itemFp.starters.join(', ')})`)
  }
  return out
}

export function pickStrategy(items, fp) {
  if (!Array.isArray(items) || !items.length || !fp) return null

  const wildcards = items.filter(i => !i?.fingerprint)
  const matches = items.filter(i => {
    const f = i?.fingerprint
    if (!f) return false
    return f.draftMode === fp.draftMode
      && f.scoringType === fp.scoringType
      && !!f.superflex === !!fp.superflex
      && String(f.season) === fp.season
  })

  if (matches.length) {
    const scored = matches
      .map(item => ({ item, deviations: deviationsBetween(item.fingerprint, fp) }))
      .sort((a, b) => {
        const d = a.deviations.length - b.deviations.length
        if (d !== 0) return d
        return String(b.item.createdAt || '').localeCompare(String(a.item.createdAt || ''))
      })
    return scored[0]
  }

  if (wildcards.length) {
    const newest = [...wildcards].sort(
      (a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
    )[0]
    return { item: newest, deviations: [] }
  }

  return null
}

// Nur dieser Text geht in den AI-Prompt. sources und contested bleiben draussen —
// sie sind fuer die Anzeige, nicht fuer das Modell.
export function resolveStrategyText(store, fp) {
  const principles = String(store?.principles || '').trim()
  const hit = pickStrategy(store?.items, fp)

  const parts = []
  if (principles) parts.push(principles)
  if (hit?.item) {
    const summary = String(hit.item.summary || '').trim()
    if (summary) parts.push(summary)
    const rules = Array.isArray(hit.item.rules) ? hit.item.rules : []
    if (rules.length) parts.push(rules.map(r => `- ${r}`).join('\n'))
  }

  return parts.join('\n\n').slice(0, MAX_STRATEGY_CHARS)
}
