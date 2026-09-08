import Icon from '../Icon'
import { posColor, fantasyProsPlayerUrl } from '../../utils/formatting'

// Reihenfolge wie in Sleeper: QB vorne, K/DEF hinten. Unbekannte Slots landen
// ans Ende; innerhalb desselben Slots bleibt die Index-Reihenfolge erhalten.
const SLOT_ORDER = ['QB', 'SUPER_FLEX', 'RB', 'WR', 'TE', 'FLEX', 'REC_FLEX', 'WRRB_FLEX', 'DEF', 'K']

// Kuerzel fuer die Pos-Pille wie in der Sleeper-UI -- "SUPER_FLEX" passt in
// keine 2.5rem-Spalte. QB/RB/WR/TE/FLEX/DEF/K bleiben unveraendert.
const SLOT_LABEL = { SUPER_FLEX: 'SF', REC_FLEX: 'W/T', WRRB_FLEX: 'W/R' }

// Zweitwert formatieren: Rang mit einer Nachkommastelle wie die Woche-Spalte,
// Trade-Wert (KTC) als ganze Zahl. Fehlt die Quelle, bleibt ein – stehen.
const altText = (v, kind) =>
  v == null ? '–' : kind === 'value' ? String(Math.round(v)) : Number.isFinite(v) ? v.toFixed(1) : '–'

export default function RecommendedLineupCard({
  lineup, comparison, leagueId, rosterNameById, altLabel = 'ROS', altKind = 'rank', sourceNote = null,
}) {
  if (!lineup) return null
  const changes = comparison && !comparison.isOptimal ? comparison.diffs.length : 0
  const orderOf = (slot) => { const i = SLOT_ORDER.indexOf(slot); return i === -1 ? 99 : i }
  const slots = lineup.slots.slice().sort((a, b) => orderOf(a.slot) - orderOf(b.slot) || a.slotIndex - b.slotIndex)
  return (
    <div className="an-card an-card--lineup">
      <div className="an-lineup-head">
        <h3 className="an-card-title">Empfohlene Aufstellung diese Woche</h3>
        {comparison?.isOptimal && (
          <span className="an-badge-ok"><Icon name="check" size={14} /> optimal gesetzt</span>
        )}
        {comparison && !comparison.isOptimal && (
          <span className="an-badge-change">{changes} {changes === 1 ? 'Änderung' : 'Änderungen'}</span>
        )}
      </div>
      {slots.length > 0 && (
        <div className="an-listrow an-listrow-head" aria-hidden="true">
          <span>Pos</span>
          <span>Spieler</span>
          <span>Team</span>
          <span className="an-num">Woche</span>
          <span className="an-num">{altLabel}</span>
        </div>
      )}
      <div className="an-lineup-list">
        {slots.map((s) => (
          <div className="an-lineup-row" key={s.slot + s.slotIndex}>
            <span className="an-pos" style={{ background: posColor(s.slot) }}>
              {SLOT_LABEL[s.slot] || s.slot}
            </span>
            {s.player ? (
              <a
                className="an-listname"
                href={fantasyProsPlayerUrl(s.player.name, s.player)}
                target="_blank"
                rel="noreferrer"
              >
                {s.player.name}
              </a>
            ) : (
              <span className="an-listname an-muted">–</span>
            )}
            <span className="an-trendteam">{s.player?.team || '—'}</span>
            <span className="an-num">{Number.isFinite(s.rank) ? s.rank.toFixed(1) : '–'}</span>
            <span className="an-num an-num-dim">{altText(s.alt, altKind)}</span>
          </div>
        ))}
      </div>
      {comparison && !comparison.isOptimal && (
        <ul className="an-lineup-diff">
          {comparison.diffs.map((d) =>
            d.in ? (
              <li key={d.in}>{d.slot}: <strong>{d.name}</strong> rein</li>
            ) : (
              <li key={d.out}>raus: <span className="an-muted">{rosterNameById?.[String(d.out)] || d.out}</span></li>
            )
          )}
        </ul>
      )}
      {sourceNote && <p className="an-card-basis">{sourceNote}</p>}
      {leagueId && (
        <a
          className="an-cta"
          href={`https://sleeper.com/leagues/${leagueId}/team`}
          target="_blank"
          rel="noreferrer"
          title="Sleeper stellt keine API zum Setzen der Aufstellung bereit – der Button öffnet dein Team direkt bei Sleeper."
        >
          <Icon name="external-link" size={14} /> Lineup in Sleeper setzen
        </a>
      )}
    </div>
  )
}
