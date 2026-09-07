import { create } from 'zustand'
import { matchKey } from '../services/analysis/waiverStats'

const TTL_MS = { week: 6 * 60 * 60 * 1000, ros: 24 * 60 * 60 * 1000 }

// Nicht persistiert: Weekly-Rankings sind pro Sitzung ohnehin nur relevant,
// waehrend /waiver offen ist, und aendern sich zu haeufig fuer localStorage
// (anders als useDynastyValuesStore, das absichtlich langlebiger ist).
export const useWeeklyRankingsStore = create((set, get) => ({
  byKey: new Map(), // "pos:scope" -> Map<matchKey, ecr>
  loadedAt: new Map(), // "pos:scope" -> timestamp
  loading: new Set(),

  loadIfStale: async ({ pos, scope, scoring = 'ppr' }) => {
    const cacheKey = `${pos}:${scope}`
    const { loadedAt, loading } = get()
    const fresh = loadedAt.has(cacheKey) && Date.now() - loadedAt.get(cacheKey) < TTL_MS[scope]
    if (fresh || loading.has(cacheKey)) return
    loading.add(cacheKey)
    try {
      const res = await fetch(`/api/rankings/fantasypros-position?pos=${pos}&scope=${scope}&scoring=${scoring}`)
      const data = await res.json()
      if (!data.ok) return
      const rankMap = new Map()
      for (const p of data.players || []) {
        rankMap.set(matchKey(pos, { name: p.name, team: p.team }), p.ecr)
      }
      set((s) => {
        const byKey = new Map(s.byKey)
        byKey.set(cacheKey, rankMap)
        const nextLoadedAt = new Map(s.loadedAt)
        nextLoadedAt.set(cacheKey, Date.now())
        return { byKey, loadedAt: nextLoadedAt }
      })
    } catch {
      // Bleibt leer -- aufrufende Komponente zeigt dann "nicht verfuegbar".
    } finally {
      loading.delete(cacheKey)
    }
  },

  getRankMap: ({ pos, scope }) => get().byKey.get(`${pos}:${scope}`) || new Map(),
}))
