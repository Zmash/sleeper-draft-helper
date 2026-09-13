import { create } from 'zustand'
import { fetchNflSchedule } from '../services/api'

// Laeuft gerade mindestens ein NFL-Spiel? Steuert, ob die Redzone-Einstiege
// (Rail, Mehr-Sheet, Tabs, Dashboard-Banner) sichtbar sind. Nicht persistiert:
// ein alter Wert aus localStorage wuerde nach dem Spieltag faelschlich "live" zeigen.
export const useGamesLiveStore = create((set) => ({
  liveCount: 0,
  refresh: async (season) => {
    if (!season) return
    try {
      const games = await fetchNflSchedule(season)
      set({ liveCount: (Array.isArray(games) ? games : []).filter((g) => g.status === 'in_game').length })
    } catch {
      // Netzfehler: letzten Stand behalten, der naechste Tick versucht es erneut.
    }
  },
}))
