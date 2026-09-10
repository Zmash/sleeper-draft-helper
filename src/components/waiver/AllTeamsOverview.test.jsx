import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import AllTeamsOverview from './AllTeamsOverview'

const rows = [
  {
    leagueId: 'l1', leagueName: 'Liga A',
    player: { sleeper_id: '1', name: 'Bye Starter', pos: 'WR', team: 'DET' },
    isStarter: true, isRecommended: false, severity: 'red', reasons: ['bye'],
  },
  {
    leagueId: 'l2', leagueName: 'Liga B',
    player: { sleeper_id: '8', name: 'Optimaler', pos: 'TE', team: 'PHI' },
    isStarter: true, isRecommended: true, severity: 'green', reasons: [],
  },
]

describe('AllTeamsOverview', () => {
  it('zeigt Warnzähler und sortiert Probleme nach oben', () => {
    const { container } = render(<AllTeamsOverview rows={rows} onSelectPlayer={() => {}} />)
    expect(container.textContent).toContain('Liga A')
    expect(container.textContent).toContain('Liga B')
    const items = container.querySelectorAll('[data-severity]')
    expect(items[0].getAttribute('data-severity')).toBe('red')
  })

  it('ruft onSelectPlayer beim Anklicken auf', () => {
    const onSelect = vi.fn()
    const { container } = render(<AllTeamsOverview rows={rows} onSelectPlayer={onSelect} />)
    fireEvent.click(container.querySelector('[data-severity]'))
    expect(onSelect).toHaveBeenCalled()
  })
})
