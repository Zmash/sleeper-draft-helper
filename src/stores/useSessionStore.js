import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  SLEEPER_API_BASE,
  fetchJson,
  loadUserDraftsForYear,
  fetchLeagueDrafts,
  mergeDraftsUnique,
  fetchLeague,
  fetchDraft,
} from '../services/api'
import { useLiveStore } from './useLiveStore'

export const useSessionStore = create(
  persist(
    (set, get) => ({
      sleeperUsername: '',
      sleeperUserId: '',
      seasonYear: String(new Date().getFullYear()),
      availableLeagues: [],
      selectedLeagueId: '',
      leagueUsers: [],
      availableDrafts: [],
      selectedDraftId: '',
      manualDraftInput: '',

      setSleeperUsername: (v) => set({ sleeperUsername: v }),
      setSleeperUserId: (v) => set({ sleeperUserId: v }),
      setSeasonYear: (v) => set({ seasonYear: String(v) }),
      setSelectedLeagueId: (v) => set({ selectedLeagueId: v }),
      setSelectedDraftId: (v) => set({ selectedDraftId: v }),
      setAvailableLeagues: (v) =>
        set((s) => ({ availableLeagues: typeof v === 'function' ? v(s.availableLeagues) : v })),
      setLeagueUsers: (v) => set({ leagueUsers: v }),
      setAvailableDrafts: (v) => set({ availableDrafts: v }),
      setManualDraftInput: (v) => set({ manualDraftInput: v }),

      resolveUserId: async () => {
        const { sleeperUserId, sleeperUsername } = get()
        if (sleeperUserId) return sleeperUserId
        if (!sleeperUsername) throw new Error('Bitte Benutzername eingeben')
        const data = await fetchJson(
          `${SLEEPER_API_BASE}/user/${encodeURIComponent(sleeperUsername)}`
        )
        set({ sleeperUserId: data.user_id })
        return data.user_id
      },

      loadLeagueUsers: async (leagueId) => {
        if (!leagueId) return
        const users = await fetchJson(`${SLEEPER_API_BASE}/league/${leagueId}/users`)
        set({ leagueUsers: users })
      },

      loadDraftOptions: async (leagueId) => {
        const { seasonYear, selectedDraftId, resolveUserId } = get()
        const userId = await resolveUserId()
        const [userDrafts, leagueDrafts] = await Promise.all([
          loadUserDraftsForYear(userId, seasonYear),
          fetchLeagueDrafts(leagueId),
        ])
        const merged = mergeDraftsUnique(userDrafts, leagueDrafts)
        merged.sort(
          (a, b) =>
            (b.start_time || 0) - (a.start_time || 0) ||
            String(b.draft_id).localeCompare(String(a.draft_id))
        )
        // Merge with existing to preserve manually-added drafts (e.g. mock drafts via URL)
        set((s) => ({ availableDrafts: mergeDraftsUnique(merged, s.availableDrafts || []) }))
        if (!selectedDraftId && merged.length) {
          const autoId = merged[0].draft_id
          set({ selectedDraftId: autoId })
          useLiveStore.getState().loadPicks(autoId).catch(() => {})
        }
      },

      loadLeagues: async () => {
        const { seasonYear, resolveUserId, loadDraftOptions } = get()
        const userId = await resolveUserId()
        const leagues = await fetchJson(
          `${SLEEPER_API_BASE}/user/${userId}/leagues/nfl/${seasonYear}`
        )
        set({ availableLeagues: leagues })
        const preferred =
          leagues.find((l) => l.status === 'drafting' || l.status === 'in_season') || leagues[0]
        if (preferred) {
          set({ selectedLeagueId: preferred.league_id })
          try {
            const detailed = await fetchLeague(preferred.league_id)
            if (detailed) {
              set((s) => ({
                availableLeagues: s.availableLeagues.map((l) =>
                  l.league_id === preferred.league_id ? { ...l, ...detailed } : l
                ),
              }))
            }
          } catch (e) {
            console.warn('[loadLeagues] fetchLeague failed', e)
          }
          await loadDraftOptions(preferred.league_id)
        } else {
          await loadDraftOptions('')
        }
      },

      attachDraftByIdOrUrl: async (input, parseDraftId) => {
        const id = parseDraftId(input)
        if (!id) return null

        // Den echten Draft holen, nicht nur einen Stub anlegen: ohne settings
        // (teams, rounds, slots_*, scoring_type) faellt deriveFormat auf die
        // Defaults zurueck — und genau das war der Mock-Bug.
        let draft = null
        try {
          draft = await fetchDraft(id)
        } catch {
          draft = null
        }
        if (!draft?.draft_id) return null

        await useLiveStore.getState().loadPicks(id).catch(() => {})
        set((s) => ({
          availableDrafts: mergeDraftsUnique([draft], s.availableDrafts || []),
          selectedDraftId: id,
        }))
        return id
      },
    }),
    {
      name: 'sdh-session-v1',
      partialize: (s) => ({
        sleeperUsername: s.sleeperUsername,
        sleeperUserId: s.sleeperUserId,
        seasonYear: s.seasonYear,
        availableLeagues: s.availableLeagues,
        selectedLeagueId: s.selectedLeagueId,
        leagueUsers: s.leagueUsers,
        availableDrafts: s.availableDrafts,
        selectedDraftId: s.selectedDraftId,
        manualDraftInput: s.manualDraftInput,
      }),
    }
  )
)
