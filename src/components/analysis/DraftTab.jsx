import StatCard from './StatCard'
import { cx, posColor, signed } from '../../utils/formatting'

function TeamRanking({ r, myTeamKey }) {
  if (!r.teams.length) {
    return <StatCard title="Team-Draft-Ranking" wide empty="Noch keine Picks in diesem Draft." />
  }
  return (
    <StatCard
      title="Team-Draft-Ranking"
      hint="Summe aus Pick-Nummer minus Experten-Rang. Positiv heißt: unter Wert geholt."
      headline={r.myDelta !== null ? signed(r.myDelta) : '—'}
      sub={r.myRank ? `Platz ${r.myRank} von ${r.teams.length}` : 'Dein Team nicht erkannt'}
      basis={`aus ${r.matched} bewerteten Picks${r.unmatched ? ` · ${r.unmatched} ohne Ranking-Treffer` : ''}${r.skipped ? ` · ${r.skipped} Kicker/Defense ausgeschlossen` : ''}`}
      wide
    >
      <table className="an-table">
        <thead>
          <tr>
            <th>#</th><th>Team</th><th className="an-num">Bilanz</th>
            <th>Bester Pick</th><th>Schwächster</th>
          </tr>
        </thead>
        <tbody>
          {r.teams.map((t, i) => (
            <tr key={t.key} className={cx(t.key === myTeamKey && 'is-me')}>
              <td>{i + 1}</td>
              <td>{t.label}</td>
              <td className={cx('an-num', t.delta > 0 ? 'an-pos-good' : t.delta < 0 && 'an-pos-bad')}>
                {signed(t.delta)}
              </td>
              <td>{t.best ? `${t.best.name} (${signed(t.best.delta)})` : '—'}</td>
              <td>{t.worst ? `${t.worst.name} (${signed(t.worst.delta)})` : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="an-steals">
        <div>
          <h4>Top Steals</h4>
          <ol>
            {r.steals.map((s) => (
              <li key={`s${s.pick_no}`}>
                {s.name} <span className="an-pos-good">{signed(s.delta)}</span>
                <span className="muted"> · Pick {s.pick_no} · {s.teamLabel}</span>
              </li>
            ))}
          </ol>
        </div>
        <div>
          <h4>Größte Reaches</h4>
          <ol>
            {r.reaches.map((s) => (
              <li key={`r${s.pick_no}`}>
                {s.name} <span className="an-pos-bad">{signed(s.delta)}</span>
                <span className="muted"> · Pick {s.pick_no} · {s.teamLabel}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </StatCard>
  )
}

function Scarcity({ rows }) {
  if (!rows.length) {
    return <StatCard title="Positionsknappheit" empty="Kein Ranking importiert." />
  }
  // viewBox-Skala ueber den Bedarf, nicht ueber "available": sonst wuerde eine
  // Position mit viel Bedarf und viel Angebot (z.B. WR) den Massstab fuer alle
  // anderen Positionen strecken. Das Fuellrechteck wird trotzdem auf max
  // begrenzt (Math.min), sonst wuerde ein Angebot ueber dem eigenen Bedarf
  // hinaus den Rahmen sprengen -- der angezeigte Zahlenwert bleibt unbegrenzt.
  const max = Math.max(...rows.map((r) => r.need), 1)
  // available/need statt available allein: 12 verfuegbare QB bei Bedarf 12 sind
  // knapper als 28 verfuegbare WR bei Bedarf 28, auch wenn beide Zahlen gleich
  // "voll" aussehen.
  const knappste = rows.slice().sort((a, b) => (a.available / a.need) - (b.available / b.need))[0]

  return (
    <StatCard
      title="Positionsknappheit"
      hint="Verfügbare Spieler, die es für die Liga noch gibt — gemessen am Bedarf aller Teams."
      headline={knappste.exhausted ? 'erschöpft' : `${knappste.available}/${knappste.need}`}
      sub={`${knappste.pos} am knappsten`}
      basis="Bedarf = Teams x Starter-Slots, FLEX anteilig"
    >
      {rows.map((r) => (
        <div className="an-row" key={r.pos}>
          <span className="an-pos" style={{ background: posColor(r.pos) }}>{r.pos}</span>
          <svg viewBox={`0 0 ${max} 1`} preserveAspectRatio="none" height="10" role="img"
               aria-label={`${r.pos}: ${r.available} von ${r.need} verfügbar`}>
            <rect x="0" y="0" width={max} height="1" fill="var(--border, #2a2a2a)" />
            <rect x="0" y="0" width={Math.min(r.available, max)} height="1" fill={posColor(r.pos)} />
          </svg>
          <span className="an-num">
            {r.exhausted ? 'erschöpft' : `${r.available}/${r.need}`}
            {/* Runden: ecr darf aus einer CSV auch gebrochen kommen (gemittelte
                Experten-Ränge), sonst stuende hier "Vorsprung 3.6666666666666665". */}
            {r.vor !== null && <span className="muted"> · Vorsprung {Math.round(r.vor)}</span>}
          </span>
        </div>
      ))}
    </StatCard>
  )
}

function Tiers({ rows }) {
  if (!rows.length) {
    return <StatCard title="Tier-Verbrauch" empty="Dieses Ranking enthält keine Tiers." />
  }
  const warn = rows
    .filter((r) => r.activeTier !== null)
    .sort((a, b) => a.remainingInActive - b.remainingInActive)[0]

  return (
    <StatCard
      title="Tier-Verbrauch"
      hint="Wie viele Spieler im aktuell besten noch offenen Tier stehen."
      headline={warn ? String(warn.remainingInActive) : '—'}
      sub={warn ? `${warn.pos} Tier ${warn.activeTier}` : 'alle Tiers leer'}
      basis="Tiers aus dem importierten Ranking"
    >
      {rows.map((r) => (
        <div className="an-row" key={r.pos}>
          <span className="an-pos" style={{ background: posColor(r.pos) }}>{r.pos}</span>
          <div
            className="an-tierbar"
            role="img"
            aria-label={r.activeTier !== null
              ? `${r.pos}: Tier ${r.activeTier} ist das beste offene, ${r.remainingInActive} Spieler frei`
              : `${r.pos}: alle Tiers leer`}
          >
            {r.tiers.map((t) => (
              <span
                key={t.tier}
                className={cx('an-tierseg', t.remaining === 0 && 'is-done', t.tier === r.activeTier && 'is-active')}
                style={{ flexGrow: t.total }}
                title={`Tier ${t.tier}: ${t.remaining} von ${t.total} frei`}
              />
            ))}
          </div>
          <span className="an-num">
            {r.activeTier !== null ? `T${r.activeTier}: ${r.remainingInActive}` : 'leer'}
          </span>
        </div>
      ))}
    </StatCard>
  )
}

function Runs({ r }) {
  if (!r.timeline.length) {
    return <StatCard title="Positional Runs" wide empty="Zu früh im Draft." />
  }
  const top = r.runs[0] || null
  return (
    <StatCard
      title="Positional Runs"
      hint={`Rollierendes Fenster über die letzten ${r.window} Picks.`}
      headline={top ? String(top.count) : 'kein Run'}
      sub={top ? `${top.pos} in den letzten ${r.window} Picks` : 'gleichmäßige Verteilung'}
      basis={`${r.timeline.length} Picks`}
      wide
    >
      <div className="an-timeline" role="img" aria-label="Positionsverlauf des Drafts">
        {r.timeline.map((t) => (
          <span
            key={t.pick_no}
            className="an-tlseg"
            style={{ background: t.pos ? posColor(t.pos) : 'var(--border, #2a2a2a)' }}
            title={`Pick ${t.pick_no}: ${t.pos || '?'}`}
          />
        ))}
      </div>
    </StatCard>
  )
}

export default function DraftTab({ ranking, scarcity, tiers, runs, myTeamKey }) {
  return (
    <div className="an-grid">
      <TeamRanking r={ranking} myTeamKey={myTeamKey} />
      <Scarcity rows={scarcity} />
      <Tiers rows={tiers} />
      <Runs r={runs} />
    </div>
  )
}
