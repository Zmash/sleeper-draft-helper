import { Fragment, useMemo } from 'react'
import { posColor } from '../../utils/formatting'
import { sortAllTeamsRows, countBySeverity } from '../../services/analysis/allTeamsLineup'

const REASON_LABEL = {
  bye: 'Bye',
  out: 'Out',
  suboptimal: 'Bank?',
  'better-on-bench': 'Starten?',
  questionable: 'Fraglich',
  'ir-return': 'Von IR zurück',
  'ir-open': 'Auf IR?',
  'drop-candidate': 'Droppen?',
}

// Mehrere Gründe -> der wichtigste zuerst (Bye/Out schlägt alles).
const REASON_PRIORITY = ['bye', 'out', 'ir-return', 'questionable', 'suboptimal', 'better-on-bench', 'ir-open', 'drop-candidate']
function primaryReason(reasons = []) {
  for (const key of REASON_PRIORITY) {
    if (reasons.includes(key)) return REASON_LABEL[key]
  }
  return ''
}

const GROUPS = [
  { severity: 'red', title: 'Probleme' },
  { severity: 'yellow', title: 'Hinweise' },
  { severity: 'green', title: 'OK' },
]

export default function AllTeamsOverview({ rows = [], loading = false, onSelectPlayer }) {
  const sorted = useMemo(() => sortAllTeamsRows(rows), [rows])
  const counts = useMemo(() => countBySeverity(rows), [rows])
  const bySeverity = useMemo(() => {
    const map = { red: [], yellow: [], green: [] }
    for (const r of sorted) (map[r.severity] || map.green).push(r)
    return map
  }, [sorted])

  if (loading) return <div className="an-card an-card--allteams"><p className="muted">Lade alle Teams …</p></div>
  if (!rows.length) return <div className="an-card an-card--allteams"><p className="muted">Keine Kader für die Übersicht gefunden.</p></div>

  return (
    <div className="an-card an-card--allteams">
      <div className="an-lineup-head">
        <h3 className="an-card-title">Alle Teams</h3>
        <span className="an-head-meta">
          {counts.red > 0 ? `${counts.red} Probleme` : 'Keine Probleme'}
          {counts.yellow > 0 ? ` · ${counts.yellow} Hinweise` : ''}
          {` · ${counts.total} Spieler`}
        </span>
      </div>
      <div className="an-listrow an-listrow-head" aria-hidden="true">
        <span>Pos</span>
        <span>Spieler</span>
        <span>Team</span>
        <span>Liga</span>
        <span>Status</span>
        <span className="an-num">Hinweis</span>
      </div>
      <div className="an-lineup-list">
        {GROUPS.map((g) => {
          const list = bySeverity[g.severity]
          if (!list.length) return null
          return (
            <Fragment key={g.severity}>
              <div className="an-lineup-subhead">{g.title} ({list.length})</div>
              {list.map((r) => {
                const id = `${r.leagueId}:${r.player.sleeper_id ?? r.player.player_id}`
                return (
                  <button
                    key={id}
                    type="button"
                    className={`an-lineup-row an-row--${r.severity}`}
                    data-severity={r.severity}
                    onClick={() => onSelectPlayer?.(r)}
                    title={`${r.player.name} · ${r.leagueName} · ${r.isStarter ? 'aufgestellt' : 'Bank'}`}
                  >
                    <span className="an-pos" style={{ background: posColor(r.player.pos) }}>{r.player.pos}</span>
                    <span className="an-listname">{r.player.name}</span>
                    <span className="an-trendteam">{r.player.team || '—'}</span>
                    <span className="an-allteams-league" title={r.leagueName}>{r.leagueName}</span>
                    <span className={`an-allteams-status ${r.isStarter ? 'an-st-ok' : 'an-muted'}`}>
                      {r.isStarter ? 'Start' : 'Bank'}
                    </span>
                    <span className={`an-num an-allteams-note an-note--${r.severity}`}>
                      {primaryReason(r.reasons)}
                    </span>
                    <span className="an-allteams-sub">
                      <span className="an-allteams-league" title={r.leagueName}>{r.leagueName}</span>
                      {' · '}
                      <span className={r.isStarter ? 'an-st-ok' : 'an-muted'}>
                        {r.isStarter ? 'Start' : 'Bank'}
                      </span>
                    </span>
                  </button>
                )
              })}
            </Fragment>
          )
        })}
      </div>
      <p className="an-card-basis">
        Rot: aufgestellt, spielt aber nicht (Bye/Out), oder muss ohne freien Platz von IR zurück ·
        Gelb: bessere Bank-Option, fraglich, freier IR-Slot oder Drop-Vorschlag · Klick öffnet Details.
      </p>
    </div>
  )
}
