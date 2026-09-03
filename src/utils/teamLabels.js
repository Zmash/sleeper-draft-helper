// Team-Teilnehmer eines Drafts auflösen -- fuer den "Freund-Team waehlen"-Picker
// in MockDraftCard. Bewusst NICHT mit DraftGrid.jsx's labelForSlot geteilt: die
// Namensaufloesung dort wurde erst kuerzlich gefixt (Team-Namen-Bug) und ist an
// picksbasierte Fallbacks (ownerLabels) gekoppelt, die es hier vor dem ersten Pick
// noch gar nicht gibt. Getrennt halten vermeidet eine Regression an der falschen Stelle.
import { fetchJson, SLEEPER_API_BASE, fetchLeagueRosters } from '../services/api'

export function userLabel(user) {
  return user ? user.metadata?.team_name || user.display_name || user.username : null
}

/** Bin ich (userId) bereits Teilnehmer dieses Drafts? */
export function isDraftParticipant(draft, picks, userId) {
  if (!userId) return false
  if (draft?.draft_order && Object.prototype.hasOwnProperty.call(draft.draft_order, userId)) return true
  if ((picks || []).some((p) => String(p?.picked_by) === String(userId))) return true
  return false
}

/**
 * Liste der Teams eines Drafts als { slot, userId, label }, sortiert nach Slot.
 * Quelle: bei Liga-Drafts (league_id) Rosters+User, sonst draft_order.
 */
export async function resolveDraftParticipants(draft) {
  const teams = Number(draft?.settings?.teams) || Object.keys(draft?.slot_to_roster_id || {}).length || 0
  const leagueId = draft?.league_id
  let leagueUsers = []
  let leagueRosters = []
  if (leagueId) {
    ;[leagueUsers, leagueRosters] = await Promise.all([
      fetchJson(`${SLEEPER_API_BASE}/league/${leagueId}/users`).catch(() => []),
      fetchLeagueRosters(leagueId).catch(() => []),
    ])
  }
  const usersById = new Map(leagueUsers.map((u) => [u.user_id, u]))
  const rostersBySlot = draft?.slot_to_roster_id || {}
  const order = draft?.draft_order || {}
  const userIdBySlot = new Map()
  for (const [uid, slot] of Object.entries(order)) userIdBySlot.set(Number(slot), uid)

  const out = []
  for (let slot = 1; slot <= teams; slot++) {
    let userId = userIdBySlot.get(slot) || null
    let label = null
    const rosterId = rostersBySlot[slot]
    if (rosterId != null) {
      const roster = leagueRosters.find((r) => Number(r.roster_id) === Number(rosterId))
      if (roster?.owner_id) {
        userId = roster.owner_id
        label = userLabel(usersById.get(roster.owner_id))
      }
    }
    if (!label && userId) label = userLabel(usersById.get(userId))
    out.push({ slot, userId, label: label || `Team ${slot}` })
  }
  return out
}
