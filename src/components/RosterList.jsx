import React from 'react'
import { normalizePlayerName } from '../utils/formatting'

const normalizePos = (posRaw = '') => {
  const pos = String(posRaw).toUpperCase()
  if (pos === 'DST' || pos === 'D/ST') return 'DEF'
  if (pos === 'PK') return 'K'
  return pos
}

export default function RosterList({ picks = [], me, boardPlayers = [] }) {
  // 1) Primäre Datenquelle: boardPlayers (bereits mit picked_by / pick_no gefüllt)
  const myPlayersFromBoard = (boardPlayers || []).filter(p => p.picked_by === me)

  // 2) Fallback: livePicks → auf CSV matchen (nur falls noch keine CSV geladen ist)
  const byName = new Map(
    (boardPlayers || []).map((bp) => [normalizePlayerName(bp.name), bp])
  )
  const myPicks = (picks || []).filter(p => p.picked_by === me)
  const myPlayersFromPicks = myPicks.map(p => {
    const first = p?.metadata?.first_name || ''
    const last  = p?.metadata?.last_name || ''
    const norm  = normalizePlayerName(`${first} ${last}`)
    const csv   = byName.get(norm)
    // Bilde ein player-ähnliches Objekt
    return {
      name: `${first} ${last}`.trim(),
      pos: normalizePos(p?.metadata?.position || csv?.pos || ''),
      team: p?.metadata?.team || csv?.team || '',
      bye: p?.bye || p?.metadata?.bye_week || csv?.bye || '',
      pick_no: p?.pick_no ?? null,
      picked_by: p?.picked_by ?? null,
    }
  })

  // 3) Wähle Quelle: bevorzugt Board (stabil & komplett), sonst Pick-Fallback
  const myRoster = myPlayersFromBoard.length ? myPlayersFromBoard.map(bp => ({
    name: bp.name,
    pos: normalizePos(bp.pos),
    team: bp.team || '',
    bye: bp.bye || '',
    pick_no: bp.pick_no ?? null,
    picked_by: bp.picked_by ?? null,
  })) : myPlayersFromPicks

  // 4) Slots wie Sleeper
  const slotConfig = [
    { label: 'QB', count: 1 },
    { label: 'RB', count: 2 },
    { label: 'WR', count: 2 },
    { label: 'TE', count: 1 },
    { label: 'FLEX', count: 1 }, // RB/WR/TE
    { label: 'DEF', count: 1 },
    { label: 'BENCH', count: Infinity },
  ]

  const slotMap = {}
  const bench = []
  for (const slot of slotConfig) slotMap[slot.label] = []

  // 5) Zuweisung zu Slots (mit FLEX-Logik)
  for (const player of myRoster) {
    const pos = player.pos
    const assign = () => {
      for (const slot of slotConfig) {
        if (slot.label === 'FLEX' && ['RB', 'WR', 'TE'].includes(pos)) {
          if (slotMap.FLEX.length < slot.count) { slotMap.FLEX.push(player); return true }
        } else if (slot.label === pos && slotMap[pos].length < slot.count) {
          slotMap[pos].push(player); return true
        }
      }
      return false
    }
    if (!assign()) bench.push(player)
  }
  slotMap.BENCH = bench

  const renderPlayerCard = (p, key) => (
    <div key={key} className="card roster-slot">
      {p ? (
        <>
          <div><strong>{p.name}</strong></div>
          <div className="muted text-xs">
            {p.pos}{p.team ? ` • ${p.team}` : ''}
          </div>
          {p.bye ? (
            <div className="text-xs bye">Bye Week: {p.bye}</div>
          ) : null}
          {Number.isFinite(p.pick_no) || typeof p.pick_no === 'number' ? (
            <div className="chip">#{p.pick_no}</div>
          ) : null}
        </>
      ) : (
        <div className="muted text-sm empty-slot">Leer</div>
      )}
    </div>
  )

  return (
    <div className="roster-wrapper">
      {slotConfig.map((slot) => (
        <div key={slot.label}>
          <h4>{slot.label}</h4>
          <div className="roster-slot-row">
            {[...Array(slot.count === Infinity ? slotMap.BENCH.length : slot.count)]
              .map((_, i) => renderPlayerCard(slotMap[slot.label][i], i))}
          </div>
        </div>
      ))}
    </div>
  )
}
