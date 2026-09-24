// Jev (TypeSafe, "System One") bewertet Spieler-News: statt Text liefert das
// Modell typisierte Antworten mit Wahrscheinlichkeiten. Erreichbar ueber
// OpenRouter (Decisions-API, alpha) — ein TypeSafe-Beta-Zugang fehlt.
//
// Grundsatz gegen Kosten: Der Client schickt nur Spielernamen. Zustand und
// Fragen baut ausschliesslich dieser Server; jede Meldung wird fuer alle
// Nutzer genau einmal bewertet (Cache per Hash), dazu Tagesbudget und
// Circuit-Breaker. Siehe docs/superpowers/specs/2026-09-24-jev-news-markierungen-design.md
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { berlinParts } from '../utils/berlinTime.js'

export const JEV_URL = 'https://openrouter.ai/api/alpha/decisions'
export const JEV_MODEL = 'typesafe/jev-1.13'
// Fragen geaendert → hochzaehlen: alle Meldungen werden neu bewertet.
// v2: Rollen-Fragen klammern Verletzungen aus (Live-Abnahme 2026-09-24).
export const QUESTION_VERSION = 2

// Tmpdir wie SYNC_DIR/SCORES_FILE: der Deploy schaltet Releases per Symlink um.
export const JEV_FILE = process.env.SDH_JEV_FILE || path.join(os.tmpdir(), 'sdh-jev.json')
export const DEFAULT_DAILY_TOKENS = 5_000_000
export const MAX_SIGNAL_PLAYERS = 50
export const MAX_NAME_LEN = 80
export const ENTRY_TTL_MS = 14 * 24 * 60 * 60 * 1000
export const NEWS_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000
export const BREAKER_MS = 60 * 60 * 1000
export const JEV_TIMEOUT_MS = 8000
export const JEV_CONCURRENCY = 4

// Englisch, weil die Meldungen (FantasyPros) englisch sind.
// Verletzungen gehoeren allein in `injury`: ohne den Ausschluss kam eine
// Hueft-Meldung als "weniger Rolle" (down 78 %) statt als Ausfall an.
export const JEV_QUESTIONS = {
  role_up: {
    type: 'noul',
    instructions: "Ignoring injuries, does this news mean the player's role on the team will grow?",
    criteria: {
      true: 'New starter, promoted on the depth chart, or target/carry share going up.',
      false: 'No change in role, the role shrinks, or the news is only about an injury.',
    },
  },
  role_down: {
    type: 'noul',
    instructions: "Ignoring injuries, does this news mean the player's role on the team will shrink?",
    criteria: {
      true: 'Demoted, benched, suspended, or losing snaps to a teammate.',
      false: 'No change in role, the role grows, or the news is only about an injury.',
    },
  },
  // Stufe 2 ist der haeufigste Fantasy-Fall ("wird wohl ein Spiel verpassen");
  // ohne sie verteilte Jev solche Meldungen auf "fraglich" und "Wochen".
  injury: {
    type: 'score',
    instructions: 'How much playing time will the player miss due to injury?',
    criteria: [
      'No injury mentioned',
      'Questionable / day-to-day, likely to play',
      "Likely to miss this week's game",
      'Out for multiple weeks',
      'Out for the season',
    ],
  },
}

// ---------- Reine Helfer ----------

export function buildState({ name, pos, team, item }) {
  return {
    player: name,
    position: pos || null,
    team: team || null,
    headline: item.headline,
    body: item.body || '',
    impact: item.impact || '',
  }
}

// Datum/URL bewusst nicht im Hash: dieselbe Meldung neu verlinkt ist keine neue.
// Der Spieler schon: "A fuer B getradet" bedeutet fuer beide etwas anderes.
export function newsHash(name, item) {
  return crypto.createHash('sha256')
    .update([QUESTION_VERSION, name, item.headline, item.body || '', item.impact || ''].join('\n'))
    .digest('hex')
    .slice(0, 32)
}

// FantasyPros schreibt "Sep 24, 2026", fuer frische Meldungen aber relativ
// ("4 days ago", "an hour ago", "Yesterday"). Beides → Zeitpunkt in ms.
const UNIT_MS = {
  second: 1000, minute: 60_000, hour: 3_600_000, day: 86_400_000,
  week: 7 * 86_400_000, month: 30 * 86_400_000, year: 365 * 86_400_000,
}
export function parseNewsDate(text, now = Date.now()) {
  const s = String(text || '').trim().toLowerCase()
  if (!s) return NaN
  if (s === 'today' || s === 'just now') return now
  if (s === 'yesterday') return now - UNIT_MS.day
  const rel = s.match(/^(\d+|an?|one)\s+(second|minute|hour|day|week|month|year)s?\s+ago$/)
  if (rel) {
    const n = /^\d+$/.test(rel[1]) ? Number(rel[1]) : 1
    return now - n * UNIT_MS[rel[2]]
  }
  return Date.parse(text)
}

// Unparsebar → als aktuell behandeln, lieber einmal zu viel bewerten als
// eine frische Meldung verschlucken.
export function isNewsTooOld(item, now = Date.now()) {
  const t = parseNewsDate(item?.date, now)
  return Number.isFinite(t) && now - t > NEWS_MAX_AGE_MS
}

const num = (x) => (Number.isFinite(Number(x)) ? Number(x) : 0)
const round2 = (x) => Math.round(x * 100) / 100

// Ausfall = alle Stufen ab "diese Woche wohl raus".
const OUT_LEVELS = ['2', '3', '4']

export function signalProbs(answers = {}) {
  const inj = answers.injury?.probabilities || {}
  return {
    up: num(answers.role_up?.noul),
    down: num(answers.role_down?.noul),
    out: OUT_LEVELS.reduce((sum, k) => sum + num(inj[k]), 0),
  }
}

// Einzige Stelle mit Schwellen. Ausfall schlaegt Rolle; widersprechen sich
// mehr und weniger Rolle, markieren wir lieber gar nichts.
export function deriveSignal({ up, down, out }) {
  if (out >= 0.6) return 'injury'
  if (down >= 0.75 && up < 0.75) return 'down'
  if (up >= 0.75 && down < 0.75) return 'up'
  return null
}

export async function callJev({ apiKey, state, fetchImpl = fetch, timeoutMs = JEV_TIMEOUT_MS }) {
  // AbortController + setTimeout statt AbortSignal.timeout: laeuft auch unter
  // jsdom und mit Fake-Timern in Tests.
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetchImpl(JEV_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: JEV_MODEL, state, questions: JEV_QUESTIONS }),
      signal: ctrl.signal,
    })
    if (!res.ok) {
      const err = new Error(`Jev HTTP ${res.status}`)
      err.status = res.status
      throw err
    }
    const data = await res.json()
    return { answers: data?.answers || {}, usage: data?.usage || {} }
  } finally {
    clearTimeout(timer)
  }
}

// ---------- Store (Cache + Budget + Breaker) ----------

export function emptyStore() {
  return { v: 1, day: null, tokens: 0, breakerUntil: 0, entries: {} }
}

export function readJevStore(file = JEV_FILE) {
  try {
    const s = JSON.parse(fs.readFileSync(file, 'utf8'))
    if (!s || typeof s !== 'object' || !s.entries || typeof s.entries !== 'object') return emptyStore()
    return { ...emptyStore(), ...s }
  } catch (e) {
    if (e?.code !== 'ENOENT') console.warn('[jev] Store unlesbar, starte leer:', e?.message)
    return emptyStore()
  }
}

export function writeJevStore(store, file = JEV_FILE, now = Date.now()) {
  for (const [k, e] of Object.entries(store.entries)) {
    if (!e || now - num(e.at) > ENTRY_TTL_MS) delete store.entries[k]
  }
  fs.mkdirSync(path.dirname(file), { recursive: true })
  // Atomar (tmp + rename) wie addScore.
  const tmp = `${file}.${process.pid}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(store))
  fs.renameSync(tmp, file)
}

const dayKey = (now) => berlinParts(now).dayKey

export function budgetLeft(store, now = Date.now(), limit = DEFAULT_DAILY_TOKENS) {
  return store.day === dayKey(now) ? Math.max(0, limit - num(store.tokens)) : limit
}

export function addUsage(store, tokens, now = Date.now()) {
  const day = dayKey(now)
  if (store.day !== day) { store.day = day; store.tokens = 0 }
  store.tokens += Math.max(0, num(tokens))
}

// ---------- Eingabe ----------

export function validateSignalPlayers(players) {
  if (!Array.isArray(players) || players.length === 0) return 'players fehlt'
  if (players.length > MAX_SIGNAL_PLAYERS) return `Höchstens ${MAX_SIGNAL_PLAYERS} Spieler pro Anfrage`
  for (const p of players) {
    const n = p?.name
    if (typeof n !== 'string' || !n.trim() || n.length > MAX_NAME_LEN) return 'Ungültiger Spielername'
  }
  return null
}

// Wie im Client (useNewsSignals): fuer Defenses/Kicker gibt es keine
// Spieler-News, der Namensabgleich koennte fremde Meldungen erwischen.
const NO_NEWS_POS = new Set(['DEF', 'DST', 'K'])

export function cleanSignalPlayers(players) {
  const seen = new Set()
  const out = []
  for (const p of players) {
    const name = p.name.trim()
    if (seen.has(name)) continue
    if (typeof p.pos === 'string' && NO_NEWS_POS.has(p.pos.toUpperCase())) continue
    seen.add(name)
    out.push({
      name,
      pos: typeof p.pos === 'string' ? p.pos.slice(0, 6) : null,
      team: typeof p.team === 'string' ? p.team.slice(0, 4) : null,
    })
  }
  return out
}

export async function mapLimit(items, limit, fn) {
  const out = new Array(items.length)
  let next = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const idx = next++
      out[idx] = await fn(items[idx], idx)
    }
  })
  await Promise.all(workers)
  return out
}

// ---------- Ablauf ----------

/**
 * Bewertet die neueste Meldung je Spieler. Mutiert `store` (Eintraege, Budget,
 * Breaker); `changed` sagt, ob er geschrieben werden muss.
 * signals[name] = null | { signal, headline, date, url, p: { up, down, out } }
 */
export async function evaluatePlayers({
  players, getNews, store, apiKey,
  dailyTokens = DEFAULT_DAILY_TOKENS, now = Date.now(), fetchImpl = fetch, log = console,
}) {
  const signals = {}
  let changed = false
  let budgetExhausted = false

  // Ohne Key ist die Funktion aus: dann auch keine FantasyPros-Scrapes —
  // 50 Seiten kosten ~5 s und koennten nie ein Signal ergeben.
  if (!apiKey) {
    for (const { name } of players) signals[name] = null
    return { signals, changed, budgetExhausted }
  }

  await mapLimit(players, JEV_CONCURRENCY, async (pl) => {
    const { name } = pl
    signals[name] = null
    let item = null
    try { item = (await getNews(name))?.[0] || null } catch { item = null }
    if (!item?.headline || isNewsTooOld(item, now)) return

    const base = { headline: item.headline, date: item.date || null, url: item.url || null }
    const key = newsHash(name, item)
    const hit = store.entries[key]
    if (hit) { signals[name] = { ...base, signal: hit.signal, p: hit.p }; return }

    if (num(store.breakerUntil) > now) return
    if (budgetLeft(store, now, dailyTokens) <= 0) { budgetExhausted = true; return }

    try {
      const { answers, usage } = await callJev({ apiKey, state: buildState({ ...pl, item }), fetchImpl })
      addUsage(store, usage.input_tokens, now)
      const raw = signalProbs(answers)
      const p = { up: round2(raw.up), down: round2(raw.down), out: round2(raw.out) }
      const signal = deriveSignal(raw)
      store.entries[key] = { at: now, signal, p }
      changed = true
      signals[name] = { ...base, signal, p }
    } catch (err) {
      if ([401, 402, 403].includes(err?.status)) {
        store.breakerUntil = now + BREAKER_MS
        changed = true
        log.warn(`[jev] OpenRouter lehnt ab (HTTP ${err.status}) — 1 h Pause. Key/Guthaben pruefen.`)
      } else {
        log.warn('[jev] Aufruf fehlgeschlagen:', err?.message)
      }
    }
  })

  return { signals, changed, budgetExhausted }
}
