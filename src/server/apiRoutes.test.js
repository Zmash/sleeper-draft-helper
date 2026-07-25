import { describe, it, expect } from 'vitest'
import { registerApiRoutes, REVIEW_TOOL, DEFAULT_MODEL, applyPromptCaching } from './apiRoutes.js'
import { STRATEGY_TOOL, STRATEGY_SOURCES, buildStrategyPrompt } from './apiRoutes.js'

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
  it('verlangt summary, rules und sources', () => {
    expect(STRATEGY_TOOL.input_schema.required).toEqual(['summary', 'rules', 'sources'])
  })

  it('begrenzt rules auf 4 bis 6', () => {
    expect(STRATEGY_TOOL.input_schema.properties.rules.minItems).toBe(4)
    expect(STRATEGY_TOOL.input_schema.properties.rules.maxItems).toBe(6)
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
