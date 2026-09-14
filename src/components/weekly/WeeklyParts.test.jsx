import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import {
  WeekPicker, RecordStrip, LeagueResults, OutlierBoard, InjuryList, BenchReport, PositionBars,
  DetailTabs, TeamCheck, LeagueFilterDropdown,
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

  it('erlaubt den direkten Sprung ueber das Menue und markiert die laufende Woche', () => {
    const onPick = vi.fn()
    render(<WeekPicker week={3} weeks={weeks} currentWeek={3} onPick={onPick} />)
    const toggle = screen.getByRole('button', { name: 'Woche' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(toggle)
    expect(screen.getByRole('listbox', { name: 'Woche' })).toBeInTheDocument()
    expect(screen.getByText('läuft')).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /Week 3/ })).toHaveAttribute('aria-selected', 'true')
    fireEvent.click(screen.getByRole('option', { name: /Week 1/ }))
    expect(onPick).toHaveBeenCalledWith(1)
    // Auswahl schliesst das Menue wieder.
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('schliesst das Menue mit Escape', () => {
    render(<WeekPicker week={3} weeks={weeks} currentWeek={3} onPick={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Woche' }))
    expect(screen.getByRole('listbox')).toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('benutzt kein natives select (dessen Liste zeichnet das OS)', () => {
    const { container } = render(<WeekPicker week={3} weeks={weeks} onPick={() => {}} />)
    expect(container.querySelector('select')).toBeNull()
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
    // Differenz zur besten Aufstellung, nicht die Summe der Bankpunkte.
    expect(screen.getByText('Verschenkte Punkte')).toBeInTheDocument()
    expect(screen.getByText('gegen die beste Aufstellung')).toBeInTheDocument()
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

  it('spiegelt die Farben fuer die Gegnerseite', () => {
    const over = [player({ delta: 12 })]
    const under = [player({ playerId: 'P9', delta: -12 })]
    // Eigene Starter: ueber Projektion = gut.
    const own = render(<OutlierBoard outliers={{ over, under, pending: 0 }} labels={labels} emptyHint="leer" />)
    expect(own.container.querySelector('.wk-out-bar i')).toHaveClass('is-good')
    own.unmount()
    // Gegner: ueber Projektion hat dich Punkte gekostet -> rot.
    const opp = render(<OutlierBoard
      outliers={{ over, under, pending: 0 }} labels={labels} emptyHint="leer"
      tones={{ over: 'bad', under: 'good' }}
    />)
    const bars = opp.container.querySelectorAll('.wk-out-bar i')
    expect(bars[0]).toHaveClass('is-bad')
    expect(bars[1]).toHaveClass('is-good')
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
    expect(screen.getByText(/23.1 Punkte verschenkt/)).toBeInTheDocument()
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

describe('DetailTabs', () => {
  it('zeigt drei Tabs und schaltet per Klick um', () => {
    const onActive = vi.fn()
    render(<DetailTabs active="du" onActive={onActive} injuryCount={2} />)
    expect(screen.getByRole('tab', { name: /Deine Ausreißer/ })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: /Gegner/ })).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByRole('tab', { name: /Team-Check/ })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: /Gegner/ }))
    expect(onActive).toHaveBeenCalledWith('geg')
  })
})

describe('TeamCheck', () => {
  const benchEntry = (over = {}) => ({
    playerId: 'PB', name: 'Bank Spieler', pos: 'QB', points: 0, projected: 5,
    injuryStatus: 'Out', severity: 'bench', startedIn: [], benchedIn: [{ leagueId: 'L1', leagueName: 'Büro-Liga' }],
    leagues: [{ leagueId: 'L1', leagueName: 'Büro-Liga' }], ...over,
  })
  const urgentEntry = (over = {}) => ({
    playerId: 'PU', name: 'Dringend Fall', pos: 'WR', points: 0, projected: 12,
    injuryStatus: 'Out', severity: 'out', startedIn: [{ leagueId: 'L1', leagueName: 'Büro-Liga' }], benchedIn: [],
    leagues: [{ leagueId: 'L1', leagueName: 'Büro-Liga' }], ...over,
  })

  it('klappt Bank-Betroffene ein und zeigt Dringende offen', () => {
    render(<TeamCheck
      injuries={[urgentEntry(), benchEntry()]}
      leagues={[]}
      positions={[]}
    />)
    expect(screen.getByText('Dringend Fall')).toBeInTheDocument()
    const details = document.querySelector('details.wk-bank')
    expect(details).not.toBeNull()
    expect(details.textContent).toMatch(/Bank Spieler/)
  })
})

describe('LeagueFilterDropdown', () => {
  const leagues = [
    { id: 'L1', label: 'Büro-Liga', avatar: null },
    { id: 'L2', label: 'Dynasty Bros', avatar: null },
  ]

  it('zeigt die Auswahl als Zusammenfassung und toggelt per Menü', () => {
    const onToggle = vi.fn()
    render(<LeagueFilterDropdown leagues={leagues} activeIds={['L1', 'L2']} onToggle={onToggle} onSelectAll={() => {}} />)
    expect(screen.getByRole('button', { name: 'Alle Ligen' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Alle Ligen' }))
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: /Dynasty Bros/ }))
    expect(onToggle).toHaveBeenCalledWith('L2')
  })

  it('bietet Alle Ligen zum Zurücksetzen an', () => {
    const onSelectAll = vi.fn()
    render(<LeagueFilterDropdown leagues={leagues} activeIds={['L1']} onToggle={() => {}} onSelectAll={onSelectAll} />)
    expect(screen.getByRole('button', { name: '1 von 2 Ligen' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '1 von 2 Ligen' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Alle Ligen' }))
    expect(onSelectAll).toHaveBeenCalled()
  })

  it('schliesst das Menü mit Escape', () => {
    render(<LeagueFilterDropdown leagues={leagues} activeIds={['L1', 'L2']} onToggle={() => {}} onSelectAll={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Alle Ligen' }))
    expect(screen.getByRole('menu')).toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })
})

describe('PositionBars', () => {
  it('zeigt je Position erzielte Punkte und Abweichung', () => {
    const { container } = render(<PositionBars rows={[
      { pos: 'QB', points: 28.4, projected: 20, delta: 8.4, count: 1 },
      { pos: 'WR', points: 25, projected: 27, delta: -2, count: 2 },
    ]} />)
    expect(screen.getByText('QB')).toBeInTheDocument()
    expect(screen.getByText('+8.4')).toBeInTheDocument()
    expect(screen.getByText('−2.0')).toBeInTheDocument()
    // Balken = erzielt (grün/rot), Marke = Projektion, beide auf denselben Maximalwert skaliert.
    const rows = container.querySelectorAll('.wk-posrow')
    expect(rows[0].querySelector('.wk-posbar-real')).toHaveClass('is-good')
    expect(rows[1].querySelector('.wk-posbar-real')).toHaveClass('is-bad')
    // Maximum ist 28.4 -> QB-Balken voll, Projektionsmarke bei 20/28.4.
    expect(rows[0].querySelector('.wk-posbar-real')).toHaveStyle({ width: '100%' })
    expect(rows[0].querySelector('.wk-posbar-proj')).toHaveStyle({ left: `${(20 / 28.4) * 100}%` })
  })

  it('meldet fehlende Daten', () => {
    render(<PositionBars rows={[]} />)
    expect(screen.getByText(/Noch keine abgeschlossenen/)).toBeInTheDocument()
  })
})
