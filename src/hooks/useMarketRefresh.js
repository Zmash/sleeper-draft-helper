import { useState } from 'react'
import { useBoardStore } from '../stores/useBoardStore'

// Gemeinsame Logik hinter dem "Aktualisieren"-Knopf (Marktdaten/ADP neu laden,
// ohne die eigene Board-Reihenfolge zu verlieren) -- vorher zweimal in
// BoardSection.jsx dupliziert, jetzt eine Stelle fuer beide Shells (alte
// BoardSection + neue NextShell/NextBoard). Rookie-Gating passiert bewusst
// NICHT hier, sondern beim Aufrufer (onRefresh={undefined} im Rookie-Modus) --
// refreshMarketData() liefert im Rookie-Modus ohnehin einen Fehler zurueck.
export function useMarketRefresh({ isSuperflex, effScoringType, numTeams } = {}) {
  // Ohne Selector aufgerufen (wie zuvor in BoardSection): mehrere Tests mocken
  // useBoardStore als `() => ({...})` und ignorieren dabei ein Selector-
  // Argument -- ein Selector kaeme hier also nicht mit der echten Funktion,
  // sondern mit dem kompletten Mock-Objekt zurueck.
  const { refreshMarketData } = useBoardStore()
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)

  async function refresh() {
    setRefreshing(true)
    setError(null)
    const res = await refreshMarketData({ isSuperflex, effScoringType, numTeams })
    if (!res.ok) setError(res.error)
    setRefreshing(false)
    return res
  }

  return { refreshing, error, refresh }
}
