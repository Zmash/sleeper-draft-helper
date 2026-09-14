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

  // FantasyPros-Wochenprojektion (fantasy_pts), UNABHAENGIG von byKey/getRankMap
  // gecached -- byKeys Cache-Key ("pos:scope") enthaelt kein Scoring, weil bisher
  // immer nur EIN Format gleichzeitig aktiv war (eine Liga pro Seite). Das
  // Dashboard zeigt aber mehrere Ligen mit potenziell unterschiedlichem Scoring
  // gleichzeitig -- ein zweiter Aufruf mit anderem "scoring" wuerde sonst als
  // "noch frisch" durchgehen und die falschen (ersten) Werte behalten.
  fpWeekPtsByScoring: new Map(), // "pos:scoring" -> Map<matchKey, fantasy_pts>
  fpWeekPtsLoadedAt: new Map(),
  fpWeekPtsLoading: new Set(),

  loadFpWeekPtsIfStale: async ({ pos, scoring = 'ppr' } = {}) => {
    const cacheKey = `${pos}:${scoring}`
    const { fpWeekPtsLoadedAt, fpWeekPtsLoading } = get()
    const fresh = fpWeekPtsLoadedAt.has(cacheKey) && Date.now() - fpWeekPtsLoadedAt.get(cacheKey) < TTL_MS.week
    if (fresh || fpWeekPtsLoading.has(cacheKey)) return
    fpWeekPtsLoading.add(cacheKey)
    try {
      const res = await fetch(`/api/rankings/fantasypros-position?pos=${pos}&scope=week&scoring=${scoring}`)
      const data = await res.json()
      if (!data.ok) return
      const ptsMap = new Map()
      for (const p of data.players || []) {
        if (p.fantasy_pts != null) ptsMap.set(matchKey(pos, { name: p.name, team: p.team }), p.fantasy_pts)
      }
      set((s) => {
        const next = new Map(s.fpWeekPtsByScoring)
        next.set(cacheKey, ptsMap)
        const nextLoadedAt = new Map(s.fpWeekPtsLoadedAt)
        nextLoadedAt.set(cacheKey, Date.now())
        return { fpWeekPtsByScoring: next, fpWeekPtsLoadedAt: nextLoadedAt }
      })
    } catch {
      // Bleibt leer -- Aufrufer faellt dann auf die andere Quelle zurueck.
    } finally {
      fpWeekPtsLoading.delete(cacheKey)
    }
  },

  getFpWeekPtsMap: ({ pos, scoring = 'ppr' }) => get().fpWeekPtsByScoring.get(`${pos}:${scoring}`) || new Map(),

  // Sleeper Wochen-Projektionen (ein Request pro Woche, alle Positionen).
  // Schluessel ist die native Sleeper-ID -- direkter Match auf Kader und
  // Free Agents, kein Name-Matching wie bei den FP-Rankings.
  // Pro Woche eigener Eintrag: sleeperWeekById zeigt immer auf die ZULETZT
  // geladene Woche. Ohne diesen Zweitcache liesse sich nach einem Wochenwechsel
  // nicht mehr auf eine frueher geladene Woche zurueckschalten -- der
  // Frische-Check unten wuerde greifen und sleeperWeekById bliebe auf der
  // falschen Woche stehen (Wochenrueckblick blaettert genau so).
  sleeperWeekByKey: new Map(), // "sleeper-week:season/week" -> Map<sleeper_id, pts>

  getSleeperWeekMap: ({ season, week } = {}) =>
    get().sleeperWeekByKey.get(`sleeper-week:${season}/${week}`) || new Map(),

  loadSleeperWeekIfStale: async ({ season, week } = {}) => {
    if (season == null || week == null) return
    const cacheKey = `sleeper-week:${season}/${week}`
    const { loadedAt, loading } = get()
    const fresh = loadedAt.has(cacheKey) && Date.now() - loadedAt.get(cacheKey) < TTL_MS.week
    if (fresh) {
      const cached = get().sleeperWeekByKey.get(cacheKey)
      if (cached && get().sleeperWeekKey !== cacheKey) set({ sleeperWeekKey: cacheKey, sleeperWeekById: cached })
      return
    }
    if (loading.has(cacheKey)) return
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
        const nextByKey = new Map(s.sleeperWeekByKey)
        nextByKey.set(cacheKey, byId)
        return { sleeperWeekKey: cacheKey, sleeperWeekById: byId, sleeperWeekByKey: nextByKey, loadedAt: nextLoadedAt }
      })
    } catch {
      // Bleibt leer -- Pkt-Spalten rendern dann nicht.
    } finally {
      loading.delete(cacheKey)
    }
  },
}))
