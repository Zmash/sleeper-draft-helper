// Startaufstellung nach Sleeper-Vorbild: welche Slots es gibt, in welcher
// Reihenfolge, und welcher Spieler in welchen faellt.
//
// Lag bisher inline in RosterList.jsx. Herausgezogen, damit die Roster-Seite
// und die Detailspalte der neuen Shell dieselben Slots in derselben Reihenfolge
// zeigen — inklusive der leeren, denn genau die sind waehrend eines Drafts die
// eigentliche Information.

export const ROSTER_SLOT_CONFIG = [
  { label: 'QB', count: 1, pill: 'QB' },
  { label: 'RB', count: 2, pill: 'RB' },
  { label: 'WR', count: 2, pill: 'WR' },
  { label: 'TE', count: 1, pill: 'TE' },
  { label: 'FLEX', count: 1, pill: 'WRT' },
  { label: 'DEF', count: 1, pill: 'DEF' },
  { label: 'BENCH', count: Infinity, pill: 'BN' },
]

/**
 * Verteilt Spieler auf die Startaufstellung: erst der eigene Positionsslot,
 * dann FLEX (nur RB/WR/TE), sonst Bank.
 *
 * @param {Array<{pos: string}>} players
 * @param {Array} config  optional, sonst ROSTER_SLOT_CONFIG
 * @returns {Object} Slot-Label -> Spielerliste (leere Slots = leeres Array)
 */
export function assignRosterSlots(players = [], config = ROSTER_SLOT_CONFIG) {
  const slots = {}
  for (const s of config) slots[s.label] = []
  const bench = []
  const flexCfg = config.find((s) => s.label === 'FLEX')

  for (const player of players) {
    const pos = String(player?.pos || '').toUpperCase()
    const posCfg = config.find((s) => s.label === pos)
    const placed =
      (posCfg && slots[pos].length < posCfg.count && slots[pos].push(player)) ||
      (flexCfg && ['RB', 'WR', 'TE'].includes(pos) && slots.FLEX.length < flexCfg.count && slots.FLEX.push(player))
    if (!placed) bench.push(player)
  }
  slots.BENCH = bench
  return slots
}

/**
 * Flache Zeilenliste in Anzeigereihenfolge — ein Eintrag je Slot-Platz, auch
 * fuer unbesetzte. `player` ist dann null.
 *
 * @returns {Array<{slot: string, pill: string, player: object|null}>}
 */
export function rosterRows(players = [], config = ROSTER_SLOT_CONFIG) {
  const slots = assignRosterSlots(players, config)
  const rows = []
  for (const s of config) {
    if (s.label === 'BENCH') {
      for (const p of slots.BENCH) rows.push({ slot: 'BN', pill: s.pill, player: p })
      continue
    }
    for (let i = 0; i < s.count; i++) {
      rows.push({ slot: s.label, pill: s.pill, player: slots[s.label][i] || null })
    }
  }
  return rows
}
