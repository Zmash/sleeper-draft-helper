// Kleines Symbol hinter dem Spielernamen, wenn Jev die neueste Meldung als
// Rollenwechsel oder Ausfall einstuft (siehe useNewsSignals / jevNews.js).
// Das Zeichen traegt die Richtung, nicht nur die Farbe. Nur Schriftzeichen:
// Pfeile sind erlaubt, Dingbats wie ein Kreuz nicht (no-emoji.test.js) —
// das "+" im Rahmen liest sich als Sanitaetskreuz.
const LABEL = { up: 'mehr Rolle', down: 'weniger Rolle', injury: 'Ausfall' }
const GLYPH = { up: '↑', down: '↓', injury: '+' }

export default function NewsSignalMark({ info }) {
  const s = info?.signal
  if (!s || !LABEL[s]) return null
  const text = `Neue Meldung: ${LABEL[s]} — ${info.headline || ''}`.trim()
  return (
    <span className={`news-mark news-mark--${s}`} role="img" aria-label={text} title={text}>
      {GLYPH[s]}
    </span>
  )
}
