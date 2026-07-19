import { normalizePlayerName } from '../utils/formatting'

// Ein Board braucht zwei Meinungen: eine Rangliste (wen sollte man nehmen) und
// einen Markt (wen nehmen die anderen). Nur aus der Differenz entsteht Value.
// Rang + Tier: FantasyCalc/FantasyPros. Markt (ADP/Streuung) + K/DEF: Sleeper/FFC.

const MARKET_FIELDS = ['adp', 'bye', 'stdev', 'high', 'low', 'times_drafted']

function marketIndex(ffcPlayers) {
  const m = new Map()
  for (const p of ffcPlayers || []) {
    const key = p?.nname || normalizePlayerName(p?.name || '')
    if (key) m.set(key, p)
  }
  return m
}

// Markt-Felder ueber einen Basis-Spieler legen: der Markt gewinnt pro Feld, aber
// wo er nichts liefert (null/undefined), bleibt der Wert der Rang-Quelle stehen.
// "Aus allen Quellen das Beste nehmen." Konkret: die Bye aus dem FantasyPros-
// Cheatsheet ueberlebt einen Sleeper-ADP-Merge, der selbst keine Bye kennt —
// ein hartes ueberschreiben wuerde sie sonst wegnullen.
function mergeMarketFields(base, hit) {
  const out = {}
  for (const f of MARKET_FIELDS) out[f] = hit?.[f] ?? base?.[f] ?? null
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
        ...mergeMarketFields(p, hit),
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
      ...mergeMarketFields(p, p),
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
  const unmatchedNames = []

  const players = (boardPlayers || []).map((p) => {
    const nname = p?.nname || normalizePlayerName(p?.name || '')
    const hit = market.get(nname)
    if (!hit) return p
    // Coalescing: neue Marktwerte gewinnen, aber ein bestehendes Feld (z. B. Bye
    // aus dem letzten Import) wird nicht weggenullt, wenn der neue Markt es nicht kennt.
    return { ...p, ...mergeMarketFields(p, hit) }
  })

  // Ein Markt-TREFFER ist kein Beleg fuer ADP -- der Treffer selbst kann adp: null
  // tragen (Union-Tail-Spieler ohne eigene ADP-Zahl). Wie mergeRankingsWithMarket
  // zaehlt withAdp nach dem Merge ueber das tatsaechliche Feld, nicht ueber "gab es
  // einen Treffer".
  const withAdp = players.filter((p) => p.adp != null).length
  for (const p of players) {
    if (p.adp == null) unmatchedNames.push(p.name)
  }

  return {
    players,
    stats: { total: players.length, withAdp, withoutAdp: players.length - withAdp, unmatchedNames },
  }
}

// Weder FantasyCalc noch FFC kennen Verletzungen. Sleeper schon — und seit dem
// sleeperId-Durchreichen im Rankings-Endpoint haben wir den Schluessel dafuer.
export function enrichWithInjuries(boardPlayers, playersMeta = {}) {
  return (boardPlayers || []).map((p) => {
    const meta = p?.sleeperId ? playersMeta[String(p.sleeperId)] : null
    return { ...p, injury_status: meta?.injury_status ?? p.injury_status ?? null }
  })
}
