import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { SLEEPER_API_BASE, fetchJson } from '../services/api'

export const useLiveStore = create(
  persist(
    (set) => ({
      livePicks: [],
      lastSyncAt: null,
      picksLoading: false,
      autoRefreshEnabled: true,
      refreshIntervalSeconds: 10,

      setLivePicks: (picks) => set({ livePicks: picks }),
      setLastSyncAt: (date) => set({ lastSyncAt: date }),
      setAutoRefreshEnabled: (v) => set({ autoRefreshEnabled: v }),
      setRefreshIntervalSeconds: (v) => set({ refreshIntervalSeconds: v }),

      loadPicks: async (draftId) => {
        if (!draftId) return []
        set({ picksLoading: true })
        try {
          const ps = await fetchJson(`${SLEEPER_API_BASE}/draft/${draftId}/picks`)
          set({ livePicks: ps, lastSyncAt: new Date(), picksLoading: false })
          return ps
        } catch (e) {
          set({ picksLoading: false })
          throw e
        }
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
