import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { registerApiRoutes, REVIEW_TOOL, DEFAULT_MODEL, applyPromptCaching } from './apiRoutes.js'
import { STRATEGY_TOOL, STRATEGY_SOURCES, buildStrategyPrompt } from './apiRoutes.js'
import { SYNC_DIR, MAX_ROOMS, isValidRoom, readRoom, writeRoom } from './apiRoutes.js'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

describe('apiRoutes — Modul-Vertrag', () => {
  it('exportiert registerApiRoutes als Funktion', () => {
    expect(typeof registerApiRoutes).toBe('function')
  })

  it('Default-Modell ist Sonnet 5', () => {
    expect(DEFAULT_MODEL).toBe('claude-sonnet-5')
  })

  it('registriert alle bekannten Routen auf der App', () => {
    const registered = []
    const fakeApp = {
      get: (p) => registered.push(`GET ${p}`),
      post: (p) => registered.push(`POST ${p}`),
    }
    registerApiRoutes(fakeApp, { model: DEFAULT_MODEL })
    for (const r of [
      'GET /api/rankings/ffc-adp', 'GET /api/rankings/sleeper-adp', 'GET /api/rankings/fantasycalc',
      'GET /api/rankings/ktc-dynasty', 'GET /api/rankings/ktc-rookies',
      'GET /api/rankings/fantasypros',
      'GET /api/health', 'POST /api/validate-key',
      'POST /api/ai-advice', 'POST /api/ai-draft-review', 'POST /api/ai-trade',
    ]) expect(registered).toContain(r)
  })

  it('REVIEW_TOOL ist das Draft-Review-Schema', () => {
    expect(REVIEW_TOOL.name).toBe('return_draft_review')
  })
})

describe('REVIEW_TOOL — Learnings statt Week-1', () => {
  it('verlangt lessonsForNextMock und kennt kein myWeek1StartSit mehr', () => {
    const props = REVIEW_TOOL.input_schema.properties
    expect(props.myWeek1StartSit).toBeUndefined()
    expect(props.lessonsForNextMock.items.required).toEqual(['lesson', 'evidence'])
    expect(REVIEW_TOOL.input_schema.required).toContain('lessonsForNextMock')
    expect(REVIEW_TOOL.input_schema.required).not.toContain('myWeek1StartSit')
  })
})

describe('applyPromptCaching', () => {
  it('macht aus String-system einen gecachten Text-Block', () => {
    const out = applyPromptCaching({ system: 'Du bist Analyst.', messages: [] })
    expect(out.system).toEqual([
      { type: 'text', text: 'Du bist Analyst.', cache_control: { type: 'ephemeral' } },
    ])
  })

  it('markiert nur das letzte Tool', () => {
    const tools = [{ name: 'a', input_schema: {} }, { name: 'b', input_schema: {} }]
    const out = applyPromptCaching({ tools })
    expect(out.tools[0].cache_control).toBeUndefined()
    expect(out.tools[1].cache_control).toEqual({ type: 'ephemeral' })
  })

  it('laesst Payloads ohne system/tools unangetastet und mutiert nie das Original', () => {
    const p = { messages: [{ role: 'user', content: 'x' }] }
    const out = applyPromptCaching(p)
    expect(out.system).toBeUndefined()
    expect(out.tools).toBeUndefined()
    const q = { system: 's', tools: [{ name: 'a' }] }
    applyPromptCaching(q)
    expect(q.system).toBe('s')
    expect(q.tools[0].cache_control).toBeUndefined()
  })
})

describe('STRATEGY_SOURCES', () => {
  it('trennt Redraft- und Rookie-Quellen', () => {
    expect(STRATEGY_SOURCES.redraft).toContain('fantasypros.com')
    expect(STRATEGY_SOURCES.rookie).toContain('dynastyleaguefootball.com')
  })

  it('enthaelt kein reddit.com — dort ist der Crawler gesperrt', () => {
    const all = [...STRATEGY_SOURCES.redraft, ...STRATEGY_SOURCES.rookie]
    expect(all.some(d => d.includes('reddit'))).toBe(false)
  })

  it('nennt Domains ohne Schema', () => {
    const all = [...STRATEGY_SOURCES.redraft, ...STRATEGY_SOURCES.rookie]
    for (const d of all) expect(d).not.toMatch(/^https?:\/\//)
  })
})

describe('STRATEGY_TOOL', () => {
  it('verlangt alle vier Felder', () => {
    expect(STRATEGY_TOOL.input_schema.required).toEqual(['summary', 'rules', 'sources', 'contested'])
  })

  // Ohne strict validiert die API die Tool-Eingabe nicht: im Live-Test kam
  // alles als ein Pseudo-XML-String im Feld "rules" zurueck statt in drei
  // Arrays. strict verlangt additionalProperties: false und dass jedes Feld
  // in required steht -- beides gehoert zum selben Vertrag.
  it('erzwingt das Schema per strict', () => {
    expect(STRATEGY_TOOL.strict).toBe(true)
    expect(STRATEGY_TOOL.input_schema.additionalProperties).toBe(false)
    expect(STRATEGY_TOOL.input_schema.properties.sources.items.additionalProperties).toBe(false)
    const props = Object.keys(STRATEGY_TOOL.input_schema.properties)
    expect(STRATEGY_TOOL.input_schema.required).toEqual(props)
  })

  it('haelt rules und sources als Arrays von Eintraegen', () => {
    expect(STRATEGY_TOOL.input_schema.properties.rules.items.type).toBe('string')
    expect(STRATEGY_TOOL.input_schema.properties.sources.items.required).toEqual(['title', 'url'])
  })
})

describe('buildStrategyPrompt', () => {
  const base = {
    format: { teams: 12, scoringType: 'half_ppr', superflex: false, rosterPositions: ['QB','RB','WR'] },
    season: '2026', draftMode: 'redraft', draftSlot: 7, principles: 'DEF wird gestreamt.',
  }

  it('setzt Format und Saison in den Query-Plan ein', () => {
    const p = buildStrategyPrompt(base)
    expect(p).toContain('12')
    expect(p).toContain('half_ppr')
    expect(p).toContain('2026')
    expect(p).toContain('1QB')
  })

  it('nennt den Draft-Slot, wenn bekannt', () => {
    expect(buildStrategyPrompt(base)).toContain('Draft-Slot 7')
  })

  // Auf 'Draft-Slot' pruefen, nicht auf 'Slot': der Prompt nennt immer die
  // 'Starter-Slots', ein blosses toContain('Slot') waere immer wahr.
  it('laesst die Slot-Frage weg, wenn kein Slot bekannt ist', () => {
    expect(buildStrategyPrompt({ ...base, draftSlot: null })).not.toContain('Draft-Slot')
  })

  it('markiert Superflex', () => {
    expect(buildStrategyPrompt({ ...base, format: { ...base.format, superflex: true } }))
      .toContain('Superflex')
  })

  it('uebernimmt die Grundsaetze als unveraenderlich', () => {
    const p = buildStrategyPrompt(base)
    expect(p).toContain('DEF wird gestreamt.')
    expect(p).toMatch(/nicht umschreiben|unveraenderlich|gesetzt/i)
  })

  it('weist an, Widersprueche zu benennen statt aufzuloesen', () => {
    expect(buildStrategyPrompt(base)).toMatch(/contested/)
  })
})

describe('Sync-Briefkasten', () => {
  const room = 'a'.repeat(32)
  let dir

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdh-sync-test-'))
  })
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true })
  })

  // Ohne diese Pruefung ist der Dateipfad fuer Traversal offen — der
  // Endpunkt ist unauthentifiziert, das ist eine Vertrauensgrenze.
  it('akzeptiert nur 32 Hex-Zeichen als Raum', () => {
    expect(isValidRoom(room)).toBe(true)
    expect(isValidRoom('../../etc/passwd')).toBe(false)
    expect(isValidRoom('A'.repeat(32))).toBe(false)
    expect(isValidRoom('a'.repeat(31))).toBe(false)
    expect(isValidRoom('')).toBe(false)
  })

  it('liefert null fuer einen unbekannten Raum', () => {
    expect(readRoom(room, dir)).toBeNull()
  })

  it('gibt zurueck, was geschrieben wurde', () => {
    const stamp = writeRoom(room, { iv: 'AAAA', ciphertext: 'BBBB' }, dir)
    expect(typeof stamp).toBe('string')
    expect(readRoom(room, dir)).toEqual({ stamp, iv: 'AAAA', ciphertext: 'BBBB' })
  })

  // Zwei Schreibvorgaenge in derselben Millisekunde duerfen nicht denselben
  // Stempel bekommen — sonst haelt das andere Geraet die neue Fassung fuer
  // die bereits gesehene und holt sie nie.
  it('vergibt bei jedem Schreiben einen neuen Stempel', () => {
    const a = writeRoom(room, { iv: 'A', ciphertext: 'A' }, dir)
    const b = writeRoom(room, { iv: 'B', ciphertext: 'B' }, dir)
    expect(a).not.toBe(b)
  })

  it('weigert sich, einen ungueltigen Raum zu schreiben', () => {
    expect(() => writeRoom('../boese', { iv: 'A', ciphertext: 'A' }, dir)).toThrow()
  })

  it('deckelt die Anzahl Raeume', () => {
    expect(MAX_ROOMS).toBe(500)
    expect(SYNC_DIR).toContain('sdh-sync')
  })

  it('registriert beide Sync-Routen', () => {
    const registered = []
    registerApiRoutes(
      { get: (p) => registered.push(`GET ${p}`), post: (p) => registered.push(`POST ${p}`) },
      { model: DEFAULT_MODEL },
    )
    expect(registered).toContain('GET /api/sync/:room')
    expect(registered).toContain('POST /api/sync/:room')
  })
})
