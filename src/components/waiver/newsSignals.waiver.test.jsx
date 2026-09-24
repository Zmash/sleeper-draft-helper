import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import RecommendedLineupCard from './RecommendedLineupCard'
import PickupSuggestions from './PickupSuggestions'
import StreamingBoard from './StreamingBoard'
import AllTeamsOverview from './AllTeamsOverview'

// Jev-News-Markierungen in den Saison-Karten (Lineup + Waiver). Der Server
// ist gemockt: "Puka Nacua" faellt aus, "Tank Bigsby" bekommt mehr Rolle.
const SIGNALS = {
  'Puka Nacua': { signal: 'injury', headline: 'Likely to miss Week 3', p: { up: 0, down: 0, out: 1 } },
  'Tank Bigsby': { signal: 'up', headline: 'Named starter', p: { up: 0.9, down: 0, out: 0 } },
}

let requested = []
beforeEach(() => {
  requested = []
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => false })
  global.fetch = vi.fn(async (_url, init) => {
    const { players } = JSON.parse(init.body)
    requested.push(...players.map((p) => p.name))
    const signals = Object.fromEntries(players.map((p) => [p.name, SIGNALS[p.name] || null]))
    return { ok: true, json: async () => ({ ok: true, enabled: true, signals }) }
  })
})
afterEach(() => { delete global.fetch })

const findMark = (label) => screen.findByLabelText(label, {}, { timeout: 2000 })

describe('RecommendedLineupCard', () => {
  it('markiert Starter und Bank', async () => {
    render(
      <RecommendedLineupCard
        lineup={{
          slots: [{ slot: 'WR', slotIndex: 0, player: { name: 'Puka Nacua', pos: 'WR', team: 'LAR', sleeper_id: '1' }, rank: 5 }],
          bench: [{ name: 'Tank Bigsby', pos: 'RB', team: 'JAX', sleeper_id: '2', rank: 40 }],
        }}
      />,
    )
    expect((await findMark('Neue Meldung: Ausfall — Likely to miss Week 3')).textContent).toBe('+')
    expect((await findMark('Neue Meldung: mehr Rolle — Named starter')).textContent).toBe('↑')
  })
})

describe('PickupSuggestions', () => {
  it('markiert Pickup-Kandidaten mit mehr Rolle', async () => {
    render(<PickupSuggestions players={[{ player_id: '2', name: 'Tank Bigsby', pos: 'RB', team: 'JAX', value: 80 }]} />)
    expect((await findMark('Neue Meldung: mehr Rolle — Named starter')).textContent).toBe('↑')
  })
})

describe('StreamingBoard', () => {
  it('fragt QB/TE an, aber keine Defenses', async () => {
    render(
      <StreamingBoard
        positions={['DEF', 'QB']}
        availablePositions={['DEF', 'QB']}
        onTogglePosition={() => {}}
        board={{
          DEF: { week: [{ player_id: 'HOU', name: 'Houston Texans', pos: 'DEF', rank: 1 }], ros: [] },
          QB: { week: [{ player_id: '3', name: 'Puka Nacua', pos: 'QB', rank: 1 }], ros: [] },
        }}
      />,
    )
    await findMark('Neue Meldung: Ausfall — Likely to miss Week 3')
    expect(requested).toEqual(['Puka Nacua'])
  })
})

describe('AllTeamsOverview', () => {
  it('markiert Spieler ueber alle Ligen', async () => {
    render(
      <AllTeamsOverview
        rows={[{
          leagueId: 'L1', leagueName: 'Liga 1', isStarter: true, severity: 'red', reasons: ['out'],
          player: { name: 'Puka Nacua', pos: 'WR', team: 'LAR', sleeper_id: '1' },
        }]}
      />,
    )
    expect((await findMark('Neue Meldung: Ausfall — Likely to miss Week 3')).textContent).toBe('+')
  })
})
