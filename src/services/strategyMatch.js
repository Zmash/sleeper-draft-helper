// Ordnet einem Mock-Draft das passende Format-Profil per Fingerprint zu.
// Liga-Bindung wird NICHT hier, sondern direkt in profileStore.resolveProfile
// aufgeloest (eindeutige league_id, kein Fuzzy-Matching noetig).

export function makeFingerprint({ format = {}, draftMode } = {}) {
  const roster = Array.isArray(format.rosterPositions) ? format.rosterPositions : []
  return {
    draftMode: String(draftMode || 'redraft'),
    scoringType: String(format.scoringType || 'ppr'),
    superflex: !!format.superflex,
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

function deviationsBetween(profileFp, fp) {
  const out = []
  if (profileFp.teams !== fp.teams) {
    out.push(`aus einer ${profileFp.teams}er-Liga, du draftest in einer ${fp.teams}er`)
  }
  if (!sameStarters(profileFp.starters, fp.starters)) {
    out.push(`andere Starter-Slots (${profileFp.starters.join(', ')})`)
  }
  return out
}

// profiles: alle Kandidaten, die NICHT liga-gebunden sind (Aufrufer filtert das).
// Harter Filter auf draftMode/scoringType/superflex, weiche Abweichungs-
// Bewertung auf teams/starters. Profile ohne fingerprint (migrierter Altbestand)
// gewinnen nur, wenn kein echter Treffer existiert.
export function pickProfile(profiles, fp) {
  if (!Array.isArray(profiles) || !profiles.length || !fp) return null

  const wildcards = profiles.filter(p => !p?.fingerprint)
  const matches = profiles.filter(p => {
    const f = p?.fingerprint
    if (!f) return false
    return f.draftMode === fp.draftMode
      && f.scoringType === fp.scoringType
      && !!f.superflex === !!fp.superflex
  })

  if (matches.length) {
    const scored = matches
      .map(profile => ({ profile, deviations: deviationsBetween(profile.fingerprint, fp) }))
      .sort((a, b) => {
        const d = a.deviations.length - b.deviations.length
        if (d !== 0) return d
        return String(b.profile.updatedAt || '').localeCompare(String(a.profile.updatedAt || ''))
      })
    return scored[0]
  }

  if (wildcards.length) {
    const newest = [...wildcards].sort(
      (a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''))
    )[0]
    return { profile: newest, deviations: [] }
  }

  return null
}

const MAX_STRATEGY_CHARS = 4000

// principles gelten global (profilübergreifend), strategy ist die Format-
// spezifische Leitlinie+Regeln des jeweiligen Profils. sources/contested
// gehen bewusst nicht in den Prompt-Text ein — nur Anzeige.
export function resolveStrategyText(principles, strategy) {
  const p = String(principles || '').trim()
  const summary = String(strategy?.summary || '').trim()
  const rules = Array.isArray(strategy?.rules) ? strategy.rules : []
  const parts = []
  if (p) parts.push(p)
  if (summary) parts.push(summary)
  if (rules.length) parts.push(rules.map(r => `- ${r}`).join('\n'))
  return parts.join('\n\n').slice(0, MAX_STRATEGY_CHARS)
}
