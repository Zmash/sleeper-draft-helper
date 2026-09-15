import { create } from 'zustand'
import { fetchNflState } from '../services/api'
import { fetchScoreboard } from '../services/redzone/espnLive'
import { fetchStandings } from '../services/nfl/espnStandings'

// Die Tabelle bewegt sich nur, wenn Spiele enden -- 10 Minuten sind auch an
// einem Spieltag reichlich frisch.
const STANDINGS_TTL_MS = 10 * 60 * 1000

// Rohdaten der NFL-Seite: das ESPN-Scoreboard je Spielwoche. Aufbereitung
// passiert in services/nfl/nflModel (rein). Bewusst NICHT persistiert -- ein
// alter Spielstand aus localStorage waere beim naechsten Start schlicht falsch,
// und ein Scoreboard ist in unter einer Sekunde neu geholt.
//
// Abgeschlossene Wochen aendern sich nicht mehr und bleiben im Cache; die
// laufende Woche wird bei jedem Poll neu geholt.
export const useNflStore = create((set, get) => ({
  week: null,
  currentWeek: null,
  season: null,
  gamesByWeek: {},
  lastUpdated: null,
  loading: false,
  error: null,

  // Tabelle: eigener Zustand, eigener Ladepfad. Sie aendert sich nur, wenn
  // Spiele enden -- der Spielplan-Takt der Seite waere dafuer Verschwendung.
  standings: [],
  standingsAt: null,
  standingsLoading: false,
  standingsError: null,

  setWeek: (week) => {
    const w = Math.min(18, Math.max(1, Number(week) || 1))
    if (w !== get().week) set({ week: w })
  },

  /**
   * Tabelle laden. Ohne `force` nur, wenn noch nichts da oder der Stand aelter
   * als STANDINGS_TTL_MS ist.
   * @param {object} args
   * @param {number|string} [args.season]
   * @param {boolean} [args.force]
   */
  loadStandings: async ({ season: fallbackSeason, force = false } = {}) => {
    const s = get()
    if (s.standingsLoading) return
    if (!force && s.standings.length && Date.now() - (s.standingsAt ?? 0) < STANDINGS_TTL_MS) return
    set({ standingsLoading: true })
    try {
      const season = Number(s.season) || Number(fallbackSeason) || undefined
      const standings = await fetchStandings({ season })
      set({ standings, standingsAt: Date.now(), standingsError: null, standingsLoading: false })
    } catch (e) {
      console.warn('[nfl] standings failed', e)
      // Letzten bekannten Stand behalten -- eine leere Tabelle waere schlechter
      // als eine, die ein paar Minuten alt ist.
      set({ standingsLoading: false, standingsError: 'Tabelle gerade nicht verfügbar (ESPN).' })
    }
  },

  /**
   * @param {object} args
   * @param {number|string} [args.season]  Fallback, falls Sleepers State klemmt
   * @param {boolean} [args.force]  true = Cache der Woche verwerfen
   */
  load: async ({ season: fallbackSeason, force = false } = {}) => {
    if (get().loading) return
    set({ loading: true })
    try {
      const s = get()
      // Saison und laufende Woche kommen von Sleeper -- der einzige Endpoint,
      // der beides ohne Liga-Kontext kennt.
      const nfl = await fetchNflState().catch(() => null)
      const season = Number(nfl?.season) || Number(fallbackSeason) || s.season
      const currentWeek = Number(nfl?.week) || s.currentWeek || 1
      const week = s.week || currentWeek
      const cached = s.gamesByWeek[week]

      if (cached && !force && week !== currentWeek) {
        set({ week, currentWeek, season, loading: false, error: null })
        return
      }

      const games = await fetchScoreboard({ season, week })
      set({
        week,
        currentWeek,
        season,
        gamesByWeek: { ...s.gamesByWeek, [week]: games },
        lastUpdated: Date.now(),
        error: null,
        loading: false,
      })
    } catch (e) {
      console.warn('[nfl] load failed', e)
      // Letzten bekannten Stand behalten -- ein Netzfehler soll die Tabelle
      // nicht leeren, der naechste Tick versucht es erneut.
      set({ loading: false, error: 'Spieldaten gerade nicht verfügbar (ESPN).' })
    }
  },
}))
