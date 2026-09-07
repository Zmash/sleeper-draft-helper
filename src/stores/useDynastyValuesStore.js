import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { normalizePlayerName } from '../utils/formatting'

// Hintergrund-Datensatz fuer die Kader-Analyse, unabhaengig vom manuell
// importierten Board: ein Rookie-Draft-Board enthaelt nur ~50 Rookies, aber
// der Liga-Feld-Vergleich (rosterStats.js) braucht dynasty_value fuer den
// GESAMTEN Kader (auch Veteranen). Statt den Nutzer zu einem zusaetzlichen
// manuellen KTC-Import zu zwingen, laedt dieser Store die volle KTC-Dynasty-
// Liste automatisch beim Oeffnen der Analyse-Seite -- getrennt von
// useBoardStore, damit ein Board-Import diese Werte nie ueberschreibt und
// umgekehrt ein Board-Wechsel sie nie loescht.
const TTL_MS = 20 * 60 * 60 * 1000 // ~20h: einmal taeglich frisch, kein Scrape bei jedem Laden

export const useDynastyValuesStore = create(
  persist(
    (set, get) => ({
      dynastyValues: [],
      dynastyValuesFetchedAt: null,
      dynastyValuesSuperflex: null,
      loading: false,

      loadDynastyValuesIfStale: async ({ superflex = false } = {}) => {
        const { dynastyValuesFetchedAt, dynastyValuesSuperflex, loading } = get()
        const fresh = dynastyValuesFetchedAt != null
          && dynastyValuesSuperflex === superflex
          && Date.now() - dynastyValuesFetchedAt < TTL_MS
        if (fresh || loading) return
        set({ loading: true })
        try {
          const resp = await fetch(`/api/rankings/ktc-dynasty?superflex=${superflex}`)
          if (!resp.ok) return
          const data = await resp.json()
          if (!data.ok) return
          const players = (data.players || []).map((p) => ({ ...p, nname: normalizePlayerName(p.name) }))
          set({ dynastyValues: players, dynastyValuesFetchedAt: Date.now(), dynastyValuesSuperflex: superflex })
        } catch {
          // Still bleiben: kein Import-Flow, kein Fehler-UI -- die Kader-Analyse
          // faellt dann einfach auf die bisherige boardPlayers-Deckung zurueck.
        } finally {
          set({ loading: false })
        }
      },
    }),
    {
      name: 'sdh-dynasty-values-v1',
      partialize: (s) => ({
        dynastyValues: s.dynastyValues,
        dynastyValuesFetchedAt: s.dynastyValuesFetchedAt,
        dynastyValuesSuperflex: s.dynastyValuesSuperflex,
      }),
    }
  )
)
