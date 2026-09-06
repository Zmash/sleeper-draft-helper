import StatCard from './StatCard'
import { cx, posColor, signed } from '../../utils/formatting'

export default function RosterTab({ split }) {
  const { mode, positions, coverage, teamCount } = split

  if (!teamCount) {
    return (
      <div className="an-grid">
        <StatCard
          title="Kader gegen das Liga-Feld"
          empty="Nur fuer echte Ligen — Mock-Drafts haben keine Kader."
        />
      </div>
    )
  }
  if (coverage < 0.5) {
    return (
      <div className="an-grid">
        <StatCard
          title="Kader gegen das Liga-Feld"
          empty={`Nur ${Math.round(coverage * 100)} % der Kaderspieler stehen im importierten Ranking — zu duenn fuer einen Vergleich.`}
        />
      </div>
    )
  }

  const einheit = mode === 'value' ? 'Punkten' : 'Raengen'
  const beste = positions.slice().sort((a, b) => (b.diff ?? -Infinity) - (a.diff ?? -Infinity))[0]
  const maxAbs = Math.max(...positions.map((p) => Math.abs(p.diff ?? 0)), 1)

  return (
    <div className="an-grid">
      <StatCard
        title="Kader gegen das Liga-Feld"
        hint={mode === 'value'
          ? 'Summe der Dynasty-Werte je Position, verglichen mit dem Median der Liga.'
          : 'Rang deines besten Spielers je Position, verglichen mit dem Median der Liga. Rangabstaende sind nicht wertproportional — die Richtung ist verlaesslich, der Betrag grob.'}
        headline={beste?.diff != null ? signed(beste.diff) : '—'}
        sub={beste ? `${beste.pos} ist deine staerkste Position` : ''}
        basis={`${teamCount} Kader · Deckung ${Math.round(coverage * 100)} % · in ${einheit}`}
        wide
      >
        {positions.map((p) => (
          <div className="an-row" key={p.pos}>
            <span className="an-pos" style={{ background: posColor(p.pos) }}>{p.pos}</span>
            <svg viewBox={`${-maxAbs} 0 ${maxAbs * 2} 1`} preserveAspectRatio="none" height="12"
                 role="img" aria-label={`${p.pos}: ${Math.round(p.diff ?? 0)} gegenueber dem Median`}>
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
