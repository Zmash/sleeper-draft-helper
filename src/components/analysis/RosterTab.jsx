import StatCard from './StatCard'
import { cx, posColor, signed } from '../../utils/formatting'

function KaderVsLiga({ split }) {
  const { mode, positions, coverage, teamCount, totalPlayers } = split

  if (!teamCount) {
    return <StatCard title="Kader gegen das Liga-Feld" empty="Nur für echte Ligen — Mock-Drafts haben keine Kader." />
  }
  // Waehrend eines laufenden Drafts liefert Sleeper alle Kader leer (0/0) --
  // erst nach Draft-Ende sind sie befuellt. Das ist kein Deckungsproblem und
  // braucht daher eine eigene Meldung statt der "Ranking zu duenn"-Meldung unten.
  if (!totalPlayers) {
    return (
      <StatCard
        title="Kader gegen das Liga-Feld"
        empty="Die Kader sind noch leer — Sleeper füllt sie erst nach Ende des Drafts. Danach steht der Vergleich hier zur Verfügung."
      />
    )
  }
  if (coverage < 0.5) {
    return (
      <StatCard
        title="Kader gegen das Liga-Feld"
        empty={`Nur ${Math.round(coverage * 100)} % der Kaderspieler stehen im importierten Ranking — zu dünn für einen Vergleich.`}
      />
    )
  }
  if (!positions.length) {
    return (
      <StatCard
        title="Kader gegen das Liga-Feld"
        empty="Für keine Position konnte ein Vergleich ermittelt werden — möglicherweise hat keine Position einen Starter-Slot in dieser Liga."
      />
    )
  }

  const einheit = mode === 'value' ? 'Punkten' : 'Rängen'
  const beste = positions.slice().sort((a, b) => (b.diff ?? -Infinity) - (a.diff ?? -Infinity))[0]
  const maxAbs = Math.max(...positions.map((p) => Math.abs(p.diff ?? 0)), 1)
  const hasData = positions.some((p) => p.diff != null)

  return (
    <StatCard
      title="Kader gegen das Liga-Feld"
      hint={mode === 'value'
        ? 'Summe der Dynasty-Werte je Position, verglichen mit dem Median der Liga.'
        : 'Rang deines besten Spielers je Position, verglichen mit dem Median der Liga. Rangabstände sind nicht wertproportional — die Richtung ist verlässlich, der Betrag grob.'}
      headline={beste?.diff != null ? signed(beste.diff) : '—'}
      sub={hasData && beste?.diff != null
        ? `${beste.pos} ist deine stärkste Position — Platz ${beste.rank} von ${beste.teamCount}`
        : ''}
      basis={`${teamCount} Kader · Deckung ${Math.round(coverage * 100)} % · in ${einheit}`}
    >
      {positions.map((p) => (
        <div className="an-row" key={p.pos}>
          <span className="an-pos" style={{ background: posColor(p.pos) }}>{p.pos}</span>
          <svg viewBox={`${-maxAbs} 0 ${maxAbs * 2} 1`} preserveAspectRatio="none" width="100%" height="12"
               role="img" aria-label={p.diff != null ? `${p.pos}: ${Math.round(p.diff)} gegenüber dem Median` : `${p.pos}: keine Daten`}>
            <line x1="0" y1="0" x2="0" y2="1" stroke="var(--muted, #888)" strokeWidth={maxAbs / 100} />
            <rect
              x={Math.min(0, p.diff ?? 0)} y="0.15"
              width={Math.abs(p.diff ?? 0)} height="0.7"
              fill={(p.diff ?? 0) >= 0 ? 'var(--good, #4ec97b)' : 'var(--bad, #e0555a)'}
            />
          </svg>
          <span className={cx('an-num', (p.diff ?? 0) >= 0 ? 'an-pos-good' : 'an-pos-bad')}>
            {p.diff != null ? signed(p.diff) : '—'}
            {/* Rang statt nur der Abweichung: "+40" sagt nicht, ob das
                Platz 2 oder Platz 6 von 12 ist. */}
            {p.rank != null && (
              <span className="muted an-composition">Platz {p.rank} von {p.teamCount}</span>
            )}
          </span>
        </div>
      ))}
    </StatCard>
  )
}

function PowerRanking({ power, myRosterId, isRookieMode }) {
  if (!power.available) {
    const empty = power.reason === 'low-coverage'
      ? `Nur ${Math.round(power.coverage * 100)} % der Kaderspieler stehen im importierten Ranking — zu dünn für einen Liga-Vergleich.`
      : power.reason === 'no-rosters'
        ? 'Nur für echte Ligen — Mock-Drafts haben keine Kader.'
        : 'Braucht mindestens zwei Kader mit einem Spieler an derselben Position, um zu ranken.'
    return <StatCard title="Power-Ranking" wide empty={empty} />
  }

  const isValue = power.mode === 'value'
  const isStandings = power.mode === 'standings'
  const colLabel = isValue ? 'Wert' : isStandings ? 'Bilanz' : 'Ø Rang'
  const fmt = (t) => (isValue ? Math.round(t.metric) : isStandings ? t.record : t.metric.toFixed(1))

  return (
    <StatCard
      title="Power-Ranking"
      hint={isValue
        ? 'Summe der Starter-Werte je Position (beste Spieler pro Slot) über alle Teams verglichen.'
        : isStandings
          // Der Board-Rang ist nur eine Vorschau -- sobald die Saison laeuft,
          // zaehlen die echten Ergebnisse (Sieg-Quote, bei Gleichstand die
          // Punkte-Bilanz als Tiebreak fuer Schedule-Glueck).
          ? 'Rang nach Saison-Bilanz: Sieg-Quote, bei Gleichstand die Punkte-Bilanz als Tiebreak (deckt Schedule-Glück auf).'
          // Dieser Fall betrifft ausdruecklich nicht nur echte Redraft-Ligen --
          // auch eine Dynasty-Liga landet hier, solange (noch) keine Dynasty-
          // Rangliste importiert ist oder die Saison noch nicht laeuft.
          : `Ohne Dynasty-Werte${isRookieMode ? '' : ' (Redraft)'}: je Position werden alle Teams nach ihrem besten Spieler geranked, der Schnitt dieser Plätze über alle Positionen ergibt den Gesamt-Rang. Kleiner ist besser.${isRookieMode ? ' Für echte Dynasty-Werte eine KTC-Rangliste importieren.' : ''}`}
      headline={power.myRank != null ? String(power.myRank) : '—'}
      sub={power.myRank != null
        ? `von ${power.teams.length} Teams · ${colLabel} ${fmt(isStandings ? power.teams[power.myRank - 1] : { metric: power.myMetric })}`
        : 'Dein Team nicht erkannt'}
      basis={isValue
        ? `${power.teams.length} Kader verglichen · Summe der Starter-Werte je Position`
        : isStandings
          ? `${power.teams.length} Teams verglichen · Bilanz der laufenden Saison`
          : `${power.teams.length} Kader verglichen · Rang-Schnitt aus bis zu ${Math.max(...power.teams.map((t) => t.positionsCounted))} Positionen`}
      wide
    >
      <table className="an-table">
        <thead>
          <tr>
            <th>#</th><th>Team</th><th className="an-num">{colLabel}</th>
            {isStandings && <th className="an-num">Punkte</th>}
          </tr>
        </thead>
        <tbody>
          {power.teams.map((t, i) => (
            <tr key={t.rosterId ?? i} className={cx(String(t.rosterId) === String(myRosterId) && 'is-me')}>
              <td>{i + 1}</td>
              <td>{t.label}</td>
              <td className="an-num">{fmt(t)}</td>
              {isStandings && <td className="an-num">{Math.round(t.pointsFor)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </StatCard>
  )
}

function AgeProfile({ ages }) {
  const { positions, teamCount } = ages

  if (!teamCount) {
    return <StatCard title="Alters-Profil" empty="Nur für echte Ligen — Mock-Drafts haben keine Kader." />
  }
  if (!positions.length) {
    return <StatCard title="Alters-Profil" empty="Keine Altersdaten für die Kader-Positionen verfügbar." />
  }

  const featured = positions.find((p) => p.diff != null) || positions[0]
  const maxAbs = Math.max(...positions.map((p) => Math.abs(p.diff ?? 0)), 1)

  return (
    <StatCard
      title="Alters-Profil"
      hint="Durchschnittsalter deines Kaders je Position gegen den Liga-Median — jünger ist kein Werturteil, nur ein Rebuild- vs. Win-Now-Signal."
      headline={featured.mine != null ? featured.mine.toFixed(1) : '—'}
      sub={featured.diff != null
        ? `${featured.pos}: ${Math.abs(featured.diff).toFixed(1)} Jahre ${featured.diff < 0 ? 'jünger' : 'älter'} als der Liga-Median`
        : ''}
      basis={`${teamCount} Kader verglichen`}
    >
      {positions.map((p) => (
        <div className="an-row" key={p.pos}>
          <span className="an-pos" style={{ background: posColor(p.pos) }}>{p.pos}</span>
          {/* Bewusst keine good/bad-Faerbung wie beim Wert-Vergleich: ein
              juengerer Kader ist kein besserer, nur ein anderer (Rebuild vs.
              Win-Now). Ein neutraler Akzent statt Gruen/Rot. */}
          <svg viewBox={`${-maxAbs} 0 ${maxAbs * 2} 1`} preserveAspectRatio="none" width="100%" height="12"
               role="img" aria-label={p.diff != null
                 ? `${p.pos}: ${p.mine.toFixed(1)} Jahre im Schnitt, Liga-Median ${p.leagueMedian.toFixed(1)}`
                 : `${p.pos}: keine Daten`}>
            <line x1="0" y1="0" x2="0" y2="1" stroke="var(--muted, #888)" strokeWidth={maxAbs / 100} />
            <rect
              x={Math.min(0, p.diff ?? 0)} y="0.15"
              width={Math.abs(p.diff ?? 0)} height="0.7"
              fill="var(--accent, #4ea1ff)"
            />
          </svg>
          <span className="an-num">
            {p.mine != null ? p.mine.toFixed(1) : '—'}
            <span className="muted an-composition">Liga {p.leagueMedian.toFixed(1)}</span>
          </span>
        </div>
      ))}
    </StatCard>
  )
}

const BENCH_SEGMENTS = [
  { key: 'starter', code: 'ST', label: 'Starter', color: 'var(--good, #4ec97b)' },
  { key: 'bench', code: 'BE', label: 'Bank', color: 'var(--accent, #4ea1ff)' },
  { key: 'taxi', code: 'TX', label: 'Taxi', color: 'var(--muted, #888)' },
  { key: 'ir', code: 'IR', label: 'IR', color: 'var(--bad, #e0555a)' },
]

function StarterVsBenchValue({ data }) {
  const segs = BENCH_SEGMENTS.filter((s) => data.value[s.key] > 0)

  return (
    <StatCard
      title="Starter vs. Bank"
      hint="Wie viel Dynasty-Wert in deiner Startelf steckt gegenüber Bank, Taxi und IR."
      headline={`${Math.round(data.starterShare * 100)}%`}
      sub="deines Kaderwerts steht in der Startelf"
      basis={`${data.matched} gematchte Kaderspieler mit Dynasty-Wert`}
    >
      <div
        className="an-stackbar"
        role="img"
        aria-label={segs.map((s) => `${s.label}: ${Math.round(data.value[s.key])} (${data.count[s.key]} Spieler)`).join(', ')}
      >
        {segs.map((s) => (
          <span key={s.key} className="an-stackseg" style={{ flexGrow: data.value[s.key], background: s.color }} />
        ))}
      </div>
      <div className="an-wlegend">
        {segs.map((s) => (
          <span key={s.key}>
            <i className="an-wkey" style={{ width: 10, height: 10, borderRadius: 2, background: s.color }} />
            {s.label} {Math.round(data.value[s.key])} ({data.count[s.key]})
          </span>
        ))}
      </div>
    </StatCard>
  )
}

function StarterVsBenchRank({ data }) {
  // Kein Summenwert im Rangmodus (siehe rosterStats.js) -- der Kopf zeigt
  // stattdessen den Rang-Abstand zwischen Bank- und Starter-Schnitt.
  const gap = (data.avgRank.starter != null && data.avgRank.bench != null)
    ? data.avgRank.bench - data.avgRank.starter
    : null
  const cats = BENCH_SEGMENTS.filter((s) => data.count[s.key] > 0)

  return (
    <StatCard
      title="Starter vs. Bank"
      hint="Durchschnittlicher Experten-Rang deiner Starter gegenüber Bank, Taxi und IR — kleinere Zahl ist besser."
      headline={gap != null ? Math.round(Math.abs(gap)) : '—'}
      sub={gap == null
        ? ''
        : gap >= 0
          ? `Ränge Abstand — deine Bank ist im Schnitt schlechter geranked als deine Startelf`
          : `Ränge — ein Bankspieler ist im Schnitt besser geranked als deine Startelf`}
      basis={`${data.matched} gematchte Kaderspieler mit Rang`}
    >
      {cats.map((s) => (
        <div className="an-row" key={s.key}>
          <span className="an-pos" style={{ background: s.color }}>{s.code}</span>
          <span className="muted">{s.label}</span>
          <span className="an-num">
            Ø {data.avgRank[s.key].toFixed(0)}
            <span className="muted an-composition">{data.count[s.key]} Spieler</span>
          </span>
        </div>
      ))}
    </StatCard>
  )
}

function StarterVsBench({ data }) {
  if (!data.available) {
    const empty = data.reason === 'low-coverage'
      ? `Nur ${Math.round(data.coverage * 100)} % deines Kaders stehen im importierten Ranking — zu dünn für einen Vergleich.`
      : 'Kein eigener Kader mit importiertem Ranking gefunden.'
    return <StatCard title="Starter vs. Bank" empty={empty} />
  }
  if (data.mode === 'value') {
    if (!data.total) {
      return <StatCard title="Starter vs. Bank" empty="Keine gematchten Kaderspieler mit Dynasty-Wert." />
    }
    return <StarterVsBenchValue data={data} />
  }
  return <StarterVsBenchRank data={data} />
}

export default function RosterTab({ split, power, ages, starterBench, myRosterId, isRookieMode }) {
  return (
    <div className="an-grid">
      <KaderVsLiga split={split} />
      <AgeProfile ages={ages} />
      <PowerRanking power={power} myRosterId={myRosterId} isRookieMode={isRookieMode} />
      <StarterVsBench data={starterBench} />
    </div>
  )
}
