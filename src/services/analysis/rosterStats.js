// Kader-Statistiken: eigener Kader gegen das Liga-Feld.
//
// Zwei Betriebsarten. Fuehrt das Board dynasty_value, wird der Wert summiert.
// Sonst wird rein ueber Raenge verglichen -- bewusst OHNE eine Wertkurve ueber
// die Raenge zu legen, denn die waere eine Annahme, keine Quelle.
import { normalizePos, toFiniteOrNull } from '../../utils/formatting'
import { starterSlots } from './draftStats'

const SPLIT_POS = ['QB', 'RB', 'WR', 'TE']

export function median(numbers = []) {
  const list = numbers.filter((n) => Number.isFinite(n)).sort((a, b) => a - b)
  if (!list.length) return null
  const mid = Math.floor(list.length / 2)
  return list.length % 2 ? list[mid] : (list[mid - 1] + list[mid]) / 2
}

export function rosterValueSplit({
  leagueRosters = [], boardPlayers = [], rosterPositions = [], myRosterId = null,
}) {
  const byId = new Map()
  const byName = new Map()
  for (const bp of boardPlayers || []) {
    if (bp?.sleeper_id) byId.set(String(bp.sleeper_id), bp)
    if (bp?.nname) byName.set(bp.nname, bp)
  }
  // toFiniteOrNull, nicht Number(): sonst zaehlt dynasty_value: null als 0
  // und der Wertmodus wuerde auf einem Board ohne Werte anspringen.
  const hasValue = (boardPlayers || []).some((bp) => toFiniteOrNull(bp?.dynasty_value) !== null)
  const mode = hasValue ? 'value' : 'rank'

  let total = 0
  let matched = 0
  const perTeam = []

  for (const roster of leagueRosters || []) {
    const players = []
    for (const p of roster?.players || []) {
      total += 1
      // Erst ueber sleeper_id, hilfsweise ueber den normalisierten Namen: die
      // Board-sleeper_id ist bei den ersten ~250 Eintraegen kaputt (Zeilennummer
      // statt echter ID), der Name ist dort die einzige verlaessliche Bruecke.
      const bp = byId.get(String(p?.sleeper_id)) ?? (p?.nname ? byName.get(p.nname) : null)
      if (bp) { matched += 1; players.push(bp) }
    }
    perTeam.push({ rosterId: roster?.roster_id ?? null, players })
  }

  const positions = []
  for (const pos of SPLIT_POS) {
    const raw = starterSlots(pos, rosterPositions)
    if (raw === 0) continue
    const slots = Math.max(1, Math.round(raw))

    // Wertmodus: Summe der besten `slots` Spieler. Rangmodus: der Rang des
    // besten Spielers -- summierte Raenge waeren bedeutungslos.
    const scoreOf = (team) => {
      const atPos = team.players
        .filter((bp) => normalizePos(bp.pos) === pos
          && (mode === 'value' || toFiniteOrNull(bp.ecr) !== null))
        .sort((a, b) => mode === 'value'
          ? (toFiniteOrNull(b.dynasty_value) ?? 0) - (toFiniteOrNull(a.dynasty_value) ?? 0)
          : toFiniteOrNull(a.ecr) - toFiniteOrNull(b.ecr))
        .slice(0, slots)
      if (!atPos.length) return null
      return mode === 'value'
        ? atPos.reduce((s, bp) => s + (toFiniteOrNull(bp.dynasty_value) ?? 0), 0)
        : toFiniteOrNull(atPos[0].ecr)
    }

    const scores = perTeam.map(scoreOf).filter((v) => Number.isFinite(v))
    if (!scores.length) continue

    const me = perTeam.find((t) => String(t.rosterId) === String(myRosterId))
    const mineRaw = me ? scoreOf(me) : null
    const mine = Number.isFinite(mineRaw) ? mineRaw : null
    const med = median(scores)
    // Bei Raengen ist klein gut, deshalb dreht sich das Vorzeichen -- positiv
    // heisst in beiden Modi "besser als das Feld".
    const diff = (mine !== null && Number.isFinite(med))
      ? (mode === 'value' ? mine - med : med - mine)
      : null
    // Rang statt nur Abweichung vom Median: "+40 ueber Median" sagt nicht,
    // ob das Platz 2 oder Platz 6 von 12 ist. Im Wertmodus ist mehr besser
    // (hoehere Werte verdraengen mich nach hinten), im Rangmodus ist
    // weniger (kleinerer ECR) besser -- gleiche Umkehrung wie bei diff.
    const rank = mine !== null
      ? (mode === 'value'
          ? scores.filter((s) => s > mine).length + 1
          : scores.filter((s) => s < mine).length + 1)
      : null

    positions.push({ pos, mine, median: med, diff, rank, teamCount: scores.length })
  }

  return {
    mode,
    positions,
    coverage: total ? matched / total : 0,
    teamCount: perTeam.length,
    // Getrennt von coverage: 0/0 (Draft laeuft noch, Sleeper liefert leere Kader)
    // sieht sonst wie "0 % Deckung" aus -- das waere die falsche Diagnose.
    totalPlayers: total,
  }
}

function labelForRoster(rosterId, rosterToUserMap, ownerLabels) {
  const ownerId = rosterToUserMap?.[String(rosterId)]
  return ownerId ? (ownerLabels?.get?.(`user:${ownerId}`) || ownerId) : `Team ${rosterId ?? '?'}`
}

/**
 * Gesamt-Power-Ranking, ein Liga-Rang statt vier Einzelvergleiche.
 *
 * Wertmodus (Dynasty): Summe der Starter-Werte (beste `slots` Spieler je
 * Position) ueber alle Positionen -- ein echter, summierbarer Marktwert.
 *
 * Rangmodus (Redraft, kein dynasty_value): keine ECR-Werte aufsummieren --
 * das waere eine erfundene Wertkurve (derselbe Grundsatz wie in
 * rosterValueSplit, wo "summierte Raenge waeren bedeutungslos" steht).
 * Stattdessen: je Position werden alle Teams nach ihrem besten Spieler
 * geranked (1..teamCount, wie rosterValueSplit es schon pro Position tut),
 * und der Mittelwert dieser bereits vorhandenen Platzierungen ueber alle
 * Positionen ergibt den Gesamt-Rang -- eine Aggregation von Ordinalzahlen
 * auf derselben Skala, keine neue Annahme ueber Werte.
 */
export function teamPowerRanking({
  leagueRosters = [], boardPlayers = [], rosterPositions = [], myRosterId = null,
  rosterToUserMap = {}, ownerLabels = null,
}) {
  const byId = new Map()
  const byName = new Map()
  for (const bp of boardPlayers || []) {
    if (bp?.sleeper_id) byId.set(String(bp.sleeper_id), bp)
    if (bp?.nname) byName.set(bp.nname, bp)
  }
  const hasValue = (boardPlayers || []).some((bp) => toFiniteOrNull(bp?.dynasty_value) !== null)
  const mode = hasValue ? 'value' : 'rank'

  const slotsByPos = {}
  for (const pos of SPLIT_POS) {
    const raw = starterSlots(pos, rosterPositions)
    if (raw > 0) slotsByPos[pos] = Math.max(1, Math.round(raw))
  }
  if (!Object.keys(slotsByPos).length) return { available: false, mode, teams: [], myRank: null }

  // Deckungsgrad wie in rosterValueSplit: ohne ihn wuerde z.B. ein Rookie-
  // Only-Board (Rookie-Draft-Modus, ~50 Spieler) scheinbar plausible Werte
  // fuer alle Teams zeigen -- tatsaechlich aber nur, wie viele wertvolle
  // Rookies ein Team zufaellig besitzt, nicht die echte Kaderstaerke. Bug
  // gefunden beim Testen mit echten Daten (Zmash / Dynasty League Bochum):
  // Power-Ranking wirkte vollstaendig befuellt, obwohl nur 14% der Kader
  // ueberhaupt im Board standen.
  let totalPlayers = 0
  let matchedPlayers = 0
  const teamsRaw = (leagueRosters || []).map((roster) => {
    const players = []
    for (const p of roster?.players || []) {
      totalPlayers += 1
      const bp = byId.get(String(p?.sleeper_id)) ?? (p?.nname ? byName.get(p.nname) : null)
      if (bp) { matchedPlayers += 1; players.push(bp) }
    }
    return { rosterId: roster?.roster_id ?? null, players }
  })
  const coverage = totalPlayers ? matchedPlayers / totalPlayers : 0
  if (!teamsRaw.length) return { available: false, mode, teams: [], myRank: null, coverage, reason: 'no-rosters' }
  if (coverage < 0.5) return { available: false, mode, teams: [], myRank: null, coverage, reason: 'low-coverage' }

  let teams
  if (mode === 'value') {
    teams = teamsRaw.map((team) => {
      let total = 0
      for (const [pos, slots] of Object.entries(slotsByPos)) {
        total += team.players
          .filter((bp) => normalizePos(bp.pos) === pos)
          .sort((a, b) => (toFiniteOrNull(b.dynasty_value) ?? 0) - (toFiniteOrNull(a.dynasty_value) ?? 0))
          .slice(0, slots)
          .reduce((s, bp) => s + (toFiniteOrNull(bp.dynasty_value) ?? 0), 0)
      }
      return { rosterId: team.rosterId, label: labelForRoster(team.rosterId, rosterToUserMap, ownerLabels), metric: total }
    })
    teams.sort((a, b) => b.metric - a.metric) // hoeherer Wert ist besser
  } else {
    const posRanks = {} // pos -> Map(rosterId -> Platz 1..N)
    for (const [pos, slots] of Object.entries(slotsByPos)) {
      const scoreOf = (team) => {
        const atPos = team.players
          .filter((bp) => normalizePos(bp.pos) === pos && toFiniteOrNull(bp.ecr) !== null)
          .sort((a, b) => toFiniteOrNull(a.ecr) - toFiniteOrNull(b.ecr))
          .slice(0, slots)
        return atPos.length ? toFiniteOrNull(atPos[0].ecr) : null
      }
      const scored = teamsRaw
        .map((t) => ({ rosterId: t.rosterId, score: scoreOf(t) }))
        .filter((x) => Number.isFinite(x.score))
      if (scored.length < 2) continue // ein einzelnes Team zu "ranken" sagt nichts aus
      scored.sort((a, b) => a.score - b.score)
      const m = new Map()
      scored.forEach((x, i) => m.set(String(x.rosterId), i + 1))
      posRanks[pos] = m
    }

    teams = teamsRaw
      .map((team) => {
        const ranks = Object.values(posRanks)
          .map((m) => m.get(String(team.rosterId)))
          .filter((r) => r != null)
        if (!ranks.length) return null
        const avg = ranks.reduce((s, r) => s + r, 0) / ranks.length
        return {
          rosterId: team.rosterId,
          label: labelForRoster(team.rosterId, rosterToUserMap, ownerLabels),
          metric: avg,
          positionsCounted: ranks.length,
        }
      })
      .filter(Boolean)
    teams.sort((a, b) => a.metric - b.metric) // kleinerer Rang-Schnitt ist besser
  }

  if (!teams.length) return { available: false, mode, teams: [], myRank: null, coverage, reason: 'insufficient-teams' }

  const myIndex = myRosterId != null ? teams.findIndex((t) => String(t.rosterId) === String(myRosterId)) : -1

  return {
    available: true,
    mode,
    teams,
    coverage,
    myRank: myIndex >= 0 ? myIndex + 1 : null,
    myMetric: myIndex >= 0 ? teams[myIndex].metric : null,
  }
}

/**
 * Alters-Profil je Position: mein Team-Durchschnittsalter gegen den
 * Liga-Median. Bewusst ohne Wertung (juenger ist kein "besser", nur ein
 * Rebuild- vs. Win-Now-Signal) -- keine good/bad-Faerbung wie beim Wert.
 */
export function ageProfile({ leagueRosters = [], rosterPositions = [], myRosterId = null }) {
  const perTeam = (leagueRosters || []).map((r) => ({
    rosterId: r?.roster_id ?? null,
    players: r?.players || [],
  }))

  const positions = []
  for (const pos of SPLIT_POS) {
    if (starterSlots(pos, rosterPositions) === 0) continue

    const avgAgeOf = (team) => {
      const ages = team.players
        .filter((p) => normalizePos(p.pos) === pos && Number.isFinite(p.age))
        .map((p) => p.age)
      return ages.length ? ages.reduce((s, a) => s + a, 0) / ages.length : null
    }

    const teamAges = perTeam.map(avgAgeOf)
    const validAges = teamAges.filter((a) => Number.isFinite(a))
    if (!validAges.length) continue

    const myIndex = myRosterId != null ? perTeam.findIndex((t) => String(t.rosterId) === String(myRosterId)) : -1
    const mine = myIndex >= 0 ? teamAges[myIndex] : null
    const leagueMedian = median(validAges)
    const diff = (Number.isFinite(mine) && Number.isFinite(leagueMedian)) ? mine - leagueMedian : null

    positions.push({ pos, mine: Number.isFinite(mine) ? mine : null, leagueMedian, diff })
  }

  return { positions, teamCount: perTeam.length }
}

const ROSTER_SLOTS = ['starter', 'bench', 'taxi', 'ir']

/**
 * Starter vs. Bank/Taxi/IR im eigenen Kader.
 *
 * Wertmodus (Dynasty): Summe des Dynasty-Werts je Kategorie -- zeigt
 * versteckte Tiefe (wertvolle Bank) oder eine duenne Startelf ohne
 * Rueckhalt.
 *
 * Rangmodus (Redraft): kein Wert zum Summieren vorhanden, also kein Anteil
 * in Prozent (das waere wieder eine erfundene Kurve). Stattdessen der
 * Mittelwert des Experten-Rangs je Kategorie -- kleiner ist besser. Ein
 * grosser Abstand zwischen Bank- und Starter-Schnitt heisst duenne Bank,
 * ein kleiner oder gar negativer Abstand heisst es sitzt noch Qualitaet
 * auf der Bank (oder schlimmer: ein Startplatz ist falsch besetzt).
 */
export function starterVsBenchSplit({ dynastyRoster = [], boardPlayers = [] }) {
  const byId = new Map()
  const byName = new Map()
  for (const bp of boardPlayers || []) {
    if (bp?.sleeper_id) byId.set(String(bp.sleeper_id), bp)
    if (bp?.nname) byName.set(bp.nname, bp)
  }
  const hasValue = (boardPlayers || []).some((bp) => toFiniteOrNull(bp?.dynasty_value) !== null)
  const mode = hasValue ? 'value' : 'rank'

  const matched = []
  for (const p of dynastyRoster || []) {
    const bp = byId.get(String(p?.sleeper_id)) ?? (p?.nname ? byName.get(p.nname) : null)
    if (!bp) continue
    const metric = mode === 'value' ? toFiniteOrNull(bp.dynasty_value) : toFiniteOrNull(bp.ecr)
    if (metric === null) continue
    const slot = ROSTER_SLOTS.includes(p.slot) ? p.slot : 'bench'
    matched.push({ slot, metric })
  }
  // Deckungsgrad wie in rosterValueSplit/teamPowerRanking: bei einem Rookie-
  // Only-Board matchen nur die paar Rookies im eigenen Kader -- Starter- und
  // Bank-Schnitt daraus waeren mit z.B. 2 von 15 Spielern statistisch
  // bedeutungslos, saehen aber wie ein vollstaendiges Ergebnis aus.
  const coverage = dynastyRoster?.length ? matched.length / dynastyRoster.length : 0
  if (!matched.length) return { available: false, mode, coverage, reason: 'no-match' }
  if (coverage < 0.5) return { available: false, mode, coverage, reason: 'low-coverage' }

  const count = { starter: 0, bench: 0, taxi: 0, ir: 0 }

  if (mode === 'value') {
    const value = { starter: 0, bench: 0, taxi: 0, ir: 0 }
    for (const p of matched) { value[p.slot] += p.metric; count[p.slot] += 1 }
    const total = value.starter + value.bench + value.taxi + value.ir
    return {
      available: true, mode, matched: matched.length, coverage, total, value, count,
      starterShare: total > 0 ? value.starter / total : null,
    }
  }

  // Rangmodus: Durchschnitts-ECR je Kategorie, keine Summe (siehe
  // rosterValueSplit: summierte Raenge waeren bedeutungslos).
  const sums = { starter: 0, bench: 0, taxi: 0, ir: 0 }
  for (const p of matched) { sums[p.slot] += p.metric; count[p.slot] += 1 }
  const avgRank = {}
  for (const slot of ROSTER_SLOTS) avgRank[slot] = count[slot] > 0 ? sums[slot] / count[slot] : null

  return { available: true, mode, matched: matched.length, coverage, avgRank, count }
}
