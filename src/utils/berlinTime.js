// Alle Zeitangaben der NFL-Seite sind deutsche Ortszeit. Die Spieltermine
// kommen als UTC-ISO-String von ESPN -- wir rechnen sie also nicht mit
// new Date().getHours() um (das waere die Zeitzone des Geraets, auf einem
// Handy im Urlaub schlicht falsch), sondern fest ueber Europe/Berlin.
const TZ = 'Europe/Berlin'

const WEEKDAY_INDEX = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }

const partsFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ,
  weekday: 'short',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

export function toDate(input) {
  if (input == null) return null
  const d = input instanceof Date ? input : new Date(input)
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * Datum/Uhrzeit eines Zeitpunkts in deutscher Ortszeit, zerlegt.
 * @returns {{weekday:number, hour:number, minute:number, day:number, month:number, year:number, dayKey:string}|null}
 */
export function berlinParts(input) {
  const d = toDate(input)
  if (!d) return null
  const p = Object.fromEntries(partsFormat.formatToParts(d).map((x) => [x.type, x.value]))
  // hour12:false liefert in aelteren Runtimes "24" statt "00" fuer Mitternacht.
  const hour = Number(p.hour) % 24
  return {
    weekday: WEEKDAY_INDEX[p.weekday] ?? null,
    hour,
    minute: Number(p.minute),
    day: Number(p.day),
    month: Number(p.month),
    year: Number(p.year),
    dayKey: `${p.year}-${p.month}-${p.day}`,
  }
}

const timeFormat = new Intl.DateTimeFormat('de-DE', { timeZone: TZ, hour: '2-digit', minute: '2-digit' })
const shortDayFormat = new Intl.DateTimeFormat('de-DE', { timeZone: TZ, weekday: 'short' })
const longDayFormat = new Intl.DateTimeFormat('de-DE', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long' })

/** "19:00" */
export function berlinTime(input) {
  const d = toDate(input)
  return d ? timeFormat.format(d) : ''
}

/** "So" */
export function berlinShortDay(input) {
  const d = toDate(input)
  return d ? shortDayFormat.format(d).replace('.', '') : ''
}

/** "Sonntag, 20. September" */
export function berlinLongDay(input) {
  const d = toDate(input)
  return d ? longDayFormat.format(d) : ''
}
