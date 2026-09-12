import { normalizePlayerName } from '../../utils/formatting.js'

const WAIVER_POSITIONS = new Set(['QB', 'RB', 'WR', 'TE', 'DEF'])

// Sleeper und FantasyPros schreiben fast alle Team-Kuerzel gleich -- die
// Ausnahme ist Jacksonville: Sleeper "JAX", FantasyPros "JAC" (verifiziert
// 2026-09-08 am dst.php-Datenstrom). Ohne Alias wuerde die Jaguars-Defense
// per TEAM:-Key nie einen Wochen-/ROS-Rang finden und immer last fallen.
const TEAM_ALIAS = { JAX: 'JAC' }

// Sleeper stellt Team-Defenses als "Spieler" mit Team-Kuerzel als ID dar,
// FantasyPros identifiziert dieselbe Defense ueber player_team_id -- deshalb
// braucht DEF einen eigenen Match-Key (Team), waehrend alles andere ueber den
// normalisierten Namen gematcht wird (gleiche Konvention wie rosterStats.js).
export function matchKey(pos, { nname, name, team } = {}) {
  if (pos === 'DEF') {
    const t = String(team || '').toUpperCase()
    return `TEAM:${TEAM_ALIAS[t] || t}`
  }
  return `NAME:${nname || normalizePlayerName(name || '')}`
}

export function freeAgents({ playersMeta = {}, leagueRosters = [] }) {
  const rostered = new Set()
  for (const r of leagueRosters || []) {
    for (const p of r.players || []) rostered.add(String(p.sleeper_id))
  }
  const out = []
  for (const [id, meta] of Object.entries(playersMeta || {})) {
    if (rostered.has(String(id))) continue
    if (meta?.status && meta.status !== 'Active') continue
    // Sleepers "status" ist fuer laengst zurueckgetretene Spieler oft trotzdem
    // "Active" (verifiziert 2026-09-07: Tom Brady, Rob Gronkowski, Antonio
    // Brown -- alle status "Active", team null; ~73% aller "Active"-Spieler
    // in Skill-Positionen haben kein Team). team ist das verlaessliche Signal:
    // ohne aktuelles Team ist niemand ein claimbarer Free Agent.
    if (!meta?.team) continue
    const pos = (meta?.fantasy_positions?.[0] || meta?.position || '').toUpperCase()
    if (!WAIVER_POSITIONS.has(pos)) continue
    const name = meta.full_name || `${meta.first_name || ''} ${meta.last_name || ''}`.trim()
    out.push({
      player_id: id,
      name,
      nname: normalizePlayerName(name),
      pos,
      depth_chart_order: meta.depth_chart_order ?? null,
      team: meta.team || '',
      bye: meta.bye_week != null ? String(meta.bye_week) : '',
      injury_status: meta.injury_status || null,
    })
  }
  return out
}

// mode 'dynasty': dynastyValues (KTC, {nname, value}) -> hoechster Wert zuerst.
// mode 'redraft': rosRankByKey (Map von matchKey -> ECR-Zahl) -> niedrigster (bester) Rang zuerst.
// Spieler ohne Treffer in der Quelle sind KEINE sinnvollen Pickups: Retired/nie mehr
// spielende Spieler haben weder KTC-Wert noch ROS-Rang, Team-Defenses haben in Dynasty
// keinen KTC-Wert. Sie werden ausgeblendet statt unsortiert ans Ende gesetzt
// (verifiziert: "Ben Roethlisberger PIT" als Free Agent, DEF-Zeilen mit '–').
// Ausnahme (Fallback): ist die Wertquelle selbst leer (KTC-/FantasyPros-Fetch
// fehlgeschlagen), bleibt jeder Kandidat sichtbar -- sonst wuerde ein API-Hickup
// die Liste komplett leeren.
const MIN_DYNASTY_VALUES = 100

export function pickupRanking({
  freeAgents: agents = [], mode = 'redraft', dynastyValues = [], rosRankByKey = new Map(), trendingAddIds = new Set(),
} = {}) {
  const dynastyByName = new Map((dynastyValues || []).map((d) => [d.nname, d.value]))
  const withValue = agents.map((a) => {
    const key = matchKey(a.pos, a)
    const value = mode === 'dynasty' ? dynastyByName.get(a.nname) ?? null : rosRankByKey.get(key) ?? null
    return { ...a, value, trending: trendingAddIds.has(a.player_id) }
  })
  const hasValue = withValue.filter((a) => a.value != null)
  const noValue = withValue.filter((a) => a.value == null)
  hasValue.sort((x, y) => (mode === 'dynasty' ? y.value - x.value : x.value - y.value))
  const sourceLoaded = mode === 'dynasty'
    ? dynastyValues.length >= MIN_DYNASTY_VALUES
    : rosRankByKey.size > 0
  if (sourceLoaded) return hasValue
  return [...hasValue, ...noValue]
}

function sortByRank(agents, rankByKey, ptsByPlayerId) {
  return agents
    .map((a) => ({ ...a, rank: rankByKey.get(matchKey(a.pos, a)) ?? null, pts: ptsByPlayerId?.get(String(a.player_id)) ?? null }))
    .filter((a) => a.rank != null)
    .sort((x, y) => x.rank - y.rank)
}

export function streamingBoard({ freeAgents: agents = [], weeklyRankByKey = new Map(), rosRankByKey = new Map(), ptsByPlayerId = new Map(), positions = [] } = {}) {
  const out = {}
  for (const pos of positions) {
    const posAgents = agents.filter((a) => a.pos === pos)
    out[pos] = {
      week: sortByRank(posAgents, weeklyRankByKey, ptsByPlayerId),
      ros: sortByRank(posAgents, rosRankByKey),
    }
  }
  return out
}

const FLEX_ELIGIBLE = {
  FLEX: ['RB', 'WR', 'TE'], SUPER_FLEX: ['QB', 'RB', 'WR', 'TE'],
  REC_FLEX: ['WR', 'TE'], WRRB_FLEX: ['RB', 'WR'],
}

// Sleeper-Injury-Status-Werte, die einen Spieler diese Woche nicht startbar
// machen. 'Out'/'IR' allein reichten nicht -- PUP/Sus/NA/DNR bedeuten ebenso
// "nicht verfuegbar" (gleiche Fehlerklasse wie der bereits behobene !meta?.team-Fix).
const UNAVAILABLE_INJURY_STATUSES = new Set(['Out', 'IR', 'PUP', 'Sus', 'NA', 'DNR'])

// Sleepers starters-Array ist positionsgleich zu roster_positions (ohne BN/IR/
// TAXI): Index i ist der i-te Nicht-Bank-Slot. Das ist die einzige Quelle, aus
// der sich der ECHTE Slot eines Starters ableiten laesst (nicht nur "Starter
// ja/nein") -- ohne den genauen Slot (z.B. RB1 vs RB2, oder "RB steckt im
// FLEX") koennte bestLineup einen bereits gespielten Starter nicht zielgenau
// auf seinen aktuellen Platz pinnen.
export function lockedStarterSlots({ rosterPositions = [], actualStarterIds = [], players = [], gameStatusByTeam = {} } = {}) {
  const teamById = new Map(players.map((p) => [String(p.sleeper_id), p.team]))
  const nonBench = rosterPositions.filter((s) => s !== 'BN' && s !== 'IR' && s !== 'TAXI')
  const counters = {}
  const out = []
  nonBench.forEach((slot, i) => {
    const slotIndex = counters[slot] || 0
    counters[slot] = slotIndex + 1
    const id = actualStarterIds[i] != null ? String(actualStarterIds[i]) : null
    if (!id) return
    const state = gameStatusByTeam[teamById.get(id)]
    if (state === 'in' || state === 'post') out.push({ slot, slotIndex, sleeper_id: id })
  })
  return out
}

// Greedy statt echtem bipartiten Matching: pro fixem Positions-Slot den
// bestplatzierten passenden Spieler zuerst, danach FLEX-Slots aus dem Rest.
// Das ist Standard fuer Fantasy-Lineup-Tools und in der Praxis fast immer
// optimal (Abweichungen nur in seltenen Randfaellen mit mehreren FLEX-Typen
// gleichzeitig) -- ponytail: greedy statt Optimalloesung, bei Bedarf durch
// echtes Matching ersetzen, falls FLEX/SUPER_FLEX gemeinsam vorkommen und
// Fehlzuteilungen auffallen.
export function bestLineup({ myRosterPlayers = [], rosterPositions = [], weeklyRankByKey = new Map(), flexRankByKey = new Map(), superflexRankByKey = new Map(), currentWeekBye = null, lockedStarterSlots: locked = [] } = {}) {
  const eligible = myRosterPlayers.filter((p) => {
    if (currentWeekBye != null && String(p.bye) === String(currentWeekBye)) return false
    if (UNAVAILABLE_INJURY_STATUSES.has(p.injury_status)) return false
    return true
  })
  // Bereits gespielte Starter (Spiel laeuft/ist vorbei) bleiben auf ihrem
  // echten Slot fest, egal was Rang/Bye/Injury-Status jetzt sagen -- Sleeper
  // laesst nach Kickoff ohnehin keine Aenderung mehr zu, ein "besserer"
  // Vorschlag waere nicht umsetzbar (Nutzer-Befund: verletzter Starter wurde
  // als "raus" vorgeschlagen, obwohl das Spiel schon lief).
  const byId = new Map(myRosterPlayers.map((p) => [String(p.sleeper_id), p]))
  const pinnedBySlotKey = new Map(locked.map((l) => [`${l.slot}:${l.slotIndex}`, byId.get(String(l.sleeper_id))]).filter(([, p]) => p))
  const rankOf = (p) => weeklyRankByKey.get(`ID:${p.sleeper_id}`) ?? Infinity
  // Flex-Slots duerfen NIEMALS nach Positions-Rang besetzt werden: die Skalen
  // sind positionsfremd (TE-Pool ~30 vs. WR-Pool ~100 -- TE5 wuerde WR20 immer
  // verdraengen). Stattdessen zaehlt der positionsuebergreifende Consensus:
  // FLEX-Rang fuer RB/WR/TE-Slots, Superflex-Rang fuer SUPER_FLEX. Fehlt der
  // Flex-Wert (Quelle leer/nicht gematcht), gilt der Positions-Rang als
  // Fallback, damit niemand unstartbar wirkt. Die angezeigte "Woche"-Spalte
  // bleibt bewusst der Positions-Rang (einheitliche Skala pro Spalte).
  const flexRankOf = (p) => flexRankByKey.get(`ID:${p.sleeper_id}`) ?? rankOf(p)
  const superflexRankOf = (p) => superflexRankByKey.get(`ID:${p.sleeper_id}`) ?? rankOf(p)
  const used = new Set()
  const slots = []

  const fixedSlots = rosterPositions.filter((s) => s !== 'BN' && s !== 'IR' && !FLEX_ELIGIBLE[s])
  const flexSlots = rosterPositions.filter((s) => FLEX_ELIGIBLE[s])

  const slotCounters = {}
  function nextSlotIndex(slot) {
    slotCounters[slot] = (slotCounters[slot] || 0) + 1
    return slotCounters[slot] - 1
  }

  for (const slot of fixedSlots) {
    const slotIndex = nextSlotIndex(slot)
    const pinned = pinnedBySlotKey.get(`${slot}:${slotIndex}`)
    if (pinned && !used.has(pinned.sleeper_id)) {
      used.add(pinned.sleeper_id)
      slots.push({ slot, slotIndex, player: pinned, rank: rankOf(pinned), locked: true })
      continue
    }
    const candidates = eligible
      .filter((p) => p.pos === slot && !used.has(p.sleeper_id))
      .sort((a, b) => rankOf(a) - rankOf(b))
    const player = candidates[0] || null
    if (player) used.add(player.sleeper_id)
    slots.push({ slot, slotIndex, player, rank: player ? rankOf(player) : null })
  }
  for (const slot of flexSlots) {
    const slotIndex = nextSlotIndex(slot)
    const pinned = pinnedBySlotKey.get(`${slot}:${slotIndex}`)
    if (pinned && !used.has(pinned.sleeper_id)) {
      used.add(pinned.sleeper_id)
      slots.push({ slot, slotIndex, player: pinned, rank: rankOf(pinned), locked: true })
      continue
    }
    const allowedPos = FLEX_ELIGIBLE[slot]
    const cmpRankOf = slot === 'SUPER_FLEX' ? superflexRankOf : flexRankOf
    const candidates = eligible
      .filter((p) => allowedPos.includes(p.pos) && !used.has(p.sleeper_id))
      .sort((a, b) => cmpRankOf(a) - cmpRankOf(b))
    const player = candidates[0] || null
    if (player) used.add(player.sleeper_id)
    slots.push({ slot, slotIndex, player, rank: player ? rankOf(player) : null })
  }

  // "Bank" = nur Spieler, die diese Woche ueberhaupt in die Aufstellung koennten
  // (BN + ggf. noch zu demontierende Starter). Taxi-Rookies und IR-Platzierte
  // zaehlen nicht zur Bank -- ohne den Filter landeten 30-Mann-Rosters mit 4
  // Taxi-/IR-Slots als "Bank" in der Lineup-Karte und wirkten groesser als die
  // echte Bank (Befund: "das ist nicht meine Bank").
  const bench = myRosterPlayers.filter((p) => !used.has(p.sleeper_id) && p.slot !== 'taxi' && p.slot !== 'ir')
  return { slots, bench }
}

export function compareToActualStarters({ recommendedSlots = [], actualStarterIds = [] } = {}) {
  const actual = new Set((actualStarterIds || []).map(String))
  const recommendedIds = new Set(recommendedSlots.filter((s) => s.player).map((s) => String(s.player.sleeper_id)))
  const diffs = []
  for (const s of recommendedSlots) {
    if (!s.player) continue
    const id = String(s.player.sleeper_id)
    if (!actual.has(id)) diffs.push({ slot: s.slot, in: id, name: s.player.name })
  }
  // Aktuelle Starter, die in KEINEM empfohlenen Slot auftauchen, muessen als
  // "raus" gemeldet werden -- nicht nur Slot-Ersetzungen (Plan-Vorgabe Task 7).
  for (const actualId of actual) {
    if (!recommendedIds.has(actualId)) diffs.push({ slot: null, out: actualId })
  }
  const isOptimal = diffs.length === 0 && actual.size === recommendedIds.size
  return { isOptimal, diffs }
}

// Sleepers eigene IR-Regel (Support-Doku, verifiziert 2026-09-12): nur diese
// vier Status machen einen Spieler IR-faehig. "Doubtful"/"Questionable" NICHT --
// das sind reine Wochen-Spielstatus, kein Long-Term-Signal, Sleeper blockt den
// Slot-Wechsel dafuer in der eigenen UI.
const IR_ELIGIBLE_STATUSES = new Set(['Out', 'Sus', 'IR', 'PUP'])

// Prioritaet, wenn mehr IR-faehige Spieler als freie Slots vorhanden sind:
// echte IR-Meldung zuerst (laengster Ausfall zu erwarten), "Out" zuletzt
// (kommt am ehesten schon naechste Woche zurueck, Slot lohnt sich weniger).
const IR_PRIORITY = { IR: 0, PUP: 1, Sus: 2, Out: 3 }

/**
 * IR-Verwaltung: welche aktiven (Bank/Starter-)Spieler koennten auf einen
 * freien IR-Slot, welche IR-Spieler sind wieder gesund und muessen zurueck,
 * und -- falls dafuer kein Platz ist -- wer sollte dafuer gedroppt werden.
 *
 * dropRankByKey: 'ID:<sleeper_id>' -> Zahl, EINE Konvention fuer beide Modi:
 * niedriger = werthaltiger (behalten), hoeher = eher droppen (wie ECR-Rang).
 * Fuer Dynasty-Werte muss der Aufrufer daher den NEGIERTEN Wert eintragen
 * (hoher Wert -> stark negative Zahl -> "auf keinen Fall droppen").
 */
export function irRecommendations({ myRosterPlayers = [], rosterPositions = [], dropRankByKey = new Map() } = {}) {
  const irSlots = rosterPositions.filter((s) => s === 'IR').length
  const activeSlots = rosterPositions.filter((s) => s !== 'IR' && s !== 'TAXI').length

  const onIR = myRosterPlayers.filter((p) => p.slot === 'ir')
  const active = myRosterPlayers.filter((p) => p.slot !== 'ir' && p.slot !== 'taxi')

  // Wieder gesund: auf IR, aber der aktuelle Status ist nicht mehr IR-faehig.
  const offIR = onIR.filter((p) => !IR_ELIGIBLE_STATUSES.has(p.injury_status))
  const stayingOnIR = onIR.length - offIR.length
  // Slots, die frei werden/sind, NACHDEM die Ruecckehrer die IR verlassen haben --
  // sonst wuerde ein Spieler, dessen IR-Slot gerade erst frei wird, uebersehen.
  const freeIrSlots = Math.max(0, irSlots - stayingOnIR)

  const irCandidates = active
    .filter((p) => IR_ELIGIBLE_STATUSES.has(p.injury_status))
    .sort((a, b) => (IR_PRIORITY[a.injury_status] ?? 9) - (IR_PRIORITY[b.injury_status] ?? 9))
  const toIR = irCandidates.slice(0, freeIrSlots)

  // Nettoeffekt auf die aktiven Slots, wenn ALLE Empfehlungen zusammen
  // umgesetzt werden (toIR raus, offIR rein) -- ein reiner IR<->Bank-Tausch
  // aendert die Belegung sonst faelschlich, wenn man beide Seiten einzeln
  // zaehlt statt den Saldo zu bilden.
  const toIrIds = new Set(toIR.map((p) => p.sleeper_id))
  const newActiveCount = active.length - toIR.length + offIR.length
  const overflow = Math.max(0, newActiveCount - activeSlots)

  const dropRankOf = (p) => dropRankByKey.get(`ID:${p.sleeper_id}`) ?? Infinity
  const dropCandidates = overflow > 0
    ? active
        .filter((p) => p.slot === 'bench' && !toIrIds.has(p.sleeper_id))
        .sort((a, b) => dropRankOf(b) - dropRankOf(a))
        .slice(0, overflow)
    : []

  return { freeIrSlots, toIR, offIR, overflow, dropCandidates }
}
