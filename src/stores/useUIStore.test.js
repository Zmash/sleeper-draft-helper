import { describe, it, expect, beforeEach } from 'vitest'

beforeEach(() => {
  localStorage.clear()
})

describe('useUIStore theming', () => {
  it('migrates legacy themeMode:light to broadcast-light', async () => {
    localStorage.setItem('sdh-ui-v1', JSON.stringify({ state: { themeMode: 'light' }, version: 0 }))
    const { useUIStore } = await import('./useUIStore')
    expect(useUIStore.getState().themeId).toBe('broadcast-light')
  })
  it('setTheme updates themeId', async () => {
    const { useUIStore } = await import('./useUIStore')
    useUIStore.getState().setTheme('broadcast-light')
    expect(useUIStore.getState().themeId).toBe('broadcast-light')
  })
})
