// 1:1 aus App.jsx übernommen (keine Logikänderungen)

// Basis-URL
export const SLEEPER_API_BASE = 'https://api.sleeper.app/v1'

// Fetch-Helper
export async function fetchJson(url) {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error('HTTP ' + res.status)
  }
  return res.json()
}

// Alle Drafts (inkl. Mock) eines Users im Jahr
export async function loadUserDraftsForYear(userId, year) {
  const url = `${SLEEPER_API_BASE}/user/${userId}/drafts/nfl/${year}`
  return fetchJson(url)
}

// Drafts der aktuellen Liga
export async function fetchLeagueDrafts(leagueId) {
  if (!leagueId) return []
  return fetchJson(`${SLEEPER_API_BASE}/league/${leagueId}/drafts`)
}

// Unique-Merge nach draft_id
export function mergeDraftsUnique(...arrays) {
  const map = new Map()
  arrays.flat().forEach(d => {
    if (d && d.draft_id && !map.has(d.draft_id)) {
      map.set(d.draft_id, d)
    }
  })
  return Array.from(map.values())
}

// Label für Dropdown: [Mock] / [Liga]
export function formatDraftLabel(d, leaguesById) {
  const isMock = !d.league_id
  const prefix = isMock ? '[Mock]' : '[Liga]'
  const name = d?.metadata?.name || d.draft_id
  const leagueName = !isMock ? (leaguesById.get(d.league_id)?.name || d.league_id) : ''
  return isMock ? `${prefix} ${name}` : `${prefix} ${name} – ${leagueName}`
}
