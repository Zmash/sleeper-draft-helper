import React, { useEffect, useMemo, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import BoardToolbar from './BoardToolbar'
import FiltersRow from './FiltersRow'
import BoardTable from './BoardTable'
import DataProvenanceBar from './DataProvenanceBar'
import BoardMobileBar from './BoardMobileBar'
import Icon from './Icon'
import { cx } from '../utils/formatting'
import { useBoardStore } from '../stores/useBoardStore'

import AdviceDialog from './AdviceDialog'
import ApiKeyDialog from './ApiKeyDialog'
import { buildAIAdviceRequest } from '../services/ai'
import { buildAdviceRequestArgs } from '../services/adviceRequestArgs'
import { getOpenAIKey, setOpenAIKey } from '../services/key'
import { loadPreferences, savePreferences, setPreference, PlayerPreference, playerKey, migrateV1ToV2IfNeeded } from '../services/preferences'
import { getTeamsCount } from '../services/derive'
import { exportSettings, importSettingsFromFile } from "../utils/settingsTransfer"
import { exportBoardAsCsv } from '../services/csv'
import { deriveFormat } from '../services/draftFormat'
import { validateAdvice } from '../services/aiValidate'
import { formatEstimate } from '../services/aiCost'
import { CostHint } from './CostHint'
import { opponentsUntilMyNext } from '../services/draftFlow'
import { isAdviceButtonDisabled } from '../services/boardGate'

const DEBUG_AI = false

export default function BoardSection({
  ownerLabels,
  teamFilter,
  onTeamFilterChange,
  currentPickNumber,
  autoRefreshEnabled,
  refreshIntervalSeconds,
  lastSyncAt,
  searchQuery,
  positionFilter,
  filteredPlayers,
  pickedCount,
  totalCount,

  onToggleAutoRefresh,
  onChangeInterval,
  onSync,
  onSearchChange,
  onPositionChange,

  boardPlayers,
  livePicks,
  meUserId,
  league,
  draft,
  draftMode = 'redraft',
  myDraftPicks = [],
  dynastyRoster = [],
  onBoardReorder,
  draftSlot = null,
  tips,
}) {
  const navigate = useNavigate()
  const {
    marketMeta, boardSource, rankingSource, refreshMarketData, boardMode,
    handleAutoImport, handleFantasyProsImport, handleKtcRookieImport, handleCsvLoad, setCsvRawText, setBoardSource,
  } = useBoardStore()
  const [refreshingMarket, setRefreshingMarket] = useState(false)
  const [marketError, setMarketError] = useState(null)

  async function handleRefreshMarket() {
    setRefreshingMarket(true)
    setMarketError(null)
    const res = await refreshMarketData()
    if (!res.ok) setMarketError(res.error)
    setRefreshingMarket(false)
  }

  const [adviceOpen, setAdviceOpen] = useState(false)
  const [adviceLoading, setAdviceLoading] = useState(false)
  const [advice, setAdvice] = useState(null)
  const [adviceError, setAdviceError] = useState(null)
  const [adviceWarnings, setAdviceWarnings] = useState([])
  const [adviceUsage, setAdviceUsage] = useState(null)
  const [adviceModel, setAdviceModel] = useState('')

  const [keyDialogOpen, setKeyDialogOpen] = useState(false)
  const [keyValidating, setKeyValidating] = useState(false)
  const [keyValidationError, setKeyValidationError] = useState('')
  const [pendingAskAfterKey, setPendingAskAfterKey] = useState(false)

  const [adviceDebug, setAdviceDebug] = useState(null)
  // Signatur des Board-/Draft-Zustands, fuer den die aktuelle Advice berechnet
  // wurde. Solange sie zum aktuellen Zustand passt, zeigt ein erneuter Klick die
  // vorhandene Antwort statt eines neuen (kostenpflichtigen) Calls.
  const [adviceSig, setAdviceSig] = useState(null)

  // Advice ueberlebte bisher einen Draft-Wechsel: aiHighlights markierte nach
  // einem Wechsel weiter die Spieler des ALTEN Drafts auf dem frisch geleerten
  // Board. App.jsx resettet reviewResult/livePicks/Board-Status bei Draft-
  // Wechsel bereits (prevDraftIdRef-Muster) -- hier dasselbe Muster fuer
  // Advice, nur beim echten Wechsel der draft_id (nicht bei jedem Render und
  // nicht beim Initial-Mount).
  const prevAdviceDraftIdRef = useRef(draft?.draft_id ?? null)
  useEffect(() => {
    const prev = prevAdviceDraftIdRef.current
    const next = draft?.draft_id ?? null
    prevAdviceDraftIdRef.current = next
    if (prev === next) return // keine Aenderung (inkl. Initial-Mount)
    setAdvice(null)
    setAdviceWarnings([])
    setAdviceUsage(null)
    setAdviceModel('')
    setAdviceError(null)
    setAdviceDebug(null)
    setAdviceSig(null)
  }, [draft?.draft_id])

  const [setupTick, setSetupTick] = useState(0)
  useEffect(() => {
    const onSetup = () => setSetupTick(x => x + 1)
    const onStorage = (e) => { if (e.key === 'sdh.setup.v2') onSetup() }
    window.addEventListener('sdh:setup-changed', onSetup)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener('sdh:setup-changed', onSetup)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  const teamsCount = getTeamsCount({ draft, picks: livePicks, league })
  const setupOverrides = (() => { try { return JSON.parse(localStorage.getItem('sdh.setup.v2') || '{}').overrides || {} } catch { return {} } })()

  const fileRef = useRef(null)
  const [status, setStatus] = useState('')

  // Mobile: Filter liegen in einem Bottom-Sheet statt dauerhaft in der Zeile.
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false)

  // Direkt-Import vom leeren Board / Draft-Typ-Guard: erspart den Umweg zurueck
  // ins Setup, wenn man nach dem Einfuegen eines Mock-Links ohne (oder mit dem
  // falschen) Board auf dem Board landet.
  const [importing, setImporting] = useState(false)
  const [importErr, setImportErr] = useState(null)

  // Importiert die zum gewuenschten Modus passenden Rankings. force=true, wenn ein
  // bestehendes (unpassendes) Board ersetzt werden soll — der Aufrufer hat dann
  // bereits zugestimmt, daher keine zweite Rueckfrage.
  async function runImportForMode(mode, force = false) {
    setImporting(true)
    setImportErr(null)
    try {
      if (mode === 'rookie') {
        await handleKtcRookieImport(force)
      } else {
        // ponytail: kein needsConfirm-Handling — Empty-State und Mismatch-Banner
        // laufen nur mit force=true (Mismatch) oder leerem Board (kein Confirm noetig).
        const res = await handleFantasyProsImport({
          isSuperflex: draftFormat.isSuperflex,
          effScoringType: draftFormat.scoringType,
          numTeams: draftFormat.teams,
          force,
        })
        if (res && res.error && !res.needsConfirm) setImportErr(res.error)
      }
    } catch (e) {
      setImportErr(e?.message || String(e))
    } finally {
      setImporting(false)
    }
  }

  function handleImportCsvFile(e) {
    const file = e.target.files?.[0]
    // Gleiches Auswahlfeld erneut waehlbar machen (onChange feuert sonst nicht
    // zweimal fuer dieselbe Datei).
    e.target.value = ''
    if (!file) return
    const reader = new FileReader()
    reader.onload = async () => {
      setImporting(true)
      setImportErr(null)
      try {
        // Store synchron befuellen, dann laden — dasselbe Muster wie im Setup.
        setCsvRawText(String(reader.result || ''))
        const ok = await handleCsvLoad()
        if (ok) setBoardSource('csv')
      } catch (err) {
        setImportErr(err?.message || String(err))
      } finally {
        setImporting(false)
      }
    }
    reader.onerror = () => setImportErr('Datei konnte nicht gelesen werden.')
    reader.readAsText(file)
  }

  const [dismissedMismatchKey, setDismissedMismatchKey] = useState(null)

  // Das ganze Format, nicht nur der Kader: scoringType und isSuperflex gingen
  // hier verloren, sodass die AI beim Mock immer den PPR-Default und "1 QB"
  // beschrieben bekam — und Setup-Overrides gar nicht sah.
  const draftFormat = deriveFormat({ draft, league, overrides: setupOverrides })
  const { rosterPositions } = draftFormat

  const hasBoard = Array.isArray(boardPlayers) && boardPlayers.length > 0

  // Solange ein Board sichtbar ist (und damit die Bottom-Bar rendert), markiert
  // eine Body-Klasse den Mobile-Board-Modus: nur dann werden auf dem Handy die
  // Haupt-Tabs, der Floating-TipsDock und die Toolbar ausgeblendet. Ohne Board
  // (Empty-State) bleibt die normale Navigation erhalten.
  useEffect(() => {
    if (!hasBoard) return
    document.body.classList.add('board-mobile-active')
    return () => document.body.classList.remove('board-mobile-active')
  }, [hasBoard])

  // Draft-Typ-Guard: passt der Typ des geladenen Boards nicht zum aktuellen Draft?
  // boardMode null (alte Boards) loest bewusst keine Warnung aus.
  const boardTypeMismatch = boardMode != null && hasBoard && boardMode !== draftMode
  const mismatchKey = boardTypeMismatch ? `${boardMode}->${draftMode}` : null
  const showMismatchBanner = boardTypeMismatch && dismissedMismatchKey !== mismatchKey

  // Player Preferences (v2) -- muss vor adviceEstimate deklariert sein, weil
  // die Schaetzung playerPrefs jetzt (wie der echte Call) mitgibt.
  const [playerPrefs, setPlayerPrefs] = useState(() => loadPreferences())

  // Kostenschaetzung am Button -- nur wenn der Button ueberhaupt sichtbar ist
  // (hasBoard) neu berechnen, nicht bei jedem Render. Baut ueber
  // buildAdviceRequestArgs() denselben Payload wie der echte Call in
  // doAskAIWithKey -- sonst zeigt die Schaetzung dem Nutzer weniger Kosten,
  // als er real zahlt (kleinere Options-Defaults, fehlendes
  // customStrategyText/playerPreferences).
  const adviceEstimate = useMemo(() => {
    if (!hasBoard) return ''
    try {
      const args = buildAdviceRequestArgs({
        boardPlayers, livePicks, meUserId, league, draft, currentPickNumber,
        draftSlot, tips, scoringType: draftFormat.scoringType, isSuperflex: draftFormat.isSuperflex,
        rosterPositions, teamsCount, draftMode, dynastyRoster, myDraftPicks,
        customStrategyText: (typeof window !== 'undefined' ? localStorage.getItem('sdh.strategy.v1') : '') || '',
        playerPreferences: playerPrefs,
      })
      return formatEstimate(buildAIAdviceRequest(args), 'claude-sonnet-5')
    } catch { return '' }
  }, [
    hasBoard, boardPlayers, livePicks, meUserId, league, draft, currentPickNumber,
    draftSlot, tips, draftFormat.scoringType, draftFormat.isSuperflex, rosterPositions,
    teamsCount, draftMode, dynastyRoster, myDraftPicks, playerPrefs,
  ])

  // Deterministische Quelle fuer "wann bin ich wieder dran": aus dem echten
  // Draft-Zustand berechnet (Task 3), nicht aus dem (moeglicherweise
  // halluzinierten) plan_next_picks-Feld der AI-Antwort.
  const myNextPick = useMemo(
    () => opponentsUntilMyNext({
      picks: livePicks, teamsCount, mySlot: draftSlot,
      upcomingPick: (currentPickNumber ?? 0) + 1, rosterPositions,
    })?.my_next_pick ?? null,
    [livePicks, teamsCount, draftSlot, currentPickNumber]
  )

  const adviceButtonDisabled = isAdviceButtonDisabled({ draft, livePicks })

  // Signatur alles dessen, was die Empfehlung veraendern wuerde: Draft, aktueller
  // Pick, Reihenfolge UND Draft-Status je Spieler (ein Pick kippt den Status),
  // sowie die Praeferenzen. Aendert sich nichts davon, ist ein neuer Call
  // ueberfluessig — die vorhandene Antwort gilt weiter.
  const currentAdviceSig = useMemo(() => {
    if (!hasBoard) return null
    const order = (boardPlayers || [])
      .map((p) => `${String(p.nname || '').toLowerCase()}:${p.status ? 1 : 0}`)
      .join('|')
    return JSON.stringify({
      draft: draft?.draft_id ?? null,
      pick: currentPickNumber ?? null,
      picks: (livePicks || []).length,
      slot: draftSlot ?? null,
      mode: draftMode,
      prefs: playerPrefs || {},
      order,
    })
  }, [hasBoard, boardPlayers, draft?.draft_id, currentPickNumber, livePicks, draftSlot, draftMode, playerPrefs])

  // ---------- AI Advice ----------

  async function handleAskAI() {
    const key = getOpenAIKey()
    if (!key) {
      setKeyDialogOpen(true)
      setPendingAskAfterKey(true)
      return
    }
    // Cache: unveraendertes Board + gueltige Advice → nur wieder anzeigen.
    if (advice && !adviceError && adviceSig != null && adviceSig === currentAdviceSig) {
      setAdviceOpen(true)
      return
    }
    await doAskAIWithKey(key)
  }

  // "Neu berechnen": erzwingt einen frischen Call und umgeht den Cache bewusst.
  async function handleAskAIForce() {
    const key = getOpenAIKey()
    if (!key) {
      setKeyDialogOpen(true)
      setPendingAskAfterKey(true)
      return
    }
    await doAskAIWithKey(key)
  }

  async function doAskAIWithKey(userKey) {
    // Zustand, fuer den DIESE Anfrage gebaut wird — festhalten, damit die Antwort
    // exakt dieser Signatur zugeordnet wird (auch wenn waehrend des Calls ein Pick
    // reinkommt: dann greift beim naechsten Klick korrekt der Cache-Miss).
    const sigAtRequest = currentAdviceSig
    try {
      setAdviceOpen(true)
      setAdviceLoading(true)
      setAdviceError(null)
      setAdvice(null)
      setAdviceDebug(null)
      setAdviceWarnings([])
      setAdviceUsage(null)
      setAdviceModel('')
      setAdviceSig(null)

      const payload = buildAIAdviceRequest(buildAdviceRequestArgs({
        boardPlayers, livePicks, meUserId, league, draft, currentPickNumber,
        draftSlot, tips, scoringType: draftFormat.scoringType, isSuperflex: draftFormat.isSuperflex,
        rosterPositions, teamsCount, draftMode, dynastyRoster, myDraftPicks,
        customStrategyText: (typeof window !== 'undefined' ? localStorage.getItem('sdh.strategy.v1') : '') || '',
        playerPreferences: playerPrefs,
      }))

      if (DEBUG_AI) {
        console.groupCollapsed('[AI REQUEST -> /api/ai-advice]')
        console.log('payload:', payload)
        console.groupEnd()
      }

      const requestSummary = {
        max_tokens: payload.max_tokens,
        temperature: payload.temperature,
        tools: payload.tools?.length,
        tool_choice: payload.tool_choice?.name,
        messages: payload.messages?.length,
      }

      const res = await fetch('/api/ai-advice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Anthropic-Key': userKey,
        },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData?.message || errData?.error || `HTTP ${res.status}`)
      }

      // Read SSE stream
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n\n')
        buffer = parts.pop() ?? ''

        for (const part of parts) {
          if (!part.trim()) continue
          const lines = part.split('\n')
          const eventLine = lines.find(l => l.startsWith('event: '))
          const dataLine = lines.find(l => l.startsWith('data: '))
          if (!dataLine) continue

          const eventType = eventLine?.slice(7).trim() || 'message'
          let data
          try { data = JSON.parse(dataLine.slice(6)) } catch { continue }

          if (eventType === 'result') {
            if (!data.ok) throw new Error(data.message || 'AI error')
            const availableNnames = new Set(
              (boardPlayers || [])
                .filter(p => !p.status)
                .map(p => String(p.nname || '').trim().toLowerCase())
            )
            const { cleaned, warnings } = validateAdvice(data.parsed, availableNnames)
            setAdvice(cleaned)
            setAdviceWarnings(warnings)
            setAdviceUsage(data.usage || null)
            setAdviceModel(data.model || '')
            setAdviceSig(sigAtRequest)
            setAdviceDebug({
              request: requestSummary,
              request_payload: payload,
              response: { ok: data.ok, model: data.model, usage: data.usage },
            })
          } else if (eventType === 'error') {
            throw new Error(data.message || 'AI error')
          }
        }
      }

    } catch (e) {
      setAdviceError(e?.message || 'Unerwarteter Fehler')
    } finally {
      setAdviceLoading(false)
    }
  }

  async function handleKeySaved(savedKey) {
    setKeyValidationError('')
    setKeyValidating(true)
    const ok = await validateKey(savedKey)
    setKeyValidating(false)

    if (!ok) {
      setOpenAIKey('')
      setKeyValidationError('API Key ungültig oder nicht autorisiert. Bitte prüfe deinen Schlüssel.')
      return
    }

    setOpenAIKey(savedKey)
    setKeyDialogOpen(false)

    if (pendingAskAfterKey) {
      setPendingAskAfterKey(false)
      await doAskAIWithKey(savedKey)
    }
  }

  async function validateKey(userKey) {
    try {
      const res = await fetch('/api/validate-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Anthropic-Key': userKey },
        body: JSON.stringify({}),
      })
      return res.ok
    } catch {
      return false
    }
  }

  // ---------- AI highlights for board ----------

  const aiHighlights = React.useMemo(() => {
    if (!advice) return { primary: null, all: new Set(), reasons: {} }
    const primary = advice?.primary?.player_nname
      ? String(advice.primary.player_nname).trim().toLowerCase()
      : null

    const all = new Set()
    const reasons = {}

    if (primary) {
      all.add(primary)
      if (advice.primary.why) reasons[primary] = advice.primary.why
    }
    for (const alt of advice?.alternatives || []) {
      const n = alt?.player_nname ? String(alt.player_nname).trim().toLowerCase() : null
      if (!n) continue
      all.add(n)
      if (alt.why) reasons[n] = alt.why
    }
    return { primary, all, reasons }
  }, [advice])

  // ---------- Player Preferences (v2) ----------

  useEffect(() => {
    if (!boardPlayers?.length) return
    const already = localStorage.getItem('sdh.playerPreferences.v2.migratedFromV1')
    if (already === '1') return
    const migrated = migrateV1ToV2IfNeeded(boardPlayers)
    if (migrated) {
      setPlayerPrefs(migrated)
    } else {
      localStorage.setItem('sdh.playerPreferences.v2.migratedFromV1', '1')
    }
  }, [boardPlayers])

  const didSanitizeRef = useRef(false)
  useEffect(() => {
    if (!boardPlayers?.length) return
    if (didSanitizeRef.current) return

    const prefs = playerPrefs || {}
    const numericKeys = Object.keys(prefs).filter(k => /^\d+$/.test(k))
    if (!numericKeys.length) return

    const byRk = new Map(
      boardPlayers
        .map(p => [String(p?.rk ?? ''), p])
        .filter(([rk]) => rk)
    )

    const next = { ...prefs }
    let changed = false
    for (const k of numericKeys) {
      const p = byRk.get(String(k))
      if (!p) continue
      const stable = playerKey(p)
      if (!stable || stable === k) continue
      next[stable] = prefs[k]
      delete next[k]
      changed = true
    }

    if (changed) {
      savePreferences(next)
      setPlayerPrefs(next)
    }

    didSanitizeRef.current = true
  }, [boardPlayers, playerPrefs])

  function handleSetPlayerPref(playerIdOrKey, pref) {
    setPlayerPrefs(prev => setPreference(prev, playerIdOrKey, pref))
  }

  const [hideAvoid, setHideAvoid] = useState(false)
  const filteredBoardPlayers = useMemo(() => {
    const list = filteredPlayers || []
    if (!hideAvoid) return list
    return list.filter(p => (playerPrefs[playerKey(p)] || null) !== PlayerPreference.AVOID)
  }, [filteredPlayers, hideAvoid, playerPrefs])

  function scrollToNextUndrafted() {
    const next = (filteredPlayers || []).find(p => !p.status)
    if (!next) return
    const el = document.getElementById(`row-${next.nname}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.classList.add('row-flash')
      setTimeout(() => el.classList.remove('row-flash'), 900)
    }
  }

  if (!boardPlayers || boardPlayers.length === 0) {
    const rookie = draftMode === 'rookie'
    return (
      <section className="card dashboard-empty">
        <div className="dashboard-empty-icon"><Icon name="clipboard" size={40} /></div>
        <h2>Noch kein Ranking importiert</h2>
        <p className="muted">Importiere direkt hier oder im Setup, um das Board zu füllen.</p>
        {importErr && (
          <p className="muted" role="alert" style={{ color: 'var(--danger, #e0564f)' }}>
            Import fehlgeschlagen: {importErr}
          </p>
        )}
        <div className="row items-center wrap" style={{ gap: 8, justifyContent: 'center' }}>
          <button className="btn btn-primary" onClick={() => runImportForMode(draftMode)} disabled={importing}>
            <Icon name="upload" size={16} />{' '}
            {importing ? 'Wird geladen…' : (rookie ? 'Rookies auto-importieren' : 'Auto-Import (FantasyPros)')}
          </button>
          <button className="btn btn-secondary" onClick={() => fileRef.current?.click()} disabled={importing}>
            CSV-Datei
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            style={{ display: 'none' }}
            onChange={handleImportCsvFile}
          />
          <button
            className="btn btn-ghost"
            onClick={() => navigate('/setup', { state: { mode: 'edit' } })}
            disabled={importing}
          >
            Zum Setup
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className="card">
      {showMismatchBanner && (
        <div className="board-type-warning" role="alert">
          <span className="board-type-warning-text">
            <Icon name="warning" size={15} />{' '}
            Dieses Board ist für <strong>{boardMode === 'rookie' ? 'Rookie-Drafts' : 'Redraft'}</strong> —
            der aktuelle Draft ist ein <strong>{draftMode === 'rookie' ? 'Rookie-Draft' : 'Redraft-Draft'}</strong>.
          </span>
          <span className="board-type-warning-actions">
            <button
              className="btn btn-primary btn-sm"
              onClick={() => runImportForMode(draftMode, true)}
              disabled={importing}
            >
              {importing
                ? 'Wird geladen…'
                : `${draftMode === 'rookie' ? 'Rookie' : 'Redraft'}-Rankings importieren`}
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setDismissedMismatchKey(mismatchKey)}
              disabled={importing}
            >
              Trotzdem behalten <Icon name="x" size={13} />
            </button>
          </span>
        </div>
      )}
      {importErr && (
        <div className="import-error-banner">
          <span className="import-error-text">Import fehlgeschlagen: {importErr}</span>
          <button className="btn btn-ghost btn-sm" onClick={() => setImportErr(null)} aria-label="Schließen">
            <Icon name="x" size={14} />
          </button>
        </div>
      )}
      <div className="row between items-center wrap board-actions-row board-status-row" style={{ gap: 8 }}>
        <BoardToolbar
          autoRefreshEnabled={autoRefreshEnabled}
          onToggleAutoRefresh={onToggleAutoRefresh}
          refreshIntervalSeconds={refreshIntervalSeconds}
          onChangeInterval={onChangeInterval}
          onSync={onSync}
          lastSyncAt={lastSyncAt}
        />

        <div className="btn-group-compact">
          <button
            onClick={handleAskAI}
            className="btn-compact btn-compact--primary"
            disabled={adviceButtonDisabled}
            title={adviceButtonDisabled ? 'Picks werden geladen — gleich verfügbar' : 'AI-Empfehlung für den nächsten Pick'}
          >
            <Icon name="bot" size={15} /> AI-Advice
          </button>
          <CostHint text={adviceEstimate} />
          <button
            onClick={() => { setPendingAskAfterKey(false); setKeyValidationError(''); setKeyValidating(false); setKeyDialogOpen(true) }}
            className="btn-compact btn-icon"
            title="Anthropic API-Key verwalten"
            aria-label="Anthropic API-Key verwalten"
          >
            <Icon name="key" size={15} />
          </button>
        </div>
      </div>

      {/* Auf dem Desktop fliesst diese Zeile normal; unter dem Mobile-Breakpoint
          wird derselbe Knoten per CSS zum Bottom-Sheet (is-open aus dem Filter-
          Button der Bottom-Bar). Ein Knoten, eine Quelle der Wahrheit. */}
      <div
        className={cx('board-sheet', 'board-filters-host', mobileFilterOpen && 'is-open')}
        role="group"
        aria-label="Filter"
      >
        <div className="board-sheet-head">
          <strong>Filter</strong>
          <button
            type="button"
            className="board-sheet-close"
            onClick={() => setMobileFilterOpen(false)}
            aria-label="Schließen"
          >
            <Icon name="x" size={18} />
          </button>
        </div>
        <FiltersRow
          searchQuery={searchQuery}
          onSearchChange={onSearchChange}
          positionFilter={positionFilter}
          onPositionChange={onPositionChange}
          onJumpToNext={scrollToNextUndrafted}
          playerPrefs={playerPrefs}
          PlayerPreference={PlayerPreference}
          hideAvoid={hideAvoid}
          setHideAvoid={setHideAvoid}
          ownerLabels={ownerLabels}
          teamFilter={teamFilter}
          onTeamFilterChange={onTeamFilterChange}
        />
      </div>
      <div
        className={cx('board-sheet-scrim', mobileFilterOpen && 'is-open')}
        onClick={() => setMobileFilterOpen(false)}
      />

      <DataProvenanceBar
        marketMeta={marketMeta}
        rankingSource={rankingSource}
        draftMode={draftMode}
        hasCsvBoard={boardSource === 'csv'}
        onRefresh={draftMode === 'rookie' ? undefined : handleRefreshMarket}
        refreshing={refreshingMarket}
        error={marketError}
        pickedCount={pickedCount}
        totalCount={totalCount}
      />

      {/* Kompakte Status-Zeile (nur Mobile): Fortschritt + Quelle in EINER Zeile,
          ersetzt die verbose Herkunfts-Zeile und die Progress-Zeile der Tabelle. */}
      <div className="board-status-line">
        <div className="bsl-bar">
          <div style={{ width: `${totalCount ? Math.round((pickedCount / totalCount) * 100) : 0}%` }} />
        </div>
        <span className="bsl-count">{pickedCount}/{totalCount}</span>
        <span className="bsl-src">
          {rankingSource || 'FantasyPros'}
          {(() => {
            const adp = boardSource === 'csv' ? 'CSV'
              : marketMeta?.source === 'sleeper' ? 'Sleeper ADP'
              : marketMeta?.source === 'ffc' ? 'FFC ADP'
              : marketMeta ? 'ADP' : null
            return adp ? <> · {adp}</> : null
          })()}
        </span>
      </div>

      {draftMode === 'rookie' && myDraftPicks.length > 0 && (
        <div className="my-picks-banner">
          <span className="muted text-xs" style={{ marginRight: '0.5rem' }}>Deine Picks:</span>
          {myDraftPicks.map((p, i) => {
            const label = `R${p.round}${p.pick_pos != null ? `.${p.pick_pos}` : ''}${p.type === 'acquired' ? ' ↗' : ''}`
            const title = p.type === 'acquired' ? 'Eingetauscht' : 'Eigener Pick'
            return (
              <span key={i} className={`chip chip--small ${p.type === 'acquired' ? 'chip--accent' : ''}`} title={title}>
                {label}
              </span>
            )
          })}
        </div>
      )}

      <BoardTable
        filteredPlayers={filteredBoardPlayers}
        highlightedNnames={[...aiHighlights.all]}
        primaryNname={aiHighlights.primary}
        adviceReasons={aiHighlights.reasons}
        boardPlayers={filteredBoardPlayers}
        playerPrefs={playerPrefs}
        onSetPlayerPref={handleSetPlayerPref}
        onReorder={onBoardReorder}
        draftMode={draftMode}
      />

      {filteredBoardPlayers.length === 0 && (
        <p className="muted center mt-3">Keine Spieler für die aktuellen Filter.</p>
      )}

      <div className="row end board-export-row" style={{ gap: 8, marginTop: '1rem' }}>
        <button
          className="btn-compact"
          onClick={() => exportBoardAsCsv(filteredBoardPlayers)}
          title="Aktuelles Ranking als CSV exportieren"
        >
          <Icon name="clipboard-copy" size={15} /> Export rankings
        </button>
        <button className="btn-compact" onClick={() => exportSettings('User-initiated export')}>
          <Icon name="save" size={15} /> Export settings
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          style={{ display: 'none' }}
          onChange={async (e) => {
            try {
              const f = e.target.files?.[0]
              if (!f) return
              const res = await importSettingsFromFile(f, { cleanupOldVersions: true })
              setStatus(`Import OK. Applied: ${res.applied.length}, Skipped: ${res.skipped.length}`)
            } catch (err) {
              setStatus(`Import-Fehler: ${err?.message || String(err)}`)
            } finally {
              e.currentTarget.value = ''
            }
          }}
        />
        <button className="btn-compact" onClick={() => fileRef.current?.click()}>
          <Icon name="upload" size={15} /> Import settings
        </button>
      </div>

      {status && <p className="text-xs muted">{status}</p>}

      <BoardMobileBar
        onSync={onSync}
        onFilter={() => setMobileFilterOpen(true)}
        onAiAdvice={handleAskAI}
        aiDisabled={adviceButtonDisabled}
        tips={tips}
        autoRefreshEnabled={autoRefreshEnabled}
        refreshIntervalSeconds={refreshIntervalSeconds}
        onToggleAutoRefresh={onToggleAutoRefresh}
        onChangeInterval={onChangeInterval}
      />

      <AdviceDialog
        open={adviceOpen}
        onClose={() => setAdviceOpen(false)}
        loading={adviceLoading}
        advice={advice}
        error={adviceError}
        debug={adviceDebug}
        warnings={adviceWarnings}
        usage={adviceUsage}
        model={adviceModel}
        myNextPick={myNextPick}
        onRecompute={handleAskAIForce}
      />

      <ApiKeyDialog
        open={keyDialogOpen}
        onClose={() => {
          setKeyDialogOpen(false)
          setPendingAskAfterKey(false)
          setKeyValidationError('')
          setKeyValidating(false)
        }}
        onSaved={handleKeySaved}
        validating={keyValidating}
        validationError={keyValidationError}
      />
    </section>
  )
}
