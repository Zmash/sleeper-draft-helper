import Icon from '../Icon'
import { cx } from '../../utils/formatting'
import { recordLabel } from '../../services/nfl/standingsModel'

const signed = (n) => (n == null ? '' : n > 0 ? `+${n}` : String(n))

// ── Divisionstabelle ────────────────────────────────────────────────────────

function TeamRow({ row, rank }) {
  const diff = row.differential
  return (
    <tr className={cx('nst-row', rank === 0 && 'is-first', row.missing && 'is-missing')}>
      <td className="nst-team">
        {row.logo
          ? <img className="nst-logo" src={row.logo} alt="" loading="lazy" width="16" height="16" />
          : <span className="nst-logo nst-logo--ph" aria-hidden="true" />}
        <span className="nst-abbr">{row.abbr}</span>
      </td>
      <td className="nst-rec nfl-num">{row.missing ? '—' : recordLabel(row)}</td>
      <td className={cx('nst-diff', 'nfl-num', diff > 0 && 'is-good', diff < 0 && 'is-bad')}>
        {signed(diff)}
      </td>
    </tr>
  )
}

export function DivisionTable({ group }) {
  return (
    <section className="nst-div">
      <h4 className="nst-div-head">{group.title}</h4>
      <table className="nst-table">
        <caption className="sr-only">{`Tabelle ${group.title}`}</caption>
        {/* Achtmal dieselbe Kopfzeile waere acht Zeilen Rauschen — die Spalten
            erklaert die Legende unter den Tabellen. Fuer Screenreader bleibt
            sie erhalten (die Spaltenbreiten haengen an den td-Regeln). */}
        <thead className="sr-only">
          <tr>
            <th scope="col">Team</th>
            <th scope="col">Bilanz</th>
            <th scope="col">Punktdifferenz</th>
          </tr>
        </thead>
        <tbody>
          {group.teams.map((row, i) => <TeamRow key={row.abbr} row={row} rank={i} />)}
        </tbody>
      </table>
    </section>
  )
}

export function ConferenceBlock({ block }) {
  return (
    <section className="nst-conf">
      <h3 className="nfl-day-head"><span>{block.conference}</span></h3>
      <div className="nst-grid">
        {block.groups.map((g) => <DivisionTable key={g.id} group={g} />)}
      </div>
    </section>
  )
}

// ── Umschalter Spiele / Tabelle ─────────────────────────────────────────────

export const VIEWS = [
  { id: 'games', label: 'Spiele', icon: 'scoreboard' },
  { id: 'standings', label: 'Tabelle', icon: 'table' },
]

export function ViewTabs({ value, onChange }) {
  return (
    <div className="nfl-views" role="tablist" aria-label="Ansicht">
      {VIEWS.map((v) => (
        <button
          key={v.id}
          type="button"
          role="tab"
          aria-selected={value === v.id}
          className={cx('nfl-view', value === v.id && 'is-on')}
          onClick={() => onChange(v.id)}
        >
          <Icon name={v.icon} size={14} />
          {v.label}
        </button>
      ))}
    </div>
  )
}
