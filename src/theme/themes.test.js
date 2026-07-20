import { describe, it, expect } from 'vitest'
import { THEMES, DEFAULT_THEME_ID } from './themes'

describe('theme registry', () => {
  it('exposes the broadcast family (dark, light, pinkluke, crimson, vikings)', () => {
    expect(THEMES.map((t) => t.id)).toEqual([
      'broadcast-dark',
      'broadcast-light',
      'broadcast-pinkluke',
      'broadcast-crimson',
      'broadcast-vikings',
    ])
  })

  it('defaults to broadcast-dark', () => {
    expect(DEFAULT_THEME_ID).toBe('broadcast-dark')
    expect(THEMES.find((t) => t.id === DEFAULT_THEME_ID).kind).toBe('dark')
  })

  it('has both a dark and a light theme for the OS preference', () => {
    expect(THEMES.some((t) => t.kind === 'dark')).toBe(true)
    expect(THEMES.some((t) => t.kind === 'light')).toBe(true)
  })

  it('every entry exposes id, label, kind', () => {
    for (const t of THEMES) {
      expect(typeof t.id).toBe('string')
      expect(typeof t.label).toBe('string')
      expect(['dark', 'light']).toContain(t.kind)
    }
  })
})
