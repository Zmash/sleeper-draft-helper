// Ligaübergreifende Lineup-Warnlogik (rein, gut testbar).
// Eine Zeile = ein Spieler in einer Liga mit Aufgestellt-Status.

const UNAVAILABLE = new Set(['Out', 'IR', 'PUP', 'Sus', 'NA', 'DNR'])

const POS_ORDER = ['QB', 'SUPER_FLEX', 'RB', 'WR', 'TE', 'FLEX', 'REC_FLEX', 'WRRB_FLEX', 'DEF', 'K']
const posRank = (pos) => {
  const i = POS_ORDER.indexOf(String(pos || '').toUpperCase())
  return i === -1 ? 99 : i
}

function severityFor({ player, isStarter, week, recommendedSet, lockedSet, irToMoveSet, irReturningSet, dropCandidateSet, irOverflow }) {
  const reasons = []
  const id = String(player?.sleeper_id ?? player?.player_id ?? '')
  const isRecommended = recommendedSet.has(id)
  // Bereits gespielte Starter (Spiel laeuft/ist vorbei) sind fuer diese Woche
  // ohnehin nicht mehr aenderbar -- "out"/"suboptimal" waeren hier ein
  // falscher Alarm (Nutzer-Befund: Push-Hinweis "X ist out", obwohl X das
  // Spiel schon gespielt hatte, bevor er sich verletzte).
  const isLocked = lockedSet?.has(id) ?? false
  if (isStarter) {
    if (week != null && String(player?.bye ?? '') !== '' && String(player?.bye) === String(week)) reasons.push('bye')
    if (!isLocked && UNAVAILABLE.has(player?.injury_status)) reasons.push('out')
    if (!isLocked && !isRecommended) reasons.push('suboptimal')
  } else if (isRecommended) {
    reasons.push('better-on-bench')
  }
  // IR-Verwaltung: unabhaengig von Starter/Bank -- ein Spieler kann auf der
  // Bank sitzen und trotzdem IR-faehig sein, oder auf IR liegen und trotzdem
  // wieder gesund sein (dann ist er nie "Starter" im obigen Sinn).
  if (irToMoveSet?.has(id)) reasons.push('ir-open')
  if (irReturningSet?.has(id)) reasons.push('ir-return')
  if (dropCandidateSet?.has(id)) reasons.push('drop-candidate')
  let severity = 'green'
  if (reasons.includes('bye') || reasons.includes('out')) severity = 'red'
  // Ruecckehr ohne freien Platz ist der einzige IR-Fall mit echtem
  // Handlungsdruck (die Aufstellung wird sonst regelwidrig) -- rot statt gelb.
  else if (reasons.includes('ir-return') && irOverflow) severity = 'red'
  else if (reasons.length > 0) severity = 'yellow'
  // Fragliche Spieler (Q) aufgestellt: gelb, auch wenn empfohlen.
  if (isStarter && severity === 'green' && ['Questionable', 'Q'].includes(player?.injury_status)) {
    severity = 'yellow'
    reasons.push('questionable')
  }
  return { severity, reasons, isRecommended }
}

export function buildAllTeamsRows({ teams = [] } = {}) {
  const rows = []
  for (const t of teams) {
    const actual = new Set((t.actualStarterIds || []).map(String))
    const recommended = new Set((t.recommendedStarterIds || []).map(String))
    const locked = new Set((t.lockedStarterIds || []).map(String))
    const irToMove = new Set((t.irToMoveIds || []).map(String))
    const irReturning = new Set((t.irReturningIds || []).map(String))
    const dropCandidates = new Set((t.dropCandidateIds || []).map(String))
    for (const p of t.roster || []) {
      const id = String(p.sleeper_id ?? p.player_id ?? '')
      const isStarter = actual.has(id)
      const { severity, reasons, isRecommended } = severityFor({
        player: p, isStarter, week: t.week, recommendedSet: recommended, lockedSet: locked,
        irToMoveSet: irToMove, irReturningSet: irReturning, dropCandidateSet: dropCandidates,
        irOverflow: !!t.irOverflow,
      })
      rows.push({
        leagueId: t.leagueId,
        leagueName: t.leagueName || t.leagueId || 'Liga',
        player: p,
        isStarter,
        isRecommended,
        severity,
        reasons,
      })
    }
  }
  return rows
}

export function sortAllTeamsRows(rows = []) {
  const sevRank = { red: 0, yellow: 1, green: 2 }
  return [...rows].sort(
    (a, b) =>
      (sevRank[a.severity] ?? 9) - (sevRank[b.severity] ?? 9) ||
      posRank(a.player?.pos) - posRank(b.player?.pos) ||
      String(a.leagueName || '').localeCompare(String(b.leagueName || '')) ||
      String(a.player?.name || '').localeCompare(String(b.player?.name || ''))
  )
}

export function countBySeverity(rows = []) {
  const counts = { red: 0, yellow: 0, green: 0, total: rows.length }
  for (const r of rows) {
    if (r.severity in counts) counts[r.severity] += 1
  }
  return counts
}
