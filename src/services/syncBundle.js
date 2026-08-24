// Sammelt und schreibt das Sync-Bündel. Kennt weder Krypto noch Netz.

export const SYNC_KEY = 'sdh.sync.v1'

// Alles mit Präfix "sdh" plus diese Ausnahmen. Eine gepflegte Whitelist
// wurde verworfen: genau daran krankt der Datei-Export, dessen
// VERSIONED_PREFIXES die Bindestrich-Stores (sdh-board-v1) nie erfasst hat.
const EXTRA_KEYS = ['draft-helper-theme']

// Reine Re-Fetch-Caches oeffentlicher APIs (24h-TTL, auf jedem Geraet aus
// derselben Quelle neu ladbar). sdh.playersMeta.v2 allein ist >2 MB — zusammen
// mit dem Board hat das JEDEN Push am 3-MB-Limit des Servers scheitern lassen,
// lautlos als 413 (syncOnce() faengt das nur als 'error' ab). Mitsynced wird
// dadurch auch nichts gewonnen: die Caches sind auf beiden Geraeten ohnehin
// identisch bzw. laufen unabhaengig ab.
//
// sdh.tip.cooldown.v2 aendert sich bei praktisch jeder Board-Interaktion
// (Timestamp pro angezeigtem Tipp) und macht damit JEDES Geraet bei JEDER
// Nutzung "aenderungsbereit" -- ganz ohne dass jemand Rankings oder
// Markierungen angefasst hat. Ohne diesen Ausschluss pusht ein Geraet beim
// naechsten Tick seinen eigenen, moeglicherweise veralteten Gesamtstand nur
// wegen dieses Timestamps -- und ueberschreibt damit eine frischere Aenderung
// des anderen Geraets auf dem Server, die dann zurueckgesynced wird. Das sah
// aus wie "eine Markierung faellt beim anderen Geraet einfach wieder weg".
const EXCLUDE_KEYS = ['sdh.playersMeta.v2', 'sdh-fc-dynasty-v1', 'sdh.tip.cooldown.v2']

function isBundled(k) {
  return k !== SYNC_KEY && !EXCLUDE_KEYS.includes(k) && (k.startsWith('sdh') || EXTRA_KEYS.includes(k))
}

export function collectBundle() {
  const keys = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k && isBundled(k)) keys.push(k)
  }
  // Sortiert einfuegen: syncClient erkennt Aenderungen ueber den
  // serialisierten String — ohne feste Reihenfolge sieht jede Umsortierung
  // von localStorage wie eine Aenderung aus.
  keys.sort()
  const out = {}
  for (const k of keys) {
    const v = localStorage.getItem(k)
    if (v !== null) out[k] = v
  }
  return out
}

// Dreiwege-Abgleich auf Ebene der localStorage-Keys.
//
// Ohne das gewinnt beim Pull das Fremdbuendel VOLLSTAENDIG — auch bei Keys, die
// man selbst gerade geaendert und noch nicht hochgeladen hat. Genau daran sind
// Markierungen vom Handy verschwunden: der PC laeuft dauerhaft mit Takt und
// pusht darum fast immer zuerst; das Handy sah beim naechsten Abgleich einen
// neueren Stempel und hat seine eigene Aenderung mit dem PC-Stand ueberschrieben.
// Das sah aus wie "Sync geht nur von PC zu Handy".
//
// base ist der Stand, auf den sich beide Geraete zuletzt geeinigt hatten
// (lastSentBundle) — nur damit laesst sich pro Key entscheiden, WER geaendert hat.
export function mergeBundles(base = {}, local = {}, remote = {}) {
  const out = {}
  for (const k of [...new Set([...Object.keys(local), ...Object.keys(remote)])].sort()) {
    const b = base[k], l = local[k], r = remote[k]
    // Loeschen kennt der Sync nicht (applyBundle schreibt nur, es entfernt nie) —
    // fehlt ein Key auf einer Seite, gilt der Wert der anderen. Wuerde der Key
    // stattdessen wegfallen, saehe ihn der naechste Takt als eigene Neuerung und
    // schoebe ihn wieder hoch: ein Ping-Pong ohne Ende.
    if (l === undefined) { out[k] = r; continue }
    if (r === undefined) { out[k] = l; continue }
    if (l === r || l === b) out[k] = r // bei uns unveraendert -> Fremdstand
    else if (r === b) out[k] = l       // nur wir haben geaendert -> unser Stand
    else out[k] = r                    // echter Konflikt am selben Key -> Server gewinnt
  }
  return out
}

export function applyBundle(bundle) {
  const applied = []
  for (const [k, v] of Object.entries(bundle || {})) {
    if (k === SYNC_KEY || typeof v !== 'string') continue
    localStorage.setItem(k, v)
    applied.push(k)
  }
  return applied
}
