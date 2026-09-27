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
// Eine Zeile je Liga statt Kachel: alle Ligen auf einen Blick, ohne seitlich zu
// scrollen. Gegnername und offene Starter haengen am title.

export function MatchupRow({ tiles }) {
  if (!tiles.length) return null
  return (
    <div className="rz-card rz-matchups">
      {tiles.map((t) => (
        <div
          key={t.leagueId}
          className="rz-mt"
          title={t.error ? undefined : [t.opponentName && `gegen ${t.opponentName}`, `offen: ${t.myOpen} ich · ${t.oppOpen} Gegner`].filter(Boolean).join(' · ')}
        >
          <SleeperAvatar avatar={t.leagueAvatar} name={t.leagueName} size={16} />
          <span className="rz-mt-name">{t.leagueName}</span>
          {t.error ? (
            <span className="rz-mt-error">nicht geladen</span>
          ) : (
            <>
              <span className="rz-num rz-mt-open" aria-label={`offen: ${t.myOpen} ich, ${t.oppOpen} Gegner`}>{t.myOpen}·{t.oppOpen}</span>
              <span className="rz-num rz-mt-score">
                <b className={cx(t.myPoints >= t.opponentPoints && 'is-lead')}>{pts(t.myPoints)}</b>
                <span className="rz-mt-vs">–</span>
                <span>{pts(t.opponentPoints)}</span>
              </span>
              <span className={cx('rz-num rz-mt-pct', t.myWinPct >= 50 ? 'is-good' : 'is-bad')}>{t.myWinPct}%</span>
              <span className="rz-bar" aria-hidden="true">
                <i className="rz-bar-me" style={{ width: `${t.myWinPct}%` }} />
                <i className="rz-bar-opp" style={{ width: `${100 - t.myWinPct}%` }} />
              </span>
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

function GroupedList({ players, groups = GROUPS, variant }) {
  return groups.map(({ key, label }) => {
    const list = players.filter((p) => p.state === key)
    if (!list.length) return null
    return (
      <div key={key}>
        <div className={cx('rz-group', key === 'in' && 'is-live')}>{label}</div>
        {list.map((p) => <PlayerRow key={p.playerId} player={p} variant={variant} />)}
      </div>
    )
  })
}

export function MyPlayers({ players }) {
  if (!players.length) return <div className="rz-empty">Keine Starter in den gewählten Ligen.</div>
  return <div className="rz-card rz-list"><GroupedList players={players} /></div>
}

export function OpponentsLive({ players }) {
  if (!players.length) return <div className="rz-empty">Gerade kein Gegner-Starter im Einsatz.</div>
  return (
    <div className="rz-card rz-list">
      {players.map((p) => <PlayerRow key={p.playerId} player={p} variant="opp" />)}
    </div>
  )
}

// Mobil: Reiter statt einer langen Liste. "Fertig" nimmt auch Spieler ohne
// Spiel mit, "Gegner" zeigt alle gegnerischen Starter nach Status. Am Desktop
// blendet redzone.css die Leiste aus und zeigt die eigenen Gruppen untereinander
// (Gegner live stehen dort in der rechten Spalte) -- reines CSS, kein matchMedia.
const TABS = [
  { key: 'in', label: 'Live', of: (mine) => mine.filter((p) => p.state === 'in') },
  { key: 'pre', label: 'Noch nicht', of: (mine) => mine.filter((p) => p.state === 'pre') },
  { key: 'post', label: 'Fertig', of: (mine) => mine.filter((p) => p.state === 'post' || p.state === 'none') },
  { key: 'opp', label: 'Gegner', of: (_, opps) => opps },
]

export function PlayerTabs({ mine, opponents }) {
  const [picked, setPicked] = useState(null)
  const lists = Object.fromEntries(TABS.map((t) => [t.key, t.of(mine, opponents)]))
  const active = picked || TABS.find((t) => t.key !== 'opp' && lists[t.key].length)?.key || 'in'
  return (
    <div className="rz-ptabs-wrap">
      <div className="tabs rz-ptabs" role="tablist" aria-label="Spieler">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={active === t.key}
            className={cx('tab', active === t.key && 'active', t.key === 'in' && lists.in.length > 0 && 'tab--live')}
            onClick={() => setPicked(t.key)}
          >
            {t.label} <span className="rz-num rz-tab-n">{lists[t.key].length}</span>
          </button>
        ))}
      </div>
      {!mine.length ? (
        <div className="rz-empty">Keine Starter in den gewählten Ligen.</div>
      ) : (
        <div className="rz-card rz-list">
          {TABS.filter((t) => t.key !== 'opp').map((t) => (
            <div key={t.key} className={cx('rz-pane', active === t.key && 'is-active')} role="tabpanel">
              {t.key === 'post'
                ? <GroupedList players={lists.post} groups={GROUPS.slice(2)} />
                : <GroupedList players={lists[t.key]} groups={GROUPS.filter((g) => g.key === t.key)} />}
              {!lists[t.key].length && <div className="rz-empty rz-pane-empty">Niemand.</div>}
            </div>
          ))}
          <div className={cx('rz-pane rz-pane--opp', active === 'opp' && 'is-active')} role="tabpanel">
            {opponents.length
              ? <GroupedList players={opponents} variant="opp" />
              : <div className="rz-empty rz-pane-empty">Keine gegnerischen Starter.</div>}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Redzone-Alarm & Ticker ──────────────────────────────────────────────────

// "Ja'Marr Chase" -> "J. Chase": Namen in Chips muessen auf eine Handy-Zeile passen.
export function shortName(name) {
  const parts = String(name || '').trim().split(/\s+/)
  if (parts.length < 2) return parts[0] || ''
  return `${parts[0][0]}. ${parts.slice(1).join(' ')}`
}

const signed = (n) => (n == null ? null : `+${Number(n).toFixed(1)}`)

function Who({ player, side, value }) {
  return (
    <span className={cx('rz-who', side === 'opp' ? 'rz-who--opp' : 'rz-who--me')} title={player.name}>
      {player.pos === 'DEF' ? player.team : shortName(player.name)}
      {value != null && <b className="rz-num">{value}</b>}
    </span>
  )
}

// Eine kompakte Karte je Redzone-Spiel: wer ist dran, wie steht es, und wie
// viele Punkte haben meine / gegnerische Beteiligte schon.
export function RedzoneAlerts({ alerts }) {
  if (!alerts.length) return null
  return (
    <div className="rz-card rz-alert-list">
      {alerts.map(({ game, mine, opponents }) => {
        const other = game.possessionAbbr === game.home.abbr ? game.away : game.home
        const own = game.possessionAbbr === game.home.abbr ? game.home : game.away
        return (
          <div key={game.id} className="rz-alert" role="status" title={game.lastPlay || undefined}>
            <div className="rz-alert-top">
              <span className="rz-tag">RZ</span>
              <span className="rz-alert-team">{own.abbr}</span>
              <span className="rz-num rz-muted">{own.score}–{other.score} {other.abbr}</span>
              {game.downDistance && <span className="rz-num rz-alert-dd">{game.downDistance}</span>}
              <span className="rz-num rz-alert-clock">{gameClock(game)}</span>
            </div>
            <div className="rz-alert-inv">
              {mine.map((p) => <Who key={p.playerId} player={p} side="me" value={pts(p.points)} />)}
              {opponents.map((p) => <Who key={p.playerId} player={p} side="opp" value={pts(p.points)} />)}
            </div>
          </div>
        )
      })}
    </div>
  )
}

const TICKER_LIMIT = 5

export function ScoringTicker({ items, limit = TICKER_LIMIT }) {
  const [all, setAll] = useState(false)
  if (!items.length) return <div className="rz-empty">Noch keine Scores deiner oder gegnerischer Starter.</div>
  const shown = all ? items : items.slice(0, limit)
  return (
    <div className="rz-card rz-list">
      {shown.map(({ play, mine, opponents, pts: gained = {}, isNew }) => (
        <div key={play.id} className={cx('rz-tick', isNew && 'is-new')}>
          <div className="rz-num rz-tick-when">Q{play.period}<br />{play.clock}</div>
          <div className="rz-tick-main">
            <div className="rz-tick-who">
              {play.type && <span className="rz-tick-type">{play.type}</span>}
              {mine.map((p) => <Who key={p.playerId} player={p} side="me" value={signed(gained[p.playerId])} />)}
              {opponents.map((p) => <Who key={p.playerId} player={p} side="opp" value={signed(gained[p.playerId])} />)}
            </div>
            <div className="rz-tick-what" title={play.text}>{play.teamAbbr} · {play.text}</div>
          </div>
        </div>
      ))}
      {items.length > limit && (
        <button type="button" className="rz-more" onClick={() => setAll((v) => !v)}>
          {all ? 'Weniger' : `Alle ${items.length} anzeigen`}
        </button>
      )}
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
