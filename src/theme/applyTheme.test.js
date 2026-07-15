import { describe, it, expect, beforeEach } from 'vitest'
import { applyTheme, resolveInitialTheme } from './applyTheme'

beforeEach(() => {
  document.documentElement.removeAttribute('data-theme')
})

describe('applyTheme', () => {
  it('sets data-theme for a valid id', () => {
    applyTheme('broadcast-light')
    expect(document.documentElement.dataset.theme).toBe('broadcast-light')
  })
  it('falls back to default for an unknown id', () => {
    expect(applyTheme('nope')).toBe('broadcast-dark')
    expect(document.documentElement.dataset.theme).toBe('broadcast-dark')
  })
})

describe('resolveInitialTheme', () => {
  it('returns light when the OS prefers light', () => {
    window.matchMedia = (q) => ({
      matches: q.includes('light'),
      media: q,
      addEventListener() {},
      removeEventListener() {},
    })
    expect(resolveInitialTheme()).toBe('broadcast-light')
  })
})
