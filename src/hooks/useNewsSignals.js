import { useEffect, useMemo, useRef, useState } from 'react'

// News-Markierungen (Jev via /api/news/signals) fuer die ersten 50 noch
// freien Zeilen eines Boards. Kosten entstehen nur, wenn jemand hinschaut:
// kein setInterval (Takt gehoert pageSync.js), keine Anfrage bei verstecktem
// Tab, und je Name hoechstens alle 10 Minuten eine Nachfrage.
export const SIGNAL_TARGETS = 50
export const SIGNAL_FRESH_MS = 10 * 60 * 1000

// Fuer Team-Defenses und Kicker gibt es keine Spieler-News — schlimmer: der
// FantasyPros-Abgleich ueber den Namen ("…-texans") koennte fremde Meldungen
// eines Texans-Spielers erwischen.
const NO_NEWS_POS = new Set(['DEF', 'DST', 'K'])

/** Beliebige Spielerliste → Anfrage-Ziele (ohne DEF/K, dedupliziert, max 50). */
export function newsTargetsFrom(players, max = SIGNAL_TARGETS) {
  const out = []
  const seen = new Set()
  for (const p of players || []) {
    if (!p?.name || seen.has(p.name)) continue
    if (NO_NEWS_POS.has(String(p.pos || '').toUpperCase())) continue
    seen.add(p.name)
    out.push({ name: p.name, pos: p.pos || null, team: p.team || null })
    if (out.length >= max) break
  }
  return out
}

/** Draft-Board: `status` heisst dort "schon gedraftet" — die interessieren nicht mehr. */
export function newsSignalTargets(rows, max = SIGNAL_TARGETS) {
  return newsTargetsFrom((rows || []).filter((p) => !p?.status), max)
}

/** Draft-Board-Zeilen. */
export function useNewsSignals(rows, opts) {
  const targets = useMemo(() => newsSignalTargets(rows), [rows])
  return useSignalsForTargets(targets, opts)
}

/** Saison-Listen (Lineup, Waiver): hier bedeutet `status` etwas anderes, also kein Filter. */
export function usePlayerNewsSignals(players, opts) {
  const targets = useMemo(() => newsTargetsFrom(players), [players])
  return useSignalsForTargets(targets, opts)
}

/** @returns {Record<string, null | { signal, headline, date, url, p }>} */
function useSignalsForTargets(targets, { debounceMs = 500 } = {}) {
  const key = targets.map((t) => t.name).join('|')
  const [signals, setSignals] = useState({})

  const targetsRef = useRef(targets)
  targetsRef.current = targets
  const fetchedAt = useRef({}) // name -> ms der letzten Antwort
  const pending = useRef(new Set()) // Namen mit laufender Anfrage
  // Beim (Wieder-)Einhaengen explizit auf true: StrictMode haengt Effekte im
  // Dev-Modus aus und wieder ein — nur im Cleanup zu setzen hiesse, jede
  // Antwort danach zu verwerfen.
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  useEffect(() => {
    async function load() {
      if (typeof document !== 'undefined' && document.hidden) return
      const now = Date.now()
      const missing = targetsRef.current.filter((t) =>
        !pending.current.has(t.name) && !(now - (fetchedAt.current[t.name] || 0) < SIGNAL_FRESH_MS))
      if (!missing.length) return
      for (const t of missing) pending.current.add(t.name)
      try {
        const r = await fetch('/api/news/signals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ players: missing }),
        })
        if (!r.ok) return // 429/400/5xx: still, alte Werte bleiben
        const d = await r.json()
        if (!d?.signals) return
        const at = Date.now()
        for (const t of missing) fetchedAt.current[t.name] = at
        if (mounted.current) setSignals((prev) => ({ ...prev, ...d.signals }))
      } catch {
        // offline o. ae. — naechste Namensaenderung oder Tab-Rueckkehr versucht es erneut
      } finally {
        for (const t of missing) pending.current.delete(t.name)
      }
    }

    const timer = setTimeout(load, debounceMs)
    const onVisible = () => { if (!document.hidden) load() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [key, debounceMs])

  return signals
}
