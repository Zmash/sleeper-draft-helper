import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { resolveInitialTheme } from '../theme/applyTheme'
import { THEMES, DEFAULT_THEME_ID } from '../theme/themes'

const validThemeId = (id) => (THEMES.some((t) => t.id === id) ? id : DEFAULT_THEME_ID)

export const useUIStore = create(
  persist(
    (set) => ({
      themeId: resolveInitialTheme(),
      analysisOpen: false,
      setupVersion: 0,
      boardDensity: 'normal', // 'normal' | 'compact' — Zeilenhoehe der Board-Tabelle (vor allem mobil relevant)
      streamPositions: ['DEF'], // welche Positionen im Waiver-Streaming-Board angehakt sind

      setTheme: (id) => set({ themeId: validThemeId(id) }),
      setAnalysisOpen: (v) => set({ analysisOpen: v }),
      incrementSetupVersion: () => set((s) => ({ setupVersion: s.setupVersion + 1 })),
      setBoardDensity: (d) => set({ boardDensity: d === 'compact' ? 'compact' : 'normal' }),
      toggleStreamPosition: (pos) => set((s) => ({
        streamPositions: s.streamPositions.includes(pos)
          ? s.streamPositions.filter((p) => p !== pos)
          : [...s.streamPositions, pos],
      })),
    }),
    {
      name: 'sdh-ui-v1',
      version: 1,
      partialize: (s) => ({ themeId: s.themeId, boardDensity: s.boardDensity, streamPositions: s.streamPositions }),
      migrate: (persisted, version) => {
        if (persisted && version < 1) {
          persisted.themeId = persisted.themeMode === 'light' ? 'broadcast-light' : 'broadcast-dark'
          delete persisted.themeMode
        }
        if (persisted) persisted.themeId = validThemeId(persisted.themeId)
        return persisted
      },
    }
  )
)
