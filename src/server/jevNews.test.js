// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  JEV_URL, JEV_MODEL, JEV_QUESTIONS, QUESTION_VERSION, buildState, newsHash, isNewsTooOld,
  signalProbs, deriveSignal, callJev,
  emptyStore, readJevStore, writeJevStore, budgetLeft, addUsage,
  validateSignalPlayers, cleanSignalPlayers, mapLimit, evaluatePlayers,
  MAX_SIGNAL_PLAYERS, BREAKER_MS,
} from './jevNews.js'

const ITEM = {
  headline: 'Puka Nacua (ankle) ruled out for Week 4',
  body: 'Nacua suffered a high-ankle sprain and will miss several weeks.',
  impact: 'Downgrade him for the next month.',
  date: 'Sep 24, 2026',
  url: 'https://www.fantasypros.com/nfl/news/1/x.php',
}
const NOW = Date.parse('2026-09-24T12:00:00Z')

function jevAnswers({ up = 0.1, down = 0.2, inj = { 0: 0.05, 1: 0.05, 2: 0.8, 3: 0.1 } } = {}) {
  return {
    role_up: { type: 'noul', noul: up },
    role_down: { type: 'noul', noul: down },
    injury: { type: 'score', score: 2, confidence: 0.9, probabilities: inj },
  }
}

function okFetch(answers = jevAnswers(), tokens = 400) {
  return vi.fn().mockResolvedValue({
    ok: true, status: 200,
    json: async () => ({ answers, usage: { input_tokens: tokens, output_tokens: 60 } }),
  })
}

describe('deriveSignal', () => {
  it.each([
    [{ up: 0, down: 0, out: 0.6 }, 'injury'],
    [{ up: 0.9, down: 0.9, out: 0.7 }, 'injury'],
    [{ up: 0, down: 0.75, out: 0.59 }, 'down'],
    [{ up: 0.75, down: 0, out: 0 }, 'up'],
    [{ up: 0.8, down: 0.8, out: 0 }, null],
    [{ up: 0.74, down: 0.74, out: 0.59 }, null],
  ])('%j -> %s', (p, want) => {
    expect(deriveSignal(p)).toBe(want)
  })
})

describe('signalProbs', () => {
  it('summiert alle Ausfall-Stufen ab 2 (diese Woche, Wochen, Saison)', () => {
    const p = signalProbs(jevAnswers({ inj: { 0: 0.1, 1: 0.2, 2: 0.3, 3: 0.2, 4: 0.2 } }))
    expect(p.out).toBeCloseTo(0.7)
    expect(p.up).toBe(0.1)
    expect(p.down).toBe(0.2)
  })
  it('fehlende Antworten werden 0 statt NaN', () => {
    expect(signalProbs({})).toEqual({ up: 0, down: 0, out: 0 })
  })
})

describe('newsHash', () => {
  it('ist stabil und haengt an Spieler und Text', () => {
    expect(newsHash('Puka Nacua', ITEM)).toBe(newsHash('Puka Nacua', { ...ITEM }))
    expect(newsHash('Puka Nacua', ITEM)).not.toBe(newsHash('Kyren Williams', ITEM))
    expect(newsHash('Puka Nacua', ITEM)).not.toBe(newsHash('Puka Nacua', { ...ITEM, body: 'anders' }))
    expect(newsHash('Puka Nacua', ITEM)).toHaveLength(32)
  })
  it('Datum und URL zaehlen nicht (gleiche Meldung, neu verlinkt)', () => {
    expect(newsHash('A', ITEM)).toBe(newsHash('A', { ...ITEM, date: 'x', url: 'y' }))
  })
})

describe('isNewsTooOld', () => {
  it('versteht das FantasyPros-Datumsformat', () => {
    expect(isNewsTooOld({ date: 'Sep 24, 2026' }, NOW)).toBe(false)
    expect(isNewsTooOld({ date: 'Sep 1, 2026' }, NOW)).toBe(true)
  })
  it('versteht relative Angaben ("4 days ago"), wie FantasyPros sie fuer frische Meldungen schreibt', () => {
    expect(isNewsTooOld({ date: '4 days ago' }, NOW)).toBe(false)
    expect(isNewsTooOld({ date: 'an hour ago' }, NOW)).toBe(false)
    expect(isNewsTooOld({ date: 'Yesterday' }, NOW)).toBe(false)
    expect(isNewsTooOld({ date: '13 days ago' }, NOW)).toBe(false)
    expect(isNewsTooOld({ date: '15 days ago' }, NOW)).toBe(true)
    expect(isNewsTooOld({ date: '3 weeks ago' }, NOW)).toBe(true)
    expect(isNewsTooOld({ date: '2 months ago' }, NOW)).toBe(true)
  })
  it('unparsebares oder fehlendes Datum gilt als aktuell', () => {
    expect(isNewsTooOld({ date: 'gestern' }, NOW)).toBe(false)
    expect(isNewsTooOld({ date: null }, NOW)).toBe(false)
  })
})

describe('JEV_QUESTIONS', () => {
  // Live-Abnahme 2026-09-24: "Puka Nacua (hip) not making great progress" kam als
  // "weniger Rolle" (down 78 %) statt als Ausfall an — Verletzungen gehoeren
  // allein in die injury-Frage.
  it('Rollen-Fragen klammern Verletzungen ausdruecklich aus', () => {
    for (const k of ['role_up', 'role_down']) {
      const q = JEV_QUESTIONS[k]
      expect(q.instructions).toMatch(/injur/i)
      expect(q.criteria.false).toMatch(/injur/i)
    }
  })
  // Gleiche Abnahme: "Nacua appears likely to miss a second straight game" landete
  // zwischen "fraglich" und "fällt Wochen aus" (out 51 %) — die Stufe fehlte.
  it('die Verletzungsskala kennt "diese Woche wohl raus" als eigene Stufe', () => {
    expect(JEV_QUESTIONS.injury.criteria).toHaveLength(5)
    expect(JEV_QUESTIONS.injury.criteria[2]).toMatch(/this week/i)
  })
  it('Fragen-Version ist hochgezaehlt, damit alte Bewertungen nicht weiter gelten', () => {
    expect(QUESTION_VERSION).toBe(2)
  })
})

describe('buildState', () => {
  it('baut den Zustand nur aus Server-Daten', () => {
    expect(buildState({ name: 'Puka Nacua', pos: 'WR', team: 'LAR', item: ITEM })).toEqual({
      player: 'Puka Nacua', position: 'WR', team: 'LAR',
      headline: ITEM.headline, body: ITEM.body, impact: ITEM.impact,
    })
  })
})

describe('callJev', () => {
  it('schickt Modell, Zustand und die festen Fragen an OpenRouter', async () => {
    const fetchImpl = okFetch()
    const out = await callJev({ apiKey: 'k', state: { a: 1 }, fetchImpl })
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe(JEV_URL)
    expect(init.method).toBe('POST')
    expect(init.headers.Authorization).toBe('Bearer k')
    const body = JSON.parse(init.body)
    expect(body.model).toBe(JEV_MODEL)
    expect(body.state).toEqual({ a: 1 })
    expect(body.questions).toEqual(JEV_QUESTIONS)
    expect(out.usage.input_tokens).toBe(400)
    expect(out.answers.role_up.noul).toBe(0.1)
  })
  it('wirft mit HTTP-Status', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 402, json: async () => ({}) })
    await expect(callJev({ apiKey: 'k', state: {}, fetchImpl })).rejects.toMatchObject({ status: 402 })
  })
})

describe('Store', () => {
  const tmp = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'sdh-jev-')), 'store.json')

  it('fehlende Datei liefert einen leeren Store', () => {
    expect(readJevStore(tmp())).toEqual(emptyStore())
  })
  it('defekte Datei liefert einen leeren Store', () => {
    const f = tmp()
    fs.writeFileSync(f, '{kaputt')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(readJevStore(f)).toEqual(emptyStore())
    warn.mockRestore()
  })
  it('schreibt, liest zurueck und raeumt alte Eintraege ab', () => {
    const f = tmp()
    const s = emptyStore()
    s.entries.neu = { at: NOW, signal: 'up', p: { up: 0.9, down: 0, out: 0 } }
    s.entries.alt = { at: NOW - 15 * 24 * 3600 * 1000, signal: null, p: { up: 0, down: 0, out: 0 } }
    writeJevStore(s, f, NOW)
    const back = readJevStore(f)
    expect(Object.keys(back.entries)).toEqual(['neu'])
  })
})

describe('Budget', () => {
  it('zaehlt pro Berliner Tag und setzt um Mitternacht (Berlin) zurueck', () => {
    const s = emptyStore()
    const evening = Date.parse('2026-09-24T21:30:00Z') // 23:30 Berlin
    addUsage(s, 900, evening)
    expect(budgetLeft(s, evening, 1000)).toBe(100)
    const afterMidnight = Date.parse('2026-09-24T22:30:00Z') // 00:30 Berlin, naechster Tag
    expect(budgetLeft(s, afterMidnight, 1000)).toBe(1000)
    addUsage(s, 10, afterMidnight)
    expect(s.tokens).toBe(10)
  })
})

describe('Validierung', () => {
  it('lehnt leere, zu lange und kaputte Listen ab', () => {
    expect(validateSignalPlayers(null)).toBeTruthy()
    expect(validateSignalPlayers([])).toBeTruthy()
    const many = Array.from({ length: MAX_SIGNAL_PLAYERS + 1 }, (_, i) => ({ name: `P${i}` }))
    expect(validateSignalPlayers(many)).toBeTruthy()
    expect(validateSignalPlayers([{ name: 'x'.repeat(81) }])).toBeTruthy()
    expect(validateSignalPlayers([{ name: 42 }])).toBeTruthy()
    expect(validateSignalPlayers([{ name: 'Puka Nacua', pos: 'WR' }])).toBeNull()
  })
  it('cleanSignalPlayers laesst Defenses und Kicker aus (keine Spieler-News, Fehlzuordnung moeglich)', () => {
    expect(cleanSignalPlayers([
      { name: 'Houston Texans', pos: 'DEF' },
      { name: 'Justin Tucker', pos: 'k' },
      { name: 'Puka Nacua', pos: 'WR' },
    ]).map((p) => p.name)).toEqual(['Puka Nacua'])
  })
  it('cleanSignalPlayers trimmt, kuerzt und dedupliziert', () => {
    expect(cleanSignalPlayers([
      { name: ' Puka Nacua ', pos: 'WR', team: 'LAR' },
      { name: 'Puka Nacua' },
      { name: 'Kyren Williams', pos: { x: 1 }, team: 'LARAMS' },
    ])).toEqual([
      { name: 'Puka Nacua', pos: 'WR', team: 'LAR' },
      { name: 'Kyren Williams', pos: null, team: 'LARA' },
    ])
  })
})

describe('mapLimit', () => {
  it('haelt die Reihenfolge und das Limit ein', async () => {
    let running = 0
    let peak = 0
    const out = await mapLimit([1, 2, 3, 4, 5, 6], 2, async (x) => {
      running++; peak = Math.max(peak, running)
      await new Promise((r) => setTimeout(r, 5))
      running--
      return x * 2
    })
    expect(out).toEqual([2, 4, 6, 8, 10, 12])
    expect(peak).toBe(2)
  })
})

describe('evaluatePlayers', () => {
  const players = [{ name: 'Puka Nacua', pos: 'WR', team: 'LAR' }]
  const news = (items) => vi.fn().mockResolvedValue(items)
  const quiet = { warn: () => {} }

  it('bewertet eine neue Meldung und cacht sie', async () => {
    const store = emptyStore()
    const fetchImpl = okFetch()
    const r = await evaluatePlayers({ players, getNews: news([ITEM]), store, apiKey: 'k', now: NOW, fetchImpl, log: quiet })
    expect(r.changed).toBe(true)
    expect(r.signals['Puka Nacua']).toMatchObject({ signal: 'injury', headline: ITEM.headline, url: ITEM.url })
    expect(r.signals['Puka Nacua'].p.out).toBeCloseTo(0.9)
    expect(store.tokens).toBe(400)

    const r2 = await evaluatePlayers({ players, getNews: news([ITEM]), store, apiKey: 'k', now: NOW, fetchImpl, log: quiet })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(r2.changed).toBe(false)
    expect(r2.signals['Puka Nacua'].signal).toBe('injury')
  })

  it('ohne Meldung kein Jev-Aufruf', async () => {
    const fetchImpl = okFetch()
    const r = await evaluatePlayers({ players, getNews: news([]), store: emptyStore(), apiKey: 'k', now: NOW, fetchImpl, log: quiet })
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(r.signals['Puka Nacua']).toBeNull()
  })

  it('zu alte Meldung: kein Jev-Aufruf', async () => {
    const fetchImpl = okFetch()
    await evaluatePlayers({ players, getNews: news([{ ...ITEM, date: 'Aug 1, 2026' }]), store: emptyStore(), apiKey: 'k', now: NOW, fetchImpl, log: quiet })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('News-Fehler: kein Jev-Aufruf, kein Absturz', async () => {
    const fetchImpl = okFetch()
    const r = await evaluatePlayers({ players, getNews: vi.fn().mockRejectedValue(new Error('down')), store: emptyStore(), apiKey: 'k', now: NOW, fetchImpl, log: quiet })
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(r.signals['Puka Nacua']).toBeNull()
  })

  it('ohne Key weder Jev-Aufruf noch News-Scrape', async () => {
    const fetchImpl = okFetch()
    const getNews = news([ITEM])
    const r = await evaluatePlayers({ players, getNews, store: emptyStore(), apiKey: null, now: NOW, fetchImpl, log: quiet })
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(getNews).not.toHaveBeenCalled()
    expect(r.signals['Puka Nacua']).toBeNull()
  })

  it('Budget aufgebraucht: kein Aufruf, budgetExhausted', async () => {
    const store = emptyStore()
    addUsage(store, 1000, NOW)
    const fetchImpl = okFetch()
    const r = await evaluatePlayers({ players, getNews: news([ITEM]), store, apiKey: 'k', dailyTokens: 1000, now: NOW, fetchImpl, log: quiet })
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(r.budgetExhausted).toBe(true)
  })

  it('402 loest den Circuit-Breaker aus, danach eine Stunde Ruhe', async () => {
    const store = emptyStore()
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 402, json: async () => ({}) })
    await evaluatePlayers({ players, getNews: news([ITEM]), store, apiKey: 'k', now: NOW, fetchImpl, log: quiet })
    expect(store.breakerUntil).toBe(NOW + BREAKER_MS)
    await evaluatePlayers({ players, getNews: news([ITEM]), store, apiKey: 'k', now: NOW + 1000, fetchImpl, log: quiet })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    await evaluatePlayers({ players, getNews: news([ITEM]), store, apiKey: 'k', now: NOW + BREAKER_MS + 1, fetchImpl, log: quiet })
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('500 wird nicht gecacht, der naechste Abruf versucht es erneut', async () => {
    const store = emptyStore()
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) })
    const r = await evaluatePlayers({ players, getNews: news([ITEM]), store, apiKey: 'k', now: NOW, fetchImpl, log: quiet })
    expect(r.signals['Puka Nacua']).toBeNull()
    expect(Object.keys(store.entries)).toHaveLength(0)
    expect(store.breakerUntil).toBe(0)
    await evaluatePlayers({ players, getNews: news([ITEM]), store, apiKey: 'k', now: NOW, fetchImpl, log: quiet })
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })
})
