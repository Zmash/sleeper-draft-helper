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

describe('autoSyncEnabled', () => {
  it('ist standardmaessig an', async () => {
    const { useUIStore } = await import('./useUIStore')
    expect(useUIStore.getState().autoSyncEnabled).toBe(true)
  })

  it('laesst sich schalten und nimmt nur Booleans', async () => {
    const { useUIStore } = await import('./useUIStore')
    useUIStore.getState().setAutoSyncEnabled(false)
    expect(useUIStore.getState().autoSyncEnabled).toBe(false)
    useUIStore.getState().setAutoSyncEnabled('ja')
    expect(useUIStore.getState().autoSyncEnabled).toBe(true)
  })

  it('schaltet Bestandsnutzer ohne den Schalter auf an, nicht auf undefined', async () => {
    localStorage.setItem('sdh-ui-v1', JSON.stringify({ state: { themeId: 'broadcast-dark' }, version: 0 }))
    const { useUIStore } = await import('./useUIStore')
    expect(useUIStore.getState().autoSyncEnabled).toBe(true)
  })
})
