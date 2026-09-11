// Saison-Simulation: reine Mathematik, kein Store-, kein Netzwerk-Zugriff.
// Alle IDs sind Strings (roster_id als String, vgl. useDynastyStore rMap).
// ELO_SCALE kalibriert (war 400/Schach-Skala — machte alle Teams zu 50:50,
// live-Befund: alle W-L bei 7,0): ~12 Punkte Projektions-Differenz (typische
// Kader-Spanne) entsprechen jetzt ~65:35-Favorit.
export const ELO_SCALE = 45
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

// ELO-Erwartung: p = 1 / (1 + 10^(-delta/ELO_SCALE)). delta in projizierten Punkten.
export function winProbability(delta) {
  const d = Number(delta)
  if (!Number.isFinite(d)) return 0.5
  return 1 / (1 + Math.pow(10, -d / ELO_SCALE))
}

// Standard-Single-Elim-Freilose: Auffuellen auf die naechste Zweierpotenz.
// 6 Teams -> 2 Byes, 8 -> 0, 10 -> 2, 12 -> 4, 4 -> 0 (Sleeper-Standard).
export function byeCountFor(cutLength) {
  const n = Math.max(0, Number(cutLength) || 0)
  if (n < 2) return 0
  return n - 2 ** Math.floor(Math.log2(n))
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
// Freilose nach byeCountFor (6 Teams -> Top-2-Seeds).
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
  const byeSeeds = cut.slice(0, byeCountFor(cut.length))
  // Rest ist per Konstruktion eine Zweierpotenz (byeCountFor fuellt auf) —
  // kein Auffuell-Hack mehr noetig.
  const round = cut.slice(byeSeeds.length)
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
// byePct: Team unter den ersten byeCountFor(seeds.length) Seeds.
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
    const byeCount = byeCountFor(seeds.length)
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
