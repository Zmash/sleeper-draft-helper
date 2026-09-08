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
// Vollstaendigkeits-Minimum: KTCs volle Dynasty-Liste hat 400+ Eintraege. Ein
// geparster Cache mit wenigen Eintraegen ist ein kaputter Frueh-Verbund
// (verifiziert 2026-09-08: 3 Spieler statt 416) und darf nicht als "frisch"
// gelten, sonst wird die leere KTC-Spalte bis zum TTL-Ablauf serviert.
const MIN_VALUES_COUNT = 100

export const useDynastyValuesStore = create(
  persist(
    (set, get) => ({
      dynastyValues: [],
      dynastyValuesFetchedAt: null,
      dynastyValuesSuperflex: null,
      loading: false,

      loadDynastyValuesIfStale: async ({ superflex = false } = {}) => {
        const { dynastyValues, dynastyValuesFetchedAt, dynastyValuesSuperflex, loading } = get()
        const fresh = dynastyValuesFetchedAt != null
          && dynastyValuesSuperflex === superflex
          && dynastyValues.length >= MIN_VALUES_COUNT
          && Date.now() - dynastyValuesFetchedAt < TTL_MS
        if (fresh || loading) return
        set({ loading: true })
        try {
          const resp = await fetch(`/api/rankings/ktc-dynasty?superflex=${superflex}`)
          if (!resp.ok) return
          const data = await resp.json()
          if (!data.ok) return
          // Das Server-Feld heisst dynasty_value, aber die Waiver-Konsumenten
          // (pickupRanking, KTC-Spalte in RecommendedLineupCard) lesen d.value.
          // Beide Namen werden hier auf denselben Wert normalisiert, damit egal
          // ist, was die API irgendwann liefert.
          const players = (data.players || []).map((p) => {
            const value = p.dynasty_value ?? p.value ?? null
            return { ...p, nname: normalizePlayerName(p.name), value, dynasty_value: value }
          })
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
      name: 'sdh-dynasty-values-v2',
      partialize: (s) => ({
        dynastyValues: s.dynastyValues,
        dynastyValuesFetchedAt: s.dynastyValuesFetchedAt,
        dynastyValuesSuperflex: s.dynastyValuesSuperflex,
      }),
    }
  )
)
