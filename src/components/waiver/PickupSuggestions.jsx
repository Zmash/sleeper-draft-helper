import Icon from '../Icon'
import { cx, posColor, posBadgeLabel, fantasyProsPlayerUrl, injuryLabel, formatProjectedPts } from '../../utils/formatting'

// Feste Positions-Reihenfolge der Batches (gleiche Reihenfolge wie das
// Streaming-Board, damit QB/RB/WR/TE/DEF ueberall gleich sortiert auftauchen).
const POS_ORDER = ['QB', 'RB', 'WR', 'TE', 'DEF']

export default function PickupSuggestions({ players = [], mode = 'redraft', ptsLoaded = false, sourceNote = null }) {
  const isDynasty = mode === 'dynasty'
  const valueLabel = isDynasty ? 'KTC-Wert' : 'ROS-Rang'

  // pickupRanking sortiert bereits global nach Wert; hier nur noch nach
  // Position gruppieren — die Reihenfolge bleibt innerhalb eines Batches
  // erhalten, weil filter() die Array-Reihenfolge nicht aendert.
  const batches = POS_ORDER
    .map((pos) => ({ pos, players: players.filter((p) => p.pos === pos).slice(0, 6) }))
    .filter((b) => b.players.length)

  return (
    <div className={`an-card an-card--pickups${ptsLoaded ? ' an-card--pickups--pts' : ''}`}>
      <h3 className="an-card-title">Pickup-Empfehlungen</h3>
      <p className="an-card-hint">Sortiert nach {valueLabel}</p>
      {!players.length && <p className="an-card-empty">Keine Free-Agent-Daten verfügbar.</p>}
      {players.length > 0 && (
        <div className="an-listrow an-listrow-head" aria-hidden="true">
          <span />
          <span>Spieler</span>
          <span title="Verletzungsstatus">St</span>
          <span>Team</span>
          {isDynasty
            ? <span className={`an-num${ptsLoaded ? ' an-num-dim' : ''}`} title="KeepTradeCut-Dynastiewert – größer ist besser">KTC</span>
            : <span className={`an-num${ptsLoaded ? ' an-num-dim' : ''}`} title="FantasyPros-Rest-der-Saison-Rang – kleiner ist besser">Rang<span className="an-col-sub">ROS</span></span>}
          {ptsLoaded && <span className="an-num" title="Sleeper-Wochenprojektion in Punkten – größer ist besser">Pkt</span>}
        </div>
      )}
      {batches.map((batch) => (
        <div key={batch.pos} className="an-batch">
          <h4 className="an-listhead">{batch.pos}</h4>
          {batch.players.map((p) => (
            <div className="an-listrow" key={p.player_id}>
              <span className="an-pos" style={{ background: posColor(p.pos) }}>{posBadgeLabel(p)}</span>
              <a
                className="an-listname"
                href={fantasyProsPlayerUrl(p.name, p)}
                target="_blank"
                rel="noreferrer"
                title={p.trending ? 'Wird liga-uebergreifend gerade oft geholt' : undefined}
              >
                {p.name}{p.trending && <Icon name="zap" size={13} />}
              </a>
              <span className={cx('an-inj', p.injury_status && p.injury_status !== 'Questionable' && 'is-out')}>
                {p.injury_status ? injuryLabel(p.injury_status) : ''}
              </span>
              <span className="an-trendteam">{p.team || '—'}</span>
              <span className={`an-num${ptsLoaded ? ' an-num-dim' : ''}`}>{p.value ?? '–'}</span>
              {ptsLoaded && <span className="an-num">{formatProjectedPts(p.pts)}</span>}
            </div>
          ))}
        </div>
      ))}
      {sourceNote && <p className="an-card-basis">{sourceNote}</p>}
    </div>
  )
}
