import React, { useEffect, useMemo, useRef, useState } from 'react'
import { loadSetup, saveSetup } from '../services/storage'

const DEFAULTS = {
  teams: 12,
  type: 'snake',
  scoring_type: 'ppr',
  roster: ['QB','RB','RB','WR','WR','TE','FLEX','DEF','BN','BN','BN','BN','BN','BN'],
  rounds: 16,
}

function rosterFromDraftSettings(settings = {}) {
  const m = {
    slots_qb:'QB', slots_rb:'RB', slots_wr:'WR', slots_te:'TE', slots_k:'K', slots_def:'DEF',
    slots_flex:'FLEX', slots_wr_rb:'WR/RB', slots_wr_te:'WR/TE', slots_rb_te:'RB/TE',
    slots_super_flex:'SUPER_FLEX', slots_idp_flex:'IDP_FLEX', slots_dl:'DL', slots_lb:'LB', slots_db:'DB', slots_bn:'BN',
  }
  const out = []
  for (const [k,v] of Object.entries(settings||{})) {
    if (!k.startsWith('slots_')) continue
    const name = m[k]; const n = Number(v)
    if (!name || !Number.isFinite(n) || n<=0) continue
    for (let i=0;i<n;i++) out.push(name)
  }
  return out
}
function detectScoringTypeStrict(draftMeta = null) {
  const t = String(draftMeta?.metadata?.scoring_type || '').toLowerCase()
  return (t==='ppr'||t==='half_ppr'||t==='standard') ? t : null
}

export default function SetupForm(props) {
  const {
    sleeperUsername, sleeperUserId, seasonYear,
    availableLeagues, selectedLeagueId,
    availableDrafts, selectedDraftId, leaguesById,
    manualDraftInput, csvRawText, isAndroid,
    setSleeperUsername, setSleeperUserId, setSeasonYear,
    setSelectedLeagueId, setSelectedDraftId, setManualDraftInput, setCsvRawText,
    saveToLocalStorage, resolveUserId, loadLeagues, loadDraftOptions,
    attachDraftByIdOrUrl, handleCsvLoad, formatDraftLabel,
  } = props

  // --- UI State
  const [openStep, setOpenStep] = useState(1)
  const [showAttachAlt, setShowAttachAlt] = useState(false)
  const [showCsvAdvanced, setShowCsvAdvanced] = useState(false)
  const [showAdvancedFormat, setShowAdvancedFormat] = useState(false)
  const [busyResolveAndLoad, setBusyResolveAndLoad] = useState(false)

  // --- CSV
  const fileRef = useRef(null)
  const [csvFileName, setCsvFileName] = useState('')

  // --- Selections
  const selectedLeague = useMemo(() => {
    if (!Array.isArray(availableLeagues)) return null
    return availableLeagues.find(l => String(l.league_id) === String(selectedLeagueId)) || null
  }, [availableLeagues, selectedLeagueId])

  const selectedDraft = useMemo(() => {
    if (!Array.isArray(availableDrafts)) return null
    return availableDrafts.find(d => String(d.draft_id) === String(selectedDraftId)) || null
  }, [availableDrafts, selectedDraftId])

  // --- Detected vs Overrides
  const detected = useMemo(() => {
    if (selectedDraft) {
      const s = selectedDraft.settings || {}
      const roster = rosterFromDraftSettings(s)
      const scoring_type = detectScoringTypeStrict(selectedDraft) ?? DEFAULTS.scoring_type
      const teams  = Number(s.teams || selectedDraft.teams)   || DEFAULTS.teams
      const rounds = Number(s.rounds || selectedDraft.rounds) || DEFAULTS.rounds
      const type   = String(selectedDraft.type || DEFAULTS.type).toLowerCase()
      return {
        source: 'draft',
        roster_positions: roster.length ? roster : DEFAULTS.roster,
        scoring_type, teams, rounds, type,
        scoring_settings: null,
      }
    }
    const leagueRoster = selectedLeague?.roster_positions || selectedLeague?.settings?.roster_positions || []
    const rec = Number(selectedLeague?.scoring_settings?.rec)
    const leagueScoring = Number.isFinite(rec) ? (rec>=0.95?'ppr':(rec>=0.45?'half_ppr':'standard')) : DEFAULTS.scoring_type
    const teams = Number(selectedLeague?.total_rosters || selectedLeague?.league_size) || DEFAULTS.teams
    return {
      source: 'league_or_default',
      roster_positions: leagueRoster.length ? leagueRoster : DEFAULTS.roster,
      scoring_type: leagueScoring,
      teams, rounds: DEFAULTS.rounds, type: DEFAULTS.type,
      scoring_settings: selectedLeague?.scoring_settings || null,
    }
  }, [selectedDraft, selectedLeague])

  const [overrides, setOverrides] = useState(() => {
    const s = loadSetup()
    return s?.overrides || {
      scoring_type: null, superflex: null, roster_positions: null,
      strategies: ['balanced'], teams: null, rounds: null, type: null,
    }
  })

  // persist + broadcast (Board reagiert live)
  useEffect(() => {
    saveSetup({ overrides })
    window.dispatchEvent(new CustomEvent('sdh:setup-changed', { detail: overrides }))
  }, [JSON.stringify(overrides)])

  const eff = {
    scoring_type: overrides.scoring_type ?? detected.scoring_type,
    roster_positions: overrides.roster_positions ?? detected.roster_positions,
    superflex:
      overrides.superflex ??
      (overrides.roster_positions ?? detected.roster_positions).some(r => String(r).toUpperCase().includes('SUPER')),
    teams:  Number(overrides.teams  ?? detected.teams)  || DEFAULTS.teams,
    rounds: Number(overrides.rounds ?? detected.rounds) || DEFAULTS.rounds,
    type:   String(overrides.type   ?? detected.type).toLowerCase(),
  }

  // file import
  function onFileChange(e){
    const f = e?.target?.files?.[0]; if (!f) return
    setCsvFileName(f.name)
    const reader = new FileReader()
    reader.onload = () => {
      try { setCsvRawText(String(reader.result||'')); handleCsvLoad() }
      catch (err) { alert('Failed to read CSV: ' + (err?.message || err)) }
    }
    reader.readAsText(f)
  }

  // Combined action: resolve user -> load leagues
  async function handleResolveAndLoad() {
    try {
      setBusyResolveAndLoad(true)
      const id = await resolveUserId()
      if (id) {
        setSleeperUserId(id)
        saveToLocalStorage({ userId: id })
      }
      await loadLeagues()
      setOpenStep(2)
    } catch (e) {
      alert('Failed to resolve user or load leagues: ' + (e?.message || e))
    } finally {
      setBusyResolveAndLoad(false)
    }
  }

  const isStepOpen = (n) => openStep === n

  return (
    <section className="card">
      <h2>Setup</h2>
      <p className="muted">Connect Sleeper, pick your draft, import rankings — then confirm the summary.</p>

      <div className="setup-steps">

        {/* STEP 1 */}
        <div className={`step ${isStepOpen(1) ? '' : 'collapsed'}`}>
          <button className="step-header" onClick={() => setOpenStep(1)}>
            <span className="step-badge">1</span>
            <span className="step-title">Sleeper account & season</span>
            <span className="step-sub">Enter username, select season, fetch leagues</span>
          </button>
          <div className="step-body">
            <div className="form-row">
              <label className="field">
                <span>Username</span>
                <div className="row">
                  <input
                    className="control"
                    value={sleeperUsername || ''}
                    onChange={(e) => { const v = e.target.value; setSleeperUsername(v); saveToLocalStorage({ username: v }) }}
                    placeholder="yourName123"
                    autoComplete="off"
                  />
                </div>
              </label>

              <label className="field">
                <span>Season</span>
                <div className="row">
                  <input
                    className="control"
                    type="number"
                    value={seasonYear || ''}
                    onChange={(e) => { const v = Number(e.target.value || 0); setSeasonYear(v); saveToLocalStorage({ year: v }) }}
                  />
                  <button className="btn btn-primary control" onClick={handleResolveAndLoad} disabled={busyResolveAndLoad}>
                    {busyResolveAndLoad ? 'Loading…' : 'Resolve user & load leagues'}
                  </button>
                </div>
              </label>
            </div>
          </div>
          <div className="step-actions">
            <button className="btn btn-primary" onClick={() => setOpenStep(2)}>Next</button>
          </div>
        </div>

        {/* STEP 2 */}
        <div className={`step ${isStepOpen(2) ? '' : 'collapsed'}`}>
          <button className="step-header" onClick={() => setOpenStep(2)}>
            <span className="step-badge">2</span>
            <span className="step-title">Choose league & draft</span>
            <span className="step-sub">Select a league (optional), then pick a draft</span>
          </button>
          <div className="step-body">
            <div className="form-row">
              <label className="field">
                <span>League</span>
                <select
                  className="control"
                  value={selectedLeagueId || ''}
                  onChange={(e) => {
                    const val = e.target.value
                    setSelectedLeagueId(val)
                    saveToLocalStorage({ leagueId: val })
                    if (val) loadDraftOptions(val)
                  }}
                >
                  <option value="">— None —</option>
                  {(availableLeagues || []).map(l => (
                    <option key={l.league_id} value={l.league_id}>
                      {l.name || l.league_id}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>Draft</span>
                <div className="row">
                  <select
                    className="control"
                    value={selectedDraftId || ''}
                    onChange={(e) => {
                      const val = e.target.value
                      setSelectedDraftId(val)
                      saveToLocalStorage({ draftId: val })
                    }}
                  >
                    <option value="" disabled>— select —</option>
                    {(availableDrafts || []).map(d => (
                      <option key={d.draft_id} value={d.draft_id}>
                        {formatDraftLabel ? formatDraftLabel(d, leaguesById || new Map()) : (d?.metadata?.name || d.draft_id)}
                      </option>
                    ))}
                  </select>
                  <button
                    className="btn btn-secondary control"
                    onClick={async () => {
                      if (!selectedLeagueId) { alert('Pick a league first (or attach by ID/URL below).'); return }
                      try { await loadDraftOptions(selectedLeagueId) } catch (e) { alert('Failed loading drafts: ' + (e.message || e)) }
                    }}
                  >
                    Refresh drafts
                  </button>
                </div>

                <div className="collapse">
                  <button
                    type="button"
                    className={`collapse-toggle ${showAttachAlt ? 'is-open' : ''}`}
                    onClick={() => setShowAttachAlt(s => !s)}
                  >
                    {showAttachAlt ? 'Hide alternative' : 'Alternative: Attach draft by ID/URL'}
                  </button>
                  {showAttachAlt && (
                    <div className="collapse-body">
                      <div className="row">
                        <input
                          className="control"
                          value={manualDraftInput || ''}
                          onChange={(e) => setManualDraftInput(e.target.value)}
                          placeholder="https://sleeper.com/draft/nfl/123... or 123..."
                        />
                        <button
                          className="btn btn-primary control"
                          onClick={async () => {
                            if (!manualDraftInput) return
                            try {
                              const ok = await attachDraftByIdOrUrl(manualDraftInput)
                              if (ok) { setManualDraftInput(''); saveToLocalStorage({ manualDraftInput: '' }) }
                            } catch (e) { alert('Failed to attach draft: ' + (e.message || e)) }
                          }}
                        >
                          Attach
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </label>
            </div>
          </div>
          <div className="step-actions">
            <button className="btn btn-secondary" onClick={() => setOpenStep(1)}>Back</button>
            <button className="btn btn-primary" onClick={() => setOpenStep(3)}>Next</button>
          </div>
        </div>

        {/* STEP 3 */}
        <div className={`step ${isStepOpen(3) ? '' : 'collapsed'}`}>
          <button className="step-header" onClick={() => setOpenStep(3)}>
            <span className="step-badge">3</span>
            <span className="step-title">Import rankings</span>
            <span className="step-sub">Upload CSV or paste raw contents</span>
          </button>
          <div className="step-body">
            <div className="form-row">
              <label className="field">
                <span>FantasyPros CSV (file)</span>
                <div className="row">
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".csv,text/csv"
                    className="sr-only"
                    onChange={onFileChange}
                  />
                  <button className="btn btn-primary control" onClick={() => fileRef.current?.click()}>Choose CSV file</button>
                  <span className="muted text-ellipsis" title={csvFileName}>
                    {csvFileName || 'No file selected'}
                  </span>
                </div>

                <div className="collapse">
                  <button
                    type="button"
                    className={`collapse-toggle ${showCsvAdvanced ? 'is-open' : ''}`}
                    onClick={() => setShowCsvAdvanced(s => !s)}
                  >
                    {showCsvAdvanced ? 'Hide paste field' : 'Alternative: paste raw CSV'}
                  </button>
                  {showCsvAdvanced && (
                    <div className="collapse-body">
                      <textarea
                        value={csvRawText || ''}
                        spellCheck={false}
                        onChange={(e) => setCsvRawText(e.target.value)}
                        placeholder="Paste CSV content here…"
                        rows={isAndroid ? 6 : 8}
                      />
                      <div className="row">
                        <button className="btn btn-primary control" onClick={() => handleCsvLoad()}>Load CSV</button>
                        <button className="btn btn-secondary control" onClick={() => { setCsvRawText(''); saveToLocalStorage({ csvRawText: '' }); setCsvFileName('') }}>
                          Clear
                        </button>
                      </div>
                    </div>
                  )}
                </div>

              </label>
            </div>
          </div>
          <div className="step-actions">
            <button className="btn btn-secondary" onClick={() => setOpenStep(2)}>Back</button>
            <button className="btn btn-primary" onClick={() => setOpenStep(4)}>Next</button>
          </div>
        </div>

        {/* STEP 4 */}
        <div className={`step ${isStepOpen(4) ? '' : 'collapsed'}`}>
          <button className="step-header" onClick={() => setOpenStep(4)}>
            <span className="step-badge">4</span>
            <span className="step-title">Draft format & options</span>
            <span className="step-sub">Adjust detected values (optional)</span>
          </button>
          <div className="step-body">
            <div className="form-row">
              <label className="field">
                <span>Scoring</span>
                <select
                  className="control"
                  value={overrides.scoring_type ?? detected.scoring_type}
                  onChange={e => setOverrides(o => ({ ...o, scoring_type: e.target.value || null }))}
                >
                  <option value="ppr">PPR</option>
                  <option value="half_ppr">Half-PPR</option>
                  <option value="standard">Standard</option>
                </select>
                <div className="muted text-xs mt-1">Detected: {detected.scoring_type || '—'} (source: {detected.source})</div>
              </label>

              <label className="field">
                <span>Superflex</span>
                <select
                  className="control"
                  value={String(overrides.superflex ?? ((detected.roster_positions || []).some(r => String(r).toUpperCase().includes('SUPER'))))}
                  onChange={e => setOverrides(o => ({ ...o, superflex: e.target.value === 'true' }))}
                >
                  <option value="true">Enabled</option>
                  <option value="false">Disabled</option>
                </select>
                <div className="muted text-xs mt-1">
                  Detected: {(detected.roster_positions || []).some(r => String(r).toUpperCase().includes('SUPER')) ? 'Yes' : 'No'}
                </div>
              </label>
            </div>

            <div className="form-row">
              <label className="field">
                <span>Teams / Rounds / Type</span>
                <div className="row">
                  <input
                    className="control"
                    type="number" min={2}
                    value={overrides.teams ?? detected.teams ?? DEFAULTS.teams}
                    onChange={e => setOverrides(o => ({ ...o, teams: Number(e.target.value || 0) || null }))}
                    aria-label="Teams" title="Teams"
                  />
                  <input
                    className="control"
                    type="number" min={1}
                    value={overrides.rounds ?? detected.rounds ?? DEFAULTS.rounds}
                    onChange={e => setOverrides(o => ({ ...o, rounds: Number(e.target.value || 0) || null }))}
                    aria-label="Rounds" title="Rounds"
                  />
                  <select
                    className="control"
                    value={overrides.type ?? detected.type ?? DEFAULTS.type}
                    onChange={e => setOverrides(o => ({ ...o, type: e.target.value || null }))}
                    aria-label="Draft type" title="Draft type"
                  >
                    <option value="snake">Snake</option>
                    <option value="auction">Auction</option>
                  </select>
                </div>
                <div className="muted text-xs mt-1">Detected: {(detected.teams ?? '—')} teams · {(detected.rounds ?? '—')} rounds · {(detected.type || '—')}</div>
              </label>
            </div>

            <div className="collapse">
              <button
                type="button"
                className={`collapse-toggle ${showAdvancedFormat ? 'is-open' : ''}`}
                onClick={() => setShowAdvancedFormat(s => !s)}
              >
                {showAdvancedFormat ? 'Hide advanced options' : 'Show advanced options'}
              </button>

              {showAdvancedFormat && (
                <div className="collapse-body">
                  <label className="field">
                    <span>Roster positions (override — optional)</span>
                    <div className="muted text-xs mb-1">Detected:</div>
                    <div className="chips">
                      {(detected.roster_positions || []).map((r, i) => (
                        <span key={i} className="chip chip--small">{r}</span>
                      ))}
                    </div>

                    <textarea
                      rows={2}
                      placeholder='Optional override, comma separated: QB,RB,RB,WR,WR,TE,FLEX,SUPER_FLEX'
                      defaultValue=""
                      onBlur={(e) => {
                        const raw = (e.target.value || '').trim()
                        if (!raw) { setOverrides(o => ({ ...o, roster_positions: null })); return }
                        const arr = raw.split(',').map(s => s.trim().toUpperCase()).filter(Boolean)
                        setOverrides(o => ({ ...o, roster_positions: arr.length ? arr : null }))
                      }}
                    />
                    <div className="muted text-xs mt-1">
                      Effective: {(overrides.roster_positions ?? detected.roster_positions)?.join(', ') || '—'}
                    </div>

                    <div className="row mt-2">
                      <button
                        type="button"
                        className="btn btn-secondary control"
                        onClick={() => {
                          setOverrides(o => ({
                            ...o,
                            scoring_type: DEFAULTS.scoring_type,
                            superflex: false,
                            roster_positions: DEFAULTS.roster,
                            teams: DEFAULTS.teams,
                            rounds: DEFAULTS.rounds,
                            type: DEFAULTS.type,
                          }))
                        }}
                      >
                        Apply defaults
                      </button>
                      <span className="muted text-xs">Defaults: 12 teams · snake · PPR · no Superflex · roster: QB, 2×RB, 2×WR, TE, FLEX, DEF; 6×BN</span>
                    </div>
                  </label>
                </div>
              )}
            </div>
          </div>
          <div className="step-actions">
            <button className="btn btn-secondary" onClick={() => setOpenStep(3)}>Back</button>
            <button className="btn btn-primary" onClick={() => setOpenStep(5)}>Next</button>
          </div>
        </div>

        {/* STEP 5 */}
        <div className={`step ${isStepOpen(5) ? '' : 'collapsed'}`}>
          <button className="step-header" onClick={() => setOpenStep(5)}>
            <span className="step-badge">5</span>
            <span className="step-title">Summary</span>
            <span className="step-sub">Quick check before drafting</span>
          </button>
          <div className="step-body">
            <div className="summary-card">
              <div className="summary-grid">
                <div className="summary-item"><span className="k">League</span><span className="v">{selectedLeague?.name || '—'}</span></div>
                <div className="summary-item"><span className="k">Draft</span><span className="v">{selectedDraft ? (formatDraftLabel ? formatDraftLabel(selectedDraft, leaguesById || new Map()) : (selectedDraft?.metadata?.name || selectedDraft?.draft_id)) : '—'}</span></div>
                <div className="summary-item"><span className="k">Scoring</span><span className="v">{String(eff.scoring_type).toUpperCase()}</span></div>
                <div className="summary-item"><span className="k">Superflex</span><span className="v">{eff.superflex ? 'Yes' : 'No'}</span></div>
                <div className="summary-item"><span className="k">Teams</span><span className="v">{eff.teams}</span></div>
                <div className="summary-item"><span className="k">Rounds</span><span className="v">{eff.rounds}</span></div>
                <div className="summary-item"><span className="k">Type</span><span className="v">{eff.type}</span></div>
                <div className="summary-item"><span className="k">Roster</span><span className="v">{(eff.roster_positions || []).join(', ')}</span></div>
              </div>
            </div>
          </div>
          <div className="step-actions">
            <button className="btn btn-secondary" onClick={() => setOpenStep(4)}>Back</button>
            <button className="btn btn-primary" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>Done</button>
          </div>
        </div>

      </div>
    </section>
  )
}
