import StatCard from './StatCard'
import { cx, posColor, signed } from '../../utils/formatting'

export default function RosterTab({ split }) {
  const { mode, positions, coverage, teamCount } = split

  if (!teamCount) {
    return (
      <div className="an-grid">
        <StatCard
          title="Kader gegen das Liga-Feld"
          empty="Nur für echte Ligen — Mock-Drafts haben keine Kader."
        />
      </div>
    )
  }
  if (coverage < 0.5) {
    return (
      <div className="an-grid">
        <StatCard
          title="Kader gegen das Liga-Feld"
          empty={`Nur ${Math.round(coverage * 100)} % der Kaderspieler stehen im importierten Ranking — zu dünn für einen Vergleich.`}
        />
      </div>
    )
  }

  if (!positions.length) {
    return (
      <div className="an-grid">
        <StatCard
          title="Kader gegen das Liga-Feld"
          empty="Für keine Position konnte ein Vergleich ermittelt werden — möglicherweise hat keine Position einen Starter-Slot in dieser Liga."
        />
      </div>
    )
  }

  const einheit = mode === 'value' ? 'Punkten' : 'Rängen'
  const beste = positions.slice().sort((a, b) => (b.diff ?? -Infinity) - (a.diff ?? -Infinity))[0]
  const maxAbs = Math.max(...positions.map((p) => Math.abs(p.diff ?? 0)), 1)
  const hasData = positions.some((p) => p.diff != null)

  return (
    <div className="an-grid">
      <StatCard
        title="Kader gegen das Liga-Feld"
        hint={mode === 'value'
          ? 'Summe der Dynasty-Werte je Position, verglichen mit dem Median der Liga.'
          : 'Rang deines besten Spielers je Position, verglichen mit dem Median der Liga. Rangabstände sind nicht wertproportional — die Richtung ist verlaesslich, der Betrag grob.'}
        headline={beste?.diff != null ? signed(beste.diff) : '—'}
        sub={hasData && beste?.diff != null ? `${beste.pos} ist deine stärkste Position` : ''}
        basis={`${teamCount} Kader · Deckung ${Math.round(coverage * 100)} % · in ${einheit}`}
        wide
      >
        {positions.map((p) => (
          <div className="an-row" key={p.pos}>
            <span className="an-pos" style={{ background: posColor(p.pos) }}>{p.pos}</span>
            <svg viewBox={`${-maxAbs} 0 ${maxAbs * 2} 1`} preserveAspectRatio="none" height="12"
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
            </span>
          </div>
        ))}
      </StatCard>
    </div>
  )
}
