import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import {
  WeekPicker, RecordStrip, LeagueResults, OutlierBoard, InjuryList, BenchReport, PositionBars,
} from './WeeklyParts'

const player = (over = {}) => ({
  playerId: 'P1', name: 'Joe Burrow', pos: 'QB', points: 28.4, projected: 20, delta: 8.4,
  leagues: [{ leagueId: 'L1', leagueName: 'Büro-Liga' }], ...over,
})

describe('WeekPicker', () => {
  const weeks = [3, 2, 1]

  it('blaettert zurueck und vor', () => {
    const onPick = vi.fn()
    render(<WeekPicker week={2} weeks={weeks} onPick={onPick} />)
    fireEvent.click(screen.getByRole('button', { name: 'Woche zurück' }))
    expect(onPick).toHaveBeenCalledWith(1)
    fireEvent.click(screen.getByRole('button', { name: 'Woche vor' }))
    expect(onPick).toHaveBeenCalledWith(3)
  })

  it('sperrt die Enden', () => {
    const { rerender } = render(<WeekPicker week={3} weeks={weeks} onPick={() => {}} />)
    expect(screen.getByRole('button', { name: 'Woche vor' })).toBeDisabled()
    rerender(<WeekPicker week={1} weeks={weeks} onPick={() => {}} />)
    expect(screen.getByRole('button', { name: 'Woche zurück' })).toBeDisabled()
  })

  it('erlaubt den direkten Sprung ueber die Auswahl', () => {
    const onPick = vi.fn()
    render(<WeekPicker week={3} weeks={weeks} onPick={onPick} />)
    fireEvent.change(screen.getByLabelText('Woche'), { target: { value: '1' } })
    expect(onPick).toHaveBeenCalledWith(1)
  })
})

describe('RecordStrip', () => {
  it('zeigt Bilanz, Punkte, Trefferquote und Bankverlust', () => {
    render(<RecordStrip record={{
      wins: 2, losses: 1, ties: 0, live: 1, leagues: 4,
      totalPoints: 412.55, pointsLeftOnBench: 8.4, hitRate: 0.6, ratedStarters: 20,
    }} />)
    expect(screen.getByText('2–1')).toBeInTheDocument()
    expect(screen.getByText('1 noch offen')).toBeInTheDocument()
    expect(screen.getByText('412.6')).toBeInTheDocument()
    expect(screen.getByText('60 %')).toBeInTheDocument()
    expect(screen.getByText('8.4')).toBeInTheDocument()
  })

  it('kommt ohne Trefferquote aus', () => {
    render(<RecordStrip record={{ wins: 0, losses: 0, ties: 0, live: 0, leagues: 0, totalPoints: 0, pointsLeftOnBench: 0, hitRate: null, ratedStarters: 0 }} />)
    expect(screen.getByText('noch keine Wertung')).toBeInTheDocument()
    expect(screen.getByText('optimal aufgestellt')).toBeInTheDocument()
  })
})

describe('LeagueResults', () => {
  const league = (over = {}) => ({
    leagueId: 'L1', leagueName: 'Büro-Liga', leagueAvatar: null, result: 'win',
    myPoints: 120.4, opponentPoints: 99.1, opponentName: 'Rivale', margin: 21.3,
    rank: 2, teams: 12, leagueAvg: 104.2, leagueHigh: 140.1, openStarters: 0, ...over,
  })

  it('zeigt Ergebnis, Gegner und Wochenrang', () => {
    render(<LeagueResults leagues={[league()]} />)
    expect(screen.getByText('Sieg')).toBeInTheDocument()
    expect(screen.getByText('120.4')).toBeInTheDocument()
    expect(screen.getByText('gegen Rivale')).toBeInTheDocument()
    expect(screen.getByText('Platz 2/12')).toBeInTheDocument()
    expect(screen.getByText('+21.3')).toBeInTheDocument()
  })

  it('markiert laufende Matchups mit offenen Startern', () => {
    const { container } = render(<LeagueResults leagues={[league({ result: 'live', openStarters: 3 })]} />)
    expect(container.querySelector('.wk-result')).toHaveClass('is-live')
    expect(screen.getByText('3 Starter offen')).toBeInTheDocument()
  })

  it('listet nicht geladene Ligen als Fehler', () => {
    render(<LeagueResults leagues={[]} errors={[{ leagueId: 'L2', leagueName: 'Kaputt', error: 'HTTP 500' }]} />)
    expect(screen.getByText('Nicht geladen (HTTP 500)')).toBeInTheDocument()
  })

  it('sagt Bescheid, wenn es nichts gibt', () => {
    render(<LeagueResults leagues={[]} />)
    expect(screen.getByText(/keine Matchups/)).toBeInTheDocument()
  })
})

describe('OutlierBoard', () => {
  const labels = { over: 'Weit über Projektion', under: 'Weit unter Projektion' }

  it('zeigt beide Spalten mit Differenz und Ligazahl', () => {
    render(<OutlierBoard
      outliers={{
        over: [player()],
        under: [player({ playerId: 'P2', name: 'Jayden Reed', pos: 'WR', points: 1.2, projected: 12, delta: -10.8, leagues: [{ leagueId: 'L1', leagueName: 'A' }, { leagueId: 'L2', leagueName: 'B' }] })],
        pending: 0,
      }}
      labels={labels}
      emptyHint="Keine nennenswerten Abweichungen."
    />)
    expect(screen.getByText('+8.4')).toBeInTheDocument()
    expect(screen.getByText('−10.8')).toBeInTheDocument()
    expect(screen.getByText('2 Ligen')).toBeInTheDocument()
    expect(screen.getByText('28.4 statt 20.0')).toBeInTheDocument()
  })

  it('weist auf noch laufende Spieler hin', () => {
    render(<OutlierBoard outliers={{ over: [], under: [], pending: 4 }} labels={labels} emptyHint="leer" />)
    expect(screen.getByText(/4 Spieler sind noch im Einsatz/)).toBeInTheDocument()
    expect(screen.getAllByText('leer')).toHaveLength(2)
  })
})

describe('InjuryList', () => {
  it('zeigt Status, Schweregrad und betroffene Ligen', () => {
    const { container } = render(<InjuryList entries={[
      { ...player({ playerId: 'P3', name: 'Jayden Reed', pos: 'WR', points: 0, projected: 12, injuryStatus: 'Out' }), severity: 'out', startedIn: [{ leagueId: 'L1', leagueName: 'Büro-Liga' }], benchedIn: [] },
      { ...player({ playerId: 'P4', name: 'Rico Dowdle', pos: 'RB', points: 0, projected: 9, injuryStatus: null }), severity: 'dnp', startedIn: [{ leagueId: 'L1', leagueName: 'Büro-Liga' }], benchedIn: [] },
    ]} />)
    expect(screen.getByText('Out')).toBeInTheDocument()
    expect(screen.getByText('Aufgestellt und ausgefallen')).toBeInTheDocument()
    expect(screen.getByText('Aufgestellt, keine Punkte')).toBeInTheDocument()
    expect(container.querySelectorAll('.wk-inj.is-out')).toHaveLength(1)
    expect(screen.getAllByText('Start: Büro-Liga')).toHaveLength(2)
  })

  it('meldet eine saubere Woche', () => {
    render(<InjuryList entries={[]} />)
    expect(screen.getByText(/Keine Verletzungen/)).toBeInTheDocument()
  })
})

describe('BenchReport', () => {
  const base = {
    leagueId: 'L1', leagueName: 'Büro-Liga', efficiency: 0.82, optimalPoints: 128.4, pointsLeftOnBench: 23.1,
    misses: [{ in: { name: 'Bank Held', points: 21 }, out: { name: 'Rico Dowdle', points: 2 }, gain: 19 }],
  }

  it('zeigt Effizienz und den groessten Fehlgriff', () => {
    render(<BenchReport leagues={[base]} />)
    expect(screen.getByText('82 %')).toBeInTheDocument()
    expect(screen.getByText(/23.1 Punkte auf der Bank/)).toBeInTheDocument()
    expect(screen.getByText('Bank Held 21.0')).toBeInTheDocument()
    expect(screen.getByText('Rico Dowdle 2.0')).toBeInTheDocument()
  })

  it('benennt einen leeren Slot statt eines verdraengten Starters', () => {
    render(<BenchReport leagues={[{ ...base, misses: [{ in: { name: 'Bank Held', points: 21 }, out: null, gain: 21 }] }]} />)
    expect(screen.getByText('Slot leer')).toBeInTheDocument()
  })

  it('lobt die optimale Aufstellung', () => {
    render(<BenchReport leagues={[{ ...base, efficiency: 1, pointsLeftOnBench: 0, misses: [] }]} />)
    expect(screen.getByText('Optimale Aufstellung.')).toBeInTheDocument()
  })

  it('bleibt leer ohne bewertbare Liga', () => {
    render(<BenchReport leagues={[{ ...base, efficiency: null }]} />)
    expect(screen.getByText(/Noch keine Punkte/)).toBeInTheDocument()
  })
})

describe('PositionBars', () => {
  it('zeigt je Position erzielte Punkte und Abweichung', () => {
    render(<PositionBars rows={[
      { pos: 'QB', points: 28.4, projected: 20, delta: 8.4, count: 1 },
      { pos: 'WR', points: 25, projected: 27, delta: -2, count: 2 },
    ]} />)
    expect(screen.getByText('QB')).toBeInTheDocument()
    expect(screen.getByText('+8.4')).toBeInTheDocument()
    expect(screen.getByText('−2.0')).toBeInTheDocument()
  })

  it('meldet fehlende Daten', () => {
    render(<PositionBars rows={[]} />)
    expect(screen.getByText(/Noch keine abgeschlossenen/)).toBeInTheDocument()
  })
})
