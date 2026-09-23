// Sleeper-AutoSubs: Ein Manager hinterlegt zu einem Starter einen Bankspieler.
// Ist der Starter zu seinem Kickoff inaktiv, rueckt der Sub automatisch in die
// Aufstellung. Die Liga legt fest, wie viele Subs pro Team und Woche erlaubt
// sind (0-3) und ob der Sub gleich spaet oder spaeter spielen muss als der
// Starter ("Require AutoSub To Not Play Before Starter").
//
// Was die oeffentliche API davon zeigt:
//   league.settings.max_subs                   Anzahl erlaubter Subs, 0 = aus
//   league.settings.sub_start_time_eligibility 1 = Sub darf nicht frueher spielen
// Ob und unter welchem Schluessel die konkrete Zuordnung Starter -> Sub je Team
// herauskommt, ist nicht dokumentiert. readAutoSubs liest deshalb tolerant und
// nimmt nur Paare, die sich am Kader bestaetigen lassen (Starter steht in
// `starters`, Sub im Kader, aber nicht in der Aufstellung). Findet es nichts,
// bleibt alles wie vor diesem Modul.
//
// Ausgefuehrte Subs brauchen keine Sonderbehandlung: Sleeper tauscht sie in
// `starters` ein, danach rechnet jede Projektion schon mit dem Sub.

const FLEX_ELIGIBLE = {
  FLEX: ['RB', 'WR', 'TE'], SUPER_FLEX: ['QB', 'RB', 'WR', 'TE'],
  REC_FLEX: ['WR', 'TE'], WRRB_FLEX: ['RB', 'WR'],
}

// Diese Woche nicht einsetzbar -- als Sub waere so ein Spieler wertlos.
const UNAVAILABLE = new Set(['Out', 'IR', 'PUP', 'Sus', 'NA', 'DNR'])

// Ausfallrisiko je Sleeper-Injury-Status. Nur fuer diese Starter lohnt ein
// Sub: ohne Status fallen Spieler praktisch nie kurzfristig aus, und jeder
// Sub-Platz, der dort liegt, fehlt womoeglich beim naechsten Wackelkandidaten.
// Grobe Erfahrungswerte, keine Statistik -- sie ordnen nur die Kandidaten.
export const AUTOSUB_RISK = { Doubtful: 0.75, Questionable: 0.25 }

/** Liga-Regeln oder null, wenn die Liga keine AutoSubs erlaubt. */
export function autoSubRules(league) {
  const s = league?.settings || {}
  const maxSubs = Math.max(0, Math.floor(Number(s.max_subs) || 0))
  if (!maxSubs) return null
  return { maxSubs, requireLaterKickoff: Number(s.sub_start_time_eligibility) > 0 }
}

const pid = (v) => (v == null || v === '' || v === '0' ? null : String(v))

// Ein Eintrag kann {starter: sub} sein oder ein Objekt mit sprechenden Feldern.
function pairFrom(entry) {
  if (!entry || typeof entry !== 'object') return null
  const starter = pid(entry.starter ?? entry.starter_id ?? entry.player_id ?? entry.out)
  const sub = pid(entry.sub ?? entry.sub_id ?? entry.substitute ?? entry.sub_player_id ?? entry.in)
  return starter && sub ? [starter, sub] : null
}

function pairsIn(value) {
  if (Array.isArray(value)) return value.map(pairFrom).filter(Boolean)
  if (value && typeof value === 'object') {
    return Object.entries(value)
      .map(([k, v]) => (typeof v === 'string' || typeof v === 'number' ? [pid(k), pid(v)] : pairFrom(v)))
      .filter((p) => p && p[0] && p[1])
  }
  return []
}

/**
 * Hinterlegte Subs eines Teams, tolerant aus Roster und Matchup gelesen.
 * @returns {Map<string,string>} Starter-ID -> Sub-ID (leer, wenn nichts belegbar)
 */
export function readAutoSubs({ roster = null, matchup = null } = {}) {
  const starters = new Set([...(matchup?.starters || roster?.starters || [])].map(String))
  const players = new Set([...(roster?.players || []), ...(matchup?.players || [])].map(String))
  const out = new Map()
  for (const src of [roster, roster?.metadata, matchup, matchup?.metadata]) {
    if (!src || typeof src !== 'object') continue
    for (const [key, value] of Object.entries(src)) {
      if (!/sub/i.test(key)) continue
      for (const [starter, sub] of pairsIn(value)) {
        if (!starters.has(starter) || starters.has(sub)) continue
        if (players.size && !players.has(sub)) continue
        if (!out.has(starter)) out.set(starter, sub)
      }
    }
  }
  return out
}

/**
 * Wendet die hinterlegten Subs auf eine Aufstellung an, wie Sleeper es beim
 * Kickoff tun wird: faellt ein Starter aus, zaehlt sein Sub. Bereits
 * punktende Starter bleiben stehen (die hat Sleeper nicht getauscht).
 *
 * @returns {{starterIds:string[], applied:{outId:string, subId:string}[]}}
 */
export function applyAutoSubs({ starterIds = [], subs, rules, outFor = () => false, pointsFor = () => 0 }) {
  if (!rules || !subs?.size) return { starterIds, applied: [] }
  const current = new Set(starterIds.map(String))
  const applied = []
  const next = starterIds.map((id) => {
    const sid = pid(id)
    if (!sid || applied.length >= rules.maxSubs) return id
    const subId = subs.get(sid)
    if (!subId || current.has(subId) || !outFor(sid) || Number(pointsFor(sid)) > 0) return id
    current.add(subId)
    applied.push({ outId: sid, subId })
    return subId
  })
  return { starterIds: next, applied }
}

/**
 * Wie viele ausgefallene Starter koennte ein AutoSub noch ersetzen? Grundlage
 * fuer den Hinweis an der Siegchance, wenn die Zuordnung nicht lesbar ist:
 * dann rechnet die Projektion den Ausfall mit 0, obwohl vielleicht ein Sub
 * einspringt -- die Chance ist dann eher zu niedrig.
 */
export function pendingAutoSubCount({ starterIds = [], rules, outFor = () => false, pointsFor = () => 0, gameFor = () => null }) {
  if (!rules) return 0
  let n = 0
  for (const id of starterIds) {
    const sid = pid(id)
    if (!sid || !outFor(sid) || Number(pointsFor(sid)) > 0) continue
    // Nach Kickoff hat Sleeper bereits entschieden -- dann steht der Sub
    // schon in `starters` oder es gab keinen.
    const state = gameFor(sid)?.state
    if (state === 'in' || state === 'post') continue
    n += 1
  }
  return Math.min(n, rules.maxSubs)
}

const slotAccepts = (slot, pos) => (FLEX_ELIGIBLE[slot] ? FLEX_ELIGIBLE[slot].includes(pos) : slot === pos)

/**
 * Empfiehlt Subs fuer die empfohlene Aufstellung -- nur fuer Starter mit
 * echtem Ausfallrisiko und nur, wenn ein passender Bankspieler etwas bringt.
 * Die Liga-Hoechstzahl ist ein Deckel, kein Soll.
 *
 * @param {object} args
 * @param {{slot:string, slotIndex:number, player:object|null, locked?:boolean}[]} args.slots  bestLineup().slots
 * @param {object[]} args.bench        bestLineup().bench
 * @param {{maxSubs:number, requireLaterKickoff:boolean}} args.rules
 * @param {(p:object)=>number|null} [args.kickoffFor]  Kickoff in ms (null = unbekannt)
 * @param {(p:object)=>number|null} [args.ptsFor]      Wochenprojektion
 * @param {(p:object)=>number|null} [args.rankFor]     Wochenrang (Ersatz, wenn Pkt fehlen)
 * @param {string|null} [args.currentWeekBye]
 * @returns {{picks:object[], uncovered:object[]}}
 *   picks: {slot, slotIndex, starter, sub, risk, expected} -- sortiert nach Nutzen
 *   uncovered: Risiko-Starter ohne sinnvollen Sub (fuer den Hinweis in der UI)
 */
export function recommendAutoSubs({
  slots = [], bench = [], rules, kickoffFor = () => null, ptsFor = () => null, rankFor = () => null, currentWeekBye = null,
}) {
  if (!rules) return { picks: [], uncovered: [] }
  const usable = bench.filter((p) =>
    !UNAVAILABLE.has(p.injury_status)
    && p.injury_status !== 'Doubtful'
    && !(currentWeekBye != null && String(p.bye) === String(currentWeekBye)))

  const risky = slots
    .filter((s) => s.player && !s.locked && AUTOSUB_RISK[s.player.injury_status])
    .map((s) => ({ ...s, risk: AUTOSUB_RISK[s.player.injury_status] }))

  // Bewertung eines Subs: Projektion, sonst ein Rang-Ersatz. Ohne beides ist
  // er nicht vergleichbar und bleibt hinten. Ein fraglicher Sub zaehlt nur
  // anteilig -- er kann selbst ausfallen.
  const valueOf = (p) => {
    const pts = ptsFor(p)
    const rank = rankFor(p)
    const base = pts != null ? pts : Number.isFinite(rank) ? 1 / (1 + rank) : 0
    return base * (1 - (AUTOSUB_RISK[p.injury_status] || 0))
  }
  const fits = (s, p) => {
    if (!slotAccepts(s.slot, p.pos)) return false
    if (!rules.requireLaterKickoff) return true
    const a = kickoffFor(s.player)
    const b = kickoffFor(p)
    // Unbekannte Kickoffs nicht raten: Sleeper wuerde den Sub sonst ablehnen.
    return a != null && b != null && b >= a
  }

  // Kandidaten je Risiko-Starter, dann nach erwartetem Nutzen (Risiko x Wert
  // des Subs) vergeben -- jeder Bankspieler hoechstens einmal.
  const options = risky.map((s) => ({
    s,
    subs: usable.filter((p) => fits(s, p)).sort((a, b) => valueOf(b) - valueOf(a)),
  }))
  const order = options
    .map((o) => ({ ...o, best: o.subs[0] ? o.s.risk * valueOf(o.subs[0]) : 0 }))
    .sort((a, b) => b.best - a.best || b.s.risk - a.s.risk)

  const taken = new Set()
  const picks = []
  const uncovered = []
  for (const o of order) {
    const sub = o.subs.find((p) => !taken.has(String(p.sleeper_id)) && valueOf(p) > 0)
    if (!sub || picks.length >= rules.maxSubs) {
      uncovered.push({ slot: o.s.slot, slotIndex: o.s.slotIndex, starter: o.s.player, risk: o.s.risk, reason: sub ? 'limit' : 'none' })
      continue
    }
    taken.add(String(sub.sleeper_id))
    picks.push({
      slot: o.s.slot,
      slotIndex: o.s.slotIndex,
      starter: o.s.player,
      sub,
      risk: o.s.risk,
      expected: ptsFor(sub) != null ? o.s.risk * valueOf(sub) : null,
    })
  }
  return { picks, uncovered }
}
