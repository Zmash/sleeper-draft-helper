import { useState, useMemo, useRef, useEffect } from 'react'
import { useTradeStore } from '../stores/useTradeStore'
import { evaluateTrade, buildTradeablePlayers, pickDynastyValue, stripSuffix } from '../services/tradeValue'
import { buildTradeAnalysisRequest } from '../services/aiTrade'
import { getOpenAIKey, setOpenAIKey } from '../services/key'
import { normalizePlayerName } from '../utils/formatting'
import ApiKeyDialog from './ApiKeyDialog'

const CURRENT_YEAR = new Date().getFullYear()
const PROFILE_LABELS = { auto: 'Auto', contender: 'Contender', balanced: 'Balanced', rebuild: 'Rebuild' }
const PROFILE_EMOJIS = { contender: '🏆', balanced: '⚖️', rebuild: '🔨', auto: '🔄' }
const TIER_LABELS = { early: 'Early (1–4)', mid: 'Mid (5–8)', late: 'Late (9–12)' }
const VERDICT_CONFIG = {
  winning:     { label: 'You win',             cls: 'verdict--win',        icon: '✅' },
  slight_win:  { label: 'Slight win for you',  cls: 'verdict--slight-win', icon: '👍' },
  fair:        { label: 'Fair trade',          cls: 'verdict--fair',       icon: '⚖️' },
  slight_lose: { label: 'Slight loss for you', cls: 'verdict--slight-lose',icon: '⚠️' },
  losing:      { label: 'You lose',            cls: 'verdict--lose',       icon: '❌' },
  neutral:     { label: 'No data yet',         cls: 'verdict--neutral',    icon: '—'  },
}
const POS_FILTERS = ['ALL', 'QB', 'RB', 'WR', 'TE']

// ── KTC/FC value lookup helper ────────────────────────────────────────────────
function lookupKtcValue(nname, extraValuesMap) {
  if (!extraValuesMap || !nname) return 0
  return extraValuesMap.get(nname) || extraValuesMap.get(stripSuffix(nname)) || 0
}

// ── Enrich manager roster players with dynasty values ─────────────────────────
function enrichPlayers(players, extraValuesMap) {
  return (players || []).map(p => {
    const val = lookupKtcValue(p.nname || normalizePlayerName(p.name || ''), extraValuesMap)
    return { ...p, dynasty_value: val, has_value: val > 0 }
  })
}

// ── Trade chip ────────────────────────────────────────────────────────────────
function TradeChip({ item, onRemove }) {
  const modPct = item.modifier != null && item.modifier !== 1
    ? (item.modifier > 1 ? `+${Math.round((item.modifier - 1) * 100)}%` : `${Math.round((item.modifier - 1) * 100)}%`)
    : null
  return (
    <div className="trade-chip">
      <div className="trade-chip-main">
        <span className="trade-chip-pos">{item.pos || 'PK'}</span>
        <span className="trade-chip-name">{item.name || item.label}</span>
        {item.age && <span className="trade-chip-age muted">{item.age}y</span>}
      </div>
      <div className="trade-chip-value">
        <span className="trade-chip-dyn">{item.dynasty_value?.toLocaleString() ?? '—'}</span>
        {modPct && (
          <span className={`trade-chip-mod ${item.modifier > 1 ? 'mod--up' : 'mod--down'}`}>{modPct}</span>
        )}
        <button className="trade-chip-remove" onClick={onRemove} title="Remove">×</button>
      </div>
    </div>
  )
}

// ── Pick form (fallback when no manager selected) ─────────────────────────────
function PickForm({ onAdd, onCancel }) {
  const [year, setYear] = useState(String(CURRENT_YEAR + 1))
  const [round, setRound] = useState(1)
  const [tier, setTier] = useState('mid')
  function handleAdd() {
    onAdd({
      type: 'pick',
      id: `pick_${year}_${round}_${tier}_${Date.now()}`,
      label: `${year} ${round === 1 ? '1st' : round === 2 ? '2nd' : '3rd+'} (${tier})`,
      year, round, tier,
      dynasty_value: pickDynastyValue(round, tier),
      pos: null, age: null,
    })
  }
  return (
    <div className="pick-form">
      <select value={year} onChange={e => setYear(e.target.value)} className="control control--sm">
        <option>{CURRENT_YEAR}</option>
        <option>{CURRENT_YEAR + 1}</option>
        <option>{CURRENT_YEAR + 2}</option>
      </select>
      <select value={round} onChange={e => setRound(Number(e.target.value))} className="control control--sm">
        <option value={1}>1st</option>
        <option value={2}>2nd</option>
        <option value={3}>3rd+</option>
      </select>
      <select value={tier} onChange={e => setTier(e.target.value)} className="control control--sm">
        {Object.entries(TIER_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      <button className="btn btn-primary btn-sm" onClick={handleAdd}>+</button>
      <button className="btn btn-ghost btn-sm" onClick={onCancel}>✕</button>
    </div>
  )
}

// ── Player search ─────────────────────────────────────────────────────────────
function PlayerSearch({ allPlayers, onAdd, onCancel, excludeIds }) {
  const [q, setQ] = useState('')
  const [posFilter, setPosFilter] = useState('ALL')
  const inputRef = useRef(null)

  const results = useMemo(() => {
    const lq = q.toLowerCase().trim()
    let pool = allPlayers.filter(p => !excludeIds.has(p.id))
    if (posFilter !== 'ALL') pool = pool.filter(p => p.pos === posFilter)
    if (!lq) {
      return pool
        .sort((a, b) => (b.dynasty_value || 0) - (a.dynasty_value || 0))
        .slice(0, 10)
    }
    return pool
      .filter(p => p.name.toLowerCase().includes(lq))
      .sort((a, b) => {
        const an = a.name.toLowerCase(), bn = b.name.toLowerCase()
        if (an === lq && bn !== lq) return -1
        if (bn === lq && an !== lq) return 1
        const as = an.startsWith(lq), bs = bn.startsWith(lq)
        if (as && !bs) return -1
        if (bs && !as) return 1
        if (a.source === 'roster' && b.source !== 'roster') return -1
        if (b.source === 'roster' && a.source !== 'roster') return 1
        return (b.dynasty_value || 0) - (a.dynasty_value || 0)
      })
      .slice(0, 12)
  }, [q, posFilter, allPlayers, excludeIds])

  return (
    <div className="player-search">
      <div className="player-search-header">
        <input
          ref={inputRef}
          className="control control--sm player-search-input"
          placeholder="Search players…"
          value={q}
          onChange={e => setQ(e.target.value)}
          autoFocus
        />
        <button className="btn btn-ghost btn-sm" onClick={onCancel}>✕</button>
      </div>
      <div className="player-search-filters">
        {POS_FILTERS.map(pos => (
          <button
            key={pos}
            className={`psf-btn ${posFilter === pos ? 'psf-btn--active' : ''}`}
            onClick={() => setPosFilter(pos)}
          >
            {pos}
          </button>
        ))}
      </div>
      {results.length > 0 && (
        <div className="player-search-results">
          {!q.trim() && <div className="psr-section-label">Top by value</div>}
          {results.map(p => (
            <button key={p.id} className="player-search-row" onClick={() => { onAdd(p); setQ('') }}>
              <span className="psr-pos">{p.pos}</span>
              <span className="psr-name">{p.name}</span>
              {p.source === 'roster' && <span className="psr-badge psr-badge--roster">Roster</span>}
              {p.source === 'drafted' && <span className="psr-badge psr-badge--drafted">pick {p.draftedAt ?? '?'}</span>}
              {p.team && <span className="psr-team muted">{p.team}</span>}
              {p.age && <span className="psr-age muted">{p.age}y</span>}
              <span className={`psr-val ${!p.dynasty_value ? 'muted' : ''}`}>
                {p.dynasty_value ? p.dynasty_value.toLocaleString() : '–'}
              </span>
            </button>
          ))}
        </div>
      )}
      {q.trim() && results.length === 0 && (
        <div className="player-search-empty muted">No results</div>
      )}
    </div>
  )
}

// ── Position badges ───────────────────────────────────────────────────────────
function PositionBadges({ players }) {
  const counts = useMemo(() => {
    const c = { QB: 0, RB: 0, WR: 0, TE: 0 }
    for (const p of players || []) {
      if (p.pos in c) c[p.pos]++
    }
    return c
  }, [players])

  return (
    <div className="pos-needs">
      {Object.entries(counts).map(([pos, n]) => (
        <span key={pos} className="pos-need-badge">{pos}: {n}</span>
      ))}
    </div>
  )
}

// ── Available picks strip ─────────────────────────────────────────────────────
function AvailablePicks({ picks, excludeIds, onAdd }) {
  const avail = (picks || []).filter(p => !excludeIds.has(p.id))
  if (!avail.length) return null
  return (
    <div className="available-picks">
      <div className="available-picks-label muted">Available Picks</div>
      <div className="available-picks-list">
        {avail.map(pick => (
          <button key={pick.id} className="available-pick-btn" onClick={() => onAdd(pick)}>
            <span className="apb-label">{pick.label}</span>
            <span className="apb-val">{pick.dynasty_value.toLocaleString()}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Trade side column ─────────────────────────────────────────────────────────
function TradeSide({
  side, items, evalItems, total,
  allPlayers, onAdd, onRemove,
  managerOptions, selectedManagerId, onManagerChange,
  managerRoster,
}) {
  const [mode, setMode] = useState(null)
  const excludeIds = useMemo(() => new Set(items.map(i => i.id)), [items])
  const sideLabel = side === 'tradeGive' ? 'You give' : 'You receive'

  // When a manager is selected: use their players; otherwise: global pool
  const playerPool = managerRoster ? managerRoster.players : allPlayers

  return (
    <div className="trade-side">
      <div className="trade-side-header">
        <span className="trade-side-label">{sideLabel}</span>
        <span className="trade-side-total">{total.toLocaleString()}</span>
      </div>

      {/* Manager selector */}
      {managerOptions?.length > 0 && (
        <div className="manager-selector">
          <select
            className="control control--sm"
            value={selectedManagerId || ''}
            onChange={e => onManagerChange(e.target.value || null)}
          >
            <option value="">Select manager…</option>
            {managerOptions.map(m => (
              <option key={m.rosterId} value={m.rosterId}>{m.displayName}</option>
            ))}
          </select>
        </div>
      )}

      {/* Position counts */}
      {managerRoster && <PositionBadges players={managerRoster.players} />}

      {/* Added items */}
      <div className="trade-items">
        {evalItems.map(item => (
          <TradeChip key={item.id} item={item} onRemove={() => onRemove(item.id)} />
        ))}
        {items.length === 0 && <div className="trade-empty muted">Nothing added yet</div>}
      </div>

      {/* Player search */}
      {mode === 'player' && (
        <PlayerSearch
          allPlayers={playerPool}
          onAdd={p => { onAdd(p); setMode(null) }}
          onCancel={() => setMode(null)}
          excludeIds={excludeIds}
        />
      )}

      {/* Manual pick form (only without manager context) */}
      {!managerRoster && mode === 'pick' && (
        <PickForm onAdd={p => { onAdd(p); setMode(null) }} onCancel={() => setMode(null)} />
      )}

      {/* Manager picks */}
      {managerRoster && (
        <AvailablePicks picks={managerRoster.picks} excludeIds={excludeIds} onAdd={onAdd} />
      )}

      {!mode && (
        <div className="trade-add-row">
          <button className="btn btn-secondary btn-sm" onClick={() => setMode('player')}>
            + Player
          </button>
          {!managerRoster && (
            <button className="btn btn-secondary btn-sm" onClick={() => setMode('pick')}>
              + Pick
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Value bar ─────────────────────────────────────────────────────────────────
function ValueBar({ totalGive, totalGet }) {
  const total = totalGive + totalGet
  const givePct = total > 0 ? Math.round((totalGive / total) * 100) : 50
  return (
    <div className="trade-bar-wrap">
      <div className="trade-bar">
        <div className="trade-bar-give" style={{ width: `${givePct}%` }} />
      </div>
      <div className="trade-bar-labels">
        <span>{totalGive.toLocaleString()}</span>
        <span>{totalGet.toLocaleString()}</span>
      </div>
    </div>
  )
}

// ── AI result display ─────────────────────────────────────────────────────────
function AiResult({ result }) {
  const recColor = { accept: 'badge--info', decline: 'badge--danger', counter: 'badge--warn' }
  const recLabel = { accept: 'Accept', decline: 'Decline', counter: 'Counter' }
  return (
    <div className="trade-ai-result">
      <div className="trade-ai-header">
        <span className="trade-ai-summary">{result.summary}</span>
        <span className={`badge ${recColor[result.recommendation] || 'badge--neutral'} badge--sm`}>
          {recLabel[result.recommendation] || result.recommendation}
        </span>
      </div>
      {result.strengths?.length > 0 && (
        <div className="trade-ai-section">
          <div className="trade-ai-section-title">Strengths</div>
          <ul className="trade-ai-list trade-ai-list--pro">
            {result.strengths.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </div>
      )}
      {result.concerns?.length > 0 && (
        <div className="trade-ai-section">
          <div className="trade-ai-section-title">Concerns</div>
          <ul className="trade-ai-list trade-ai-list--con">
            {result.concerns.map((c, i) => <li key={i}>{c}</li>)}
          </ul>
        </div>
      )}
      {(result.best_case || result.worst_case) && (
        <div className="trade-ai-scenarios">
          {result.best_case && (
            <div className="trade-ai-scenario trade-ai-scenario--best">
              <span className="trade-ai-scenario-label">Best case</span>
              <span>{result.best_case}</span>
            </div>
          )}
          {result.worst_case && (
            <div className="trade-ai-scenario trade-ai-scenario--worst">
              <span className="trade-ai-scenario-label">Worst case</span>
              <span>{result.worst_case}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function TradeAnalyzer({
  dynastyRoster, boardPlayers, league,
  extraValuesMap, ktcLoading,
  rostersByRosterId, rosterLoading, rosterError, myRosterId,
}) {
  const {
    tradeGive, tradeGet, profileOverride, addItem, removeItem, clearTrade, setProfileOverride,
    managerGive, managerGet, setManagerGive, setManagerGet,
  } = useTradeStore()

  const [aiResult, setAiResult]     = useState(null)
  const [aiLoading, setAiLoading]   = useState(false)
  const [aiError, setAiError]       = useState(null)
  const [keyDialogOpen, setKeyDialogOpen] = useState(false)
  const [pendingAi, setPendingAi]   = useState(false)

  // Derive manager options list
  const managerOptions = useMemo(() => {
    if (!rostersByRosterId) return []
    return Object.entries(rostersByRosterId)
      .map(([rosterId, data]) => ({ rosterId, displayName: data.displayName }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName))
  }, [rostersByRosterId])

  // Pre-select current user's roster on "give" side once rosters are available
  const didAutoSelect = useRef(false)
  useEffect(() => {
    if (!didAutoSelect.current && myRosterId && managerOptions.length > 0) {
      didAutoSelect.current = true
      setManagerGive(myRosterId)
    }
  }, [myRosterId, managerOptions.length]) // eslint-disable-line

  // Enrich manager rosters with dynasty values
  const enrichedRosters = useMemo(() => {
    if (!rostersByRosterId) return null
    const result = {}
    for (const [rid, data] of Object.entries(rostersByRosterId)) {
      result[rid] = { ...data, players: enrichPlayers(data.players, extraValuesMap) }
    }
    return result
  }, [rostersByRosterId, extraValuesMap])

  const managerGiveRoster = enrichedRosters?.[managerGive] || null
  const managerGetRoster  = enrichedRosters?.[managerGet]  || null

  // Global player pool (fallback when no manager selected)
  const allPlayers = useMemo(
    () => buildTradeablePlayers(dynastyRoster, boardPlayers, extraValuesMap),
    [dynastyRoster, boardPlayers, extraValuesMap]
  )

  const hasDynastyValues = useMemo(
    () => allPlayers.some(p => p.dynasty_value > 0) || (extraValuesMap?.size > 0),
    [allPlayers, extraValuesMap]
  )

  // Trade evaluation
  const evalResult = useMemo(
    () => evaluateTrade(tradeGive, tradeGet, { dynastyRoster, profileOverride }),
    [tradeGive, tradeGet, dynastyRoster, profileOverride]
  )
  const { totalGive, totalGet, verdict, profile, avgAge, enrichedGive, enrichedGet } = evalResult
  const verdictCfg = VERDICT_CONFIG[verdict] || VERDICT_CONFIG.neutral

  // ── AI call ──────────────────────────────────────────────────────────────────
  async function handleAiAnalysis() {
    const key = getOpenAIKey()
    if (!key) { setPendingAi(true); setKeyDialogOpen(true); return }
    await doAiWithKey(key)
  }

  async function doAiWithKey(key) {
    setAiLoading(true); setAiError(null); setAiResult(null)
    try {
      const payload = buildTradeAnalysisRequest({
        tradeGive: enrichedGive,
        tradeGet: enrichedGet,
        evalResult,
        dynastyRoster,
        league,
        managerGiveRoster,
        managerGetRoster,
      })
      const res = await fetch('/api/ai-trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Anthropic-Key': key },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.message || err?.error || `HTTP ${res.status}`)
      }
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
          const dataLine  = lines.find(l => l.startsWith('data: '))
          if (!dataLine) continue
          const eventType = eventLine?.slice(7).trim() || 'message'
          let data
          try { data = JSON.parse(dataLine.slice(6)) } catch { continue }
          if (eventType === 'result') {
            if (!data.ok) throw new Error(data.message || 'AI error')
            setAiResult(data.parsed || null)
          } else if (eventType === 'error') {
            throw new Error(data.message || 'AI error')
          }
        }
      }
    } catch (e) {
      setAiError(e?.message || 'Unexpected error')
    } finally {
      setAiLoading(false)
    }
  }

  function handleKeySaved(key) {
    setOpenAIKey(key)
    setKeyDialogOpen(false)
    if (pendingAi) { setPendingAi(false); doAiWithKey(key) }
  }

  const hasItems = tradeGive.length > 0 || tradeGet.length > 0
  const canAnalyze = tradeGive.length > 0 && tradeGet.length > 0

  return (
    <div className="trade-analyzer">

      {/* ── Status hints ──────────────────────────────────────────── */}
      {ktcLoading && (
        <div className="trade-no-values-hint trade-no-values-hint--loading">
          Loading dynasty values…
        </div>
      )}
      {!ktcLoading && !hasDynastyValues && (
        <div className="trade-no-values-hint">
          Failed to load dynasty values. Check your internet connection.
        </div>
      )}
      {rosterLoading && (
        <div className="trade-no-values-hint trade-no-values-hint--loading">
          Loading rosters…
        </div>
      )}
      {rosterError && (
        <div className="trade-no-values-hint">{rosterError}</div>
      )}

      {/* ── Trade columns ─────────────────────────────────────────── */}
      <div className="trade-columns">
        <TradeSide
          side="tradeGive"
          items={tradeGive}
          evalItems={enrichedGive}
          total={totalGive}
          allPlayers={allPlayers}
          onAdd={item => addItem('tradeGive', item)}
          onRemove={id => removeItem('tradeGive', id)}
          managerOptions={managerOptions}
          selectedManagerId={managerGive}
          onManagerChange={setManagerGive}
          managerRoster={managerGiveRoster}
        />
        <div className="trade-vs">VS</div>
        <TradeSide
          side="tradeGet"
          items={tradeGet}
          evalItems={enrichedGet}
          total={totalGet}
          allPlayers={allPlayers}
          onAdd={item => addItem('tradeGet', item)}
          onRemove={id => removeItem('tradeGet', id)}
          managerOptions={managerOptions}
          selectedManagerId={managerGet}
          onManagerChange={setManagerGet}
          managerRoster={managerGetRoster}
        />
      </div>

      {/* ── Value bar + verdict ────────────────────────────────────── */}
      {hasItems && (
        <div className="trade-evaluation">
          <ValueBar totalGive={totalGive} totalGet={totalGet} />
          <div className={`trade-verdict ${verdictCfg.cls}`}>
            <span className="trade-verdict-icon">{verdictCfg.icon}</span>
            <span className="trade-verdict-label">{verdictCfg.label}</span>
          </div>

          {/* ── Team profile ──────────────────────────────────────── */}
          <div className="trade-profile-row">
            <span className="trade-profile-label">
              {PROFILE_EMOJIS[profile]} Team profile: <strong>{PROFILE_LABELS[profile]}</strong>
              {avgAge && <span className="muted"> · Avg. starter age {Number(avgAge).toFixed(1)}</span>}
            </span>
            <div className="trade-profile-controls">
              {['auto', 'contender', 'balanced', 'rebuild'].map(p => (
                <button
                  key={p}
                  className={`btn btn-sm ${profileOverride === p ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setProfileOverride(p)}
                >
                  {PROFILE_LABELS[p]}
                </button>
              ))}
            </div>
          </div>

          {/* ── AI analysis ───────────────────────────────────────── */}
          <div className="trade-ai-section-wrap">
            {!aiResult && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={handleAiAnalysis}
                disabled={!canAnalyze || aiLoading}
              >
                {aiLoading ? 'Analyzing…' : '🤖 AI Analysis'}
              </button>
            )}
            {aiError && <div className="trade-ai-error">{aiError}</div>}
            {aiResult && (
              <>
                <AiResult result={aiResult} />
                <button className="btn btn-ghost btn-sm" onClick={() => setAiResult(null)}>
                  Close analysis
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {hasItems && (
        <button className="btn btn-ghost btn-sm trade-clear" onClick={clearTrade}>
          Clear trade
        </button>
      )}

      <ApiKeyDialog
        open={keyDialogOpen}
        onClose={() => { setKeyDialogOpen(false); setPendingAi(false) }}
        onSaved={handleKeySaved}
      />
    </div>
  )
}
