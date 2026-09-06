import { cx } from '../../utils/formatting'

/**
 * Gemeinsames Kachel-Geruest der Analyse-Seite.
 *
 * `basis` ist Pflicht, sobald die Kachel Zahlen zeigt: die Seite behauptet
 * Genauigkeit, also legt sie ihre Grundlage offen.
 * `empty` ersetzt den Inhalt durch eine Begruendung -- eine Kachel ohne Daten
 * zeigt nie Nullwerte.
 */
export default function StatCard({
  title, hint = '', headline = null, sub = '', basis = '',
  wide = false, empty = '', children,
}) {
  return (
    <section className={cx('an-card', wide && 'an-card--wide')}>
      <header className="an-card-head">
        <h3 className="an-card-title">{title}</h3>
        {hint && <p className="an-card-hint">{hint}</p>}
      </header>

      {empty ? (
        <p className="an-card-empty">{empty}</p>
      ) : (
        <>
          {headline !== null && (
            <div className="an-card-headline">
              <span className="an-headline-value">{headline}</span>
              {sub && <span className="an-headline-sub">{sub}</span>}
            </div>
          )}
          <div className="an-card-body">{children}</div>
          {basis && <footer className="an-card-basis">{basis}</footer>}
        </>
      )}
    </section>
  )
}
