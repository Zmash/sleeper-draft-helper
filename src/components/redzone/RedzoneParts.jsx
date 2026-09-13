import { useEffect, useRef, useState } from 'react'
import Icon from '../Icon'
import SleeperAvatar from '../SleeperAvatar'
import { cx } from '../../utils/formatting'

const STATE_ORDER = { in: 0, pre: 1, post: 2 }
const pts = (n) => (n == null ? '–' : Number(n).toFixed(1))
const LONG_PRESS_MS = 450

// ── Liga-Filter ─────────────────────────────────────────────────────────────

function LeagueChip({ league, active, onToggle, onSolo }) {
  const timer = useRef(null)
  const longPressed = useRef(false)
  const start = () => {
    longPressed.current = false
    timer.current = setTimeout(() => { longPressed.current = true; onSolo(league.id) }, LONG_PRESS_MS)
  }
  const stop = () => clearTimeout(timer.current)
  useEffect(() => stop, [])
  return (
    <button
      type="button"
      className={cx('rz-chip', active && 'is-on')}
      aria-pressed={active}
      onClick={() => {
        // Nach Langdruck feuert der Browser trotzdem click -> nicht zusaetzlich toggeln.
        if (longPressed.current) { longPressed.current = false; return }
        onToggle(league.id)
      }}
      onDoubleClick={() => onSolo(league.id)}
      onPointerDown={start}
      onPointerUp={stop}
      onPointerLeave={stop}
      onContextMenu={(e) => e.preventDefault()}
    >
      <SleeperAvatar avatar={league.avatar} name={league.label} size={16} className="rz-chip-av" />
      <span>{league.label}</span>
      {active && <Icon name="check" size={13} />}
    </button>
  )
}

export function LeagueChips({ leagues, activeIds, onToggle, onSolo }) {
  return (
    <div className="rz-chips" role="group" aria-label="Ligen filtern">
      {leagues.map((l) => (
        <LeagueChip key={l.id} league={l} active={activeIds.includes(l.id)} onToggle={onToggle} onSolo={onSolo} />
      ))}
      <span className="rz-chips-hint">Doppelklick oder lang drücken = nur diese · nochmal = alle</span>
    </div>
  )
}

// ── Spielleiste ─────────────────────────────────────────────────────────────

export function gameClock(game) {
  if (game.state === 'in') return `Q${game.period ?? '?'} ${game.clock}`.trim()
  if (game.state === 'post') return 'Final'
  if (!game.date) return ''
  return new Date(game.date).toLocaleString('de-DE', { weekday: 'short', hour: '2-digit', minute: '2-digit' })
}

function GameSide({ side, game }) {
  const lead = game.state !== 'pre' && side.score >= Math.max(game.home.score, game.away.score)
  return (
    <div className={cx('rz-game-row', lead && 'is-lead')}>
      <span className={cx('rz-poss', game.state === 'in' && game.possessionAbbr === side.abbr && 'is-on')} />
      <span className="rz-game-abbr">{side.abbr}</span>
      <span className="rz-game-score">{game.state === 'pre' ? '–' : side.score}</span>
    </div>
  )
}

export function GameStrip({ games, counts = {} }) {
  const sorted = [...games].sort((a, b) => (STATE_ORDER[a.state] ?? 3) - (STATE_ORDER[b.state] ?? 3))
  return (
    <div className="rz-strip">
      {sorted.map((game) => {
        const c = counts[game.id] || { mine: 0, opp: 0 }
        const rz = game.state === 'in' && game.isRedZone
        return (
          <div key={game.id} data-id={game.id} className={cx('rz-game', rz && 'is-redzone', game.state === 'post' && 'is-final')}>
            <GameSide side={game.away} game={game} />
            <GameSide side={game.home} game={game} />
            <div className="rz-game-foot">
              {rz && <span className="rz-tag">RZ</span>}
              <span className="rz-num">{gameClock(game)}</span>
              <span className="rz-game-inv">
                {c.mine > 0 && <span className="rz-cnt rz-cnt--me" title="Meine Starter">{c.mine}</span>}
                {c.opp > 0 && <span className="rz-cnt rz-cnt--opp" title="Gegner-Starter">{c.opp}</span>}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Matchups ────────────────────────────────────────────────────────────────

export function MatchupRow({ tiles }) {
  if (!tiles.length) return null
  return (
    <div className="rz-matchups">
      {tiles.map((t) => (
        <div key={t.leagueId} className="rz-mt">
          <div className="rz-mt-top">
            <SleeperAvatar avatar={t.leagueAvatar} name={t.leagueName} size={16} />
            <span className="rz-mt-name">{t.leagueName}</span>
            {!t.error && <span className="rz-mt-open"><span className="rz-num">{t.myOpen} · {t.oppOpen}</span> offen</span>}
          </div>
          {t.error ? (
            <div className="rz-mt-error">Matchup nicht geladen ({t.error})</div>
          ) : (
            <>
              <div className="rz-mt-score" title={t.opponentName ? `gegen ${t.opponentName}` : undefined}>
                <span className="rz-num rz-mt-me">{pts(t.myPoints)}</span>
                <span className="rz-mt-vs">:</span>
                <span className="rz-num rz-mt-opp">{pts(t.opponentPoints)}</span>
                <span className={cx('rz-num rz-mt-pct', t.myWinPct >= 50 ? 'is-good' : 'is-bad')}>{t.myWinPct}%</span>
              </div>
              <div className="rz-bar" aria-hidden="true">
                <span><i className="rz-bar-me" style={{ width: `${t.myWinPct}%` }} /></span>
                <span><i className="rz-bar-opp" style={{ width: `${100 - t.myWinPct}%` }} /></span>
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Spieler ─────────────────────────────────────────────────────────────────

function leagueLabel(leagues) {
  return leagues.length === 1 ? leagues[0].leagueName : `${leagues.length} Ligen`
}

export function PlayerRow({ player, variant = 'mine' }) {
  const g = player.game
  const rz = g && g.state === 'in' && g.isRedZone && g.possessionAbbr === player.team
  const score = g && g.state !== 'pre'
    ? `${player.team} ${g.home.abbr === player.team ? g.home.score : g.away.score}–${g.home.abbr === player.team ? g.away.score : g.home.score} · ${gameClock(g)}`
    : g ? gameClock(g) : 'kein Spiel'
  return (
    <div className={cx('rz-player', rz && 'is-redzone', variant === 'opp' && 'is-opp')}>
      <span className={`rz-pos rz-pos--${player.pos.toLowerCase()}`}>{player.pos}</span>
      <div className="rz-player-main">
        <div className="rz-player-name">{player.name}{rz && <span className="rz-tag">RZ</span>}</div>
        <div className="rz-player-sub">
          <span className="rz-num">{score}</span>
          <span className={cx('rz-cnt', variant === 'opp' ? 'rz-cnt--opp' : 'rz-cnt--me')} title={player.leagues.map((l) => l.leagueName).join(', ')}>
            {leagueLabel(player.leagues)}
          </span>
        </div>
      </div>
      <div className="rz-player-pts">
        <span className="rz-num">{pts(player.points)}</span>
        {player.projected != null && <small className="rz-num">Proj {pts(player.projected)}</small>}
      </div>
    </div>
  )
}

const GROUPS = [
  { key: 'in', label: 'Läuft' },
  { key: 'pre', label: 'Noch nicht' },
  { key: 'post', label: 'Fertig' },
  { key: 'none', label: 'Kein Spiel' },
]

export function MyPlayers({ players }) {
  if (!players.length) return <div className="rz-empty">Keine Starter in den gewählten Ligen.</div>
  return (
    <div className="rz-card rz-list">
      {GROUPS.map(({ key, label }) => {
        const list = players.filter((p) => p.state === key)
        if (!list.length) return null
        return (
          <div key={key}>
            <div className={cx('rz-group', key === 'in' && 'is-live')}>{label}</div>
            {list.map((p) => <PlayerRow key={p.playerId} player={p} />)}
          </div>
        )
      })}
    </div>
  )
}

export function OpponentsLive({ players }) {
  if (!players.length) return <div className="rz-empty">Gerade kein Gegner-Starter im Einsatz.</div>
  return (
    <div className="rz-card rz-list">
      {players.map((p) => <PlayerRow key={p.playerId} player={p} variant="opp" />)}
    </div>
  )
}

// ── Redzone-Alarm & Ticker ──────────────────────────────────────────────────

const names = (list) => list.map((p) => p.name).join(' · ')

export function RedzoneAlerts({ alerts }) {
  if (!alerts.length) return <div className="rz-empty">Gerade keine Redzone mit deinen oder gegnerischen Startern.</div>
  return alerts.map(({ game, mine, opponents }) => {
    const other = game.possessionAbbr === game.home.abbr ? game.away : game.home
    const own = game.possessionAbbr === game.home.abbr ? game.home : game.away
    return (
      <div key={game.id} className="rz-card rz-alert" role="status">
        <div className="rz-alert-top">
          <span className="rz-tag rz-tag--lg">REDZONE</span>
          <span className="rz-alert-team">{own.abbr}</span>
          <span className="rz-num rz-muted">{own.score}–{other.score} {other.abbr}</span>
          <span className="rz-num rz-alert-clock">{gameClock(game)}</span>
        </div>
        {game.downDistance && <div className="rz-num rz-alert-dd">{game.downDistance}</div>}
        {game.lastPlay && <div className="rz-alert-last">{game.lastPlay}</div>}
        {mine.length > 0 && <div className="rz-alert-inv"><span className="rz-side rz-side--me">MEINE</span><span>{names(mine)}</span></div>}
        {opponents.length > 0 && <div className="rz-alert-inv"><span className="rz-side rz-side--opp">GEGNER</span><span>{names(opponents)}</span></div>}
      </div>
    )
  })
}

export function ScoringTicker({ items }) {
  if (!items.length) return <div className="rz-empty">Noch keine Scores deiner oder gegnerischer Starter.</div>
  return (
    <div className="rz-card rz-list">
      {items.map(({ play, mine, opponents, isNew }) => (
        <div key={play.id} className={cx('rz-tick', isNew && 'is-new')}>
          <div className="rz-num rz-tick-when">Q{play.period}<br />{play.clock}</div>
          <div className="rz-tick-what">{play.text}<span>{play.teamAbbr} · {play.type}</span></div>
          <div className="rz-tick-imp">
            {mine.length > 0 && <span className="rz-cnt rz-cnt--me">{names(mine)}</span>}
            {opponents.length > 0 && <span className="rz-cnt rz-cnt--opp">{names(opponents)}</span>}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Aktualitaet ─────────────────────────────────────────────────────────────

export function Stamp({ at }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  if (!at) return <span className="rz-stamp">lädt …</span>
  const s = Math.max(0, Math.round((now - at) / 1000))
  return (
    <span className={cx('rz-stamp', s > 120 && 'is-stale')}>
      Stand vor <span className="rz-num">{s < 60 ? `${s} s` : `${Math.floor(s / 60)} min`}</span>
    </span>
  )
}
