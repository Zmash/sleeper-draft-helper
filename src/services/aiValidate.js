// Kein AI-Output erreicht ungeprueft die UI. Ein einziger halluzinierter Name,
// der gerendert wird, zerstoert das Vertrauen in das ganze Feature — deshalb
// wird aussortiert UND sichtbar gewarnt, nie still repariert.
import { normalizePlayerName } from '../utils/formatting'
import { stripSuffix } from './tradeValue'

const norm = (s) => normalizePlayerName(String(s || ''))

export function validateAdvice(parsed, availableNnames) {
  const warnings = []
  if (!parsed || !parsed.primary) return { cleaned: null, warnings: ['Die AI-Antwort enthielt keine Empfehlung.'] }
  const ok = (n) => availableNnames.has(norm(n))
  const label = (p) => p?.player_display || p?.player_nname || '?'

  const alternatives = (parsed.alternatives || []).filter(a => {
    if (ok(a.player_nname)) return true
    warnings.push(`AI nannte „${label(a)}" — nicht (mehr) verfügbar, aussortiert.`)
    return false
  })

  let primary = parsed.primary
  if (!ok(primary.player_nname)) {
    const promoted = alternatives.shift() || null
    warnings.push(promoted
      ? `Empfehlung „${label(primary)}" war nicht verfügbar — „${label(promoted)}" nachgerückt.`
      : `Empfehlung „${label(primary)}" war nicht verfügbar.`)
    primary = promoted
  }
  if (!primary) {
    return { cleaned: null, warnings: [...warnings, 'Keine der genannten Optionen ist auf dem Board verfügbar.'] }
  }

  const known = new Set([primary.player_nname, ...alternatives.map(a => a.player_nname)].map(norm))
  const survival = (parsed.survival || []).filter(s => known.has(norm(s.player_nname)))

  const plan_next_picks = (parsed.plan_next_picks || []).map(p => ({
    ...p,
    candidate_nnames: (p.candidate_nnames || []).filter(n => {
      if (ok(n)) return true
      warnings.push(`AI nannte „${n}" im Plan — nicht (mehr) verfügbar, aussortiert.`)
      return false
    }),
  }))

  return { cleaned: { ...parsed, primary, alternatives, survival, plan_next_picks }, warnings }
}

function matchAsset(assetStr, assets) {
  const s = String(assetStr || '').trim()
  if (!s) return null
  for (const pk of assets?.picks || []) {
    if (pk.label && pk.label.toLowerCase() === s.toLowerCase()) return { value: pk.dynasty_value || 0 }
  }
  // Fuehrendes Positions-Kuerzel ("RB Bijan Robinson") tolerieren
  const bare = s.replace(/^(QB|RB|WR|TE|K|DEF)\s+/i, '')
  const n = norm(bare)
  for (const pl of assets?.players || []) {
    const pn = pl.nname || norm(pl.name)
    if (pn === n || stripSuffix(pn) === stripSuffix(n)) return { value: pl.dynasty_value || 0 }
  }
  return null
}

export function validateTradeSuggestions(parsed, { myAssets, opponentAssetsByName }) {
  const warnings = []
  if (!parsed) return { cleaned: null, warnings: ['Die AI-Antwort war leer.'] }

  const suggestions = []
  for (const s of parsed.suggestions || []) {
    const opp = opponentAssetsByName.get(String(s.opponent || '').toLowerCase())
    if (!opp) {
      warnings.push(`Vorschlag gegen „${s.opponent}" aussortiert — Team unbekannt.`)
      continue
    }
    let give = 0, get = 0, valid = true
    for (const item of s.you_give || []) {
      const m = matchAsset(item, myAssets)
      if (!m) { warnings.push(`Vorschlag aussortiert — „${item}" ist nicht auf deinem Roster.`); valid = false; break }
      give += m.value
    }
    if (valid) for (const item of s.you_get || []) {
      const m = matchAsset(item, opp)
      if (!m) { warnings.push(`Vorschlag aussortiert — „${item}" ist nicht auf dem Roster von ${s.opponent}.`); valid = false; break }
      get += m.value
    }
    if (!valid) continue
    // Modell-Zahlen bewusst verwerfen: die Badges rechnen nur mit unseren Werten.
    suggestions.push({ ...s, value_you_give: give, value_you_get: get })
  }
  return { cleaned: { ...parsed, suggestions }, warnings }
}
