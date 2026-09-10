// Stabile Board-Keys pro Liga/Profil und Modus.
// Liga-Drafts: `league:<league_id>:<mode>`; Standalone/Mock: `fp:<teams>:<scoring>:<0|1>:<starters>:<mode>`.
// Reine Funktion — kein Storage-Write (React.StrictMode-sicher).
import { isStandaloneDraft } from './draftFormat'
import { computeDetectedFingerprint } from './profileStore'

export function boardKeyFor({ league = null, draft = null, draftMode = 'redraft' } = {}) {
  const mode = draftMode === 'rookie' ? 'rookie' : 'redraft'
  if (league?.league_id && !isStandaloneDraft(draft)) return `league:${league.league_id}:${mode}`
  if (draft && !isStandaloneDraft(draft) && draft.draft_id && !league) return `draft:${draft.draft_id}:${mode}`
  const fp = computeDetectedFingerprint({ draft, league, draftMode: mode })
  const starters = Array.isArray(fp.starters) && fp.starters.length ? fp.starters.join('+') : 'nostarters'
  return `fp:${fp.teams}:${fp.scoringType}:${fp.superflex ? 1 : 0}:${starters}:${mode}`
}

// Board-Key aus der Profilaufloesung: ein bereits gespeichertes Profil
// (isNew === false mit echter id) bekommt den stabilen Key `profile:<id>` —
// alle Ligen/Mocks mit diesem Profil teilen sich damit ein Board. Ein noch
// nicht gespeichertes Profil (isNew === true oder gar keine Aufloesung)
// teilt sich das Modus-Board `mode:<redraft|rookie>` — neue Ligen haben damit
// sofort Rankings, ohne Re-Import. boardKeyFor bleibt als Fallback-Helper
// bestehen (Setup-Fallback-Key, alte Tests). Reine Funktion, kein Storage-Write.
export function boardKeyForContext({ league = null, draft = null, draftMode = 'redraft', resolved = null } = {}) {
  const profile = resolved?.profile
  if (resolved?.isNew === false && profile?.id) return `profile:${profile.id}`
  const mode = draftMode === 'rookie' ? 'rookie' : 'redraft'
  return `mode:${mode}`
}
