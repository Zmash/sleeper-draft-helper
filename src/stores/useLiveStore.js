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
      refreshIntervalSeconds: 30,

      setLivePicks: (picks) => set({ livePicks: picks }),
      setLastSyncAt: (date) => set({ lastSyncAt: date }),
      setAutoRefreshEnabled: (v) => set({ autoRefreshEnabled: v }),
      setRefreshIntervalSeconds: (v) => set({ refreshIntervalSeconds: v }),

      loadPicks: async (draftId) => {
        if (!draftId) return []
        set({ picksLoading: true })
        try {
          // Sleeper cached diesen Endpoint 5 Min am Cloudflare-Edge (s-maxage=300,
          // shared cache -- betrifft alle Clients, nicht nur uns). Ohne Cache-Buster
          // liefert Sync/Auto-Refresh bis zu 5 Min alte Picks. _=Date.now() erzwingt
          // pro Request eine neue URL -> CDN-MISS -> frische Origin-Daten.
          const ps = await fetchJson(`${SLEEPER_API_BASE}/draft/${draftId}/picks?_=${Date.now()}`)
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
