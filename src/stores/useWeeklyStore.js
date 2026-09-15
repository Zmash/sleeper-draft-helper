import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { fetchNflState, fetchMatchups, fetchLeagueRosters, fetchLeagueUsers } from '../services/api'
import { loadPlayersMetaCached } from '../services/playersMeta'
import { fetchScoreboard, lastKickoffAt } from '../services/redzone/espnLive'
import { selectedLeagueIds, toggleLeague, soloLeague } from '../services/redzone/redzoneModel'

// Rohdaten des Wochenrueckblicks. Aufbereitung passiert in weeklyModel (rein)
// bzw. in WeeklyPage. Anders als die Redzone pollt diese Seite nicht dauernd --
// ein Rueckblick aendert sich hoechstens, waehrend noch gespielt wird, und
// dann reicht der Aktualisieren-Knopf bzw. ein Wochenwechsel.
//
// Gecacht wird pro Woche: leagueData/games liegen unter der Wochennummer,
// damit das Blaettern durch abgeschlossene Wochen ohne erneuten Abruf geht.
// Persistiert wird nur der Liga-Filter (abgewaehlte IDs, wie in der Redzone).
export const useWeeklyStore = create(
  persist(
    (set, get) => ({
      deselectedLeagueIds: [],
      week: null,
      currentWeek: null,
      gamesByWeek: {},
      leagueDataByWeek: {},
      rosterCache: {}, // leagueId -> { rosters, users } (aendert sich innerhalb einer Woche nicht)
      playersMeta: {},
      playersMetaAt: null,
      lastUpdated: null,
      loading: false,
      error: null,

      toggleLeague: (allIds, id) =>
        set((s) => ({ deselectedLeagueIds: toggleLeague(allIds, s.deselectedLeagueIds, id) })),
      soloLeague: (allIds, id) =>
        set((s) => ({ deselectedLeagueIds: soloLeague(allIds, s.deselectedLeagueIds, id) })),
      showAllLeagues: () => set({ deselectedLeagueIds: [] }),
      setWeek: (week) => set({ week: Number(week) || null }),

      /**
       * @param {object} args
       * @param {Array} args.leagues    availableLeagues aus der Session
       * @param {number|string} args.season
       * @param {string} args.myUserId
       * @param {boolean} [args.force]  true = Cache der Woche verwerfen (Aktualisieren-Knopf)
       */
      load: async ({ leagues = [], season, myUserId, force = false }) => {
        if (get().loading || !leagues.length) return
        set({ loading: true })
        try {
          const s = get()
          const nfl = await fetchNflState().catch(() => null)
          const currentWeek = Number(nfl?.week) || s.currentWeek || 1
          const week = s.week || currentWeek

          const activeIds = new Set(selectedLeagueIds(leagues.map((l) => l.league_id), s.deselectedLeagueIds))
          const active = leagues.filter((l) => activeIds.has(l.league_id))
          const cachedWeek = (force ? {} : s.leagueDataByWeek[week]) || {}

          const loadLeague = async (league) => {
            const id = league.league_id
            // Abgeschlossene Wochen aendern sich nicht mehr -- einmal geladen
            // reicht. Die laufende Woche wird bei jedem Aufruf neu geholt.
            if (cachedWeek[id] && !cachedWeek[id].error && week !== currentWeek) return [id, cachedWeek[id]]
            const cachedRoster = s.rosterCache[id]
            try {
              const [matchups, rosters, users] = await Promise.all([
                fetchMatchups(id, week),
                cachedRoster?.rosters || fetchLeagueRosters(id),
                cachedRoster?.users || fetchLeagueUsers(id),
              ])
              return [id, { matchups, rosters, users, error: null }]
            } catch (e) {
              return [id, { ...cachedWeek[id], error: e.message || 'Fehler beim Laden' }]
            }
          }

          const [scoreboard, ...entries] = await Promise.all([
            fetchScoreboard({ season, week }).then((games) => ({ games }), () => ({ games: null })),
            ...active.map(loadLeague),
          ])
          const games = scoreboard.games || s.gamesByWeek[week] || []

          // playersMeta erst NACH dem Scoreboard: der Verletzungsblock lebt von
          // injury_status/status, und die Game-Day-Inactives stehen erst ~90 min
          // vor Kickoff fest. staleBefore verwirft einen Cache von vor dem
          // letzten Kickoff -- genau ein Nachladen pro Slate statt gar keinem
          // (5-MB-Antwort, Sleeper bittet um seltene Abrufe). Fuer
          // zurueckliegende Wochen liegt der Kickoff in der Vergangenheit, der
          // Cache bleibt also gueltig.
          const kickoff = lastKickoffAt(games)
          const metaStale = !Object.keys(s.playersMeta).length
            || (kickoff != null && (s.playersMetaAt ?? 0) < kickoff)
          const playersMeta = metaStale
            ? await loadPlayersMetaCached({ season: Number(season), staleBefore: kickoff })
              .catch(() => s.playersMeta)
            : s.playersMeta

          const leagueData = { ...cachedWeek, ...Object.fromEntries(entries) }
          const rosterCache = { ...s.rosterCache }
          for (const [id, d] of entries) {
            if (d?.rosters && d?.users) rosterCache[id] = { rosters: d.rosters, users: d.users }
          }

          set({
            week,
            currentWeek,
            playersMeta,
            playersMetaAt: metaStale ? Date.now() : s.playersMetaAt,
            rosterCache,
            // Bei ESPN-Ausfall den letzten bekannten Stand der Woche behalten,
            // statt die Spielstatus (und damit jede "fertig"-Aussage) zu verlieren.
            gamesByWeek: { ...s.gamesByWeek, [week]: games },
            leagueDataByWeek: { ...s.leagueDataByWeek, [week]: leagueData },
            error: scoreboard.games ? null : 'ESPN-Spieldaten gerade nicht verfügbar — Spielstatus kann fehlen.',
            lastUpdated: Date.now(),
            loading: false,
          })
        } catch (e) {
          console.warn('[weekly] load failed', e)
          set({ loading: false, error: e?.message || 'Laden fehlgeschlagen' })
        }
      },
    }),
    {
      name: 'sdh-weekly-v1',
      version: 1,
      partialize: (s) => ({ deselectedLeagueIds: s.deselectedLeagueIds }),
    }
  )
)
