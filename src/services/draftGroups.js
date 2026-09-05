// Drafts fuer die Auswahl aufbereiten: Liga-Drafts vor Mocks, laufende zuerst.
// Wird von der Desktop-Shell (Dropdown im Breadcrumb) und vom mobilen
// Schnellwechsel genutzt — damit beide dieselbe Reihenfolge und dieselben
// Beschriftungen zeigen.

export function leagueNameOf(leagues, leagueId) {
  return (leagues || []).find((l) => String(l.league_id) === String(leagueId))?.name || null
}

/** Beschriftung einer Draft-Zeile: Name, sonst Liga, sonst die ID. */
export function draftLabel(draft, leagues) {
  return draft?.metadata?.name || leagueNameOf(leagues, draft?.league_id) || `Draft ${draft?.draft_id}`
}

/** Zweite Zeile: Liga, Saison, Teams, Typ — was davon vorhanden ist. */
export function draftSubtitle(draft, leagues) {
  return [
    leagueNameOf(leagues, draft?.league_id),
    draft?.season,
    draft?.settings?.teams ? `${draft.settings.teams} Teams` : null,
    draft?.type,
  ].filter(Boolean).join(' · ')
}

/** @returns {Array<{title: string, items: Array}>} leere Gruppen entfallen */
export function groupDrafts(drafts) {
  const list = Array.isArray(drafts) ? drafts : []
  const running = (a, b) => (a.status === 'drafting' ? -1 : b.status === 'drafting' ? 1 : 0)
  return [
    { title: 'Liga-Drafts', items: list.filter((d) => d.league_id).slice().sort(running) },
    { title: 'Mock-Drafts', items: list.filter((d) => !d.league_id).slice().sort(running) },
  ].filter((g) => g.items.length)
}
