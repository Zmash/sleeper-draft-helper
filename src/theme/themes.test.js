import { describe, it, expect } from 'vitest'
import { THEMES, DEFAULT_THEME_ID } from './themes'

describe('theme registry', () => {
  it('exposes broadcast-dark and broadcast-light', () => {
    expect(THEMES.map((t) => t.id)).toEqual(['broadcast-dark', 'broadcast-light'])
  })
  it('defaults to broadcast-dark', () => {
    expect(DEFAULT_THEME_ID).toBe('broadcast-dark')
    expect(THEMES.find((t) => t.id === DEFAULT_THEME_ID).kind).toBe('dark')
  })
})
