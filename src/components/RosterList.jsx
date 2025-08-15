// src/components/RosterList.jsx
import React from 'react'
import { normalizePlayerName } from '../utils/formatting'
import { getTeamsCount } from '../services/derive'

const normalizePos = (posRaw = '') => {
  const pos = String(posRaw).toUpperCase()
  if (pos === 'DST' || pos === 'D/ST') return 'DEF'
  if (pos === 'PK') return 'K'
  return pos
}
const initials = (name = '') =>
  name.split(' ').filter(Boolean).map(s => s[0]).slice(0,2).join('').toUpperCase()

// NEU: Hilfen für Runde.Pick
const formatRoundPick = (pickNo, teamsCount) => {
  if (!pickNo && pickNo !== 0) return null
  if (!teamsCount || teamsCount <= 0) return String(pickNo) // Fallback
  const round = Math.ceil(pickNo / teamsCount)
  const inRound = ((pickNo - 1) % teamsCount) + 1
  return `${round}.${inRound}`
}
const guessTeamsFromPicks = (picks = []) => {
  // Simple Heuristik: Anzahl verschiedener picked_by in den ersten ~teams Picks
  const first = (picks || []).slice(0, 40)
  const set = new Set(first.map(p => p?.picked_by).filter(Boolean))
  return set.size || null
}

export default function RosterList({
  picks = [],
  me,
  boardPlayers = [],
  teamsCount = null,   // <- wir nutzen diese Prop direkt
  draft = null,        // (optional, wird hier nicht gebraucht)
  league = null,       // (optional, wird hier nicht gebraucht)
}) {
  // 1) Primärquelle: boardPlayers
  const myPlayersFromBoard = (boardPlayers || []).filter(p => p.picked_by === me)

  // 2) Fallback: livePicks → CSV matchen
  const byName = new Map((boardPlayers || []).map(bp => [normalizePlayerName(bp.name), bp]))
  const myPicks = (picks || []).filter(p => p.picked_by === me)
  const myPlayersFromPicks = myPicks.map(p => {
    const first = p?.metadata?.first_name || ''
    const last  = p?.metadata?.last_name || ''
    const full  = `${first} ${last}`.trim()
    const norm  = normalizePlayerName(full)
    const csv   = byName.get(norm)

    return {
      name: full,
      pos: normalizePos(p?.metadata?.position || csv?.pos || ''),
      team: p?.metadata?.team || csv?.team || '',
      bye: p?.bye || p?.metadata?.bye_week || csv?.bye || '',
      pick_no: p?.pick_no ?? null,   // overall pick von Sleeper
      round: p?.round ?? null,       // (optional)
      picked_by: p?.picked_by ?? null,
    }
  })

  // 3) Quelle wählen
  const myRoster = myPlayersFromBoard.length
    ? myPlayersFromBoard.map(bp => ({
        name: bp.name,
        pos: normalizePos(bp.pos),
        team: bp.team || '',
        bye: bp.bye || '',
        pick_no: bp.pick_no ?? null,
        picked_by: bp.picked_by ?? null,
      }))
    : myPlayersFromPicks

  // 4) Slots (Sleeper-like)
  const slotConfig = [
    { label: 'QB',  count: 1,           pill: 'QB'  },
    { label: 'RB',  count: 2,           pill: 'RB'  },
    { label: 'WR',  count: 2,           pill: 'WR'  },
    { label: 'TE',  count: 1,           pill: 'TE'  },
    { label: 'FLEX',count: 1,           pill: 'WRT' },
    { label: 'DEF', count: 1,           pill: 'DEF' },
    { label: 'BENCH', count: Infinity,  pill: 'BN'  },
  ]

  const slotMap = {}; const bench = []
  for (const s of slotConfig) slotMap[s.label] = []

  for (const player of myRoster) {
    const pos = player.pos
    const cfgPos  = slotConfig.find(s => s.label === pos)
    const cfgFlex = slotConfig.find(s => s.label === 'FLEX')

    const placed =
      (cfgPos && slotMap[pos].length < cfgPos.count && slotMap[pos].push(player)) ||
      (['RB','WR','TE'].includes(pos) && slotMap.FLEX.length < cfgFlex.count && slotMap.FLEX.push(player))

    if (!placed) bench.push(player)
  }
  slotMap.BENCH = bench

  // ---- Pick-Chip (rechts in der Karte, absolut positioniert; CSS hast du bereits)
  const computeRoundInRound = (pickNo, teams) => {
    const p = Number(pickNo), t = Number(teams)
    if (!Number.isFinite(p) || !Number.isFinite(t) || t <= 0) return null
    const round = Math.ceil(p / t)
    const inRound = ((p - 1) % t) + 1
    return `${round}.${inRound}`
  }

  const Row = ({ pill, player, emptyText = 'Empty', keyIdx }) => (
    <div className="roster-row" key={keyIdx}>
      <div className={`slot-pill slot-pill--${pill}`}>{pill}</div>

      <div className={`roster-card ${player ? '' : 'is-empty'}`}>
        {player ? (
          <>
            <div className="roster-avatar" aria-hidden>
              {player.avatar
                ? <img src={player.avatar} alt="" />
                : <span>{initials(player.name)}</span>
              }
            </div>

            <div className="roster-main">
              <div className="roster-name">{player.name}</div>
              <div className="roster-sub muted">
                {player.pos}{player.team ? ` - ${player.team}` : ''}{player.bye ? ` (${player.bye})` : ''}
              </div>
            </div>

            {/* Pick-Chip: runde.pick aus pick_no + teamsCount */}
            {(() => {
              const txt = computeRoundInRound(player.pick_no, teamsCount)
              return txt ? <div className="roster-pick-chip" title={`Pick ${txt}`}>{txt}</div> : null
            })()}
          </>
        ) : (
          <div className="roster-empty">{emptyText}</div>
        )}
      </div>
    </div>
  )

  return (
    <div className="roster-list">
      {slotConfig.flatMap((slot) => {
        const count = slot.count === Infinity ? Math.max(1, slotMap.BENCH.length || 1) : slot.count
        return Array.from({ length: count }, (_, i) => (
          <Row
            keyIdx={`${slot.label}-${i}`}
            pill={slot.pill}
            player={slotMap[slot.label][i] || null}
            emptyText="Empty"
          />
        ))
      })}
    </div>
  )
}
