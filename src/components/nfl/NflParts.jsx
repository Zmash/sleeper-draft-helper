import Icon from '../Icon'
import { cx } from '../../utils/formatting'
import { berlinTime } from '../../utils/berlinTime'
import { statusLabel, leaderAbbr, isLive } from '../../services/nfl/nflModel'

const WEEKS = Array.from({ length: 18 }, (_, i) => i + 1)

// ── Wochenwahl ──────────────────────────────────────────────────────────────

export function WeekPicker({ week, currentWeek, onPick }) {
  const go = (delta) => onPick(Math.min(18, Math.max(1, (week || 1) + delta)))
  return (
    <div className="nfl-weeks" role="group" aria-label="Spielwoche wählen">
      <button type="button" className="nfl-week-arrow" onClick={() => go(-1)} disabled={week <= 1} aria-label="Woche zurück">
        <Icon name="chevron-left" size={15} />
      </button>
      <div className="nfl-week-scroll">
        {WEEKS.map((w) => (
          <button
            key={w}
            type="button"
            className={cx('nfl-week', w === week && 'is-on', w === currentWeek && 'is-current')}
            aria-pressed={w === week}
            onClick={() => onPick(w)}
            title={w === currentWeek ? `Week ${w} — aktuelle Spielwoche` : `Week ${w}`}
          >
            {w}
          </button>
        ))}
      </div>
      <button type="button" className="nfl-week-arrow" onClick={() => go(1)} disabled={week >= 18} aria-label="Woche vor">
        <Icon name="chevron-right" size={15} />
      </button>
    </div>
  )
}

// ── Kopfzeile mit Kurzbilanz ────────────────────────────────────────────────

export function SummaryBar({ summary, byes = [] }) {
  const next = summary.next
  return (
    <div className="nfl-summary">
      {summary.live > 0 && <span className="nfl-sum nfl-sum--live"><b className="nfl-num">{summary.live}</b> laufen</span>}
      {summary.final > 0 && <span className="nfl-sum"><b className="nfl-num">{summary.final}</b> beendet</span>}
      {summary.upcoming > 0 && <span className="nfl-sum"><b className="nfl-num">{summary.upcoming}</b> ausstehend</span>}
      {next && (
        <span className="nfl-sum nfl-sum--next">
          <Icon name="zap" size={12} />
          Nächster Kickoff <b className="nfl-num">{berlinTime(next.date)}</b>
        </span>
      )}
      {byes.length > 0 && (
        <span className="nfl-sum nfl-sum--bye" title="Teams ohne Spiel in dieser Woche">
          Bye: <span className="nfl-num">{byes.join(' · ')}</span>
        </span>
      )}
    </div>
  )
}

// ── Filter ──────────────────────────────────────────────────────────────────

export const FILTERS = [
  { id: 'all', label: 'Alle' },
  { id: 'live', label: 'Läuft' },
  { id: 'free', label: 'Free-TV' },
]

export function FilterBar({ value, onChange, counts = {} }) {
  return (
    <div className="nfl-filters" role="group" aria-label="Spiele filtern">
      {FILTERS.map((f) => (
        <button
          key={f.id}
          type="button"
          className={cx('nfl-filter', value === f.id && 'is-on')}
          aria-pressed={value === f.id}
          onClick={() => onChange(f.id)}
        >
          {f.label}
          {counts[f.id] != null && <span className="nfl-filter-n">{counts[f.id]}</span>}
        </button>
      ))}
    </div>
  )
}

// ── Sender ──────────────────────────────────────────────────────────────────

export function OutletChips({ broadcast }) {
  if (!broadcast) return null
  return (
    <div className="nfl-outlets">
      {broadcast.outlets.map((o) => (
        <span
          key={o.name}
          className={cx('nfl-outlet', `nfl-outlet--${o.kind}`)}
          title={o.hint || (broadcast.selection ? `${o.name} zeigt ein Spiel aus diesem Fenster` : `${o.name} überträgt dieses Spiel`)}
        >
          {o.name}
        </span>
      ))}
      {broadcast.selection && <span className="nfl-outlet-hint" title="Die Sender wählen pro Fenster ein Spiel aus.">Auswahl</span>}
    </div>
  )
}

// ── Spielkarte ──────────────────────────────────────────────────────────────

function TeamRow({ side, game, lead }) {
  const hasScore = game.state !== 'pre'
  return (
    <div className={cx('nfl-team', lead && 'is-lead')}>
      <span
        className={cx('nfl-poss', isLive(game) && game.possessionAbbr === side.abbr && 'is-on')}
        title={isLive(game) && game.possessionAbbr === side.abbr ? 'Ballbesitz' : undefined}
      />
      {side.logo
        ? <img className="nfl-logo" src={side.logo} alt="" loading="lazy" width="20" height="20" />
        : <span className="nfl-logo nfl-logo--ph" aria-hidden="true" />}
      <span className="nfl-abbr">{side.abbr}</span>
      <span className="nfl-tname">{side.name}</span>
      {side.record && <span className="nfl-rec nfl-num">{side.record}</span>}
      <span className="nfl-score nfl-num">{hasScore ? side.score : '–'}</span>
    </div>
  )
}

export function GameCard({ game }) {
  const status = statusLabel(game)
  const lead = leaderAbbr(game)
  const bc = game.broadcast
  const redzone = isLive(game) && game.isRedZone
  return (
    <article className={cx('nfl-game', `is-${game.state}`, redzone && 'is-redzone')}>
      <div className="nfl-game-head">
        <span className={cx('nfl-status', `nfl-status--${status.tone}`)}>{status.text}</span>
        {redzone && <span className="nfl-rz">RZ</span>}
        <span className="nfl-game-meta">
          {game.neutralSite && game.venue && <span className="nfl-venue" title={game.venue}>{game.venue}</span>}
          {game.network && <span className="nfl-us" title="US-Sender">{game.network}</span>}
          {bc?.short && <span className="nfl-slot" title={bc.label}>{bc.short}</span>}
        </span>
      </div>
      <TeamRow side={game.away} game={game} lead={lead === game.away.abbr} />
      <TeamRow side={game.home} game={game} lead={lead === game.home.abbr} />
      {isLive(game) && game.downDistance && <div className="nfl-dd">{game.downDistance}</div>}
      <div className="nfl-game-foot">
        <OutletChips broadcast={bc} />
      </div>
      {bc?.note && <div className="nfl-note">{bc.note}</div>}
    </article>
  )
}

// ── Spieltag ────────────────────────────────────────────────────────────────

export function DaySection({ group }) {
  const live = group.games.filter(isLive).length
  // Die Konferenz gilt fuer den ganzen Sonntag, nicht je Spiel -- unter jeder
  // Karte waere sie dieselbe Zeile acht Mal.
  const conference = group.games.find((g) => g.broadcast?.conference)?.broadcast.conference
  return (
    <section className="nfl-day">
      <h3 className="nfl-day-head">
        <span>{group.label}</span>
        <span className="nfl-day-n">{group.games.length} {group.games.length === 1 ? 'Spiel' : 'Spiele'}</span>
        {live > 0 && <span className="nfl-day-live">{live} live</span>}
      </h3>
      {conference && <div className="nfl-conf">{conference}</div>}
      <div className="nfl-grid">
        {group.games.map((g) => <GameCard key={g.id} game={g} />)}
      </div>
    </section>
  )
}
