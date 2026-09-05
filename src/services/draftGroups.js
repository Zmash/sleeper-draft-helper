// Drafts fuer die Auswahl aufbereiten: Liga-Drafts vor Mocks, laufende zuerst.
// Wird von der Desktop-Shell (Dropdown im Breadcrumb) und vom mobilen
// Schnellwechsel genutzt — damit beide dieselbe Reihenfolge und dieselben
// Beschriftungen zeigen.

export function leagueNameOf(leagues, leagueId) {
  return (leagues || []).find((l) => String(l.league_id) === String(leagueId))?.name || null
}

/**
 * Beschriftung einer Draft-Zeile. Der selbstvergebene Kachel-Nickname geht
 * vor — wer eine Liga umbenannt hat, will sie ueberall unter diesem Namen
 * wiederfinden. Genau wie im Dashboard liegt er unter der league_id, bei
 * Mocks unter der draft_id (siehe LeagueCard/EditableTitle).
 */
export function draftLabel(draft, leagues, nicknames) {
  const nick = nicknames?.[draft?.league_id] || nicknames?.[draft?.draft_id]
  return nick || draft?.metadata?.name || leagueNameOf(leagues, draft?.league_id) || `Draft ${draft?.draft_id}`
}

/** Zweite Zeile: Liga, Saison, Teams, Typ — was davon vorhanden ist. */
export function draftSubtitle(draft, leagues, nicknames) {
  const nick = nicknames?.[draft?.league_id] || nicknames?.[draft?.draft_id]
  const real = leagueNameOf(leagues, draft?.league_id)
  return [
    // Bei gesetztem Nickname steht der echte Name hier — sonst waere er weg.
    nick ? real : (real === draftLabel(draft, leagues, nicknames) ? null : real),
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
