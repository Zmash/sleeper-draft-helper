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

      setTheme: (id) => set({ themeId: validThemeId(id) }),
      setAnalysisOpen: (v) => set({ analysisOpen: v }),
      incrementSetupVersion: () => set((s) => ({ setupVersion: s.setupVersion + 1 })),
    }),
    {
      name: 'sdh-ui-v1',
      version: 1,
      partialize: (s) => ({ themeId: s.themeId }),
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
