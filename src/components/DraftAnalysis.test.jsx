import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import DraftAnalysis from './DraftAnalysis'

vi.mock('../services/key', () => ({ getOpenAIKey: () => 'test-key' }))
vi.mock('../services/aiDraftReviewClient', () => ({
  buildDraftReviewContext: vi.fn((args) => ({ ...args, _ctx: true })),
  buildDraftReviewPayload: vi.fn((ctx, opts) => ({ ctx, opts })),
  callAiDraftReview: vi.fn(),
}))

import { buildDraftReviewContext, buildDraftReviewPayload, callAiDraftReview } from '../services/aiDraftReviewClient'

const emptyParsed = {
  overallSummary: '',
  overallRankings: [],
  teamOneLiners: [],
  steals: [],
  reaches: [],
  myTeamDeepDive: {},
  lessonsForNextMock: [],
}

const baseProps = {
  scores: [],
  ownerLabels: new Map(),
  league: { league_id: 'l1' },
  picks: [{ pick_no: 1, picked_by: 'u1' }],
  teamByRosterId: { 'roster:user:u1': { owner_id: 'u1', players: [] } },
  myOwnerId: 'u1',
  myRosterId: 'roster:user:u1',
  board: null,
  draftMode: 'redraft',
  format: { scoringType: 'ppr', teams: 10, isSuperflex: false },
  reviewResult: null,
  onReviewResult: () => {},
}

describe('DraftAnalysis — Button statt Auto-Call', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('feuert keinen AI-Call automatisch beim Rendern — Button mit Kostenschaetzung sichtbar', () => {
    render(<DraftAnalysis {...baseProps} />)
    expect(callAiDraftReview).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Review starten' })).toBeTruthy()
  })

  it('startet den Call erst per Klick, mit draftMode und format, und meldet das Ergebnis nach oben', async () => {
    const onReviewResult = vi.fn()
    callAiDraftReview.mockResolvedValue({
      parsed: { ...emptyParsed, overallSummary: 'Zusammenfassung' },
      usage: { input_tokens: 10, output_tokens: 5 },
      model: 'claude-sonnet-5',
    })
    render(<DraftAnalysis {...baseProps} onReviewResult={onReviewResult} />)

    fireEvent.click(screen.getByRole('button', { name: 'Review starten' }))

    await waitFor(() => expect(callAiDraftReview).toHaveBeenCalledTimes(1))
    expect(buildDraftReviewContext).toHaveBeenCalledWith(expect.objectContaining({ draftMode: 'redraft' }))
    expect(buildDraftReviewPayload).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ format: baseProps.format })
    )
    await waitFor(() => expect(onReviewResult).toHaveBeenCalledWith({
      parsed: { ...emptyParsed, overallSummary: 'Zusammenfassung' },
      usage: { input_tokens: 10, output_tokens: 5 },
      model: 'claude-sonnet-5',
    }))
  })

  it('rendert ein gecachtes Ergebnis ohne erneuten Call und zeigt "Neu berechnen"', () => {
    render(<DraftAnalysis {...baseProps} reviewResult={{
      parsed: { ...emptyParsed, overallSummary: 'Zusammenfassung' }, usage: null, model: null,
    }} />)
    expect(callAiDraftReview).not.toHaveBeenCalled()
    expect(screen.getByText('Zusammenfassung')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Neu berechnen' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Review starten' })).toBeNull()
  })

  it('rendert die Learnings-Sektion statt des toten Week-1-Blocks', () => {
    render(<DraftAnalysis {...baseProps} reviewResult={{
      parsed: {
        ...emptyParsed,
        lessonsForNextMock: [{ lesson: 'Reache nicht bei RB2', evidence: 'Pick 14 war 2 Tiers zu frueh.' }],
      },
      usage: null, model: null,
    }} />)
    expect(screen.getByText('Learnings für den nächsten Mock')).toBeTruthy()
    expect(screen.getByText('Reache nicht bei RB2')).toBeTruthy()
    expect(screen.getByText('Pick 14 war 2 Tiers zu frueh.')).toBeTruthy()
    expect(screen.queryByText(/Week 1/)).toBeNull()
    expect(screen.queryByText(/Start\/Sit/)).toBeNull()
  })

  it('zeigt den Fallback-Hinweis, wenn myRosterId nicht im teamByRosterId enthalten ist', () => {
    render(<DraftAnalysis {...baseProps} myRosterId="unbekannt" reviewResult={{
      parsed: emptyParsed, usage: null, model: null,
    }} />)
    expect(screen.getByText(/Dein Team konnte nicht sicher erkannt werden/)).toBeTruthy()
  })

  it('zeigt keinen Fallback-Hinweis, wenn myRosterId gueltig ist', () => {
    render(<DraftAnalysis {...baseProps} reviewResult={{ parsed: emptyParsed, usage: null, model: null }} />)
    expect(screen.queryByText(/Dein Team konnte nicht sicher erkannt werden/)).toBeNull()
  })

  it('zeigt den echten Verbrauch im Footer, wenn usage vorhanden ist', () => {
    render(<DraftAnalysis {...baseProps} reviewResult={{
      parsed: emptyParsed,
      usage: { input_tokens: 9234, output_tokens: 811 },
      model: 'claude-sonnet-5',
    }} />)
    expect(screen.getByText(/9,2k in/)).toBeTruthy()
  })
})
