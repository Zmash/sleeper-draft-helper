import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { SLEEPER_API_BASE, fetchJson } from '../services/api'

export const useLiveStore = create(
  persist(
    (set) => ({
      livePicks: [],
      lastSyncAt: null,
      autoRefreshEnabled: true,
      refreshIntervalSeconds: 10,

      setLivePicks: (picks) => set({ livePicks: picks }),
      setLastSyncAt: (date) => set({ lastSyncAt: date }),
      setAutoRefreshEnabled: (v) => set({ autoRefreshEnabled: v }),
      setRefreshIntervalSeconds: (v) => set({ refreshIntervalSeconds: v }),

      loadPicks: async (draftId) => {
        if (!draftId) return []
        const ps = await fetchJson(`${SLEEPER_API_BASE}/draft/${draftId}/picks`)
        set({ livePicks: ps, lastSyncAt: new Date() })
        return ps
      },
    }),
    {
      name: 'sdh-live-v1',
      partialize: (s) => ({
        autoRefreshEnabled: s.autoRefreshEnabled,
        refreshIntervalSeconds: s.refreshIntervalSeconds,
      }),
    }
  )
)
