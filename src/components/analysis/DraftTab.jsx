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
  // JEDER Balken hat seinen EIGENEN Bedarf als Skala, nicht einen gemeinsamen
  // Massstab ueber alle Positionen. Sonst vergleicht die Grafik Aepfel mit
  // Birnen: 13 verfuegbare QB (Bedarf 12, gedeckt) und 11 verfuegbare RB
  // (Bedarf 28, echter Mangel) saehen auf einer gemeinsamen 0..28-Skala fast
  // gleich lang aus -- bei genau gegensaetzlicher Lage. "Voll" heisst jetzt
  // ueberall dasselbe: der Bedarf der Liga ist gedeckt.
  const deckung = (r) => (r.need > 0 ? r.available / r.need : 0)
  const knappste = rows.slice().sort((a, b) => deckung(a) - deckung(b))[0]

  return (
    <StatCard
      title="Positionsknappheit"
      hint="Verfügbare Spieler, die es für die Liga noch gibt — gemessen am Bedarf aller Teams."
      headline={`${knappste.available}/${knappste.need}`}
      sub={knappste.exhausted
        ? `${knappste.pos} reicht nicht mehr für alle Teams`
        : `${knappste.pos} am knappsten`}
      basis={`Bedarf = Teams x Starter-Slots, FLEX anteilig · nur die ersten ${knappste.relevanceLimit} Ränge gezählt`}
    >
      {rows.map((r) => {
        const anteil = deckung(r)
        const prozent = Math.round(anteil * 100)
        return (
          <div className="an-row" key={r.pos}>
            <span className="an-pos" style={{ background: posColor(r.pos) }}>{r.pos}</span>
            {/* Die Spur ist genau ein Bedarf breit. Ueberschuss laeuft nicht
                weiter, sondern zeigt sich als Streifen am rechten Rand -- sonst
                muesste die Skala mitwachsen und der Vergleich waere wieder hin. */}
            <span
              className={cx('an-meter', r.exhausted && 'is-short', anteil > 1 && 'is-over')}
              role="img"
              aria-label={`${r.pos}: ${r.available} von ${r.need} benötigten Spielern verfügbar, ${prozent} Prozent`}
            >
              <span
                className="an-meter-fill"
                style={{ width: `${Math.min(anteil, 1) * 100}%`, background: posColor(r.pos) }}
              />
            </span>
            <span className="an-num">
              {/* Auch im erschoepften Fall die Zahl zeigen: "8 von 32" ist eine
                  andere Lage als "0 von 32", und genau hier wird es interessant. */}
              <span className={cx(r.exhausted && 'an-pos-bad')}>{r.available}/{r.need}</span>
              {/* Runden: ecr darf aus einer CSV auch gebrochen kommen (gemittelte
                  Experten-Ränge), sonst stuende hier "Vorsprung 3.6666666666666665". */}
              {r.vor !== null && <span className="muted"> · Vorsprung {Math.round(r.vor)}</span>}
            </span>
          </div>
        )
      })}
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
