import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import Icon from './Icon'
import DraftGrid from './DraftGrid'
import { cx, normalizePos, fantasyProsSlug } from '../utils/formatting'
import { useBoardStore } from '../stores/useBoardStore'
import { loadPreferences, getPreference, setPreference, PlayerPreference } from '../services/preferences'
import AdviceDialog from './AdviceDialog'
import ApiKeyDialog from './ApiKeyDialog'
import { CostHint } from './CostHint'
import { buildAIAdviceRequest } from '../services/ai'
import { buildAdviceRequestArgs } from '../services/adviceRequestArgs'
import { askAiAdvice, validateAnthropicKey } from '../services/aiAdviceClient'
import { getOpenAIKey, setOpenAIKey } from '../services/key'
import { formatEstimate } from '../services/aiCost'
import { isAdviceButtonDisabled } from '../services/boardGate'
import { opponentsUntilMyNext } from '../services/draftFlow'

const FP_PLAYER = (name) => `https://www.fantasypros.com/nfl/players/${fantasyProsSlug(name)}.php`

const POS_FILTERS = ['ALL', 'QB', 'RB', 'WR', 'TE']
const POS_LABEL = { ALL: 'Alle' }

// Arbeitsflaeche der neuen Shell: Filterzeile + Liste/Board + Inspector.
// Bekommt exakt dieselben Props wie BoardSection — BoardPage bleibt die eine
// Stelle, an der Merge, Enrichment und Filterung passieren.
export default function NextBoard({
  filteredPlayers = [],
  boardPlayers = [],
  livePicks = [],
  searchQuery,
  positionFilter,
  teamFilter,
  onSearchChange,
  onPositionChange,
  onTeamFilterChange,
  ownerLabels,
  draft,
  draftSlot,
  teamsCount,
  meUserId,
  effRoster,
  draftMode,
  league,
  isSuperflex,
  scoringType,
  currentPickNumber,
  tips,
  dynastyRoster,
  myDraftPicks,
  customStrategyText,
  draftFinished,
  onOpenDraftReview,
}) {
  const [view, setView] = useState('list')
  const [inspOpen, setInspOpen] = useState(true)
  const [tab, setTab] = useState('player')
  const [selKey, setSelKey] = useState(null)
  const [playerPrefs, setPlayerPrefs] = useState(() => loadPreferences())
  const { setSearchQuery } = useBoardStore()

  const rows = filteredPlayers
  const selected = useMemo(
    () => rows.find((p) => (p.nname || p.name) === selKey) || rows[0] || null,
    [rows, selKey]
  )

  const jumpToNextUndrafted = useCallback(() => {
    const next = rows.find((p) => !p.status)
    if (!next) return
    const key = next.nname || next.name
    setSelKey(key)
    setTab('player')
    // Ein Frame warten: die Zeile kann durch den Filterwechsel gerade erst
    // gerendert worden sein.
    requestAnimationFrame(() => {
      const el = document.getElementById(`ns-row-${key}`)
      if (!el) return
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.classList.add('ns-flash')
      setTimeout(() => el.classList.remove('ns-flash'), 900)
    })
  }, [rows])

  // Auto-Jump beim Aufruf des Boards und beim Zurueckwechseln von der Grid-
  // in die Listenansicht — sonst muss man jedes Mal zur aktuellen Stelle
  // runterscrollen (gleiches Verhalten wie BoardSection).
  const jumpedRef = useRef(false)
  useEffect(() => {
    if (view !== 'list' || rows.length === 0) { if (view !== 'list') jumpedRef.current = false; return }
    if (jumpedRef.current) return
    jumpedRef.current = true
    jumpToNextUndrafted()
  }, [view, rows.length, jumpToNextUndrafted])

  useEffect(() => {
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const el = e.target
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return
      const k = e.key.toLowerCase()
      if (k === 'v') { e.preventDefault(); setView((v) => (v === 'list' ? 'board' : 'list')); return }
      if (k === 'i') { e.preventDefault(); setInspOpen((v) => !v); return }
      if (k === 'j') { e.preventDefault(); jumpToNextUndrafted(); return }
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
      e.preventDefault()
      const i = rows.findIndex((p) => p === selected)
      const nxt = rows[Math.min(rows.length - 1, Math.max(0, i + (e.key === 'ArrowDown' ? 1 : -1)))]
      if (nxt) { setSelKey(nxt.nname || nxt.name); setTab('player') }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [rows, selected, jumpToNextUndrafted])

  // ── AI-Advice ────────────────────────────────────────────────────────────
  // Gleiche Bausteine wie im alten Board (buildAdviceRequestArgs →
  // buildAIAdviceRequest → /api/ai-advice), inklusive Cache-Signatur: ein
  // erneuter Klick auf unveraendertem Board zeigt die vorhandene Antwort,
  // statt einen weiteren kostenpflichtigen Call auszuloesen.
  const [adviceOpen, setAdviceOpen] = useState(false)
  const [adviceLoading, setAdviceLoading] = useState(false)
  const [advice, setAdvice] = useState(null)
  const [adviceError, setAdviceError] = useState(null)
  const [adviceWarnings, setAdviceWarnings] = useState([])
  const [adviceUsage, setAdviceUsage] = useState(null)
  const [adviceModel, setAdviceModel] = useState('')
  const [adviceSig, setAdviceSig] = useState(null)
  const [keyDialogOpen, setKeyDialogOpen] = useState(false)
  const [keyValidating, setKeyValidating] = useState(false)
  const [keyValidationError, setKeyValidationError] = useState('')
  const [pendingAskAfterKey, setPendingAskAfterKey] = useState(false)

  const adviceArgs = useMemo(() => ({
    boardPlayers, livePicks, meUserId, league, draft, currentPickNumber,
    draftSlot, tips, scoringType, isSuperflex,
    rosterPositions: effRoster, teamsCount, draftMode, dynastyRoster, myDraftPicks,
    customStrategyText, playerPreferences: playerPrefs,
  }), [boardPlayers, livePicks, meUserId, league, draft, currentPickNumber, draftSlot,
       tips, scoringType, isSuperflex, effRoster, teamsCount, draftMode, dynastyRoster,
       myDraftPicks, customStrategyText, playerPrefs])

  const adviceEstimate = useMemo(() => {
    if (!boardPlayers.length) return ''
    try { return formatEstimate(buildAIAdviceRequest(buildAdviceRequestArgs(adviceArgs)), 'claude-sonnet-5') }
    catch { return '' }
  }, [adviceArgs, boardPlayers.length])

  const currentAdviceSig = useMemo(() => {
    if (!boardPlayers.length) return null
    return JSON.stringify({
      draft: draft?.draft_id ?? null,
      pick: currentPickNumber ?? null,
      picks: (livePicks || []).length,
      slot: draftSlot ?? null,
      mode: draftMode,
      prefs: playerPrefs || {},
      order: boardPlayers.map((p) => `${String(p.nname || '').toLowerCase()}:${p.status ? 1 : 0}`).join('|'),
    })
  }, [boardPlayers, draft?.draft_id, currentPickNumber, livePicks, draftSlot, draftMode, playerPrefs])

  const myNextPick = useMemo(
    () => opponentsUntilMyNext({
      picks: livePicks, teamsCount, mySlot: draftSlot,
      upcomingPick: (currentPickNumber ?? 0) + 1, rosterPositions: effRoster,
    })?.my_next_pick ?? null,
    [livePicks, teamsCount, draftSlot, currentPickNumber, effRoster]
  )

  const adviceDisabled = isAdviceButtonDisabled({ draft, livePicks })

  async function runAdvice(userKey) {
    const sigAtRequest = currentAdviceSig
    setAdviceOpen(true)
    setAdviceLoading(true)
    setAdviceError(null)
    setAdvice(null)
    setAdviceWarnings([])
    setAdviceUsage(null)
    setAdviceModel('')
    setAdviceSig(null)
    try {
      const availableNnames = new Set(
        boardPlayers.filter((p) => !p.status).map((p) => String(p.nname || '').trim().toLowerCase())
      )
      const r = await askAiAdvice({
        payload: buildAIAdviceRequest(buildAdviceRequestArgs(adviceArgs)),
        apiKey: userKey,
        availableNnames,
      })
      setAdvice(r.advice)
      setAdviceWarnings(r.warnings)
      setAdviceUsage(r.usage)
      setAdviceModel(r.model)
      setAdviceSig(sigAtRequest)
    } catch (e) {
      setAdviceError(e?.message || 'Unerwarteter Fehler')
    } finally {
      setAdviceLoading(false)
    }
  }

  function askAdvice(force = false) {
    const key = getOpenAIKey()
    if (!key) { setKeyDialogOpen(true); setPendingAskAfterKey(true); return }
    if (!force && advice && !adviceError && adviceSig != null && adviceSig === currentAdviceSig) {
      setAdviceOpen(true)
      return
    }
    runAdvice(key)
  }

  async function handleKeySaved(savedKey) {
    setKeyValidationError('')
    setKeyValidating(true)
    const ok = await validateAnthropicKey(savedKey)
    setKeyValidating(false)
    if (!ok) {
      setOpenAIKey('')
      setKeyValidationError('API Key ungültig oder nicht autorisiert. Bitte prüfe deinen Schlüssel.')
      return
    }
    setOpenAIKey(savedKey)
    setKeyDialogOpen(false)
    if (pendingAskAfterKey) { setPendingAskAfterKey(false); await runAdvice(savedKey) }
  }

  // Empfohlene Spieler im Board markieren — wie aiHighlights im alten Board.
  const aiPicks = useMemo(() => {
    if (!advice) return { primary: null, all: new Set() }
    const key = (n) => String(n || '').trim().toLowerCase()
    const primary = advice?.primary?.player_nname ? key(advice.primary.player_nname) : null
    const all = new Set(primary ? [primary] : [])
    for (const alt of advice?.alternatives || []) if (alt?.player_nname) all.add(key(alt.player_nname))
    return { primary, all }
  }, [advice])

  const pickedCount = boardPlayers.filter((p) => p.status).length
  const hasAdp = useMemo(() => rows.some((p) => p.adp != null), [rows])
  const hasBye = useMemo(() => rows.some((p) => p.bye), [rows])
  const hasValue = useMemo(() => rows.some((p) => p.value != null), [rows])

  const teamOptions = useMemo(() => {
    const out = []
    if (ownerLabels?.size) for (const [key, label] of ownerLabels.entries()) out.push({ key, label })
    return out.sort((a, b) => String(a.label).localeCompare(String(b.label), 'de'))
  }, [ownerLabels])

  return (
    <div className={cx('ns-panes', !inspOpen && 'is-solo')}>
      <section className="ns-main">
        <div className="ns-filters">
          <div className="ns-seg" role="group" aria-label="Position">
            {POS_FILTERS.map((p) => (
              <button
                key={p}
                className={cx(p === positionFilter && 'is-on')}
                onClick={() => onPositionChange?.({ target: { value: p } })}
              >
                {POS_LABEL[p] || p}
              </button>
            ))}
          </div>
          <input
            className="ns-search"
            placeholder="Spieler filtern …"
            value={searchQuery || ''}
            onChange={(e) => onSearchChange?.(e)}
          />
          {teamOptions.length > 0 && (
            <select
              className="ns-select"
              value={teamFilter || 'ALL'}
              onChange={(e) => onTeamFilterChange?.(e)}
              aria-label="Nur Picks eines Teams anzeigen"
            >
              <option value="ALL">Alle Teams</option>
              {teamOptions.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
          )}
          <button
            className="ns-chip"
            title="Zum nächsten freien Spieler springen (J)"
            onClick={jumpToNextUndrafted}
          >
            <Icon name="arrow-down" size={12} /> Jump
          </button>
          <button
            className="ns-ai-btn"
            onClick={() => (draftFinished ? onOpenDraftReview?.() : askAdvice())}
            disabled={!draftFinished && adviceDisabled}
            title={
              draftFinished
                ? 'Draft ist fertig — AI Draft Review öffnen'
                : adviceDisabled
                  ? 'Picks werden geladen — gleich verfügbar'
                  : 'AI-Empfehlung für den nächsten Pick'
            }
          >
            <Icon name="bot" size={13} /> {draftFinished ? 'AI Draft Review' : 'AI-Advice'}
          </button>
          {!draftFinished && <CostHint text={adviceEstimate} />}
          <div className="ns-seg ns-seg--view" role="group" aria-label="Ansicht">
            <button className={cx(view === 'list' && 'is-on')} onClick={() => setView('list')} title="Liste (V)">
              <Icon name="board" size={13} /> Liste
            </button>
            <button className={cx(view === 'board' && 'is-on')} onClick={() => setView('board')} title="Board (V)">
              <Icon name="chart" size={13} /> Board
            </button>
          </div>
        </div>

        {view === 'board' ? (
          <div className="ns-gridhost">
            <DraftGrid draft={draft} teamsCount={teamsCount} ownerLabels={ownerLabels} draftSlot={draftSlot} />
          </div>
        ) : rows.length === 0 ? (
          <div className="ns-empty">
            {boardPlayers.length === 0
              ? 'Noch kein Ranking importiert — über das Upload-Symbol oben rechts starten.'
              : 'Kein Spieler passt zu diesem Filter.'}
          </div>
        ) : (
          <div className="ns-tablewrap">
            <table className="ns-table">
              <thead>
                <tr>
                  <th className="ns-rk">#</th>
                  <th>Spieler</th>
                  <th className="ns-c-pos">Pos</th>
                  <th className="ns-c-team">Team</th>
                  {hasAdp && <th className="ns-num">ADP</th>}
                  {hasBye && <th className="ns-num">Bye</th>}
                  {hasValue && <th className="ns-num">Wert</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => {
                  const key = p.nname || p.name
                  const pref = getPreference(playerPrefs, p)
                  return (
                    <tr
                      key={key}
                      id={`ns-row-${key}`}
                      className={cx(
                        p === selected && 'is-sel',
                        p.status === 'me' && 'is-me',
                        p.status === 'other' && 'is-other',
                        aiPicks.all.has(String(p.nname || '').toLowerCase()) && 'is-ai',
                      )}
                      onClick={() => { setSelKey(key); setTab('player') }}
                    >
                      <td className="ns-rk ns-num">{p.rk}</td>
                      <td className="ns-name">
                        {pref === PlayerPreference.FAVORITE && <Icon name="star" size={10} className="ns-favmark" />}
                        {p.name}
                        {p.injury_status && (
                          <span className={cx('ns-inj', p.injury_status !== 'Questionable' && 'is-out')}>
                            {p.injury_status === 'Questionable' ? 'Q' : p.injury_status}
                          </span>
                        )}
                        {aiPicks.primary === String(p.nname || '').toLowerCase() && (
                          <span className="ns-aimark" title="AI-Empfehlung">AI</span>
                        )}
                        {p.pick_no && <span className="ns-pickno">#{p.pick_no}</span>}
                      </td>
                      <td className="ns-c-pos">
                        {p.pos && (
                          <span className="ns-posbadge" style={{ background: `var(--pos-${normalizePos(p.pos).toLowerCase()})` }}>
                            {normalizePos(p.pos)}
                          </span>
                        )}
                      </td>
                      <td className="ns-team ns-c-team">{p.team || '—'}</td>
                      {hasAdp && <td className="ns-num">{p.adp != null ? Math.round(p.adp * 10) / 10 : '—'}</td>}
                      {hasBye && <td className="ns-num">{p.bye || '—'}</td>}
                      {hasValue && <td className="ns-num">{Math.round(p.value).toLocaleString('de-DE')}</td>}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <AdviceDialog
        open={adviceOpen}
        onClose={() => setAdviceOpen(false)}
        loading={adviceLoading}
        advice={advice}
        error={adviceError}
        warnings={adviceWarnings}
        usage={adviceUsage}
        model={adviceModel}
        myNextPick={myNextPick}
        onRecompute={() => askAdvice(true)}
      />
      <ApiKeyDialog
        open={keyDialogOpen}
        onClose={() => { setKeyDialogOpen(false); setPendingAskAfterKey(false); setKeyValidationError(''); setKeyValidating(false) }}
        onSaved={handleKeySaved}
        validating={keyValidating}
        validationError={keyValidationError}
      />

      {inspOpen && (
        <aside className="ns-inspector" aria-label="Details">
          <div className="ns-insp-tabs" role="tablist">
            {[['player', 'Spieler'], ['roster', 'Roster'], ['draft', 'Draft']].map(([id, label]) => (
              <button
                key={id}
                role="tab"
                aria-selected={tab === id}
                className={cx('ns-insp-tab', tab === id && 'is-on')}
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            ))}
          </div>
          {tab === 'player' && (
            <PlayerPanel
              p={selected}
              pref={getPreference(playerPrefs, selected)}
              onPref={(pl, v) => setPlayerPrefs((prev) => setPreference(prev, pl, v, draftMode))}
            />
          )}
          {tab === 'roster' && (
            <RosterPanel livePicks={livePicks} meUserId={meUserId} draftSlot={draftSlot} teamsCount={teamsCount} effRoster={effRoster} />
          )}
          {tab === 'draft' && (
            <DraftPanel draft={draft} livePicks={livePicks} teamsCount={teamsCount} draftSlot={draftSlot} ownerLabels={ownerLabels} onSearch={setSearchQuery} />
          )}
        </aside>
      )}
    </div>
  )
}

function PlayerPanel({ p, pref, onPref }) {
  const [news, setNews] = useState(null)
  const [newsState, setNewsState] = useState('idle')

  useEffect(() => {
    if (!p?.name) { setNews(null); setNewsState('idle'); return }
    let cancelled = false
    setNewsState('loading')
    fetch(`/api/news/player?name=${encodeURIComponent(p.name)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => { if (!cancelled) { setNews(d.items || []); setNewsState('ok') } })
      .catch(() => { if (!cancelled) { setNews([]); setNewsState('error') } })
    return () => { cancelled = true }
  }, [p?.name])

  if (!p) return <div className="ns-empty">Kein Spieler ausgewählt.</div>


  return (
    <>
      <div className="ns-insp-head">
        <div className="ns-insp-title">
          <span className="ns-insp-name">{p.name}</span>
          <a className="ns-extlink" href={FP_PLAYER(p.name)} target="_blank" rel="noreferrer" title="Auf FantasyPros öffnen">
            <img src="/fantasypros.ico" alt="" /> FantasyPros
          </a>
        </div>
        <div className="ns-insp-sub">
          {p.pos && (
            <span className="ns-posbadge" style={{ background: `var(--pos-${normalizePos(p.pos).toLowerCase()})` }}>
              {normalizePos(p.pos)}
            </span>
          )}
          <span>{p.team || '—'}</span>
          {p.age ? <><span className="ns-crumb-sep">·</span><span>{p.age} J.</span></> : null}
          {p.rk ? <><span className="ns-crumb-sep">·</span><span>Rang {p.rk}</span></> : null}
        </div>
        {p.injury_status && (
          <div className={cx('ns-statusline', p.injury_status !== 'Questionable' ? 'is-out' : 'is-warn')}>
            <Icon name="warning" size={12} />
            <span>{p.injury_status === 'Questionable' ? 'Fraglich' : p.injury_status}{p.injury_body_part ? ` · ${p.injury_body_part}` : ''}</span>
          </div>
        )}
        {p.status && (
          <div className="ns-statusline">
            <Icon name="check" size={12} />
            <span>Bereits gedraftet{p.pick_no ? ` — Pick ${p.pick_no}` : ''}</span>
          </div>
        )}
      </div>

      <div className="ns-stats">
        <div className="ns-stat">
          <div className="ns-stat-k">ADP</div>
          <div className="ns-stat-v">{p.adp != null ? Math.round(p.adp * 10) / 10 : '—'}</div>
        </div>
        <div className="ns-stat">
          <div className="ns-stat-k">Bye</div>
          <div className="ns-stat-v">{p.bye || '—'}</div>
        </div>
        <div className="ns-stat">
          <div className="ns-stat-k">Wert</div>
          <div className="ns-stat-v">{p.value != null ? Math.round(p.value).toLocaleString('de-DE') : '—'}</div>
        </div>
      </div>

      <div className="ns-sect">
        <div className="ns-sect-h">
          <span>Aus dem Netz</span>
          <span className="ns-sect-meta">
            {newsState === 'loading' ? 'lädt …' : newsState === 'error' ? 'nicht erreichbar' : news?.length ? 'FantasyPros' : 'keine Treffer'}
          </span>
        </div>
        {newsState === 'loading' ? (
          <>
            <div className="ns-sk" style={{ width: '92%' }} />
            <div className="ns-sk" style={{ width: '78%' }} />
            <div className="ns-sk" style={{ width: '85%' }} />
          </>
        ) : news?.length ? (
          news.map((n, i) => (
            <article key={i} className="ns-news">
              <div className="ns-news-meta">{n.date || 'unbekannt'}{n.author ? ` · ${n.author}` : ''}</div>
              <div className="ns-news-text">
                {n.url
                  ? <a className="ns-news-link" href={n.url} target="_blank" rel="noreferrer">{n.headline}</a>
                  : <b>{n.headline}</b>}
                {n.body ? <> — {n.body}</> : null}
              </div>
              {n.impact && <div className="ns-news-impact"><b>Fantasy Impact</b> {n.impact}</div>}
            </article>
          ))
        ) : (
          <div className="ns-news-empty">
            {newsState === 'error'
              ? 'News-Dienst nicht erreichbar (läuft npm run dev:all?).'
              : `Keine aktuellen Meldungen zu ${String(p.name).split(' ')[0]}.`}
          </div>
        )}
      </div>

      <div className="ns-actions">
        <button
          className={cx('ns-btn', pref === PlayerPreference.FAVORITE && 'ns-btn--primary')}
          onClick={() => onPref(p, pref === PlayerPreference.FAVORITE ? null : PlayerPreference.FAVORITE)}
          title="Im Board bevorzugen"
        >
          <Icon name="star" size={13} /> Favorit
        </button>
        <button
          className={cx('ns-btn', pref === PlayerPreference.AVOID && 'ns-btn--primary')}
          onClick={() => onPref(p, pref === PlayerPreference.AVOID ? null : PlayerPreference.AVOID)}
          title="Im Board abwerten"
        >
          <Icon name="eye-off" size={13} /> Meiden
        </button>
      </div>
    </>
  )
}

function RosterPanel({ livePicks, meUserId, draftSlot, teamsCount, effRoster }) {
  const mine = useMemo(
    () => (livePicks || []).filter(
      (p) => (meUserId && p.picked_by === meUserId) || (draftSlot && Number(p.draft_slot) === Number(draftSlot))
    ),
    [livePicks, meUserId, draftSlot]
  )
  const byPos = useMemo(() => {
    const m = {}
    for (const p of mine) {
      const pos = normalizePos(p.metadata?.position) || '?'
      ;(m[pos] ||= []).push(p)
    }
    return m
  }, [mine])

  const want = useMemo(() => {
    const r = effRoster || {}
    return { QB: Number(r.QB) || 1, RB: Number(r.RB) || 2, WR: Number(r.WR) || 3, TE: Number(r.TE) || 1 }
  }, [effRoster])

  if (!mine.length) {
    return (
      <>
        <div className="ns-insp-head">
          <div className="ns-insp-name">Dein Roster</div>
          <div className="ns-insp-sub">
            <span>Slot {draftSlot || '—'}</span>
            <span className="ns-crumb-sep">·</span>
            <span>{teamsCount || '—'} Teams</span>
          </div>
        </div>
        <div className="ns-empty">Noch keine eigenen Picks in diesem Draft.</div>
      </>
    )
  }

  return (
    <>
      <div className="ns-insp-head">
        <div className="ns-insp-name">Dein Roster</div>
        <div className="ns-insp-sub">
          <span>Slot {draftSlot || '—'}</span>
          <span className="ns-crumb-sep">·</span>
          <span>{mine.length} Picks</span>
        </div>
      </div>

      <div className="ns-sect">
        <div className="ns-sect-h"><span>Bedarf</span></div>
        <div className="ns-needs">
          {['QB', 'RB', 'WR', 'TE'].map((pos) => {
            const have = (byPos[pos] || []).length
            const level = have >= want[pos] ? 'good' : have === 0 ? 'bad' : 'warn'
            return (
              <div key={pos} className={cx('ns-need', `is-${level}`)}>
                <span className="ns-need-pos">{pos}</span>
                <span className="ns-need-val">{have}/{want[pos]}</span>
              </div>
            )
          })}
        </div>
      </div>

      <div className="ns-sect">
        <div className="ns-sect-h"><span>Picks</span></div>
        {mine
          .slice()
          .sort((a, b) => (a.pick_no || 0) - (b.pick_no || 0))
          .map((p) => {
            const pos = normalizePos(p.metadata?.position) || '?'
            const name = `${p.metadata?.first_name || ''} ${p.metadata?.last_name || ''}`.trim()
            return (
              <div key={p.pick_no} className="ns-rrow">
                <span className="ns-rslot">{p.round}.{String(p.draft_slot).padStart(2, '0')}</span>
                <span className="ns-posbadge" style={{ background: `var(--pos-${pos.toLowerCase()})` }}>{pos}</span>
                {name
                  ? <a className="ns-rname" href={FP_PLAYER(name)} target="_blank" rel="noreferrer">{name}</a>
                  : <span className="ns-rname">—</span>}
                <span className="ns-team">{p.metadata?.team}</span>
              </div>
            )
          })}
      </div>
    </>
  )
}

function DraftPanel({ draft, livePicks, teamsCount, draftSlot, ownerLabels, onSearch }) {
  const teams = Number(teamsCount) || Number(draft?.settings?.teams) || 12
  const rounds = Number(draft?.settings?.rounds) || 0
  const completed = livePicks?.length || 0
  const upcoming = completed + 1
  const recent = (livePicks || []).slice().sort((a, b) => (b.pick_no || 0) - (a.pick_no || 0)).slice(0, 12)

  if (!draft) return <div className="ns-empty">Kein Draft ausgewählt.</div>

  return (
    <>
      <div className="ns-insp-head">
        <div className="ns-insp-name">{draft.metadata?.name || 'Draft'}</div>
        <div className="ns-insp-sub">
          <span>{draft.type || 'snake'}</span>
          <span className="ns-crumb-sep">·</span>
          <span>{teams} Teams</span>
          {rounds ? <><span className="ns-crumb-sep">·</span><span>{rounds} Runden</span></> : null}
        </div>
      </div>
      <div className="ns-stats">
        <div className="ns-stat">
          <div className="ns-stat-k">Am Zug</div>
          <div className="ns-stat-v">
            {Math.floor((upcoming - 1) / teams) + 1}.{String(((upcoming - 1) % teams) + 1).padStart(2, '0')}
          </div>
        </div>
        <div className="ns-stat">
          <div className="ns-stat-k">Dein Slot</div>
          <div className="ns-stat-v">{draftSlot || '—'}</div>
        </div>
        <div className="ns-stat">
          <div className="ns-stat-k">Picks</div>
          <div className="ns-stat-v">{completed}</div>
        </div>
      </div>
      <div className="ns-sect">
        <div className="ns-sect-h"><span>Letzte Picks</span></div>
        {recent.length === 0 && <div className="ns-news-empty">Noch keine Picks.</div>}
        {recent.map((p) => {
          const pos = normalizePos(p.metadata?.position) || '?'
          const owner = ownerLabels?.get(`user:${p.picked_by}`) || ownerLabels?.get(`slot:${p.draft_slot}`) || `Slot ${p.draft_slot}`
          const name = `${p.metadata?.first_name || ''} ${p.metadata?.last_name || ''}`.trim()
          return (
            <div key={p.pick_no} className="ns-rrow">
              <span className="ns-rslot">{p.round}.{String(p.draft_slot).padStart(2, '0')}</span>
              <span className="ns-posbadge" style={{ background: `var(--pos-${pos.toLowerCase()})` }}>{pos}</span>
              <button className="ns-rname ns-rname-btn" onClick={() => onSearch?.(name)} title="Im Board suchen">{name}</button>
              <span className="ns-team">{owner}</span>
            </div>
          )
        })}
      </div>
    </>
  )
}
