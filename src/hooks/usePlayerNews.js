import { useEffect, useState } from 'react'

// Laedt Spieler-News von /api/news/player (FantasyPros-Scrape im Proxy).
// Als Hook, damit Desktop-Inspector und mobiles Detail-Sheet exakt dasselbe
// Verhalten haben — inklusive Ladezustand und Abbruch beim Spielerwechsel.
export function usePlayerNews(name, { limit = 3 } = {}) {
  const [items, setItems] = useState(null)
  const [state, setState] = useState('idle') // idle | loading | ok | error

  useEffect(() => {
    if (!name) { setItems(null); setState('idle'); return }
    let cancelled = false
    setState('loading')
    fetch(`/api/news/player?name=${encodeURIComponent(name)}&limit=${limit}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => { if (!cancelled) { setItems(d.items || []); setState('ok') } })
      .catch(() => { if (!cancelled) { setItems([]); setState('error') } })
    return () => { cancelled = true }
  }, [name, limit])

  return { items, state }
}
