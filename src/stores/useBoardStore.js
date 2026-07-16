import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { normalizePlayerName } from '../utils/formatting'
import { parseFantasyProsCsv } from '../services/csv'
import { mergeRankingsWithMarket, overlayMarketData } from '../services/marketMerge'
import { useSessionStore } from './useSessionStore'
import { useLiveStore } from './useLiveStore'

function ffcFormatFor({ isSuperflex, effScoringType }) {
  if (isSuperflex) return '2qb'
  if (effScoringType === 'half_ppr') return 'half-ppr'
  if (effScoringType === 'standard') return 'standard'
  return 'ppr'
}

async function fetchJsonOk(url) {
  const resp = await fetch(url)
  if (!resp.ok) throw new Error(`Server antwortete mit ${resp.status}`)
  const data = await resp.json()
  if (!data.ok) throw new Error(data.error || 'Unbekannter Fehler')
  return data
}

export const useBoardStore = create(
  persist(
    (set, get) => ({
      csvRawText: '',
      boardPlayers: [],
      searchQuery: '',
      positionFilter: 'ALL',
      teamFilter: 'ALL',
      draftMode: 'redraft',
      enriching: false,
      marketMeta: null,          // { source, format, total_drafts, end_date, fetched_at }
      lastImportStats: null,     // { total, withAdp, withoutAdp, unmatchedNames }
      lastBoardSnapshot: null,   // Ein Level Undo — bewusst nicht persistiert

      setCsvRawText: (v) => set({ csvRawText: v }),
      setBoardPlayers: (v) =>
        set((s) => ({ boardPlayers: typeof v === 'function' ? v(s.boardPlayers) : v })),
      setSearchQuery: (v) => set({ searchQuery: v }),
      setPositionFilter: (v) => set({ positionFilter: v }),
      setTeamFilter: (v) => set({ teamFilter: v }),
      setDraftMode: (v) => set({ draftMode: v }),
      setEnriching: (v) => set({ enriching: v }),

      handleCsvLoad: async () => {
        const { csvRawText, boardPlayers } = get()
        if (!csvRawText.trim()) { alert('Bitte CSV einfügen oder Datei wählen.'); return false }
        if (boardPlayers.length) {
          const ok = window.confirm('Es ist bereits eine CSV geladen. Aktuelle Daten überschreiben?')
          if (!ok) return false
        }
        const rows = parseFantasyProsCsv(csvRawText)
        if (!rows.length) { alert('CSV konnte nicht gelesen werden.'); return false }
        const fresh = rows.map((r) => ({ ...r, status: null, pick_no: null, picked_by: null }))
        set({ boardPlayers: fresh })
        const { selectedDraftId } = useSessionStore.getState()
        if (selectedDraftId) await useLiveStore.getState().loadPicks(selectedDraftId)
        return true
      },

      handleKtcRookieImport: async () => {
        const { boardPlayers } = get()
        if (boardPlayers.length) {
          const ok = window.confirm('Es sind bereits Rankings geladen. Aktuelle Daten überschreiben?')
          if (!ok) return false
        }
        const resp = await fetch('/api/rankings/ktc-rookies')
        if (!resp.ok) throw new Error(`Server antwortete mit ${resp.status}`)
        const data = await resp.json()
        if (!data.ok) throw new Error(data.error || 'Unbekannter Fehler')
        const fresh = data.players.map((p) => ({
          ...p,
          nname: normalizePlayerName(p.name),
          status: null,
          pick_no: null,
          picked_by: null,
        }))
        set({ csvRawText: '', boardPlayers: fresh, lastBoardSnapshot: boardPlayers.length ? boardPlayers : null })
        const { selectedDraftId } = useSessionStore.getState()
        if (selectedDraftId) await useLiveStore.getState().loadPicks(selectedDraftId)
        return true
      },

      handleAutoImport: async ({ isSuperflex, effScoringType, numTeams, draftMode = 'redraft', force = false } = {}) => {
        const { boardPlayers } = get()
        if (boardPlayers.length && !force) {
          // Bestaetigung liegt beim Aufrufer (Modal, Task 8) — der Store fragt nicht.
          return { ok: false, needsConfirm: true }
        }
        const snapshot = boardPlayers.length ? boardPlayers : null
        const numQbs = isSuperflex ? 2 : 1
        const pprVal = effScoringType === 'ppr' ? 1 : effScoringType === 'half_ppr' ? 0.5 : 0
        const isDynasty = draftMode === 'rookie'

        // Rangliste ist Pflicht — ohne sie gibt es kein Board.
        let fc
        try {
          fc = await fetchJsonOk(
            `/api/rankings/fantasycalc?isDynasty=${isDynasty}&numQbs=${numQbs}&numTeams=${numTeams}&ppr=${pprVal}`
          )
        } catch (e) {
          return { ok: false, error: e.message || 'Rangliste nicht erreichbar' }
        }

        // Markt ist Kuer — ein Board ohne ADP ist besser als kein Board.
        // Fuer Rookie/Dynasty liefert FFC nichts, deshalb gar nicht erst fragen.
        let ffc = null
        if (!isDynasty) {
          try {
            ffc = await fetchJsonOk(`/api/rankings/ffc-adp?format=${ffcFormatFor({ isSuperflex, effScoringType })}&teams=${numTeams}`)
          } catch { ffc = null }
        }

        const { players, stats } = mergeRankingsWithMarket(fc.players, ffc?.players || [])
        set({
          csvRawText: '',
          boardPlayers: players,
          marketMeta: ffc?.meta || null,
          lastImportStats: stats,
          lastBoardSnapshot: snapshot,
        })
        const { selectedDraftId } = useSessionStore.getState()
        if (selectedDraftId) await useLiveStore.getState().loadPicks(selectedDraftId)
        return { ok: true, stats, marketMissing: !isDynasty && !ffc }
      },

      refreshMarketData: async () => {
        const { boardPlayers, marketMeta } = get()
        if (!boardPlayers.length) return { ok: false, error: 'Kein Board geladen' }
        const format = marketMeta?.format || 'ppr'
        try {
          const ffc = await fetchJsonOk(`/api/rankings/ffc-adp?format=${format}`)
          const { players, stats } = overlayMarketData(boardPlayers, ffc.players)
          // rk und Reihenfolge bleiben unberuehrt — der Nutzer pflegt sein Board.
          set({ boardPlayers: players, marketMeta: ffc.meta })
          return { ok: true, stats }
        } catch (e) {
          return { ok: false, error: e.message || 'Marktdaten nicht erreichbar' }
        }
      },

      undoImport: () => {
        const { lastBoardSnapshot } = get()
        if (!lastBoardSnapshot) return false
        set({ boardPlayers: lastBoardSnapshot, lastBoardSnapshot: null, lastImportStats: null })
        return true
      },

      onBoardReorder: (draggedNname, targetNname) => {
        if (!draggedNname || draggedNname === targetNname) return
        const arr = [...get().boardPlayers]
        const fromIdx = arr.findIndex((p) => p.nname === draggedNname)
        const toIdx = arr.findIndex((p) => p.nname === targetNname)
        if (fromIdx === -1 || toIdx === -1) return
        const [removed] = arr.splice(fromIdx, 1)
        arr.splice(toIdx, 0, removed)
        set({ boardPlayers: arr.map((p, i) => ({ ...p, rk: String(i + 1), ecr: i + 1 })) })
      },

      // Called reactively when livePicks change (from BoardPage useEffect)
      mergeLivePicksWithBoard: (livePicks, sleeperUserId) => {
        const { boardPlayers } = get()
        if (!boardPlayers.length) return
        const byNormalizedName = new Map(boardPlayers.map((p) => [p.nname, p]))
        for (const pick of livePicks || []) {
          const fullName = normalizePlayerName(
            `${pick?.metadata?.first_name || ''} ${pick?.metadata?.last_name || ''}`
          )
          const player = byNormalizedName.get(fullName)
          if (player) {
            player.status = pick.picked_by === sleeperUserId ? 'me' : 'other'
            player.pick_no = pick.pick_no
            player.picked_by = pick.picked_by
            const sleeperBye = pick?.metadata?.bye_week
            if (sleeperBye !== undefined && sleeperBye !== null && String(sleeperBye).trim() !== '') {
              player.bye = sleeperBye
            }
          }
        }
        const updated = [...byNormalizedName.values()].sort(
          (a, b) => Number(a.rk) - Number(b.rk)
        )
        set({ boardPlayers: updated })
      },
    }),
    {
      name: 'sdh-board-v1',
      partialize: (s) => ({
        csvRawText: s.csvRawText,
        boardPlayers: s.boardPlayers,
        searchQuery: s.searchQuery,
        positionFilter: s.positionFilter,
        teamFilter: s.teamFilter,
        draftMode: s.draftMode,
        marketMeta: s.marketMeta,
        // lastBoardSnapshot bleibt in-memory: ein Undo ueber Sessions hinweg
        // waere ueberraschend, und der Snapshot verdoppelt den Speicherbedarf.
      }),
    }
  )
)
