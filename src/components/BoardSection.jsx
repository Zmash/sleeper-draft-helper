import React, { useEffect, useMemo, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import BoardToolbar from './BoardToolbar'
import FiltersRow from './FiltersRow'
import BoardTable from './BoardTable'
import DataProvenanceBar from './DataProvenanceBar'
import Icon from './Icon'
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
  const { marketMeta, boardSource, refreshMarketData } = useBoardStore()
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

  // Das ganze Format, nicht nur der Kader: scoringType und isSuperflex gingen
  // hier verloren, sodass die AI beim Mock immer den PPR-Default und "1 QB"
  // beschrieben bekam — und Setup-Overrides gar nicht sah.
  const draftFormat = deriveFormat({ draft, league, overrides: setupOverrides })
  const { rosterPositions } = draftFormat

  const hasBoard = Array.isArray(boardPlayers) && boardPlayers.length > 0

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

  // ---------- AI Advice ----------

  async function handleAskAI() {
    const key = getOpenAIKey()
    if (!key) {
      setKeyDialogOpen(true)
      setPendingAskAfterKey(true)
      return
    }
    await doAskAIWithKey(key)
  }

  async function doAskAIWithKey(userKey) {
    try {
      setAdviceOpen(true)
      setAdviceLoading(true)
      setAdviceError(null)
      setAdvice(null)
      setAdviceDebug(null)
      setAdviceWarnings([])
      setAdviceUsage(null)
      setAdviceModel('')

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
    return (
      <section className="card dashboard-empty">
        <div className="dashboard-empty-icon"><Icon name="clipboard" size={40} /></div>
        <h2>Noch kein Ranking importiert</h2>
        <p className="muted">Importiere im Setup deine Rankings (CSV, FantasyCalc oder KeepTradeCut), um das Board zu füllen.</p>
        <button className="btn btn-primary" onClick={() => navigate('/setup', { state: { mode: 'edit' } })}>
          <Icon name="upload" size={16} /> Zum Setup
        </button>
      </section>
    )
  }

  return (
    <section className="card">
      <div className="row between items-center wrap" style={{ gap: 8 }}>
        <BoardToolbar
          currentPickNumber={currentPickNumber}
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
            className="btn-compact"
            disabled={adviceButtonDisabled}
            title={adviceButtonDisabled ? 'Picks werden geladen — gleich verfügbar' : 'AI-Empfehlung für den nächsten Pick'}
          >
            <Icon name="bot" size={15} /> AI-Advice
          </button>
          <CostHint text={adviceEstimate} />
          <button
            onClick={() => { setPendingAskAfterKey(false); setKeyValidationError(''); setKeyValidating(false); setKeyDialogOpen(true) }}
            className="btn-compact"
            title="Anthropic API-Key verwalten"
          >
            <Icon name="key" size={15} /> Key
          </button>
        </div>
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

      <DataProvenanceBar
        marketMeta={marketMeta}
        draftMode={draftMode}
        hasCsvBoard={boardSource === 'csv'}
        onRefresh={draftMode === 'rookie' ? undefined : handleRefreshMarket}
        refreshing={refreshingMarket}
        error={marketError}
      />

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
        progressPercent={totalCount ? Math.round((pickedCount / totalCount) * 100) : 0}
        pickedCount={pickedCount}
        totalCount={totalCount}
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

      <div className="row end" style={{ gap: 8, marginTop: '1rem' }}>
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
