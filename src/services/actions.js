// State-lose Helfer aus services/api
import {
    SLEEPER_API_BASE,
    fetchJson,
    loadUserDraftsForYear,
    fetchLeagueDrafts,
    mergeDraftsUnique,
  } from './api'
  
  // 1) User-ID auflösen (schreibt userId in State + LocalStorage)
  export async function resolveUserIdAction({
    sleeperUserId,
    sleeperUsername,
    setSleeperUserId,
    saveToLocalStorage,
  }) {
    if (sleeperUserId) return sleeperUserId
    if (!sleeperUsername) throw new Error('Bitte Benutzername eingeben')
    const data = await fetchJson(`${SLEEPER_API_BASE}/user/${encodeURIComponent(sleeperUsername)}`)
    setSleeperUserId?.(data.user_id)
    saveToLocalStorage?.({ userId: data.user_id })
    return data.user_id
  }
  
  // 2) Ligen laden und „preferred“ setzen, danach Draft-Optionen laden
  export async function loadLeaguesAction({
    seasonYear,
    setAvailableLeagues,
    setSelectedLeagueId,
    saveToLocalStorage,
    // Abhängigkeiten reinreichen:
    resolveUserId,        // function(): Promise<string>
    loadDraftOptions,     // function(leagueId: string): Promise<void>
  }) {
    const userId = await resolveUserId()
    const leagues = await fetchJson(`${SLEEPER_API_BASE}/user/${userId}/leagues/nfl/${seasonYear}`)
    setAvailableLeagues?.(leagues)
  
    const preferred = leagues.find(l => l.status === 'drafting' || l.status === 'in_season') || leagues[0]
    if (preferred) {
      setSelectedLeagueId?.(preferred.league_id)
      saveToLocalStorage?.({ leagueId: preferred.league_id })
      await loadDraftOptions(preferred.league_id)
    } else {
      await loadDraftOptions('')
    }
  }
  
  // 3) League-User laden
  export async function loadLeagueUsersAction({ leagueId, setLeagueUsers }) {
    if (!leagueId) return
    const users = await fetchJson(`${SLEEPER_API_BASE}/league/${leagueId}/users`)
    setLeagueUsers?.(users)
  }
  
  // 4) Picks laden + Zeitstempel
  export async function loadPicksAction({ draftId, setLivePicks, setLastSyncAt }) {
    if (!draftId) return []
    const ps = await fetchJson(`${SLEEPER_API_BASE}/draft/${draftId}/picks`)
    setLivePicks?.(ps)
    setLastSyncAt?.(new Date())
    return ps
  }
  
  // 5) Draft-Optionen laden (User+Mock + ggf. Liga) und Defaults setzen
  export async function loadDraftOptionsAction({
    leagueId,
    seasonYear,
    selectedDraftId,
    setAvailableDrafts,
    setSelectedDraftId,
    saveToLocalStorage,
    // Abhängigkeiten:
    resolveUserId, // function(): Promise<string>
  }) {
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
  
    setAvailableDrafts?.(merged)
  
    if (!selectedDraftId && merged.length) {
      setSelectedDraftId?.(merged[0].draft_id)
      saveToLocalStorage?.({ draftId: merged[0].draft_id })
    }
  }
  
  // 6) Draft per ID/URL „anheften“ + sofort laden
  export async function attachDraftByIdOrUrlAction({
    input,
    parseDraftId,
    availableDrafts,
    setAvailableDrafts,
    setSelectedDraftId,
    saveToLocalStorage,
    // Abhängigkeiten:
    loadPicks, // function(id: string): Promise<void>
  }) {
    const id = parseDraftId(input)
    if (!id) throw new Error('Bitte gültige Draft-ID oder URL eingeben.')
  
    await loadPicks(id)
  
    const exists = (availableDrafts || []).some(d => d.draft_id === id)
    if (!exists) {
      setAvailableDrafts?.(prev => [{ draft_id: id, metadata: { name: `Draft ${id}` } }, ...(prev || [])])
    }
  
    setSelectedDraftId?.(id)
    saveToLocalStorage?.({ draftId: id })
    alert('Draft per ID/URL gesetzt.')
  }
  