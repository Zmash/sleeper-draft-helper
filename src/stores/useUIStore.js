import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useUIStore = create(
  persist(
    (set, get) => ({
      themeMode: 'dark',
      analysisOpen: false,
      setupVersion: 0,

      setThemeMode: (v) => set({ themeMode: v }),
      toggleTheme: () => set((s) => ({ themeMode: s.themeMode === 'dark' ? 'light' : 'dark' })),
      setAnalysisOpen: (v) => set({ analysisOpen: v }),
      incrementSetupVersion: () => set((s) => ({ setupVersion: s.setupVersion + 1 })),
    }),
    {
      name: 'sdh-ui-v1',
      partialize: (s) => ({ themeMode: s.themeMode }),
    }
  )
)
