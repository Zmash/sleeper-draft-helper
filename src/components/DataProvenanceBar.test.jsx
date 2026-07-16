import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import DataProvenanceBar, { formatMarketAge, isStale } from './DataProvenanceBar'

describe('formatMarketAge', () => {
  it('heute', () => expect(formatMarketAge('2026-07-16', new Date('2026-07-16'))).toBe('heute'))
  it('gestern', () => expect(formatMarketAge('2026-07-15', new Date('2026-07-16'))).toBe('gestern'))
  it('vor N Tagen', () => expect(formatMarketAge('2026-07-10', new Date('2026-07-16'))).toBe('vor 6 Tagen'))
  it('ohne Datum', () => expect(formatMarketAge(null, new Date('2026-07-16'))).toBeNull())
})

describe('isStale', () => {
  it('7 Tage sind noch frisch — das ist die FFC-Fensterbreite', () => {
    expect(isStale('2026-07-09', new Date('2026-07-16'))).toBe(false)
  })
  it('ab 8 Tagen veraltet', () => {
    expect(isStale('2026-07-08', new Date('2026-07-16'))).toBe(true)
  })
  it('ohne Datum nicht veraltet', () => expect(isStale(null, new Date())).toBe(false))
})

describe('DataProvenanceBar', () => {
  const meta = { source: 'ffc', format: 'ppr', total_drafts: 2072, end_date: '2026-07-10' }

  it('nennt beide Quellen, die Draft-Zahl und den Modus', () => {
    render(<DataProvenanceBar marketMeta={meta} draftMode="redraft" now={new Date('2026-07-16')} />)
    expect(screen.getByText(/FantasyCalc/)).toBeTruthy()
    expect(screen.getByText(/Fantasy Football Calculator/)).toBeTruthy()
    expect(screen.getByText(/2072 Mocks/)).toBeTruthy()
    expect(screen.getByText(/Redraft/)).toBeTruthy()
  })

  it('CSV-Board: keine Auto-Quellen, kein Aktualisieren-Button', () => {
    render(<DataProvenanceBar marketMeta={null} hasCsvBoard csvFileName="ranks.csv" draftMode="redraft" />)
    expect(screen.getByText(/ranks\.csv/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Aktualisieren/ })).toBeNull()
  })

  it('ohne ADP wird das benannt statt verschwiegen', () => {
    render(<DataProvenanceBar marketMeta={null} draftMode="redraft" />)
    expect(screen.getByText(/ADP fehlt/)).toBeTruthy()
  })

  it('Aktualisieren ruft onRefresh', async () => {
    const onRefresh = vi.fn()
    render(<DataProvenanceBar marketMeta={meta} draftMode="redraft" onRefresh={onRefresh} now={new Date('2026-07-16')} />)
    screen.getByRole('button', { name: /Aktualisieren/ }).click()
    expect(onRefresh).toHaveBeenCalled()
  })

  it('veraltete Daten werden hervorgehoben', () => {
    const { container } = render(
      <DataProvenanceBar marketMeta={{ ...meta, end_date: '2026-07-01' }} draftMode="redraft" now={new Date('2026-07-16')} />
    )
    expect(container.querySelector('.provenance-stale')).toBeTruthy()
  })

  it('Rookie-Modus wird angezeigt — ein falscher Modus ist damit sichtbar statt still', () => {
    render(<DataProvenanceBar marketMeta={null} draftMode="rookie" />)
    expect(screen.getByText(/Rookie/)).toBeTruthy()
  })
})
