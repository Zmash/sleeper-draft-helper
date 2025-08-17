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

  const fileRef = useRef(null)
  const [csvFileName, setCsvFileName] = useState('')

  const selectedLeague = useMemo(() => {
    if (!Array.isArray(availableLeagues)) return null
    return availableLeagues.find(l => String(l.league_id) === String(selectedLeagueId)) || null
  }, [availableLeagues, selectedLeagueId])

  const selectedDraft = useMemo(() => {
    if (!Array.isArray(availableDrafts)) return null
    return availableDrafts.find(d => String(d.draft_id) === String(selectedDraftId)) || null
  }, [availableDrafts, selectedDraftId])

  // Source of truth: DRAFT if present; else league; else defaults
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
        scoring_settings: null, // nicht aus Liga ziehen wenn Draft existiert
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

  // Save & broadcast so App/BoardSection re-render live
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

  // CSV file import
  function triggerPickFile(){ fileRef.current?.click() }
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

  return (
    <section className="card">
      <h2>Setup</h2>
      <p className="muted">Connect Sleeper, select your draft, and import FantasyPros rankings.</p>

      {/* Account & Season */}
      <div className="grid3">
        <label className="field">
          <span>Sleeper Username</span>
          <div className="row" style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
            <input
              value={sleeperUsername || ''}
              onChange={(e) => { const v = e.target.value; setSleeperUsername(v); saveToLocalStorage({ username: v }) }}
              placeholder="yourName123"
              autoComplete="off"
              style={{ flex:'1 1 240px', minWidth:0 }}
            />
            <button
              className="btn"
              onClick={async () => {
                try {
                  const id = await resolveUserId()
                  if (id) { setSleeperUserId(id); saveToLocalStorage({ userId: id }); alert('User resolved: ' + id) }
                } catch (e) { alert('Failed to resolve user id: ' + (e.message || e)) }
              }}
            >
              Resolve user
            </button>
          </div>
        </label>

        <label className="field">
          <span>Season</span>
          <div className="row" style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
            <input
              type="number"
              value={seasonYear || ''}
              onChange={(e) => { const v = Number(e.target.value || 0); setSeasonYear(v); saveToLocalStorage({ year: v }) }}
              style={{ width:120, minWidth:0 }}
            />
            <button className="btn ghost" onClick={async () => { try { await loadLeagues() } catch (e) { alert('Failed loading leagues: ' + (e.message || e)) } }}>
              Load leagues
            </button>
          </div>
        </label>

        <label className="field">
          <span>League</span>
          <select
            value={selectedLeagueId || ''}
            onChange={(e) => {
              const val = e.target.value
              setSelectedLeagueId(val)
              saveToLocalStorage({ leagueId: val })
              if (val) loadDraftOptions(val)
            }}
          >
            <option value="" disabled>— select —</option>
            {(availableLeagues || []).map(l => (
              <option key={l.league_id} value={l.league_id}>
                {l.name || l.league_id}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Draft section */}
      <div className="grid3">
        <label className="field">
          <span>Draft</span>
          <div className="row" style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
            <select
              value={selectedDraftId || ''}
              onChange={(e) => {
                const val = e.target.value
                setSelectedDraftId(val)
                saveToLocalStorage({ draftId: val })
              }}
              style={{ flex:'1 1 280px', minWidth:0 }}
            >
              <option value="" disabled>— select —</option>
              {(availableDrafts || []).map(d => (
                <option key={d.draft_id} value={d.draft_id}>
                  {formatDraftLabel ? formatDraftLabel(d, leaguesById || new Map()) : (d?.metadata?.name || d.draft_id)}
                </option>
              ))}
            </select>
            <button
              className="btn ghost"
              onClick={async () => {
                if (!selectedLeagueId) { alert('Choose a league first.'); return }
                try { await loadDraftOptions(selectedLeagueId) } catch (e) { alert('Failed loading drafts: ' + (e.message || e)) }
              }}
            >
              Refresh drafts
            </button>
          </div>
        </label>

        <label className="field">
          <span>Attach Draft by ID or URL</span>
          <div className="row" style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
            <input
              value={manualDraftInput || ''}
              onChange={(e) => setManualDraftInput(e.target.value)}
              placeholder="https://sleeper.com/draft/nfl/123... or 123..."
              style={{ flex:'1 1 280px', minWidth:0 }}
            />
            <button
              className="btn"
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
        </label>

        {/* CSV Import (FILE) */}
        <label className="field">
          <span>FantasyPros CSV (file)</span>
          <div className="row" style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
            <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={onFileChange} style={{ display:'none' }} />
            <button className="btn" onClick={triggerPickFile}>Import CSV file</button>
            <span className="muted" title={csvFileName} style={{ marginLeft: 4, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {csvFileName || 'No file selected'}
            </span>
          </div>
          <div className="muted text-xs mt-1">You can also paste raw CSV below.</div>
        </label>
      </div>

      {/* CSV Paste Raw */}
      <label className="field">
        <span>FantasyPros CSV (paste raw)</span>
        <textarea
          value={csvRawText || ''}
          spellCheck={false}
          onChange={(e) => setCsvRawText(e.target.value)}
          placeholder="Paste the CSV content here..."
          rows={isAndroid ? 6 : 8}
        />
        <div className="row" style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
          <button className="btn" onClick={() => handleCsvLoad()}>Load CSV</button>
          <button className="btn ghost" onClick={() => { setCsvRawText(''); saveToLocalStorage({ csvRawText: '' }); setCsvFileName('') }}>
            Clear
          </button>
        </div>
      </label>

      <div className="divider" />

      {/* Format & Strategies */}
      <h3>Draft Format & Strategies</h3>
      <p className="muted">
        Values are taken from the selected draft. Anything missing falls back to sensible defaults.
        You can override below — this affects both Tips and AI.
      </p>

      <div className="grid3">
        <label className="field">
          <span>Scoring format</span>
          <select
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

        <label className="field">
          <span>Teams / Rounds / Type</span>
          <div className="row" style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', maxWidth:'100%' }}>
            <input
              type="number" min={2}
              value={overrides.teams ?? detected.teams ?? DEFAULTS.teams}
              onChange={e => setOverrides(o => ({ ...o, teams: Number(e.target.value || 0) || null }))}
              style={{ width:80, minWidth:0 }}
              aria-label="Teams" title="Teams"
            />
            <input
              type="number" min={1}
              value={overrides.rounds ?? detected.rounds ?? DEFAULTS.rounds}
              onChange={e => setOverrides(o => ({ ...o, rounds: Number(e.target.value || 0) || null }))}
              style={{ width:80, minWidth:0 }}
              aria-label="Rounds" title="Rounds"
            />
            <select
              value={overrides.type ?? detected.type ?? DEFAULTS.type}
              onChange={e => setOverrides(o => ({ ...o, type: e.target.value || null }))}
              style={{ width:80, minWidth:0 }}
              aria-label="Draft type" title="Draft type"
            >
              <option value="snake">Snake</option>
              <option value="auction">Auction</option>
            </select>
          </div>
          <div className="muted text-xs mt-1">Detected: {(detected.teams ?? '—')} teams · {(detected.rounds ?? '—')} rounds · {(detected.type || '—')}</div>
        </label>
      </div>

      <label className="field">
        <span>Roster Positions (override)</span>
        <div className="muted text-xs mb-1">Detected:</div>
        <div className="flex flex-wrap gap-2 mb-2">
          {(detected.roster_positions || []).map((r, i) => (
            <span key={i} className="px-2 py-1 rounded border text-xs">{r}</span>
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
        <div className="row" style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', marginTop:8 }}>
          <button
            type="button"
            className="btn ghost"
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
          <span className="muted text-xs">Defaults: 12 teams, snake, PPR, no Superflex, roster: QB, 2×RB, 2×WR, TE, FLEX, DEF; 6×BN</span>
        </div>
      </label>

      <div className="mt-2">
        <span className="block mb-1">Draft Strategies</span>
        <div className="flex flex-wrap gap-2">
          {[
            { key:'balanced', label:'Balanced (default)' },
            { key:'hero_rb',  label:'Hero RB' },
            { key:'zero_rb',  label:'Zero RB' },
            { key:'elite_te', label:'Elite TE (or Punt)' },
            { key:'qb_early_sf', label:'Early QB (Superflex)' },
          ].map(s => {
            const active = (overrides.strategies || []).includes(s.key)
            return (
              <button
                key={s.key}
                type="button"
                className={`btn ${active ? '' : 'ghost'}`}
                onClick={() => {
                  setOverrides(o => {
                    const cur = new Set(o.strategies || [])
                    if (cur.has(s.key)) cur.delete(s.key); else cur.add(s.key)
                    return { ...o, strategies: Array.from(cur) }
                  })
                }}
                title={s.label}
              >
                {active ? '✓ ' : ''}{s.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="muted text-xs mt-3">
        Effective: <strong>{eff.scoring_type.toUpperCase()}</strong> · Superflex: <strong>{eff.superflex ? 'Yes' : 'No'}</strong> ·{' '}
        <strong>{eff.teams}</strong> teams · <strong>{eff.rounds}</strong> rounds · <strong>{eff.type}</strong>
      </div>
    </section>
  )
}
