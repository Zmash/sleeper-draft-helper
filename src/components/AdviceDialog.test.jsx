import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AdviceDialog from './AdviceDialog'

const advice = {
  primary: { player_nname: 'bijan robinson', player_display: 'Bijan Robinson', pos: 'RB', rk: 2, why: 'Bester RB-Value.', fit_score: 91 },
  alternatives: [
    { player_nname: 'puka nacua', player_display: 'Puka Nacua', pos: 'WR', rk: 4, why: 'WR1-Profil.', tradeoff_vs_primary: 'Nimmst du Bijan, ist Puka bei Pick 17 wahrscheinlich weg.' },
  ],
  survival: [
    { player_nname: 'puka nacua', verdict: 'duerfte_weg_sein', reason: 'Wird typisch zwischen 4 und 9 gezogen.' },
  ],
  plan_next_picks: [
    { pick_number: 17, target_positions: ['WR', 'TE'], candidate_nnames: ['jamarr chase'], note: 'WR-Tier kippt vor Runde 3.' },
  ],
  run_alert: { pos: 'RB', note: '5 der letzten 12 Picks waren RBs.' },
  strategy_notes: 'RB-Anker zuerst.',
}

describe('AdviceDialog', () => {
  it('rendert Empfehlung, Trade-off, Survival-Verdict, Plan und Run-Hinweis', () => {
    render(<AdviceDialog open advice={advice} onClose={() => {}} myNextPick={17} />)
    expect(screen.getByText('Bijan Robinson')).toBeTruthy()
    expect(screen.getByText(/ist Puka bei Pick 17 wahrscheinlich weg/)).toBeTruthy()
    expect(screen.getByText(/dürfte weg sein/)).toBeTruthy()
    expect(screen.getByText(/WR-Tier kippt/)).toBeTruthy()
    expect(screen.getByText(/5 der letzten 12 Picks/)).toBeTruthy()
  })

  it('zeigt Validierungs-Warnungen sichtbar an', () => {
    render(<AdviceDialog open advice={advice} warnings={['AI nannte „Geist" — nicht (mehr) verfügbar, aussortiert.']} onClose={() => {}} />)
    expect(screen.getByText(/Geist/)).toBeTruthy()
  })

  it('zeigt den echten Verbrauch im Footer erst nach Klick auf den Kosten-Hinweis', async () => {
    render(<AdviceDialog open advice={advice} usage={{ input_tokens: 9234, output_tokens: 811 }} model="claude-sonnet-5" onClose={() => {}} />)
    expect(screen.queryByText(/9,2k in/)).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: /Kosten anzeigen/i }))
    expect(screen.getByText(/9,2k in/)).toBeTruthy()
  })

  it('advice null + Warnungen: Warnungen statt leerer Empfehlung', () => {
    render(<AdviceDialog open advice={null} warnings={['Keine der genannten Optionen ist auf dem Board verfügbar.']} onClose={() => {}} />)
    expect(screen.getByText(/Keine der genannten Optionen/)).toBeTruthy()
  })
})
