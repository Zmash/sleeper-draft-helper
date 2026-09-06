import { create } from 'zustand'
import { fetchLeagueRosters, fetchTradedPicks } from '../services/api'
import { loadPlayersMetaCached } from '../services/playersMeta'
import { normalizePlayerName } from '../utils/formatting'

// Schuetzt vor einem Wettlauf beim schnellen Ligawechsel: wird bei jedem Aufruf
// von loadDynastyRoster erhoeht. Trifft eine spaeter gestartete Antwort zuerst
// ein, ist der Zaehler schon weitergezaehlt und der aeltere, inzwischen
// veraltete Aufruf schreibt seine Daten nicht mehr ueber die neueren.
let ladeLauf = 0

export const useDynastyStore = create((set) => ({
  dynastyRoster: [],
  // Alle Kader der Liga (roh, ungefiltert) - zusaetzlich zu dynastyRoster (nur der eigene,
  // aufbereitete Kader), fuer den Liga-Feld-Vergleich auf der Analyse-Seite.
  leagueRosters: [],
  mySleeperRosterId: null,
  rosterToUserMap: {},
  tradedPicks: [],

  setMySleeperRosterId: (v) => set({ mySleeperRosterId: v }),
  setRosterToUserMap: (v) => set({ rosterToUserMap: v }),
  setTradedPicks: (v) => set({ tradedPicks: v }),

  // Leert Kader-Daten UND entwertet gleichzeitig laufende loadDynastyRoster-Aufrufe
  // (z.B. beim Abwaehlen einer Liga). Das Erhoehen von ladeLauf gehoert untrennbar
  // zum Leeren dazu: ohne das wuerde ein noch laufender, inzwischen ueberholter
  // Ladevorgang nach dem Leeren hier seine (veralteten) Daten wieder reinschreiben.
  clearDynastyData: () => {
    ladeLauf += 1
    // rosterToUserMap gehoert mit dazu: roster_id faengt in JEDER Liga bei 1 an.
    // Eine stehengebliebene Zuordnung der vorigen Liga liefert damit keine leeren,
    // sondern falsche Besitzer-Labels (App.jsx:233, BoardPage.jsx:120).
    set({ dynastyRoster: [], leagueRosters: [], mySleeperRosterId: null, rosterToUserMap: {} })
  },

  loadDynastyRoster: async ({ selectedLeagueId, sleeperUserId, seasonYear }) => {
    // Frueher Ruecksprung vor dem ersten await: kein Wettlauf moeglich, schreibt sofort.
    if (!selectedLeagueId || !sleeperUserId) { set({ dynastyRoster: [], leagueRosters: [] }); return }
    // Eigenen Lauf markieren: nur der jeweils zuletzt gestartete Aufruf darf nach
    // dem await noch schreiben.
    const eigenerLauf = ++ladeLauf
    const istAktuell = () => ladeLauf === eigenerLauf
    try {
      const season = Number(seasonYear) || new Date().getFullYear()
      const [rosters, playersMeta] = await Promise.all([
        fetchLeagueRosters(selectedLeagueId),
        loadPlayersMetaCached({ season }),
      ])
      // Zwischenzeitlich ist ein neuerer loadDynastyRoster-Aufruf gestartet (z.B. Ligawechsel) -
      // still abbrechen, ohne dessen bereits gesetzte Werte zu ueberschreiben.
      if (!istAktuell()) return
      const rMap = {}
      for (const r of rosters || []) {
        if (r.roster_id != null && r.owner_id) rMap[String(r.roster_id)] = String(r.owner_id)
      }
      // leagueRosters wird hier gesetzt (nicht erst nach dem myRoster-Fund): auch wenn unten
      // kein eigener Kader gefunden wird, sind die Liga-Kader fuer den Liga-Feld-Vergleich
      // brauchbar und bleiben bewusst erhalten.
      //
      // Angereichert statt roh: die Board-sleeper_id ist bei den ersten ~250 Eintraegen
      // kaputt (Zeilennummer statt echter ID, siehe rosterStats.js), darum braucht der
      // Vergleich dort zusaetzlich den normalisierten Namen als verlaessliche Bruecke.
      // playersMeta kann einen Spieler nicht kennen (z.B. Free Agents, DEF-Eintraege) --
      // dann bleibt der Name der Platzhalter "#<id>".
      const enrichedRosters = (rosters || []).map((r) => ({
        roster_id: r.roster_id ?? null,
        owner_id: r.owner_id ?? null,
        players: (r.players || []).map((id) => {
          const meta = playersMeta[id] || {}
          const name = meta.full_name || `#${id}`
          return {
            sleeper_id: id,
            name,
            nname: normalizePlayerName(name),
            pos: (meta.fantasy_positions?.[0] || meta.position || '').toUpperCase(),
          }
        }),
      }))
      set({ rosterToUserMap: rMap, leagueRosters: enrichedRosters })
      const myRoster = (rosters || []).find((r) => String(r.owner_id) === String(sleeperUserId))
      if (!myRoster) { set({ dynastyRoster: [], mySleeperRosterId: null }); return }
      set({ mySleeperRosterId: myRoster.roster_id ?? null })
      const starterSet = new Set(myRoster.starters || [])
      const taxiSet = new Set(myRoster.taxi || [])
      const reserveSet = new Set(myRoster.reserve || [])
      const players = (myRoster.players || []).map((id) => {
        const meta = playersMeta[id] || {}
        const slot = taxiSet.has(id)
          ? 'taxi'
          : reserveSet.has(id)
          ? 'ir'
          : starterSet.has(id)
          ? 'starter'
          : 'bench'
        return {
          sleeper_id: id,
          name: meta.full_name || `#${id}`,
          pos: (meta.fantasy_positions?.[0] || meta.position || '').toUpperCase(),
          team: meta.team || '',
          bye: meta.bye_week != null ? String(meta.bye_week) : '',
          age: meta.age || null,
          slot,
        }
      })
      set({ dynastyRoster: players })
    } catch (e) {
      console.warn('[dynastyRoster] load failed', e)
      // Auch im Fehlerfall nur schreiben, wenn kein neuerer Aufruf inzwischen erfolgreich war -
      // sonst wuerde ein veralteter Fehler die frischen Daten des neueren Aufrufs leeren.
      if (!istAktuell()) return
      set({ dynastyRoster: [], leagueRosters: [] })
    }
  },

  loadTradedPicks: async (draftId) => {
    if (!draftId) { set({ tradedPicks: [] }); return }
    try {
      const picks = await fetchTradedPicks(draftId)
      set({ tradedPicks: picks })
    } catch (e) {
      console.warn('[tradedPicks] load failed', e)
      set({ tradedPicks: [] })
    }
  },
}))
