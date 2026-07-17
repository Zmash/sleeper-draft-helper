import { describe, it, expect } from 'vitest'
import { buildAIAdviceRequest } from './ai'

// Der Standalone-Mock: keine Liga, Format steckt ausschliesslich im Draft.
// Genau der Fall, den BoardSection an die AI schickt (league = {} + roster_positions
// + total_rosters), weil ein per Link angehaengter Mock keine league_id hat.
const mockBoard = [
  { rk: 1, name: 'Justin Jefferson', nname: 'justin jefferson', pos: 'WR', team: 'MIN', adp: 16.4, bye: 6 },
  { rk: 2, name: 'Bijan Robinson', nname: 'bijan robinson', pos: 'RB', team: 'ATL', adp: 2.4, bye: 11 },
  { rk: 3, name: 'Jahmyr Gibbs', nname: 'jahmyr gibbs', pos: 'RB', team: 'DET', adp: 1.7, bye: 6 },
]

const baseParams = {
  boardPlayers: mockBoard,
  livePicks: [],
  me: 'u1',
  league: { roster_positions: ['QB', 'RB', 'WR', 'TE', 'FLEX', 'BN'], total_rosters: 10 },
  draft: { settings: { teams: 10, rounds: 15 } },
  currentPickNumber: 4,
  options: {},
}

describe('buildAIAdviceRequest — Format-Treue', () => {
  it('uebernimmt den uebergebenen scoringType, statt auf PPR zu raten', () => {
    // Regression: ohne league.scoring_settings (Standalone-Mock) fiel der Default
    // auf 'ppr'. Ein Standard-Mock wurde der AI als PPR beschrieben.
    const req = buildAIAdviceRequest({ ...baseParams, scoringType: 'standard' })
    const ctx = JSON.parse(req.messages[0].content.match(/<CONTEXT_JSON>\n([\s\S]*)\n<\/CONTEXT_JSON>/)[1])
    expect(ctx.format.scoring_type).toBe('standard')
  })

  it('meldet Superflex an die AI', () => {
    // Der System-Prompt sagt "In 1-QB leagues, de-emphasize QB before Round 7".
    // Ohne dieses Flag bekam ein Superflex-Draft genau den falschen Rat.
    const req = buildAIAdviceRequest({ ...baseParams, isSuperflex: true })
    const ctx = JSON.parse(req.messages[0].content.match(/<CONTEXT_JSON>\n([\s\S]*)\n<\/CONTEXT_JSON>/)[1])
    expect(ctx.format.superflex).toBe(true)
  })

  it('widerspricht sich nicht: ppr_type folgt dem scoringType, nicht der leeren Liga', () => {
    // Regression: league.ppr_type kam ausschliesslich aus league.scoring_settings.
    // Beim Standalone-Mock ist die leer -> "Standard/Non-PPR", waehrend
    // format.scoring_type korrekt 'ppr' meldete. Die AI bekam beide Angaben
    // widerspruechlich im selben Payload und musste raten, welche gilt.
    const req = buildAIAdviceRequest({ ...baseParams, league: {}, scoringType: 'ppr' })
    const ctx = JSON.parse(req.messages[0].content.match(/<CONTEXT_JSON>\n([\s\S]*)\n<\/CONTEXT_JSON>/)[1])
    expect(ctx.format.scoring_type).toBe('ppr')
    expect(ctx.league.ppr_type).toMatch(/PPR/)
    expect(ctx.league.ppr_type).not.toMatch(/Standard/i)
  })

  it('gibt der AI die Marktdaten (ADP) mit', () => {
    // Das ganze Redraft-Board dreht sich um ADP. minifyBoardPlayer liess das Feld
    // fallen, die AI beriet also ohne jedes Marktsignal.
    const req = buildAIAdviceRequest({ ...baseParams, scoringType: 'standard' })
    const ctx = JSON.parse(req.messages[0].content.match(/<CONTEXT_JSON>\n([\s\S]*)\n<\/CONTEXT_JSON>/)[1])
    const jj = ctx.board.overall_top.find(p => p.nname === 'justin jefferson')
    expect(jj.adp).toBe(16.4)
  })

  it('meldet den Pick, der ansteht — nicht den, der schon gelaufen ist', () => {
    // Regression, live am Mock gefunden: currentPickNumber ist der hoechste
    // BEREITS gemachte Pick. Bei 3 gemachten Picks stand der User an 4 auf der
    // Uhr, die AI bekam "current_pick_number: 3" und beriet fuer Pick 3
    // ("top WRs likely gone at picks 1-2") — konsequent einen Pick zu frueh.
    const req = buildAIAdviceRequest({ ...baseParams, currentPickNumber: 3, scoringType: 'standard' })
    const ctx = JSON.parse(req.messages[0].content.match(/<CONTEXT_JSON>\n([\s\S]*)\n<\/CONTEXT_JSON>/)[1])
    expect(ctx.draft.upcoming_pick_number).toBe(4)
  })

  it('vor dem ersten Pick steht Pick 1 an', () => {
    const req = buildAIAdviceRequest({ ...baseParams, currentPickNumber: 0, scoringType: 'standard' })
    const ctx = JSON.parse(req.messages[0].content.match(/<CONTEXT_JSON>\n([\s\S]*)\n<\/CONTEXT_JSON>/)[1])
    expect(ctx.draft.upcoming_pick_number).toBe(1)
  })

  it('ohne bekannten Pick wird nichts erfunden', () => {
    const req = buildAIAdviceRequest({ ...baseParams, currentPickNumber: null, scoringType: 'standard' })
    const ctx = JSON.parse(req.messages[0].content.match(/<CONTEXT_JSON>\n([\s\S]*)\n<\/CONTEXT_JSON>/)[1])
    expect(ctx.draft.upcoming_pick_number).toBe(null)
  })

  it('nennt den FantasyCalc-Wert im Redraft nicht "dynasty"', () => {
    // Live gefunden: die AI schrieb "a true workhorse with elite dynasty value
    // (8203)" ueber einen Redraft-Mock. Das Feld heisst historisch
    // dynasty_value, traegt im Redraft aber den Redraft-Wert (isDynasty=false).
    // Der Feldname leckte woertlich in die Beratung.
    const board = [{ ...mockBoard[0], dynasty_value: 8342 }]
    const req = buildAIAdviceRequest({ ...baseParams, boardPlayers: board, draftMode: 'redraft', scoringType: 'standard' })
    const ctx = JSON.parse(req.messages[0].content.match(/<CONTEXT_JSON>\n([\s\S]*)\n<\/CONTEXT_JSON>/)[1])
    const p = ctx.board.overall_top[0]
    expect(p.market_value).toBe(8342)
    expect(p.dynasty_value).toBeUndefined()
  })

  it('im Rookie-Draft heisst der Dynasty-Wert weiter so', () => {
    const board = [{ ...mockBoard[0], dynasty_value: 8342 }]
    const req = buildAIAdviceRequest({ ...baseParams, boardPlayers: board, draftMode: 'rookie' })
    const ctx = JSON.parse(req.messages[0].content.match(/<CONTEXT_JSON>\n([\s\S]*)\n<\/CONTEXT_JSON>/)[1])
    expect(ctx.board.overall_top[0].dynasty_value).toBe(8342)
  })

  it('kennt die Teamzahl des Drafts auch ohne Liga', () => {
    const req = buildAIAdviceRequest({ ...baseParams, league: {}, scoringType: 'standard' })
    const ctx = JSON.parse(req.messages[0].content.match(/<CONTEXT_JSON>\n([\s\S]*)\n<\/CONTEXT_JSON>/)[1])
    expect(ctx.league.total_rosters).toBe(10)
  })
})

const ctxOf = (req) => JSON.parse(req.messages[0].content.match(/<CONTEXT_JSON>\n([\s\S]*)\n<\/CONTEXT_JSON>/)[1])

describe('buildAIAdviceRequest — erweiterter Kontext', () => {
  it('gibt Markt-Spannen mit, aber nur wenn vorhanden', () => {
    const board = [
      { ...mockBoard[0], high: 12, low: 24, stdev: 2.7 },
      { ...mockBoard[1] },
    ]
    const ctx = ctxOf(buildAIAdviceRequest({ ...baseParams, boardPlayers: board, scoringType: 'standard' }))
    const [a, b] = ctx.board.overall_top
    expect([a.high, a.low, a.stdev]).toEqual([12, 24, 2.7])
    expect('high' in b).toBe(false)
  })

  it('draftSlot hat Vorrang vor der Ableitung aus den Picks', () => {
    const ctx = ctxOf(buildAIAdviceRequest({ ...baseParams, draftSlot: 4, scoringType: 'standard' }))
    expect(ctx.draft.my_slot).toBe(4)
  })

  it('kennt meinen naechsten Pick und die Gegner dazwischen', () => {
    const ctx = ctxOf(buildAIAdviceRequest({
      ...baseParams, draftSlot: 4, currentPickNumber: 3, scoringType: 'standard',
      draft: { settings: { teams: 10, rounds: 15 }, type: 'snake' },
    }))
    expect(ctx.draft.my_next_pick_number).toBe(17)
    expect(ctx.draft.picks_until_my_next).toBe(13)   // 17 - upcoming(4)
    expect(ctx.opponents_before_my_next.between).toHaveLength(12)
  })

  it('draft_type kommt aus dem Draft, is_snake wird abgeleitet — nie hardcodiert', () => {
    const ctx = ctxOf(buildAIAdviceRequest({
      ...baseParams, scoringType: 'standard',
      draft: { settings: { teams: 10, rounds: 15 }, type: 'auction' },
    }))
    expect(ctx.draft.draft_type).toBe('auction')
    expect(ctx.draft.is_snake).toBe(false)
    expect(ctx.opponents_before_my_next).toBeUndefined()   // keine Snake-Mathe fuer Auctions
  })

  it('zaehlt die Byes meiner markierten Spieler', () => {
    const board = [
      { ...mockBoard[0], status: 'me', bye: 6 },
      { ...mockBoard[1], status: 'me', bye: 6 },
      { ...mockBoard[2], status: 'me', bye: 11 },
    ]
    const ctx = ctxOf(buildAIAdviceRequest({ ...baseParams, boardPlayers: board, scoringType: 'standard' }))
    expect(ctx.my_team.bye_weeks).toEqual({ 6: 2, 11: 1 })
  })

  it('reicht die Gratis-Tipps gekappt als Signale durch', () => {
    const tips = Array.from({ length: 10 }, (_, i) => ({ type: 'value', text: `Tipp ${i}`, severity: 'info' }))
    const ctx = ctxOf(buildAIAdviceRequest({ ...baseParams, tips, scoringType: 'standard' }))
    expect(ctx.tips_signals).toHaveLength(7)
    expect(ctx.tips_signals[0]).toEqual({ type: 'value', text: 'Tipp 0' })
  })

  it('favBonus wirkt — egal ob in options oder top-level uebergeben', () => {
    const a = ctxOf(buildAIAdviceRequest({ ...baseParams, options: { favBonus: 6 }, scoringType: 'standard' }))
    const b = ctxOf(buildAIAdviceRequest({ ...baseParams, favBonus: 6, scoringType: 'standard' }))
    expect(a.user_bias.weights.fav_bonus).toBe(6)
    expect(b.user_bias.weights.fav_bonus).toBe(6)
  })
})

describe('buildAIAdviceRequest — Schema & Prompt', () => {
  it('das Tool verlangt Vergleich, Survival und Plan', () => {
    const req = buildAIAdviceRequest({ ...baseParams, scoringType: 'standard' })
    const schema = req.tools[0].input_schema
    expect(schema.required).toEqual(expect.arrayContaining(['primary', 'alternatives', 'survival', 'plan_next_picks']))
    expect(schema.properties.alternatives.items.required).toContain('tradeoff_vs_primary')
    expect(schema.properties.survival.items.properties.verdict.enum)
      .toEqual(['duerfte_da_sein', 'muenzwurf', 'duerfte_weg_sein'])
  })
  it('der Prompt erzwingt Deutsch und verbietet erfundene Survival-Gruende', () => {
    const req = buildAIAdviceRequest({ ...baseParams, scoringType: 'standard' })
    expect(req.system).toMatch(/Deutsch/)
    expect(req.system).toMatch(/du-Form/)
    expect(req.system).toMatch(/high.*low|low.*high/)
    expect(req.max_tokens).toBe(2000)
  })
  it('auch der Rookie-Prompt ist deutsch und behaelt die Rookie-Regeln', () => {
    const req = buildAIAdviceRequest({ ...baseParams, draftMode: 'rookie' })
    expect(req.system).toMatch(/Deutsch/)
    expect(req.system).toMatch(/[Tt]axi/)
  })
})
