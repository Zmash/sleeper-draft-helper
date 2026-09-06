import { create } from 'zustand'
import { fetchLeagueRosters, fetchTradedPicks } from '../services/api'
import { loadPlayersMetaCached } from '../services/playersMeta'

export const useDynastyStore = create((set) => ({
  dynastyRoster: [],
  // Alle Kader der Liga (roh, ungefiltert) - zusaetzlich zu dynastyRoster (nur der eigene,
  // aufbereitete Kader), fuer den Liga-Feld-Vergleich auf der Analyse-Seite.
  leagueRosters: [],
  mySleeperRosterId: null,
  rosterToUserMap: {},
  tradedPicks: [],

  setDynastyRoster: (v) => set({ dynastyRoster: v }),
  setLeagueRosters: (v) => set({ leagueRosters: v }),
  setMySleeperRosterId: (v) => set({ mySleeperRosterId: v }),
  setRosterToUserMap: (v) => set({ rosterToUserMap: v }),
  setTradedPicks: (v) => set({ tradedPicks: v }),

  loadDynastyRoster: async ({ selectedLeagueId, sleeperUserId, seasonYear }) => {
    if (!selectedLeagueId || !sleeperUserId) { set({ dynastyRoster: [], leagueRosters: [] }); return }
    try {
      const season = Number(seasonYear) || new Date().getFullYear()
      const [rosters, playersMeta] = await Promise.all([
        fetchLeagueRosters(selectedLeagueId),
        loadPlayersMetaCached({ season }),
      ])
      const rMap = {}
      for (const r of rosters || []) {
        if (r.roster_id != null && r.owner_id) rMap[String(r.roster_id)] = String(r.owner_id)
      }
      // leagueRosters wird hier gesetzt (nicht erst nach dem myRoster-Fund): auch wenn unten
      // kein eigener Kader gefunden wird, sind die rohen Liga-Kader fuer den Liga-Feld-Vergleich
      // brauchbar und bleiben bewusst erhalten.
      set({ rosterToUserMap: rMap, leagueRosters: rosters || [] })
      const myRoster = (rosters || []).find((r) => String(r.owner_id) === String(sleeperUserId))
      if (!myRoster) { set({ dynastyRoster: [], mySleeperRosterId: null }); return }
      set({ mySleeperRosterId: myRoster.roster_id ?? null })
      const starterSet = new Set(myRoster.starters || [])
      const taxiSet = new Set(myRoster.taxi || [])
      const reserveSet = new Set(myRoster.reserve || [])
      const players = (myRoster.players || []).map((id) => {
        const meta = playersMeta[id] || {}
        const slot = taxiSet.has(id)
          ? 'taxi'
          : reserveSet.has(id)
          ? 'ir'
          : starterSet.has(id)
          ? 'starter'
          : 'bench'
        return {
          sleeper_id: id,
          name: meta.full_name || `#${id}`,
          pos: (meta.fantasy_positions?.[0] || meta.position || '').toUpperCase(),
          team: meta.team || '',
          bye: meta.bye_week != null ? String(meta.bye_week) : '',
          age: meta.age || null,
          slot,
        }
      })
      set({ dynastyRoster: players })
    } catch (e) {
      console.warn('[dynastyRoster] load failed', e)
      set({ dynastyRoster: [], leagueRosters: [] })
    }
  },

  loadTradedPicks: async (draftId) => {
    if (!draftId) { set({ tradedPicks: [] }); return }
    try {
      const picks = await fetchTradedPicks(draftId)
      set({ tradedPicks: picks })
    } catch (e) {
      console.warn('[tradedPicks] load failed', e)
      set({ tradedPicks: [] })
    }
  },
}))
