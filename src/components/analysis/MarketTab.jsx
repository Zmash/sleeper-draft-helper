import StatCard from './StatCard'
import DepthTag from '../DepthTag'
import { posColor, fantasyProsPlayerUrl, cx } from '../../utils/formatting'
import { useTrendingPlayers } from '../../hooks/useTrendingPlayers'
import { FORMAT_LABEL, formatMarketAge } from '../DataProvenanceBar'

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
          <DepthTag player={p} />
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

// Gemeinsame Darstellung fuer marketDisagreement/expertDisagreement (siehe
// marketStats.js) -- beide liefern dieselbe Form (players/basis/scaleMin/
// scaleMax mit low/high/avg/stdev je Spieler), nur aus unterschiedlichen
// Quellen. unitLabel unterscheidet "Pick" (Markt) von "Rang" (Experten).
function DisagreementCard({
  title, hint, data, unitLabel, basisText, nextPickNo = null, wide = false,
}) {
  const { players, scaleMin, scaleMax } = data
  const span = scaleMax - scaleMin
  const pct = (v) => ((v - scaleMin) / span) * 100

  return (
    <StatCard
      title={title}
      hint={hint}
      headline={`±${Math.round(players[0].stdev)}`}
      sub={`${unitLabel}-Streuung bei ${players[0].name}`}
      basis={basisText}
      wide={wide}
    >
      {/* Legende: ohne sie sind die Marken auf der Spur stumme Striche. Sie
          steht ueber den Zeilen, nicht unter der Kachel — sonst liest man
          zehn Balken, bevor man erfaehrt, was sie bedeuten. */}
      <div className="an-wlegend">
        <span><i className="an-wkey an-wkey--range" /> Spanne</span>
        <span><i className="an-wkey an-wkey--adp" /> Durchschnitt</span>
        {nextPickNo && <span><i className="an-wkey an-wkey--mine" /> dein Pick {nextPickNo}</span>}
      </div>
      {players.map((p) => (
        <div className="an-whisker" key={`${p.pos}-${p.name}`}>
          <span className="an-pos" style={{ background: posColor(p.pos) }}>{p.pos}</span>
          <span className="an-wname">{p.name}</span>
          <div className="an-wtrack" role="img" aria-label={`Spanne ${Math.round(p.low)} bis ${Math.round(p.high)}${Number.isFinite(p.avg) ? `, Durchschnitt ${Math.round(p.avg)}` : ''}${nextPickNo && nextPickNo >= scaleMin && nextPickNo <= scaleMax ? `, dein Pick ${nextPickNo}` : ''}`}>
            <span className="an-wrange"
                  style={{ left: `${pct(p.low)}%`, width: `${pct(p.high) - pct(p.low)}%` }} />
            {Number.isFinite(p.avg) && (
              <span className="an-wadp" style={{ left: `${pct(p.avg)}%` }} />
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
  )
}

export default function MarketTab({ market, expert, marketMeta = null, nextPickNo = null }) {
  const { adds, drops, state: trendState } = useTrendingPlayers()
  // Nur FantasyPros liefert die Panel-Streuung, die expertDisagreement()
  // braucht -- bei CSV/FantasyCalc bleibt sie leer. Statt einer Kachel, die
  // dann nur einen Erklaertext zeigt, wird sie ganz weggelassen: eine
  // Kachel, die "nie geht", ist schlimmer als eine, die fehlt.
  const hasExpert = expert.players.length > 0

  // Format-Kontext direkt auf der Kachel: FFC-Daten werden schon beim Import/
  // Refresh mit Scoring/Superflex/Team-Anzahl der Liga abgerufen (siehe
  // useBoardStore.refreshMarketData) -- das war bisher nirgends sichtbar,
  // man musste es der App glauben. Gleiche Labels/Formatierung wie die
  // Herkunfts-Zeile ueber dem Board (DataProvenanceBar), damit beide Stellen
  // dasselbe Format immer gleich benennen.
  const age = formatMarketAge(marketMeta?.end_date)
  const marketBasis = market.players.length
    ? `${market.players.length} von ${market.basis} Spielern · FFC-Mock-Drafts`
      + (marketMeta?.format ? ` · ${FORMAT_LABEL[marketMeta.format] || marketMeta.format}` : '')
      + (marketMeta?.total_drafts ? ` · ${marketMeta.total_drafts} Drafts` : '')
      + (age ? ` · Stand ${age}` : '')
    : ''

  return (
    <div className="an-grid">
      {market.players.length ? (
        <DisagreementCard
          title="Umstrittenste Spieler"
          hint="Streuung relativ zur eigenen ADP, damit nicht automatisch Spätrunden-Spieler gewinnen."
          data={market}
          unitLabel="Pick"
          basisText={marketBasis}
          nextPickNo={nextPickNo}
          wide={!hasExpert}
        />
      ) : (
        <StatCard title="Umstrittenste Spieler" empty="Dieses Ranking enthält keine Marktdaten (Streuung, Hoch- und Tiefstwerte)." />
      )}
      {hasExpert && (
        <DisagreementCard
          title="Wo Analysten uneinig sind"
          hint="Streuung im FantasyPros-Expertenpanel — unabhängig von der Markt-Kachel: Analysten-Meinung statt Mock-Draft-Verhalten."
          data={expert}
          unitLabel="Rang"
          basisText={`${expert.players.length} von ${expert.basis} Spielern · FantasyPros-Expertenpanel`}
        />
      )}
      <TrendList title="Meistgeholt" hint="Wer wird gerade ligaübergreifend am meisten vom Waiver geholt." items={adds} state={trendState} />
      <TrendList title="Meistgedroppt" hint="Wer wird gerade ligaübergreifend am meisten abgegeben." items={drops} state={trendState} />
    </div>
  )
}
