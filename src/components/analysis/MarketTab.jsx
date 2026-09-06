import StatCard from './StatCard'
import { posColor } from '../../utils/formatting'

export default function MarketTab({ market, nextPickNo = null }) {
  const { players, basis, scaleMin, scaleMax } = market

  if (!players.length) {
    return (
      <div className="an-grid">
        <StatCard
          title="Umstrittenste Spieler"
          empty="Dieses Ranking enthaelt keine Marktdaten (Streuung, Hoch- und Tiefstwerte)."
        />
      </div>
    )
  }

  const span = scaleMax - scaleMin
  const pct = (v) => ((v - scaleMin) / span) * 100

  return (
    <div className="an-grid">
      <StatCard
        title="Umstrittenste Spieler"
        hint="Grosse Streuung heisst: der Markt ist sich uneins — hier weichen Ligen am staerksten voneinander ab."
        headline={players[0].stdev.toFixed(1)}
        sub={`hoechste Streuung: ${players[0].name}`}
        basis={`${players.length} von ${basis} Spielern mit Marktdaten${nextPickNo ? ` · deine naechste Pick-Nr: ${nextPickNo}` : ''}`}
        wide
      >
        {players.map((p) => (
          <div className="an-whisker" key={`${p.pos}-${p.name}`}>
            <span className="an-pos" style={{ background: posColor(p.pos) }}>{p.pos}</span>
            <span className="an-wname">{p.name}</span>
            <div className="an-wtrack" role="img" aria-label={`Spanne ${Math.round(p.low)} bis ${Math.round(p.high)}${Number.isFinite(p.adp) ? `, Durchschnitt ${Math.round(p.adp)}` : ''}${nextPickNo && nextPickNo >= scaleMin && nextPickNo <= scaleMax ? `, dein Pick ${nextPickNo}` : ''}`}>
              <span className="an-wrange"
                    style={{ left: `${pct(p.low)}%`, width: `${pct(p.high) - pct(p.low)}%` }} />
              {Number.isFinite(p.adp) && (
                <span className="an-wadp" style={{ left: `${pct(p.adp)}%` }} />
              )}
              {nextPickNo && nextPickNo >= scaleMin && nextPickNo <= scaleMax && (
                <span className="an-wmine" style={{ left: `${pct(nextPickNo)}%` }}
                      title={`Dein Pick ${nextPickNo}`} />
              )}
            </div>
            <span className="an-num">{Math.round(p.low)}–{Math.round(p.high)}</span>
          </div>
        ))}
      </StatCard>
    </div>
  )
}
