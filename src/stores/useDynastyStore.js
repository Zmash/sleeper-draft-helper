import { create } from 'zustand'
import { fetchLeagueRosters, fetchTradedPicks } from '../services/api'
import { loadPlayersMetaCached } from '../services/playersMeta'

export const useDynastyStore = create((set) => ({
  dynastyRoster: [],
  mySleeperRosterId: null,
  rosterToUserMap: {},
  tradedPicks: [],

  setDynastyRoster: (v) => set({ dynastyRoster: v }),
  setMySleeperRosterId: (v) => set({ mySleeperRosterId: v }),
  setRosterToUserMap: (v) => set({ rosterToUserMap: v }),
  setTradedPicks: (v) => set({ tradedPicks: v }),

  loadDynastyRoster: async ({ selectedLeagueId, sleeperUserId, seasonYear }) => {
    if (!selectedLeagueId || !sleeperUserId) { set({ dynastyRoster: [] }); return }
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
      set({ rosterToUserMap: rMap })
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
      set({ dynastyRoster: [] })
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
