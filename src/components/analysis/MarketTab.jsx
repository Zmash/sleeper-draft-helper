import StatCard from './StatCard'
import { posColor, fantasyProsPlayerUrl, cx } from '../../utils/formatting'
import { useTrendingPlayers } from '../../hooks/useTrendingPlayers'

function TrendList({ title, hint, items, state }) {
  const empty = state === 'loading'
    ? 'lädt …'
    : state === 'error'
      ? 'Trend-Daten von Sleeper aktuell nicht erreichbar.'
      : !items.length
        ? 'Keine Trend-Daten verfügbar.'
        : ''

  return (
    <StatCard
      title={title}
      hint={hint}
      basis="Sleeper, ligaübergreifend, letzte 24h"
      empty={empty}
    >
      {items.map((p) => (
        <div className="an-trendrow" key={p.player_id}>
          <span className="an-pos" style={{ background: posColor(p.pos) }}>{p.pos}</span>
          <a className="an-trendname" href={fantasyProsPlayerUrl(p.name)} target="_blank" rel="noreferrer">
            {p.name}
          </a>
          {p.injury_status && (
            <span className={cx('an-inj', p.injury_status !== 'Questionable' && 'is-out')}>
              {p.injury_status === 'Questionable' ? 'Q' : p.injury_status}
            </span>
          )}
          <span className="an-trendteam">{p.team || '—'}</span>
          <span className="an-num">{p.count.toLocaleString('de-DE')}</span>
        </div>
      ))}
    </StatCard>
  )
}

export default function MarketTab({ market, nextPickNo = null }) {
  const { players, basis, scaleMin, scaleMax } = market
  const { adds, drops, state: trendState } = useTrendingPlayers()

  if (!players.length) {
    return (
      <div className="an-grid">
        <StatCard
          title="Umstrittenste Spieler"
          empty="Dieses Ranking enthält keine Marktdaten (Streuung, Hoch- und Tiefstwerte)."
        />
        <TrendList title="Meistgeholt" hint="Wer wird gerade ligaübergreifend am meisten vom Waiver geholt." items={adds} state={trendState} />
        <TrendList title="Meistgedroppt" hint="Wer wird gerade ligaübergreifend am meisten abgegeben." items={drops} state={trendState} />
      </div>
    )
  }

  const span = scaleMax - scaleMin
  const pct = (v) => ((v - scaleMin) / span) * 100

  return (
    <div className="an-grid">
      <StatCard
        title="Umstrittenste Spieler"
        hint="Große Streuung heißt: der Markt ist sich uneins — hier weichen Ligen am stärksten voneinander ab."
        headline={`±${Math.round(players[0].stdev)}`}
        sub={`Picks Streuung bei ${players[0].name}`}
        basis={`${players.length} von ${basis} Spielern · Werte aus FFC-Drafts, nicht aus der Board-ADP`}
        wide
      >
        {/* Legende: ohne sie sind die Marken auf der Spur stumme Striche. Sie
            steht ueber den Zeilen, nicht unter der Kachel — sonst liest man
            zehn Balken, bevor man erfaehrt, was sie bedeuten. */}
        <div className="an-wlegend">
          <span><i className="an-wkey an-wkey--range" /> Spanne der Draftpositionen</span>
          <span><i className="an-wkey an-wkey--adp" /> Durchschnitt</span>
          {nextPickNo && <span><i className="an-wkey an-wkey--mine" /> dein Pick {nextPickNo}</span>}
        </div>
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
      <TrendList title="Meistgeholt" hint="Wer wird gerade ligaübergreifend am meisten vom Waiver geholt." items={adds} state={trendState} />
      <TrendList title="Meistgedroppt" hint="Wer wird gerade ligaübergreifend am meisten abgegeben." items={drops} state={trendState} />
    </div>
  )
}
