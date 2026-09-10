import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { normalizePlayerName } from '../utils/formatting'
import { parseFantasyProsCsv } from '../services/csv'
import { mergeRankingsWithMarket, overlayMarketData, overlayFfcSpread, enrichWithInjuries, fillMissingBye as fillMissingByeInMarket } from '../services/marketMerge'
import { loadPlayersMetaCached } from '../services/playersMeta'
import { effScoringTypeToFpParam } from '../services/draftFormat'
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

// Markt-ADP fuer ein Format. Hauptquelle ist Sleeper (RotoWire, format-spezifisch);
// faellt sie aus, uebernimmt FFC als Fallback. Beide liefern dieselbe normalisierte
// Form, nur marketMeta.source unterscheidet sie — die Herkunfts-Zeile nennt darueber
// die echte Quelle. null = beide Quellen weg (Board bleibt ohne ADP, das ist Kuer).
async function fetchMarketAdp(format, numTeams = 12) {
  try {
    return await fetchJsonOk(`/api/rankings/sleeper-adp?format=${format}`)
  } catch { /* Sleeper aus — FFC ist der Fallback */ }
  try {
    return await fetchJsonOk(`/api/rankings/ffc-adp?format=${format}&teams=${numTeams}`)
  } catch { return null }
}

// Zusaetzlich zur Haupt-ADP (fetchMarketAdp) IMMER FFC fuer die Streuungsfelder
// holen -- unabhaengig davon, ob Sleeper geliefert hat. Sleeper kennt keine
// Streuung, aber bleibt trotzdem die Haupt-ADP-Quelle (siehe overlayFfcSpread).
// Schlaegt der Abruf fehl, ist das folgenlos: das Board laedt normal weiter,
// nur der Markt-Reiter der Analyse-Seite bleibt dann leer.
async function fetchFfcSpread(format, numTeams = 12) {
  try {
    const data = await fetchJsonOk(`/api/rankings/ffc-adp?format=${format}&teams=${numTeams}`)
    return data.players
  } catch {
    return null
  }
}

// Quota-Erkennung fuer safeStorage: Chrome/Firefox melden QuotaExceededError
// per Name, aeltere WebKit-Varianten per code 22, der Rest per Meldungstext.
export function isQuota(e) {
  return e?.name === 'QuotaExceededError' || e?.code === 22
    || String(e?.message || '').toLowerCase().includes('quota')
}

// Verkleinert ein persist-JSON so weit, dass es wieder in localStorage passt:
// der boardsByKey-Cache ist verzichtbar (rekonstruiert sich per writeThrough),
// das aktive Top-Level-Board (boardPlayers etc.) bleibt immer erhalten.
// Wirft bei unlesbarem Input das Original, damit der Fehler sichtbar bleibt.
export function dropBoards(v) {
  try {
    const parsed = JSON.parse(v)
    if (parsed && parsed.state) parsed.state.boardsByKey = {}
    return JSON.stringify(parsed)
  } catch {
    throw v
  }
}

// Quota-sicheres Storage fuer die persist-Config: passt der volle Stand nicht
// mehr in localStorage (~5 MB), wird einmalig der Cache abgeworfen und nur das
// aktive Board persistiert, statt dass jeder Store-Write bricht.
export const safeStorage = {
  getItem: (k) => localStorage.getItem(k),
  setItem: (k, v) => {
    try {
      localStorage.setItem(k, v)
    } catch (e) {
      if (!isQuota(e)) throw e
      const slim = dropBoards(v)
      localStorage.setItem(k, slim)
    }
  },
  removeItem: (k) => localStorage.removeItem(k),
}

// Schreibt den aktiven Top-Level-Board-Stand in den boardsByKey-Cache zurueck
// (aktiver Key = Quelle der Wahrheit fuer switchBoard). No-Op ohne aktiven Key.
// Heilt Reload-mit-Hit: ohne Durchschrieb wuerde ein stale Cache-Hit nach Reload
// den persistierten Top-Level-Stand (z. B. Nutzer-Reorder) ueberschreiben.
// Der Cache haelt bewusst KEIN csvRawText: der Rohtext ist gross und nur das
// aktive Top-Level-Feld braucht ihn (Import-Dialog) — pro Cache-Eintrag wuerde
// er localStorage Richtung Quota treiben.
function writeThroughActiveBoard(set, get) {
  const st = get()
  if (!st.activeBoardKey) return
  set((s) => ({
    boardsByKey: {
      ...(s.boardsByKey || {}),
      [s.activeBoardKey]: {
        boardPlayers: s.boardPlayers, boardMode: s.boardMode, boardSource: s.boardSource,
        rankingSource: s.rankingSource, marketMeta: s.marketMeta,
        lastImportStats: s.lastImportStats,
      },
    },
  }))
}

// Reine Seed-Funktion fuer die einmalige Board-Migration (migrate.js): nimmt das
// rohe `sdh-board-v1`-JSON, gibt ggf. neues JSON zurueck, null wenn nichts zu tun.
// Pro Modus m in [redraft, rookie] wird das Ziel `mode:<m>` nur geseedet, wenn es
// fehlt oder keine boardPlayers hat UND mindestens ein `league:*:<m>`-/`fp:*:<m>`-
// Eintrag mit boardPlayers.length > 0 existiert → Kopie des inhaltsreichsten
// (laengste boardPlayers, Gleichstand: erste). Nur kopieren, nie loeschen.
// Idempotent: zweiter Lauf findet das Ziel vorhanden und liefert null.
export function migrateBoardsToModeKeys(rawJsonString) {
  if (!rawJsonString) return null
  let parsed
  try { parsed = JSON.parse(rawJsonString) } catch { return null }
  const boardsByKey = parsed?.state?.boardsByKey
  if (!boardsByKey || typeof boardsByKey !== 'object') return null
  const next = { ...boardsByKey }
  let changed = false
  for (const m of ['redraft', 'rookie']) {
    const target = `mode:${m}`
    const cur = next[target]
    // Ziel bereits geseedet → Skip (Idempotenz).
    if (Array.isArray(cur?.boardPlayers) && cur.boardPlayers.length > 0) continue
    let richest = null
    for (const k of Object.keys(next)) {
      if (!(k.startsWith('league:') || k.startsWith('fp:'))) continue
      if (!k.endsWith(`:${m}`)) continue
      const entry = next[k]
      if (!Array.isArray(entry?.boardPlayers) || entry.boardPlayers.length === 0) continue
      if (!richest || entry.boardPlayers.length > richest.boardPlayers.length) richest = entry
    }
    if (!richest) continue
    next[target] = { ...richest, boardPlayers: [...richest.boardPlayers] }
    changed = true
  }
  if (!changed) return null
  return JSON.stringify({ ...parsed, state: { ...parsed.state, boardsByKey: next } })
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
      // Typ des GELADENEN Boards: 'redraft' | 'rookie' | null. Wird beim Import
      // gesetzt und dient dem Draft-Typ-Guard (BoardSection warnt, wenn das Board
      // nicht zum aktuellen Draft passt). null = unbekannt (alte Boards ohne
      // Markierung) → loest bewusst KEINE Warnung aus.
      boardMode: null,
      enriching: false,
      marketMeta: null,          // { source, format, total_drafts, end_date, fetched_at }
      lastImportStats: null,     // { total, withAdp, withoutAdp, unmatchedNames }
      // Ein Level Undo — bewusst nicht persistiert. Haelt neben boardPlayers auch
      // boardSource/marketMeta fest: die Herkunfts-Zeile liest diese direkt aus dem
      // Store, und ein Undo, das nur boardPlayers zurueckdreht, wuerde sie luegen
      // lassen (z. B. "FantasyCalc" fuer ein Board, das wieder CSV ist).
      lastBoardSnapshot: null,
      // Herkunft des AKTUELLEN Boards: 'csv' | 'market' | null. Haengt bewusst nicht an
      // csvRawText (das aendert sich bei jedem Tastendruck im Setup-Feld, auch ohne dass
      // ein CSV-Import stattfand) — sonst luegt die Herkunfts-Zeile, sobald jemand nur
      // CSV-Text eintippt und den Overwrite-Dialog dann abbricht.
      boardSource: null,
      // Welche Markt-Rangliste das AKTUELLE Board speist: 'FantasyCalc' |
      // 'FantasyPros' | 'KeepTradeCut' | null. Getrennt von boardSource (das nur
      // csv|market kennt), damit die Herkunfts-Zeile die echte Quelle nennt statt
      // hart "FantasyCalc". null = Alt-Board ohne Markierung (Fallback in der UI).
      rankingSource: null,
      // Board-Cache pro Liga/Profil (Task 4): persistiert, Key aus boardKeyFor
      // (league:<id>:<mode> | draft:<id>:<mode> | fp:<...>:<mode>). Das aktive
      // Board bleibt in den Top-Level-Feldern (kein UI-Umbau noetig).
      boardsByKey: {},
      // Aktiver Cache-Key — bewusst NICHT persistiert (partialize): nach Reload
      // bestimmt App.jsx den Key neu und ruft switchBoard auf.
      activeBoardKey: null,

      switchBoard: (key) => set((s) => {
        const nextKey = String(key || '')
        // Guard: leerer oder identischer Key — nichts zu tun.
        if (!nextKey || s.activeBoardKey === nextKey) return {}
        const cache = { ...(s.boardsByKey || {}) }
        // Aktiven Stand wegsichern (nur wenn ueberhaupt ein Key aktiv war oder Board Inhalt hat).
        // Ohne csvRawText: der Rohtext lebt nur im aktiven Top-Level-Feld, im
        // Cache wuerde er pro Eintrag localStorage Richtung Quota treiben.
        if (s.activeBoardKey) {
          cache[s.activeBoardKey] = {
            boardPlayers: s.boardPlayers, boardMode: s.boardMode, boardSource: s.boardSource,
            rankingSource: s.rankingSource, marketMeta: s.marketMeta,
            lastImportStats: s.lastImportStats,
          }
        }
        const hit = cache[nextKey]
        // Legacy-Schutz: nach dem Update steht das alte Board noch in den
        // Top-Level-Feldern, aber boardsByKey ist leer und activeBoardKey null.
        // Ohne diesen Schutz wuerde der erste switchBoard-Aufruf den
        // vorhandenen Stand mit einem leeren Board ueberschreiben (Datenverlust
        // beim Upgrade). Der vorhandene Stand gehoert logisch zu genau diesem
        // ersten Key — also behalten statt leeren.
        if (!hit && !s.activeBoardKey && (s.boardPlayers || []).length > 0) {
          return { activeBoardKey: nextKey, boardsByKey: cache, lastBoardSnapshot: null }
        }
        // Single-Source-Active: das geladene Board lebt ab hier nur noch in den
        // Top-Level-Feldern — der Cache-Eintrag wird geloescht, damit kein Board
        // doppelt (Top-Level + Cache) localStorage fuellt. Beim Weg-Wechseln
        // sichert die Sicherung oben den Stand wieder weg (Roundtrip bleibt).
        delete cache[nextKey]
        return {
          activeBoardKey: nextKey,
          boardsByKey: cache,
          boardPlayers: hit?.boardPlayers || [],
          boardMode: hit?.boardMode ?? null,
          boardSource: hit?.boardSource ?? null,
          rankingSource: hit?.rankingSource ?? null,
          marketMeta: hit?.marketMeta ?? null,
          csvRawText: hit?.csvRawText ?? '',
          lastImportStats: hit?.lastImportStats ?? null,
          lastBoardSnapshot: null,
        }
      }),

      // Board-Eintrag von einem Key auf einen anderen umziehen (Persist-Pfad:
      // Fallback-Key -> profile:<id>). Ueberschreibt das Ziel, loescht die Quelle
      // und verwirft den Undo-Snapshot (Undo wirkt nie profil-uebergreifend).
      // Ohne Cache-Eintrag unter fromKey faellt das aktive Top-Level-Board als
      // Quelle zurueck, wenn es gerade unter fromKey aktiv ist.
      moveBoard: (fromKey, toKey) => set((s) => {
        const from = String(fromKey || '')
        const to = String(toKey || '')
        if (!from || !to || from === to) return {}
        const cache = { ...(s.boardsByKey || {}) }
        // Ohne Cache-Eintrag unter fromKey faellt das aktive Top-Level-Board als
        // Quelle zurueck, wenn es gerade unter fromKey aktiv ist (ohne
        // csvRawText — der Rohtext lebt nur im aktiven Top-Level-Feld).
        const src = cache[from] || (s.activeBoardKey === from ? {
          boardPlayers: s.boardPlayers, boardMode: s.boardMode, boardSource: s.boardSource,
          rankingSource: s.rankingSource, marketMeta: s.marketMeta,
          lastImportStats: s.lastImportStats,
        } : null)
        if (!src) return {}
        cache[to] = { ...src }
        delete cache[from]
        const patch = { boardsByKey: cache, lastBoardSnapshot: null }
        if (s.activeBoardKey === from) patch.activeBoardKey = to
        return patch
      }),

      // Board-Eintrag vom geteilten Modus-Key auf ein exklusives Profil-Board
      // KOPIEREN (Persist-Pfad, wenn die Quelle `mode:<…>` ist). Der Modus-Key ist
      // geteilt — alle unzugeordneten Drafts eines Modus lesen von dort, deshalb
      // muss die Quelle BLEIBEN (kein delete, sonst verliert der Rest das Board).
      // Das Ziel wird ueberschrieben, der Undo-Snapshot verworfen (Undo wirkt nie
      // profil-uebergreifend). activeBoardKey bleibt unveraendert — der Aufrufer
      // aktiviert das Ziel danach per switchBoard. Gegensatz: moveBoard fuer
      // exklusive Fallback-Quellen (league:/fp:), die nach dem Umzug weg muessen.
      copyBoard: (fromKey, toKey) => set((s) => {
        const from = String(fromKey || '')
        const to = String(toKey || '')
        if (!from || !to || from === to) return {}
        const cache = { ...(s.boardsByKey || {}) }
        // Fallback wie moveBoard (ohne csvRawText, siehe dort).
        const src = cache[from] || (s.activeBoardKey === from ? {
          boardPlayers: s.boardPlayers, boardMode: s.boardMode, boardSource: s.boardSource,
          rankingSource: s.rankingSource, marketMeta: s.marketMeta,
          lastImportStats: s.lastImportStats,
        } : null)
        if (!src) return {}
        cache[to] = { ...src }
        return { boardsByKey: cache, lastBoardSnapshot: null }
      }),

      // Cache-Eintrag eines Profils loeschen (deleteProfile-Pfad: keine Orphans).
      // Das aktive Top-Level-Board bleibt unangetastet — BoardSection liest nur das.
      deleteBoard: (key) => set((s) => {
        const k = String(key || '')
        if (!k || !(s.boardsByKey || {})[k]) return {}
        const cache = { ...(s.boardsByKey || {}) }
        delete cache[k]
        return { boardsByKey: cache }
      }),

      setCsvRawText: (v) => set({ csvRawText: v }),
      setBoardSource: (v) => {
        set({ boardSource: v })
        // handleCsvLoad setzt boardSource bewusst nicht selbst (macht der Aufrufer
        // via setBoardSource nach Erfolg) — deshalb hier nachfuehren, sobald eine
        // Herkunft gesetzt wird und Board-Inhalt da ist. Heilt F3 an der Wurzel
        // fuer alle Aufrufer (SetupPage + BoardSection).
        if (v && (get().boardPlayers || []).length) writeThroughActiveBoard(set, get)
      },
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
        // CSV traegt keinen eigenen Typ — der aktuelle Modus ist die beste
        // verfuegbare Zuordnung fuer den Draft-Typ-Guard.
        set({ boardPlayers: fresh, boardMode: get().draftMode, rankingSource: null })
        // Aktiven Stand in den boardsByKey-Cache durchschreiben.
        writeThroughActiveBoard(set, get)
        const { selectedDraftId } = useSessionStore.getState()
        if (selectedDraftId) await useLiveStore.getState().loadPicks(selectedDraftId)
        return true
      },

      handleKtcRookieImport: async (force = false) => {
        const { boardPlayers, boardSource, marketMeta, rankingSource } = get()
        // force=true: der Aufrufer (z. B. Draft-Typ-Guard-Banner) hat die
        // Zustimmung bereits eingeholt — kein doppelter window.confirm.
        if (boardPlayers.length && !force) {
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
        // Snapshot sichert die Herkunft des Boards VOR diesem Import mit (siehe
        // Kommentar bei lastBoardSnapshot oben) — sonst luegt die Herkunfts-Zeile
        // nach einem Undo.
        const snapshot = boardPlayers.length ? { boardPlayers, boardSource, marketMeta, rankingSource } : null
        set({ csvRawText: '', boardPlayers: fresh, lastBoardSnapshot: snapshot, boardSource: 'market', boardMode: 'rookie', rankingSource: 'KeepTradeCut' })
        // Aktiven Stand in den boardsByKey-Cache durchschreiben.
        writeThroughActiveBoard(set, get)
        const { selectedDraftId } = useSessionStore.getState()
        if (selectedDraftId) await useLiveStore.getState().loadPicks(selectedDraftId)
        return true
      },

      handleAutoImport: async ({ isSuperflex, effScoringType, numTeams, draftMode = 'redraft', force = false } = {}) => {
        const { boardPlayers, boardSource, marketMeta, rankingSource } = get()
        if (boardPlayers.length && !force) {
          // Bestaetigung liegt beim Aufrufer (Modal, Task 8) — der Store fragt nicht.
          return { ok: false, needsConfirm: true }
        }
        // Snapshot sichert die Herkunft des Boards VOR diesem Import mit (siehe
        // Kommentar bei lastBoardSnapshot oben) — sonst luegt die Herkunfts-Zeile
        // nach einem Undo.
        const snapshot = boardPlayers.length ? { boardPlayers, boardSource, marketMeta, rankingSource } : null
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
        // Fuer Rookie/Dynasty gibt es keine Redraft-ADP, deshalb gar nicht erst fragen.
        let market = null
        let spread = null
        if (!isDynasty) {
          const ffcFormat = ffcFormatFor({ isSuperflex, effScoringType })
          ;[market, spread] = await Promise.all([
            fetchMarketAdp(ffcFormat, numTeams),
            fetchFfcSpread(ffcFormat, numTeams),
          ])
        }

        const { players, stats } = mergeRankingsWithMarket(fc.players, market?.players || [])
        const withSpread = spread ? overlayFfcSpread(players, spread).players : players

        // Verletzungsdaten sind Kuer: schlaegt der Abruf fehl, darf der Import nicht kippen.
        let withInjuries = withSpread
        try {
          const meta = await loadPlayersMetaCached({ season: new Date().getFullYear() })
          withInjuries = enrichWithInjuries(withSpread, meta)
        } catch { /* Verletzungsdaten sind Kuer, kein Grund den Import zu kippen */ }

        set({
          csvRawText: '',
          boardPlayers: withInjuries,
          marketMeta: market?.meta || null,
          lastImportStats: stats,
          lastBoardSnapshot: snapshot,
          boardSource: 'market',
          boardMode: isDynasty ? 'rookie' : 'redraft',
          rankingSource: 'FantasyCalc',
        })
        // Aktiven Stand in den boardsByKey-Cache durchschreiben.
        writeThroughActiveBoard(set, get)
        const { selectedDraftId } = useSessionStore.getState()
        if (selectedDraftId) await useLiveStore.getState().loadPicks(selectedDraftId)
        return { ok: true, stats, marketMissing: !isDynasty && !market }
      },

      // FantasyPros Consensus-ECR als Redraft-Rang-Quelle (Alternative zum
      // FantasyCalc-Auto-Import). Laeuft durch dieselbe Pipeline: FantasyPros-Rang
      // + FFC-ADP-Overlay + Verletzungen. Immer 'redraft' (FantasyPros liefert hier
      // keine Rookie-/Dynasty-Werte).
      handleFantasyProsImport: async ({ isSuperflex, effScoringType, numTeams, force = false } = {}) => {
        const { boardPlayers, boardSource, marketMeta, rankingSource } = get()
        if (boardPlayers.length && !force) {
          // Bestaetigung liegt beim Aufrufer (wie handleAutoImport).
          return { ok: false, needsConfirm: true }
        }
        const snapshot = boardPlayers.length ? { boardPlayers, boardSource, marketMeta, rankingSource } : null
        const fpScoring = effScoringTypeToFpParam(effScoringType)

        // Rangliste ist Pflicht — ohne sie gibt es kein Board.
        let fp
        try {
          fp = await fetchJsonOk(`/api/rankings/fantasypros?scoring=${fpScoring}`)
        } catch (e) {
          return { ok: false, error: e.message || 'FantasyPros nicht erreichbar' }
        }

        // Markt-ADP ist Kuer — ein Board ohne ADP ist besser als kein Board.
        const ffcFormat = ffcFormatFor({ isSuperflex, effScoringType })
        const [market, spread] = await Promise.all([
          fetchMarketAdp(ffcFormat, numTeams),
          fetchFfcSpread(ffcFormat, numTeams),
        ])

        const { players, stats } = mergeRankingsWithMarket(fp.players, market?.players || [])
        const withSpread = spread ? overlayFfcSpread(players, spread).players : players

        // Verletzungsdaten sind Kuer: schlaegt der Abruf fehl, darf der Import nicht kippen.
        let withInjuries = withSpread
        try {
          const meta = await loadPlayersMetaCached({ season: new Date().getFullYear() })
          withInjuries = enrichWithInjuries(withSpread, meta)
        } catch { /* Verletzungsdaten sind Kuer, kein Grund den Import zu kippen */ }

        set({
          csvRawText: '',
          boardPlayers: withInjuries,
          marketMeta: market?.meta || null,
          lastImportStats: stats,
          lastBoardSnapshot: snapshot,
          boardSource: 'market',
          boardMode: 'redraft',
          rankingSource: 'FantasyPros',
        })
        // Aktiven Stand in den boardsByKey-Cache durchschreiben.
        writeThroughActiveBoard(set, get)
        const { selectedDraftId } = useSessionStore.getState()
        if (selectedDraftId) await useLiveStore.getState().loadPicks(selectedDraftId)
        return { ok: true, stats, marketMissing: !market }
      },

      refreshMarketData: async ({ isSuperflex, effScoringType, numTeams } = {}) => {
        const { boardPlayers, marketMeta, draftMode } = get()
        if (!boardPlayers.length) return { ok: false, error: 'Kein Board geladen' }
        // Markt-ADP ist NFL-weite Redraft-ADP — im Rookie/Dynasty-Modus waere das ein
        // Rookie-Rang gegen einen fremden Markt gerechnet, bedeutungslos und nicht
        // rueckholbar (kein Snapshot hier). handleAutoImport guardet das bereits genauso.
        if (draftMode === 'rookie') return { ok: false, error: 'Marktdaten-Refresh ist im Rookie-Modus nicht verfügbar (Redraft-ADP passt nicht auf Rookie-Ränge).' }
        // Format explizit uebergeben (Board-Seite kennt isSuperflex/effScoringType/numTeams
        // ueber draftFormat) -- ohne Argument bleibt der Fallback auf marketMeta.format,
        // fuer Aufrufer, die das schon aus einem vorherigen Import kennen.
        const format = effScoringType != null
          ? ffcFormatFor({ isSuperflex, effScoringType })
          : (marketMeta?.format || 'ppr')
        const [market, spread] = await Promise.all([
          fetchMarketAdp(format, numTeams),
          fetchFfcSpread(format, numTeams),
        ])
        if (!market) return { ok: false, error: 'Marktdaten nicht erreichbar' }
        const { players, stats } = overlayMarketData(boardPlayers, market.players)
        const withSpread = spread ? overlayFfcSpread(players, spread).players : players
        // rk und Reihenfolge bleiben unberuehrt — der Nutzer pflegt sein Board.
        set({ boardPlayers: withSpread, marketMeta: market.meta })
        return { ok: true, stats }
      },

      // Bye Week ist die einzige Luecke, die enrichBoardPlayersWithSleeper strukturell
      // nicht fuellen kann (players/nfl hat in der Praxis keine Bye-Daten) -- diese
      // Action holt sie stattdessen aus derselben Markt-ADP-Quelle wie refreshMarketData,
      // aendert aber NIE eine bereits vorhandene Bye (siehe fillMissingBye in marketMerge.js).
      fillMissingBye: async ({ isSuperflex, effScoringType, numTeams } = {}) => {
        const { boardPlayers, draftMode } = get()
        if (!boardPlayers.length) return { ok: false, error: 'Kein Board geladen' }
        if (draftMode === 'rookie') return { ok: false, error: 'Bye-Week-Ergänzung ist im Rookie-Modus nicht verfügbar (Redraft-ADP passt nicht auf Rookie-Ränge).' }
        const format = effScoringType != null ? ffcFormatFor({ isSuperflex, effScoringType }) : 'ppr'
        const market = await fetchMarketAdp(format, numTeams)
        if (!market) return { ok: false, error: 'Marktdaten nicht erreichbar' }
        const { players, stats } = fillMissingByeInMarket(boardPlayers, market.players)
        set({ boardPlayers: players })
        return { ok: true, stats }
      },

      undoImport: () => {
        const { lastBoardSnapshot } = get()
        if (!lastBoardSnapshot) return false
        // boardSource/marketMeta gehoeren zum Snapshot, nicht nur boardPlayers —
        // sonst behauptet die Herkunfts-Zeile nach dem Undo weiter die Herkunft
        // des rueckgaengig gemachten Imports (siehe Kommentar bei lastBoardSnapshot).
        const { boardPlayers, boardSource, marketMeta, rankingSource } = lastBoardSnapshot
        set({ boardPlayers, boardSource, marketMeta, rankingSource: rankingSource ?? null, lastBoardSnapshot: null, lastImportStats: null })
        // Undo in den Cache durchschreiben — sonst reanimiert ein Reload-mit-Hit
        // den rueckgaengig gemachten Stand.
        writeThroughActiveBoard(set, get)
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
        // Nutzer-Reorder in den Cache durchschreiben — sonst ueberschreibt nach
        // Reload ein stale Cache-Hit den persistierten Top-Level-Stand.
        writeThroughActiveBoard(set, get)
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
      // Quota-sicheres Storage: bei vollem localStorage wird der verzichtbare
      // Cache abgeworfen, das aktive Top-Level-Board persistiert immer.
      storage: createJSONStorage(() => safeStorage),
      partialize: (s) => ({
        csvRawText: s.csvRawText,
        boardPlayers: s.boardPlayers,
        searchQuery: s.searchQuery,
        positionFilter: s.positionFilter,
        teamFilter: s.teamFilter,
        draftMode: s.draftMode,
        boardMode: s.boardMode,
        marketMeta: s.marketMeta,
        boardSource: s.boardSource,
        rankingSource: s.rankingSource,
        boardsByKey: s.boardsByKey || {},
        // activeBoardKey bleibt in-memory: nach Reload bestimmt App.jsx den Key
        // neu und ruft switchBoard auf. lastBoardSnapshot bleibt in-memory: ein
        // Undo ueber Sessions hinweg waere ueberraschend, und der Snapshot
        // verdoppelt den Speicherbedarf.
      }),
    }
  )
)
