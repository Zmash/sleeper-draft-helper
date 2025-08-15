import React, { useState, useMemo } from 'react'
import BoardToolbar from './BoardToolbar'
import FiltersRow from './FiltersRow'
import BoardTable from './BoardTable'

import AdviceDialog from './AdviceDialog'
import ApiKeyDialog from './ApiKeyDialog'
import { buildAIAdviceRequest } from '../services/ai'
import { getOpenAIKey, setOpenAIKey } from '../services/key'
import { loadPreferences, setPreference, PlayerPreference } from '../services/preferences'

const DEBUG_AI = false

export default function BoardSection({
  // --- Original-Werte ---
  currentPickNumber,
  autoRefreshEnabled,
  refreshIntervalSeconds,
  lastSyncAt,
  searchQuery,
  positionFilter,
  filteredPlayers,
  pickedCount,
  totalCount,

  // --- Original-Actions ---
  onToggleAutoRefresh,
  onChangeInterval,
  onSync,
  onSearchChange,
  onPositionChange,

  // --- AI-Advice relevante Props ---
  boardPlayers,
  livePicks,
  meUserId,
  league,
  draft,
}) {
  // --- AI Advice Dialog State ---
  const [adviceOpen, setAdviceOpen] = useState(false)
  const [adviceLoading, setAdviceLoading] = useState(false)
  const [advice, setAdvice] = useState(null)
  const [adviceError, setAdviceError] = useState(null)

  // --- API Key Dialog State ---
  const [keyDialogOpen, setKeyDialogOpen] = useState(false)
  const [keyValidating, setKeyValidating] = useState(false)
  const [keyValidationError, setKeyValidationError] = useState('')
  const [pendingAskAfterKey, setPendingAskAfterKey] = useState(false)

  // --- Debug: Request/Response im Dialog anzeigen ---
  const [adviceDebug, setAdviceDebug] = useState(null)

  // Roster-Positions robuster ermitteln
  const rosterPositions =
    (league && Array.isArray(league.roster_positions) && league.roster_positions) ||
    (league && league.settings && Array.isArray(league.settings.roster_positions) && league.settings.roster_positions) ||
    []

  const hasBoard = Array.isArray(boardPlayers) && boardPlayers.length > 0
  const disabled = false

  // Button click -> Wenn Key fehlt, Dialog öffnen; sonst direkt Anfrage starten
  async function handleAskAI() {
    const key = getOpenAIKey()
    if (!key) {
      setKeyDialogOpen(true)
      setPendingAskAfterKey(true)
      return
    }
    await doAskAIWithKey(key)
  }

  // Tatsächlicher Advice-Call (mit bereits vorhandenem, validem Key)
    async function doAskAIWithKey(userKey) {
    try {
      setAdviceOpen(true)
      setAdviceLoading(true)
      setAdviceError(null)
      setAdvice(null)
      setAdviceDebug(null)

      const payload = buildAIAdviceRequest({
        boardPlayers: boardPlayers || [],
        livePicks: livePicks || [],
        me: meUserId || '',
        league: { ...(league || {}), roster_positions: rosterPositions },
        draft: draft || null,
        currentPickNumber: Number.isFinite(currentPickNumber) ? currentPickNumber : null,
        options: { topNOverall: 60, topPerPos: 20, model: 'gpt-4o-mini', temperature: 0.2, max_output_tokens: 700 }
      })

     // ---- LOG: Vollständige Anfrage im Browser-Console
     if (DEBUG_AI) {
       console.groupCollapsed('[AI REQUEST -> /api/ai-advice]')
       console.log('payload:', payload)
       const ctx = extractContextFromUserMessage(payload)
       console.log('context_counts:', summarizeCtxCounts(ctx))
       console.log('context_sample:', sampleCtx(ctx))
       console.groupEnd()
     }

      // Kleine Request-Zusammenfassung für Debug-Panel
      const requestSummary = summarizeRequest(payload)

      const res = await fetch('/api/ai-advice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-OpenAI-Key': userKey,
        },
        body: JSON.stringify(payload),
      })

      const text = await res.text()
      let data = null
      try { data = JSON.parse(text) } catch { /* noop */ }

      // ---- LOG: Vollständige RESPONSE im Browser
      console.groupCollapsed('[AI RESPONSE <- /api/ai-advice]')
      console.log('status:', res.status)
      console.log('json parsed:', data)
      console.log('raw text:', text)
      console.groupEnd()

      if (!res.ok) {
        const msg = data?.message || data?.error || `HTTP ${res.status}`
       setAdviceDebug({
        // kompakte Summary für schnellen Überblick
        request: requestSummary,

        // volle Anfrage, die rausging
        request_payload: payload,

        // verkleinerter Kontext-Sample (erste Einträge)
        request_context_sample: sampleCtx(extractContextFromUserMessage(payload)),

        // was der Server zurückgab (falls JSON), sonst zumindest Status/Text
        response: data || { status: res.status, text },

        // komplette Response (JSON) und der rohe Text – super fürs Debuggen
        response_all: data || null,
        response_text: text,

        // falls der Server bereits openai_message mitecho’t (bei Fehlern oft null)
        openai_message: data?.debug?.openai_message || null,

        // falls der Server schon was in raw/tool_calls hatte
        raw: data?.raw || null,
        tool_calls: data?.tool_calls || null,
      })

        throw new Error(msg)
      }

      // Server liefert { ok, raw, parsed, tool_calls, usage, debug?... }
      let parsed = data?.parsed || null

      if (!parsed && Array.isArray(data?.tool_calls) && data.tool_calls.length > 0) {
        const call = data.tool_calls.find(c => c?.function?.name === 'return_draft_advice')
        if (call?.function?.arguments) {
          try { parsed = JSON.parse(call.function.arguments) } catch { /* noop */ }
        }
      }

      if (!parsed && data?.raw) {
        parsed = extractLooseJson(data.raw) || null
      }
      if (!parsed && text) {
        parsed = extractLooseJson(text) || null
      }

      setAdvice(parsed || null)
      setAdviceDebug({
        // nimm bevorzugt die serverseitige Request-Zusammenfassung, sonst unsere
        request: data?.debug?.request || requestSummary,

        // volle Anfrage
        request_payload: payload,

        // Kontext-Sample
        request_context_sample: sampleCtx(extractContextFromUserMessage(payload)),

        // OpenAI-Metadaten (usage, tool_calls_count, content_len, …)
        response: {
          ok: data?.ok,
          ...(data?.debug?.openai || {}),
          id: data?.id,
          model: data?.model,
          usage: data?.usage,
        },

        // kompletter Response-Body und Roh-Text (falls mal kein JSON)
        response_all: data || null,
        response_text: text,

        // genau die Message, die OpenAI zurückgab (gekürzt), inkl. tool_calls
        openai_message: data?.debug?.openai_message || null,

        // was wir fürs UI extrahiert haben
        raw: data?.raw || null,
        tool_calls: data?.tool_calls || null,
      })

    } catch (e) {
      setAdviceError(e?.message || 'Unerwarteter Fehler')
    } finally {
      setAdviceLoading(false)
    }
  }


  function summarizeRequest(payload) {
    const sys = payload?.messages?.find(m => m.role === 'system')?.content || ''
    const user = payload?.messages?.find(m => m.role === 'user')?.content || ''
    const ctxMatch = user.match(/<CONTEXT_JSON>\s*([\s\S]*?)\s*<\/CONTEXT_JSON>/)
    let ctx = null
    try { ctx = ctxMatch ? JSON.parse(ctxMatch[1]) : null } catch { /* noop */ }

    const counts = ctx ? {
      overall_top: ctx?.board?.overall_top?.length || 0,
      by_pos_keys: Object.keys(ctx?.board?.by_position || {}).length,
      my_picks: ctx?.my_team?.picks?.length || 0,
      roster_pos_len: ctx?.league?.roster_positions?.length || 0,
    } : null

    return {
      model: payload?.model,
      temperature: payload?.temperature,
      max_tokens: payload?.max_tokens,
      messages: payload?.messages?.length,
      has_tools: Array.isArray(payload?.tools) && payload.tools.length > 0,
      tool_choice: payload?.tool_choice?.type || null,
      context_counts: counts,
    }
  }

  function extractContextFromUserMessage(payload) {
  try {
    const user = payload?.messages?.find(m => m.role === 'user')?.content || ''
    const m = user.match(/<CONTEXT_JSON>\s*([\s\S]*?)\s*<\/CONTEXT_JSON>/)
    if (!m) return null
    return JSON.parse(m[1])
  } catch { return null }
}

function summarizeCtxCounts(ctx) {
  if (!ctx) return null
  return {
    overall_top: Array.isArray(ctx?.board?.overall_top) ? ctx.board.overall_top.length : 0,
    by_pos_keys: ctx?.board?.by_position ? Object.keys(ctx.board.by_position).length : 0,
    my_picks: Array.isArray(ctx?.my_team?.picks) ? ctx.my_team.picks.length : 0,
    roster_pos_len: Array.isArray(ctx?.league?.roster_positions) ? ctx.league.roster_positions.length : 0,
  }
}

function sampleCtx(ctx) {
  if (!ctx) return null
  const byPosKeys = ctx?.board?.by_position ? Object.keys(ctx.board.by_position) : []
  return {
    overall_top_first5: (ctx?.board?.overall_top || []).slice(0,5),
    by_pos_keys: byPosKeys,
    by_pos_first2: byPosKeys.slice(0,2).map(k => ({ [k]: (ctx.board.by_position[k] || []).slice(0,3) })),
    my_picks_first3: (ctx?.my_team?.picks || []).slice(0,3),
    roster_positions_first15: (ctx?.league?.roster_positions || []).slice(0,15),
  }
}

function extractLooseJson(s) {
  if (!s || typeof s !== 'string') return null
  const start = s.indexOf('{')
  const end = s.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) return null
  const candidate = s.slice(start, end + 1)
  if (!/\"primary\"\s*:/.test(candidate)) return null
  try { return JSON.parse(candidate) } catch { return null }
}

function scrollToNextUndrafted() {
  const next = (filteredPlayers || []).find(p => !p.status)
  if (!next) return
  const id = `row-${next.nname}`   // muss in BoardTable gesetzt werden
  const el = document.getElementById(id)
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el.classList.add('row-flash')
    setTimeout(() => el.classList.remove('row-flash'), 900)
  }
}


  // Wird aufgerufen, nachdem der Nutzer im ApiKeyDialog "Speichern" gedrückt hat
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

    // Key dauerhaft speichern
    setOpenAIKey(savedKey)

    setKeyDialogOpen(false)

    if (pendingAskAfterKey) {
      setPendingAskAfterKey(false)
      await doAskAIWithKey(savedKey)
    }
  }

  // Schlanke Key-Validierung gegen separaten Endpoint
  async function validateKey(userKey) {
    try {
      const res = await fetch('/api/validate-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-OpenAI-Key': userKey },
        body: JSON.stringify({}),
      })
      return res.ok
    } catch {
      return false
    }
  }

  // --- Abgeleitete Highlights aus der AI-Antwort ---
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

// Player Preferences
const [playerPrefs, setPlayerPrefs] = useState(() => loadPreferences())
function handleSetPlayerPref(playerId, pref) {
  setPlayerPrefs(prev => setPreference(prev, playerId, pref))
}

// Filter: Avoid ausblenden
const [hideAvoid, setHideAvoid] = useState(false)
const filteredBoardPlayers = useMemo(() => {
  const list = filteredPlayers || []
  if (!hideAvoid) return list
  return list.filter(p => playerPrefs[p.player_id || p.id] !== PlayerPreference.AVOID)
}, [filteredPlayers, hideAvoid, playerPrefs])

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

        {/* AI-Advice Button neben der Toolbar */}
        <div className="btn-group-compact">
  <button onClick={handleAskAI} className="btn-compact" title="AI-Empfehlung für den nächsten Pick">
    🤖 AI-Advice
  </button>
  <button onClick={() => { setPendingAskAfterKey(false); setKeyValidationError(''); setKeyValidating(false); setKeyDialogOpen(true) }}
          className="btn-compact" title="OpenAI API-Key verwalten">
    🔑 Key
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
      />

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
      />

      {/* Advice Modal mit Debug */}
      <AdviceDialog
        open={adviceOpen}
        onClose={() => setAdviceOpen(false)}
        loading={adviceLoading}
        advice={advice}
        error={adviceError}
        debug={adviceDebug}
      />

      {/* API Key Modal mit Validierungsstatus */}
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
