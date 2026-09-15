import Icon from '../Icon'
import { cx } from '../../utils/formatting'
import { berlinTime } from '../../utils/berlinTime'
import { statusLabel, leaderAbbr, isLive, windowsOf } from '../../services/nfl/nflModel'

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
  {
    id: 'free',
    label: 'Free-TV',
    title: 'Nur Spiele, die sicher frei im TV laufen. Aus den Sonntagsfenstern '
      + 'zeigen RTL, RTL+ und Sky je ein Spiel — welches, steht erst kurzfristig fest.',
  },
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
          title={f.title}
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

// Bewusst Text statt Kacheln: als umrandete Chips waere das die halbe
// Zeilenhoehe fuer eine Nebeninfo. Free-TV ist farbig, alles andere gedimmt.
export function Outlets({ broadcast }) {
  if (!broadcast?.outlets.length) return null
  return (
    <span className="nfl-outlets">
      {broadcast.outlets.map((o, i) => (
        <span key={o.name} className={cx('nfl-outlet', `nfl-outlet--${o.kind}`)} title={o.name}>
          {i > 0 && <span className="nfl-outlet-sep"> · </span>}
          {o.short}
        </span>
      ))}
    </span>
  )
}

// ── Spielzeile ──────────────────────────────────────────────────────────────

function TeamLine({ side, game, lead }) {
  return (
    <span className={cx('nfl-team', lead && 'is-lead')}>
      <span className={cx('nfl-poss', isLive(game) && game.possessionAbbr === side.abbr && 'is-on')} />
      {side.logo
        ? <img className="nfl-logo" src={side.logo} alt="" loading="lazy" width="16" height="16" />
        : <span className="nfl-logo nfl-logo--ph" aria-hidden="true" />}
      {/* Nur das Kuerzel, kein Teamname: in einer 44px-Zeile bliebe davon
          ohnehin nur "Buc..." uebrig, und das sagt weniger als "TB". Der
          volle Name haengt am Titel der Zeile. */}
      <span className="nfl-abbr">{side.abbr}</span>
      {/* Der Punktestand wird IMMER gerendert, auch leer: sonst verrutscht die
          Zahlenspalte, sobald ein Spiel noch nicht angepfiffen ist. Die
          Saisonbilanz steht bewusst nicht hier — die gehoert in die Tabelle. */}
      <span className="nfl-score nfl-num">{game.state === 'pre' ? '' : side.score}</span>
    </span>
  )
}

export function GameRow({ game }) {
  const status = statusLabel(game)
  const lead = leaderAbbr(game)
  const bc = game.broadcast
  const redzone = isLive(game) && game.isRedZone
  // Spielort und Down/Distance haben in zwei Zeilen keinen Platz — sie haengen
  // am Titel, statt eine dritte Zeile aufzumachen.
  const title = [
    `${game.away.name || game.away.abbr} bei ${game.home.name || game.home.abbr}`,
    bc?.label,
    game.venue,
    isLive(game) ? game.downDistance : null,
  ].filter(Boolean).join(' · ')
  return (
    <article className={cx('nfl-game', `is-${game.state}`, redzone && 'is-redzone')} title={title}>
      <span className="nfl-teams">
        <TeamLine side={game.away} game={game} lead={lead === game.away.abbr} />
        <TeamLine side={game.home} game={game} lead={lead === game.home.abbr} />
      </span>
      <span className="nfl-meta">
        <span className="nfl-meta-top">
          {redzone && <span className="nfl-rz">RZ</span>}
          <span className={cx('nfl-status', `nfl-status--${status.tone}`)}>{status.text}</span>
        </span>
      </span>
    </article>
  )
}

// ── Spieltag ────────────────────────────────────────────────────────────────

function WindowHead({ win }) {
  const bc = win.broadcast
  return (
    <div className="nfl-win-head">
      <span className="nfl-win-time nfl-num">{win.timeLabel}</span>
      {win.label && <span className="nfl-win-label">{win.label}</span>}
      <span className="nfl-win-outlets">
        <Outlets broadcast={bc} />
        {/* Der entscheidende Zusatz: bei mehreren Spielen im Fenster zeigt
            jeder Sender nur EINES davon. Ohne diesen Satz behauptet die Seite
            bei 13 Sonntagsspielen dreizehnmal "RTL". */}
        {!win.certain && bc?.outlets.length > 0 && (
          <span className="nfl-win-hint">— je ein Spiel</span>
        )}
      </span>
    </div>
  )
}

export function DaySection({ group }) {
  const live = group.games.filter(isLive).length
  // Die Konferenz gilt fuer den ganzen Sonntag, nicht je Spiel -- unter jeder
  // Karte waere sie dieselbe Zeile acht Mal.
  const conference = group.games.find((g) => g.broadcast?.conference)?.broadcast.conference
  const windows = windowsOf(group.games)
  return (
    <section className="nfl-day">
      <h3 className="nfl-day-head">
        <span>{group.label}</span>
        <span className="nfl-day-n">{group.games.length} {group.games.length === 1 ? 'Spiel' : 'Spiele'}</span>
        {live > 0 && <span className="nfl-day-live">{live} live</span>}
      </h3>
      {conference && <div className="nfl-conf">{conference}</div>}
      {windows.map((win) => (
        <div key={win.key} className="nfl-win">
          <WindowHead win={win} />
          <div className="nfl-grid">
            {win.games.map((g) => <GameRow key={g.id} game={g} />)}
          </div>
        </div>
      ))}
    </section>
  )
}
