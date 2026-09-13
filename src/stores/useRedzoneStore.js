import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { fetchNflState, fetchMatchups, fetchLeagueRosters, fetchLeagueUsers } from '../services/api'
import { loadPlayersMetaCached } from '../services/playersMeta'
import { fetchScoreboard, fetchScoringPlays } from '../services/redzone/espnLive'
import {
  selectedLeagueIds, toggleLeague, soloLeague, carryPossession, relevantTeams,
} from '../services/redzone/redzoneModel'

// Scoring-Plays aendern sich nur mit dem Spielstand. Der Status gehoert dazu,
// damit ein Spiel nach "Final" genau einmal nachgeladen wird.
const scoreKey = (g) => `${g.away.score}:${g.home.score}:${g.state}`

// Rohdaten der Redzone. Aufbereitung passiert in redzoneModel (rein) bzw. in
// RedzonePage. Persistiert wird nur der Liga-Filter.
export const useRedzoneStore = create(
  persist(
    (set, get) => ({
      deselectedLeagueIds: [],
      week: null,
      games: [],
      leagueData: {},
      scoringPlaysByEvent: {},
      scoreKeyByEvent: {},
      newPlayIds: [],
      playersMeta: {},
      lastUpdated: null,
      espnError: null,
      loading: false,

      toggleLeague: (allIds, id) =>
        set((s) => ({ deselectedLeagueIds: toggleLeague(allIds, s.deselectedLeagueIds, id) })),
      soloLeague: (allIds, id) =>
        set((s) => ({ deselectedLeagueIds: soloLeague(allIds, s.deselectedLeagueIds, id) })),

      poll: async ({ leagues = [], season, myUserId }) => {
        if (get().loading || !leagues.length) return
        set({ loading: true })
        try {
          const s = get()
          const nfl = await fetchNflState().catch(() => null)
          const week = Number(nfl?.week) || s.week || 1
          const weekChanged = s.week != null && s.week !== week
          const playersMeta = Object.keys(s.playersMeta).length
            ? s.playersMeta
            : await loadPlayersMetaCached({ season: Number(season) }).catch(() => ({}))

          const activeIds = new Set(selectedLeagueIds(leagues.map((l) => l.league_id), s.deselectedLeagueIds))
          const active = leagues.filter((l) => activeIds.has(l.league_id))

          // Rosters/Users aendern sich am Spieltag nicht -> nur einmal holen.
          const loadLeague = async (league) => {
            const prev = s.leagueData[league.league_id]
            try {
              const [matchups, rosters, users] = await Promise.all([
                fetchMatchups(league.league_id, week),
                prev?.rosters || fetchLeagueRosters(league.league_id),
                prev?.users || fetchLeagueUsers(league.league_id),
              ])
              return [league.league_id, { matchups, rosters, users, error: null }]
            } catch (e) {
              return [league.league_id, { ...prev, error: e.message || 'Fehler beim Laden' }]
            }
          }

          const [scoreboard, ...leagueEntries] = await Promise.all([
            fetchScoreboard({ season, week }).then((games) => ({ games }), () => ({ games: null })),
            ...active.map(loadLeague),
          ])

          const prevGames = weekChanged ? [] : s.games
          const games = scoreboard.games ? carryPossession(prevGames, scoreboard.games) : prevGames
          const leagueData = { ...s.leagueData, ...Object.fromEntries(leagueEntries) }

          // Summary (~32 KB) nur fuer Spiele mit eigenen/gegnerischen Startern
          // und nur, wenn sich dort der Stand seit dem letzten Abruf bewegt hat.
          const teams = relevantTeams({
            leagueData: active.map((l) => ({ league: l, ...leagueData[l.league_id] })),
            myUserId,
            playersMeta,
          })
          const prevPlays = weekChanged ? {} : s.scoringPlaysByEvent
          const prevKeys = weekChanged ? {} : s.scoreKeyByEvent
          const due = games.filter((g) =>
            g.state !== 'pre' && (teams.has(g.home.abbr) || teams.has(g.away.abbr)) && prevKeys[g.id] !== scoreKey(g))
          const results = await Promise.all(
            due.map((g) => fetchScoringPlays(g.id).then((plays) => ({ g, plays }), () => null))
          )

          const known = new Set(Object.values(prevPlays).flat().map((p) => p.id))
          const scoringPlaysByEvent = { ...prevPlays }
          const scoreKeyByEvent = { ...prevKeys }
          const newPlayIds = []
          for (const r of results) {
            if (!r) continue // fehlgeschlagen: scoreKey bleibt alt -> naechster Poll versucht es erneut
            if (known.size) for (const p of r.plays) if (!known.has(p.id)) newPlayIds.push(p.id)
            scoringPlaysByEvent[r.g.id] = r.plays
            scoreKeyByEvent[r.g.id] = scoreKey(r.g)
          }

          set({
            week, games, playersMeta, leagueData, scoringPlaysByEvent, scoreKeyByEvent, newPlayIds,
            espnError: scoreboard.games ? null : 'ESPN-Daten gerade nicht verfügbar',
            lastUpdated: Date.now(),
            loading: false,
          })
        } catch (e) {
          console.warn('[redzone] poll failed', e)
          set({ loading: false })
        }
      },
    }),
    {
      name: 'sdh-redzone-v1',
      version: 1,
      partialize: (s) => ({ deselectedLeagueIds: s.deselectedLeagueIds }),
    }
  )
)
