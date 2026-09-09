import { create } from 'zustand'
import { matchKey } from '../services/analysis/waiverStats'

const TTL_MS = { week: 6 * 60 * 60 * 1000, ros: 24 * 60 * 60 * 1000 }

// Nicht persistiert: Weekly-Rankings sind pro Sitzung ohnehin nur relevant,
// waehrend /lineup offen ist, und aendern sich zu haeufig fuer localStorage
// (anders als useDynastyValuesStore, das absichtlich langlebiger ist).
export const useWeeklyRankingsStore = create((set, get) => ({
  byKey: new Map(), // "pos:scope" -> Map<matchKey, ecr>
  sleeperWeekKey: null, // "season/week" der geladenen Sleeper-Projektionen
  sleeperWeekById: new Map(), // sleeper_id -> { pts_ppr, pts_half_ppr, pts_std }
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

  // Sleeper Wochen-Projektionen (ein Request pro Woche, alle Positionen).
  // Schluessel ist die native Sleeper-ID -- direkter Match auf Kader und
  // Free Agents, kein Name-Matching wie bei den FP-Rankings.
  loadSleeperWeekIfStale: async ({ season, week } = {}) => {
    if (season == null || week == null) return
    const cacheKey = `sleeper-week:${season}/${week}`
    const { loadedAt, loading } = get()
    const fresh = loadedAt.has(cacheKey) && Date.now() - loadedAt.get(cacheKey) < TTL_MS.week
    if (fresh || loading.has(cacheKey)) return
    loading.add(cacheKey)
    try {
      const res = await fetch(`/api/rankings/sleeper-projections-week?season=${season}&week=${week}`)
      const data = await res.json()
      if (!data.ok) return
      const byId = new Map()
      for (const p of data.players || []) {
        byId.set(String(p.sleeper_id), { pts_ppr: p.pts_ppr ?? null, pts_half_ppr: p.pts_half_ppr ?? null, pts_std: p.pts_std ?? null })
      }
      set((s) => {
        const nextLoadedAt = new Map(s.loadedAt)
        nextLoadedAt.set(cacheKey, Date.now())
        return { sleeperWeekKey: cacheKey, sleeperWeekById: byId, loadedAt: nextLoadedAt }
      })
    } catch {
      // Bleibt leer -- Pkt-Spalten rendern dann nicht.
    } finally {
      loading.delete(cacheKey)
    }
  },
}))
