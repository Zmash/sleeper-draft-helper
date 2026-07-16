import { normalizePlayerName } from '../utils/formatting'

// Ein Board braucht zwei Meinungen: eine Rangliste (wen sollte man nehmen) und
// einen Markt (wen nehmen die anderen). Nur aus der Differenz entsteht Value.
// Rang + Tier: FantasyCalc. Markt (ADP/Bye/Streuung) + K/DEF: FFC.

const MARKET_FIELDS = ['adp', 'bye', 'stdev', 'high', 'low', 'times_drafted']

function marketIndex(ffcPlayers) {
  const m = new Map()
  for (const p of ffcPlayers || []) {
    const key = p?.nname || normalizePlayerName(p?.name || '')
    if (key) m.set(key, p)
  }
  return m
}

function marketFieldsOf(src) {
  const out = {}
  for (const f of MARKET_FIELDS) out[f] = src?.[f] ?? null
  return out
}

export function mergeRankingsWithMarket(fcPlayers, ffcPlayers) {
  const market = marketIndex(ffcPlayers)
  const used = new Set()
  const unmatchedNames = []

  const ranked = (fcPlayers || [])
    .slice()
    .sort((a, b) => Number(a.overallRank) - Number(b.overallRank))
    .map((p) => {
      const nname = normalizePlayerName(p.name || '')
      const hit = market.get(nname)
      if (hit) used.add(nname)
      else unmatchedNames.push(p.name)
      return {
        ...p,
        nname,
        tier: p.tier ?? null,
        sleeperId: p.sleeperId ?? null,
        ...marketFieldsOf(hit),
        status: null, pick_no: null, picked_by: null,
      }
    })

  // Union: was nur der Markt kennt (K, DEF, tiefe Namen), haengen wir nach ADP
  // sortiert hinten an. FantasyCalc kennt weder Kicker noch Defense — im
  // 16-Runden-Redraft draftet man beide.
  const tail = (ffcPlayers || [])
    .filter((p) => {
      const nname = p?.nname || normalizePlayerName(p?.name || '')
      return nname && !used.has(nname)
    })
    .sort((a, b) => Number(a.adp) - Number(b.adp))
    .map((p) => ({
      ...p,
      nname: p.nname || normalizePlayerName(p.name || ''),
      tier: null,
      sleeperId: null,
      ...marketFieldsOf(p),
      status: null, pick_no: null, picked_by: null,
    }))

  const players = [...ranked, ...tail].map((p, i) => ({ ...p, rk: String(i + 1), ecr: i + 1 }))
  const withAdp = players.filter((p) => p.adp != null).length

  return {
    players,
    stats: {
      total: players.length,
      withAdp,
      withoutAdp: players.length - withAdp,
      unmatchedNames,
    },
  }
}

// Nicht-destruktiv: legt ausschliesslich Marktfelder ueber ein bestehendes Board.
// Fasst rk, Reihenfolge, Pick-Status und Praeferenzen nicht an — der Nutzer
// pflegt sein Board ueber Wochen, das darf ein Markt-Refresh nicht wegwerfen.
export function overlayMarketData(boardPlayers, ffcPlayers) {
  const market = marketIndex(ffcPlayers)
  let withAdp = 0
  const unmatchedNames = []

  const players = (boardPlayers || []).map((p) => {
    const nname = p?.nname || normalizePlayerName(p?.name || '')
    const hit = market.get(nname)
    if (!hit) {
      if (p.adp == null) unmatchedNames.push(p.name)
      else withAdp++
      return p
    }
    withAdp++
    return { ...p, ...marketFieldsOf(hit) }
  })

  return {
    players,
    stats: { total: players.length, withAdp, withoutAdp: players.length - withAdp, unmatchedNames },
  }
}
