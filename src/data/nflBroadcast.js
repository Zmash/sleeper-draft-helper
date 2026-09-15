// Deutsche Uebertragungswege der NFL, als gepflegte Tabelle -- so wie
// nflByes.js. Seit der Saison 2026/27 teilen sich RTL Deutschland (RTL, NITRO,
// RTL+) und Sky die Rechte fuer Deutschland/Oesterreich/Schweiz; der Vertrag
// laeuft bis einschliesslich der Saison 2028/29. DAZN hat keinen Liga-Deal
// mehr, fuehrt aber den NFL Game Pass (alle Spiele, US-Originalkommentar)
// weiter -- deshalb steht er unter jedem Spiel.
// Verifiziert 2026-09-15 gegen sport.sky.de und techbook.de.
//
// Was hier bewusst NICHT steht: welches konkrete Sonntagsspiel RTL, RTL+ bzw.
// Sky in einer bestimmten Woche auswaehlen. Das gibt keine offene Quelle her.
// Diese Fenster sind daher als `selection: true` markiert und werden in der UI
// als "Auswahl" gekennzeichnet -- lieber "eines dieser Spiele" sagen als das
// falsche Spiel behaupten.
import { berlinParts } from '../utils/berlinTime'

// Saisons, fuer die die Tabelle unten gilt. Faellt ein Spiel ausserhalb,
// nennen wir nur den Game Pass statt einer geratenen Rechtelage.
export const RIGHTS_SEASONS = [2026, 2027, 2028]

const GAME_PASS = { name: 'NFL Game Pass', kind: 'stream', hint: 'Alle Spiele, US-Originalkommentar (ueber DAZN)' }

const RTL = { name: 'RTL', kind: 'free' }
const NITRO = { name: 'NITRO', kind: 'free' }
const RTL_PLUS = { name: 'RTL+', kind: 'stream' }
const SKY = { name: 'Sky Sport', kind: 'pay' }

// Die deutschsprachige Konferenz laeuft sonntags ab 19:00 Uhr auf Sky Sport
// Top Event; in den ersten drei Spielwochen zusaetzlich frei bei NITRO.
const conferenceFor = (week) =>
  Number(week) > 0 && Number(week) <= 3
    ? 'Sky NFL Konferenz: Sky Sport Top Event · NITRO'
    : 'Sky NFL Konferenz: Sky Sport Top Event'

// slot -> Anzeige + Sender. `selection` heisst: der Sender zeigt EIN Spiel aus
// diesem Fenster, nicht zwingend dieses.
const SLOTS = {
  tnf: { label: 'Thursday Night Football', short: 'TNF', outlets: [RTL, SKY], selection: false },
  fri: { label: 'Freitagsspiel', short: 'FRI', outlets: [RTL, SKY], selection: true },
  sat: { label: 'Samstagsspiel', short: 'SAT', outlets: [RTL, SKY], selection: true },
  // Alle International Games laufen live und frei bei RTL -- die RTL-Kachel
  // ohne "Auswahl" sagt das bereits, ein zusaetzlicher Hinweis waere Fuellung.
  intl: { label: 'International Game', short: 'INTL', outlets: [RTL], selection: false },
  early: { label: 'Sonntag früh', short: 'SO 19', outlets: [RTL, RTL_PLUS, SKY], selection: true, conference: true },
  late: { label: 'Sonntag spät', short: 'SO 22', outlets: [RTL, SKY], selection: true, conference: true },
  snf: { label: 'Sunday Night Football', short: 'SNF', outlets: [RTL, SKY], selection: false },
  mnf: { label: 'Monday Night Football', short: 'MNF', outlets: [RTL, SKY], selection: false },
  thu: { label: 'Donnerstagsspiel', short: 'THU', outlets: [RTL, SKY], selection: true },
}

/**
 * Sendefenster eines Spiels aus dem deutschen Kickoff-Zeitpunkt ableiten.
 * Die Uhrzeiten sind Bereiche, keine festen Werte: zwischen der europaeischen
 * (letzter Oktobersonntag) und der US-Zeitumstellung (erster Novembersonntag)
 * liegt eine Woche, in der jedes Spiel eine Stunde frueher startet.
 * @returns {string|null} Slot-Key oder null, wenn kein Fenster passt
 */
export function slotForKickoff(date) {
  const p = berlinParts(date)
  if (!p) return null
  const { weekday, hour } = p
  const night = hour < 7
  if (weekday === 5) return night ? 'tnf' : 'fri' // Nacht auf Freitag = Donnerstagabend US
  if (weekday === 1) return night ? 'snf' : null // Nacht auf Montag = Sonntagabend US
  if (weekday === 2) return night ? 'mnf' : null // Nacht auf Dienstag = Montagabend US
  if (weekday === 6) return 'sat'
  if (weekday === 4) return night ? null : 'thu'
  if (weekday === 0) {
    if (hour >= 12 && hour < 18) return 'intl'
    if (hour >= 18 && hour < 21) return 'early'
    if (hour >= 21) return 'late'
  }
  return null
}

/**
 * Wo laeuft dieses Spiel in Deutschland?
 * @param {{date?: string|Date}} game  Spiel aus normalizeScoreboard
 * @param {{week?: number, season?: number|string}} ctx
 * @returns {{slot:string|null, label:string, short:string, selection:boolean,
 *            outlets:Array<{name:string,kind:string,hint?:string}>,
 *            conference:string|null, note:string|null}}
 */
export function broadcastFor(game, { week, season } = {}) {
  const covered = season == null || RIGHTS_SEASONS.includes(Number(season))
  const slotKey = slotForKickoff(game?.date)
  const slot = (covered && SLOTS[slotKey]) || null
  const p = berlinParts(game?.date)
  // Die Weihnachtsspiele sind in den letzten Jahren ausserhalb der regulaeren
  // Rechtekette gelaufen (Netflix) -- lieber einen Hinweis als eine Zusage.
  const christmas = p?.month === 12 && p?.day === 25

  const notes = []
  if (!covered) notes.push('Rechtelage für diese Saison nicht hinterlegt.')
  if (slot?.note) notes.push(slot.note)
  if (christmas) notes.push('Christmas Game — der Übertragungsweg kann abweichen.')

  return {
    slot: slotKey,
    label: slot?.label || 'Spiel',
    short: slot?.short || '',
    selection: !!slot?.selection,
    outlets: [...(slot?.outlets || []), GAME_PASS],
    conference: slot?.conference ? conferenceFor(week) : null,
    note: notes.length ? notes.join(' ') : null,
  }
}
