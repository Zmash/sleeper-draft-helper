import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import NewsSignalMark from './NewsSignalMark'
import BoardTable from './BoardTable'

describe('NewsSignalMark', () => {
  it.each([
    ['up', '↑', 'mehr Rolle'],
    ['down', '↓', 'weniger Rolle'],
    ['injury', '+', 'Ausfall'],
  ])('%s zeigt %s mit Klartext fuer Screenreader und Tooltip', (signal, glyph, label) => {
    render(<NewsSignalMark info={{ signal, headline: 'Schlagzeile' }} />)
    const el = screen.getByRole('img')
    expect(el.textContent).toBe(glyph)
    expect(el.getAttribute('aria-label')).toBe(`Neue Meldung: ${label} — Schlagzeile`)
    expect(el.getAttribute('title')).toBe(`Neue Meldung: ${label} — Schlagzeile`)
    expect(el.className).toContain(`news-mark--${signal}`)
  })

  it('rendert nichts ohne Signal oder bei unbekanntem Wert', () => {
    const { container, rerender } = render(<NewsSignalMark info={null} />)
    expect(container.innerHTML).toBe('')
    rerender(<NewsSignalMark info={{ signal: null, headline: 'x' }} />)
    expect(container.innerHTML).toBe('')
    rerender(<NewsSignalMark info={{ signal: 'boom', headline: 'x' }} />)
    expect(container.innerHTML).toBe('')
  })
})

describe('BoardTable — News-Markierung in der Zeile', () => {
  afterEach(() => { delete global.fetch })

  it('zeigt die Markierung, sobald das Signal da ist', async () => {
    global.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        ok: true, enabled: true,
        signals: { 'Puka Nacua': { signal: 'injury', headline: 'Ruled out', p: { up: 0, down: 0, out: 0.9 } } },
      }),
    }))
    render(
      <BoardTable
        filteredPlayers={[{ name: 'Puka Nacua', nname: 'puka nacua', pos: 'WR', team: 'LAR', rk: '1' }]}
      />,
    )
    const mark = await screen.findByLabelText('Neue Meldung: Ausfall — Ruled out', {}, { timeout: 2000 })
    expect(mark.textContent).toBe('+')
    expect(global.fetch).toHaveBeenCalledWith('/api/news/signals', expect.objectContaining({ method: 'POST' }))
  })
})
