import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../stores/useGamesLiveStore', () => {
  const s = { liveCount: 0 }
  const h = (sel) => (sel ? sel(s) : s); h.getState = () => s
  return { useGamesLiveStore: h }
})

import MobileNav from './MobileNav'

const renderNav = (props = {}) => render(
  <MemoryRouter><MobileNav onSync={() => {}} {...props} /></MemoryRouter>
)
const dot = (c) => c.querySelector('.bmb-fab-auto')

describe('MobileNav — Punkt am Sync-Knopf', () => {
  it('gruen, solange Auto-Sync laeuft und der Stand frisch ist', () => {
    const { container } = renderNav({ autoRefreshActive: true, lastSyncAt: Date.now(), staleSeconds: 90 })
    expect(dot(container)).toBeInTheDocument()
    expect(dot(container)).not.toHaveClass('is-stale')
  })

  it('rot, sobald der Stand aelter als die Schwelle ist', () => {
    const { container } = renderNav({
      autoRefreshActive: true, lastSyncAt: Date.now() - 120_000, staleSeconds: 90,
    })
    expect(dot(container)).toHaveClass('is-stale')
  })

  it('rot auch bei ausgeschaltetem Auto-Sync — gerade dann soll man es sehen', () => {
    const { container } = renderNav({
      autoRefreshActive: false, lastSyncAt: Date.now() - 120_000, staleSeconds: 90,
    })
    expect(dot(container)).toHaveClass('is-stale')
  })

  it('kein Punkt ohne Auto-Sync und ohne veralteten Stand', () => {
    const { container } = renderNav({ autoRefreshActive: false, lastSyncAt: Date.now(), staleSeconds: 90 })
    expect(dot(container)).not.toBeInTheDocument()
  })

  it('kein Punkt auf Seiten ohne Schwelle, egal wie alt der Stand ist', () => {
    const { container } = renderNav({ autoRefreshActive: false, lastSyncAt: 0, staleSeconds: null })
    expect(dot(container)).not.toBeInTheDocument()
  })

  it('nennt den veralteten Stand auch im Label, nicht nur in der Farbe', () => {
    const { container } = renderNav({
      syncLabel: 'Picks aktualisieren', lastSyncAt: Date.now() - 999_000, staleSeconds: 90,
    })
    expect(container.querySelector('.bmb-fab')).toHaveAttribute('aria-label', 'Picks aktualisieren — Stand veraltet')
  })
})

describe('MobileNav — Auto-Sync-Sheet per Long-Press', () => {
  // Der Store ist modulweit: ohne Reset traegt ein Test seinen Schalterstand
  // in den naechsten.
  beforeEach(async () => {
    vi.useFakeTimers()
    const { useUIStore } = await import('../stores/useUIStore')
    useUIStore.getState().setAutoSyncEnabled(true)
  })
  afterEach(() => vi.useRealTimers())

  const press = (el, ms) => {
    fireEvent.pointerDown(el)
    act(() => { vi.advanceTimersByTime(ms) })
    fireEvent.pointerUp(el)
    fireEvent.click(el)
  }

  it('kurzer Tap aktualisiert, ohne das Sheet zu oeffnen', () => {
    const onSync = vi.fn()
    const { container } = renderNav({ onSync })
    press(container.querySelector('.bmb-fab'), 100)
    expect(onSync).toHaveBeenCalledTimes(1)
    expect(container.querySelector('.bmb-tips-sheet')).not.toHaveClass('is-open')
  })

  it('langer Druck oeffnet das Sheet und loest KEIN Aktualisieren aus', () => {
    const onSync = vi.fn()
    const { container } = renderNav({ onSync })
    press(container.querySelector('.bmb-fab'), 600)
    expect(container.querySelector('.bmb-tips-sheet')).toHaveClass('is-open')
    expect(onSync).not.toHaveBeenCalled()
  })

  it('schaltet den seitenuebergreifenden Auto-Sync im Sheet', async () => {
    const { useUIStore } = await import('../stores/useUIStore')
    const { container } = renderNav({ autoSeconds: 300 })
    press(container.querySelector('.bmb-fab'), 600)
    const box = container.querySelector('.bmb-tips-sheet input[type="checkbox"]')
    expect(box).toBeChecked()
    fireEvent.click(box)
    expect(useUIStore.getState().autoSyncEnabled).toBe(false)
  })

  it('nennt den Takt der offenen Seite', () => {
    const { container } = renderNav({ autoSeconds: 300 })
    press(container.querySelector('.bmb-fab'), 600)
    expect(container.querySelector('.bmb-tips-sheet').textContent).toContain('alle 5 min')
  })
})

describe('MobileNav — Punkt tickt ohne neue Daten weiter', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('faerbt sich rot, waehrend die Seite offen bleibt', () => {
    const { container } = renderNav({ autoRefreshActive: true, lastSyncAt: Date.now(), staleSeconds: 30 })
    expect(dot(container)).not.toHaveClass('is-stale')
    act(() => { vi.advanceTimersByTime(45_000) })
    expect(dot(container)).toHaveClass('is-stale')
  })
})
