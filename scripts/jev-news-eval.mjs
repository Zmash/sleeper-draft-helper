// Abnahme der Jev-News-Markierungen, bevor sie live gehen.
// Holt die neueste Meldung je Spieler ueber den laufenden Dev-Server und
// fragt Jev direkt — ohne Store und Tagesbudget, damit nichts gecacht wird.
// Kosten: ~30 Aufrufe x ~500 Tokens x $0.042/1M ≈ 0,06 Cent.
//
//   npm run dev:api                         (in einem zweiten Terminal)
//   node scripts/jev-news-eval.mjs           (Standardliste)
//   node scripts/jev-news-eval.mjs "Puka Nacua" "Bijan Robinson"
import dotenv from 'dotenv'
import { callJev, buildState, signalProbs, deriveSignal, isNewsTooOld } from '../src/server/jevNews.js'

dotenv.config({ path: new URL('../src/.env', import.meta.url) })

const API = process.env.SDH_EVAL_API || 'http://127.0.0.1:5175'
const KEY = process.env.SDH_OPENROUTER_KEY
if (!KEY) {
  console.error('SDH_OPENROUTER_KEY fehlt (src/.env). Ohne Key keine Auswertung.')
  process.exit(1)
}

const DEFAULT_PLAYERS = [
  "Ja'Marr Chase", 'Bijan Robinson', 'Justin Jefferson', 'CeeDee Lamb', 'Puka Nacua',
  'Jahmyr Gibbs', 'Saquon Barkley', 'Amon-Ra St. Brown', 'Malik Nabers', 'Brian Thomas Jr.',
  'Ashton Jeanty', 'Nico Collins', 'Christian McCaffrey', 'Derrick Henry', "De'Von Achane",
  'Josh Allen', 'Lamar Jackson', 'Jalen Hurts', 'Joe Burrow', 'Brock Bowers',
  'Trey McBride', 'George Kittle', 'Travis Kelce', 'A.J. Brown', 'Drake London',
  'Garrett Wilson', 'Tee Higgins', 'Kyren Williams', 'Breece Hall', 'James Cook',
]
const players = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_PLAYERS

const pct = (x) => `${Math.round(x * 100)}%`.padStart(4)
const rows = []
let tokens = 0

for (const name of players) {
  let item = null
  try {
    const r = await fetch(`${API}/api/news/player?name=${encodeURIComponent(name)}&limit=1`)
    item = (await r.json())?.items?.[0] || null
  } catch (e) {
    console.error(`Dev-Server nicht erreichbar (${API}) — laeuft "npm run dev:api"?`, e.message)
    process.exit(1)
  }
  if (!item) { rows.push({ name, note: 'keine Meldung' }); continue }
  if (isNewsTooOld(item)) { rows.push({ name, note: `zu alt (${item.date})` }); continue }
  try {
    const { answers, usage } = await callJev({ apiKey: KEY, state: buildState({ name, item }) })
    tokens += Number(usage.input_tokens) || 0
    const p = signalProbs(answers)
    rows.push({ name, item, p, signal: deriveSignal(p) })
  } catch (e) {
    rows.push({ name, note: `Jev-Fehler ${e.status || ''} ${e.message}` })
  }
}

for (const r of rows) {
  if (!r.p) { console.log(`${r.name.padEnd(22)}  —  ${r.note}`); continue }
  const mark = { up: '↑ mehr', down: '↓ weniger', injury: '+ Ausfall' }[r.signal] || '·'
  console.log(`${r.name.padEnd(22)} ${mark.padEnd(10)} up ${pct(r.p.up)}  down ${pct(r.p.down)}  out ${pct(r.p.out)}  | ${r.item.date || '?'}  ${r.item.headline}`)
}
console.log(`\n${rows.filter((r) => r.p).length} bewertet, ${tokens} Input-Tokens (~$${(tokens * 0.042 / 1e6).toFixed(5)})`)
