// Saison-Simulation: reine Mathematik, kein Store-, kein Netzwerk-Zugriff.
// Alle IDs sind Strings (roster_id als String, vgl. useDynastyStore rMap).
export const ELO_SCALE = 400
export const DEFAULT_SIMS = 10000
export const SIM_CHUNK = 1000

// Deterministischer RNG, damit Tests mit festem Seed reproduzierbar sind.
// Der Hook nutzt Date.now() als Seed, Tests eine feste Zahl.
export function mulberry32(seed) {
  let a = Number(seed) >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ELO-Erwartung: p = 1 / (1 + 10^(-delta/400)). delta in projizierten Punkten.
export function winProbability(delta) {
  const d = Number(delta)
  if (!Number.isFinite(d)) return 0.5
  return 1 / (1 + Math.pow(10, -d / ELO_SCALE))
}

// R1 Dynasty-Tiebreak (Rookie-Modus): bei < 0.5 Punkten Differenz entscheidet
// das hoehere Dynasty-Total mit p = 0.55. Sonst exakt die ELO-Formel.
export function matchWinProbability(delta, aTotal = null, bTotal = null) {
  const d = Number(delta)
  const a = Number(aTotal)
  const b = Number(bTotal)
  if (
    Number.isFinite(d) && Math.abs(d) < 0.5 &&
    Number.isFinite(a) && Number.isFinite(b) && a !== b
  ) {
    return a > b ? 0.55 : 0.45
  }
  return winProbability(d)
}

// effScoringType ('ppr'|'half_ppr'|'standard', vgl. draftFormat.js) ->
// Sleeper-Wochenprojektionsfeld (vgl. useWeeklyRankingsStore sleeperWeekById).
export function pointsFieldFor(scoringType) {
  if (scoringType === 'half_ppr') return 'pts_half_ppr'
  if (scoringType === 'standard') return 'pts_std'
  return 'pts_ppr'
}

// Genau EINE Saison: Regular Season aus schedule, danach Seeding nach Siegen
// (Tiebreak Rest-Staerke) und K.-o.-Baum, in dem jede Paarung probabilistisch
// mit der Last-Week-Staerke simuliert wird (keine wochen-spezifischen
// Projektionen im Baum -- V1-Vereinfachung, im Spec dokumentiert).
// Bye: ab 8 Playoff-Teams bekommen die Top-2-Seeds ein Freilos
// (haeufigstes Sleeper-Format).
export function simulateSeason({ strengthsByWeek, schedule, playoffTeams, seed, dynastyTotals = null }) {
  const rng = mulberry32(seed)
  const teams = Math.max(2, Number(playoffTeams) || 2)
  const wins = new Map()
  const strengthOf = (week, id) => {
    const w = strengthsByWeek?.get(week)
    const v = w?.get(String(id))
    return Number.isFinite(Number(v)) ? Number(v) : 0
  }
  const pFor = (week, a, b) => matchWinProbability(
    strengthOf(week, a) - strengthOf(week, b),
    dynastyTotals?.get(String(a)) ?? null,
    dynastyTotals?.get(String(b)) ?? null,
  )
  for (const g of schedule || []) {
    const a = String(g.a)
    const b = String(g.b)
    if (!wins.has(a)) wins.set(a, 0)
    if (!wins.has(b)) wins.set(b, 0)
    if (rng() < pFor(g.week, a, b)) wins.set(a, wins.get(a) + 1)
    else wins.set(b, wins.get(b) + 1)
  }
  const ids = [...wins.keys()]
  if (!ids.length) return { wins, champion: null, topSeeds: [] }
  const lastWeek = Math.max(...(schedule || []).map((g) => Number(g.week) || 0), 0)
  const ranked = [...ids].sort((x, y) => {
    const dw = wins.get(y) - wins.get(x)
    if (dw !== 0) return dw
    return strengthOf(lastWeek, y) - strengthOf(lastWeek, x)
  })
  const cut = ranked.slice(0, Math.min(teams, ranked.length))
  const byeCount = cut.length >= 8 ? 2 : 0
  const byeSeeds = cut.slice(0, byeCount)
  let round = cut.slice(byeCount)
  // Auf ungerade Runden auffuellen kann nicht passieren: cut ohne Byes ist
  // nur bei < 8 Teams ungerade moeglich (z.B. 6) -- dann bekommt Seed 1 das Freilos.
  if (round.length % 2 === 1) {
    byeSeeds.push(round.shift())
  }
  const playRound = (players) => {
    const winners = []
    for (let i = 0; i < players.length; i += 2) {
      const x = players[i]
      const y = players[i + 1]
      if (y == null) { winners.push(x); continue }
      winners.push(rng() < pFor(lastWeek, x, y) ? x : y)
    }
    return winners
  }
  let alive = [...byeSeeds, ...playRound(round)]
  while (alive.length > 1) alive = playRound(alive)
  return { wins, champion: alive[0] ?? null, topSeeds: cut }
}

// Zaehlt N Einzelsaisons zu Odds pro Team. playoffPct: Team unter den topSeeds;
// byePct: unter den ersten 2 bei >= 8 Teams, sonst unter erstem Seed bei Freilos.
export function aggregateOdds(results, { rosterIds, sims }) {
  const n = Math.max(1, Number(sims) || 1)
  const out = new Map()
  for (const id of rosterIds || []) {
    out.set(String(id), { winsAvg: 0, playoffPct: 0, byePct: 0, titlePct: 0 })
  }
  for (const r of results || []) {
    for (const [id, w] of r.wins || []) {
      const key = String(id)
      if (out.has(key)) out.get(key).winsAvg += Number(w) || 0
    }
    const seeds = (r.topSeeds || []).map(String)
    const byeCount = seeds.length >= 8 ? 2 : seeds.length % 2 === 1 ? 1 : 0
    for (const s of seeds) {
      if (out.has(s)) out.get(s).playoffPct += 100 / n
    }
    for (const s of seeds.slice(0, byeCount)) {
      if (out.has(s)) out.get(s).byePct += 100 / n
    }
    const champ = r.champion != null ? String(r.champion) : null
    if (champ && out.has(champ)) out.get(champ).titlePct += 100 / n
  }
  for (const v of out.values()) v.winsAvg /= n
  return out
}
