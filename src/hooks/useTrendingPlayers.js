import { useEffect, useState } from 'react'
import { fetchTrendingPlayers } from '../services/api'
import { loadPlayersMetaCached } from '../services/playersMeta'

function primaryPos(meta) {
  const arr = Array.isArray(meta?.fantasy_positions) ? meta.fantasy_positions : []
  return arr[0] || meta?.position || ''
}

// Sleeper liefert nur player_id + count -- Name/Team/Position/Verletzung
// kommen aus dem ohnehin 24h-gecachten Spieler-Datensatz. Eintraege ohne
// Treffer im Cache (neue/unbekannte IDs) fallen raus statt leer zu rendern.
function mergeWithMeta(entries, metaById) {
  return (entries || [])
    .map((e) => {
      const meta = metaById[e.player_id]
      if (!meta) return null
      return {
        player_id: e.player_id,
        count: e.count,
        name: meta.full_name || `${meta.first_name || ''} ${meta.last_name || ''}`.trim(),
        team: meta.team || null,
        pos: primaryPos(meta),
        injury_status: meta.injury_status || null,
      }
    })
    .filter(Boolean)
}

// Ligaübergreifende Waiver-Trends fuer den Markt-Tab: wer wird gerade auf
// Sleeper am meisten geholt/gedroppt (letzte 24h). Gleiches Lade-/Fehler-
// Verhalten wie usePlayerNews.js.
export function useTrendingPlayers({ lookbackHours = 24, limit = 15 } = {}) {
  const [adds, setAdds] = useState([])
  const [drops, setDrops] = useState([])
  const [state, setState] = useState('loading') // loading | ok | error

  useEffect(() => {
    let cancelled = false
    setState('loading')
    Promise.all([
      fetchTrendingPlayers('add', { lookbackHours, limit }),
      fetchTrendingPlayers('drop', { lookbackHours, limit }),
      loadPlayersMetaCached(),
    ])
      .then(([addEntries, dropEntries, metaById]) => {
        if (cancelled) return
        setAdds(mergeWithMeta(addEntries, metaById))
        setDrops(mergeWithMeta(dropEntries, metaById))
        setState('ok')
      })
      .catch(() => {
        if (cancelled) return
        setAdds([])
        setDrops([])
        setState('error')
      })
    return () => { cancelled = true }
  }, [lookbackHours, limit])

  return { adds, drops, state }
}
