import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { buildAdviceRequestArgs, ADVICE_REQUEST_OPTIONS } from './adviceRequestArgs'
import { buildAIAdviceRequest } from './ai'

// Regression: die Kostenschaetzung am Advice-Button baute den Payload mit
// options: {} (Defaults topNOverall=40, topPerPos=10) waehrend der echte Call
// topNOverall=60, topPerPos=20 nutzte -- die Anzeige unterschaetzte die echten
// Kosten fast um die Haelfte. buildAdviceRequestArgs() ist jetzt die EINZIGE
// Quelle fuer diesen Argumente-Block, genutzt von Schaetzung UND echtem Call.

const baseInputs = {
  boardPlayers: [
    { rk: 1, name: 'Justin Jefferson', nname: 'justin jefferson', pos: 'WR', team: 'MIN', adp: 16.4, bye: 6 },
  ],
  livePicks: [],
  meUserId: 'u1',
  league: { league_id: 'l1', scoring_settings: { rec: 1 } },
  draft: { draft_id: 'd1', settings: { teams: 10, rounds: 15 } },
  currentPickNumber: 4,
  draftSlot: 3,
  tips: null,
  scoringType: 'ppr',
  isSuperflex: false,
  rosterPositions: ['QB', 'RB', 'WR', 'TE', 'FLEX', 'BN'],
  teamsCount: 10,
  draftMode: 'redraft',
  dynastyRoster: [],
  myDraftPicks: [],
  customStrategyText: 'Draft RBs early',
  playerPreferences: { 'justin jefferson': 'favorite' },
}

describe('buildAdviceRequestArgs — EINE Quelle fuer Schaetzung und echten Call', () => {
  it('nutzt immer die "echten" Options-Werte (topNOverall 60, topPerPos 20, favBonus 6, avoidPenalty 10)', () => {
    // Diese Werte sind identisch mit denen, die der echte /api/ai-advice-Call
    // nutzt (BoardSection.jsx doAskAIWithKey). Eine Schaetzung mit kleineren
    // Defaults waere wieder die urspruengliche Kostenluege.
    expect(ADVICE_REQUEST_OPTIONS).toEqual({
      topNOverall: 60,
      topPerPos: 20,
      temperature: 0.2,
      favBonus: 6,
      avoidPenalty: 10,
    })
    const args = buildAdviceRequestArgs(baseInputs)
    expect(args.options).toBe(ADVICE_REQUEST_OPTIONS)
  })

  it('mischt roster_positions und total_rosters in die league ein, wie der echte Call', () => {
    const args = buildAdviceRequestArgs(baseInputs)
    expect(args.league.roster_positions).toEqual(baseInputs.rosterPositions)
    expect(args.league.total_rosters).toBe(10)
    expect(args.league.league_id).toBe('l1') // Rest der Liga bleibt erhalten
  })

  it('gibt customStrategyText und playerPreferences weiter, statt sie auszulassen', () => {
    // Regression: die Schaetzung liess beide Felder komplett weg, obwohl
    // customStrategyText bis zu 4000 Zeichen gross werden kann.
    const args = buildAdviceRequestArgs(baseInputs)
    expect(args.customStrategyText).toBe('Draft RBs early')
    expect(args.playerPreferences).toEqual({ 'justin jefferson': 'favorite' })
  })

  it('normalisiert eine nicht-endliche currentPickNumber zu null, wie der echte Call', () => {
    const args = buildAdviceRequestArgs({ ...baseInputs, currentPickNumber: undefined })
    expect(args.currentPickNumber).toBeNull()
  })

  it('faellt bei fehlenden customStrategyText/playerPreferences auf leere Defaults zurueck', () => {
    const { customStrategyText, playerPreferences, ...rest } = baseInputs
    const args = buildAdviceRequestArgs(rest)
    expect(args.customStrategyText).toBe('')
    expect(args.playerPreferences).toEqual({})
  })

  it('baut denselben Payload-Umfang wie die Schaetzung, wenn beide Aufrufer dieselben Werte uebergeben', () => {
    // Der eigentliche Beweis gegen Drift: Schaetz-Aufruf (adviceEstimate) und
    // echter Aufruf (doAskAIWithKey) speisen beide durch buildAdviceRequestArgs.
    // Mit identischen Rohdaten muss buildAIAdviceRequest(...) denselben
    // Options-Block und dieselbe Payload-Groesse liefern. timestamp_iso im
    // Context ist der einzige nicht-deterministische Wert -- Zeit einfrieren,
    // damit der Vergleich nicht auf Millisekunden-Drift hereinfaellt.
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-17T12:00:00Z'))
    try {
      const estimateArgs = buildAdviceRequestArgs(baseInputs)
      const realArgs = buildAdviceRequestArgs(baseInputs)
      expect(estimateArgs).toEqual(realArgs)

      const estimatePayload = buildAIAdviceRequest(estimateArgs)
      const realPayload = buildAIAdviceRequest(realArgs)
      expect(estimatePayload).toEqual(realPayload)

      const ctx = JSON.parse(
        estimatePayload.messages[0].content.match(/<CONTEXT_JSON>\n([\s\S]*)\n<\/CONTEXT_JSON>/)[1]
      )
      expect(ctx.custom_strategy).toBe('Draft RBs early')
    } finally {
      vi.useRealTimers()
    }
  })
})
