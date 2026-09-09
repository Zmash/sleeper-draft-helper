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
