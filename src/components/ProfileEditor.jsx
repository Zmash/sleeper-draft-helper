import React, { useState } from 'react'
import { FORMAT_DEFAULTS } from '../services/draftFormat'
import { upsertProfileOverrides, upsertProfileStrategy, loadPrinciples, savePrinciples } from '../services/profileStore'
import StrategySection from './StrategySection'

export default function ProfileEditor({ profile, detected, strategyFormat, season, draftMode, onProfileChange }) {
  const [showAdvancedFormat, setShowAdvancedFormat] = useState(false)
  const [principles, setPrinciples] = useState(() => loadPrinciples())

  const overrides = profile.overrides
  const eff = {
    scoring_type: overrides.scoring_type ?? detected.scoringType,
    superflex: overrides.superflex ?? detected.isSuperflex,
    teams: Number(overrides.teams ?? detected.teams) || FORMAT_DEFAULTS.teams,
    rounds: Number(overrides.rounds ?? detected.rounds) || FORMAT_DEFAULTS.rounds,
    type: String(overrides.type ?? detected.type).toLowerCase(),
  }

  function patchOverrides(patch) {
    const updated = upsertProfileOverrides(profile, patch)
    window.dispatchEvent(new CustomEvent('sdh:setup-changed', { detail: updated }))
    onProfileChange(updated)
  }

  function saveStrategy(strategyPatch) {
    const updated = upsertProfileStrategy(profile, strategyPatch)
    window.dispatchEvent(new CustomEvent('sdh:setup-changed', { detail: updated }))
    onProfileChange(updated)
  }

  function handlePrinciplesChange(text) {
    setPrinciples(text)
    savePrinciples(text)
    window.dispatchEvent(new CustomEvent('sdh:setup-changed'))
  }

  return (
    <div className="card profile-editor">
      <div className="collapse">
        <button
          type="button"
          className={`collapse-toggle ${showAdvancedFormat ? 'is-open' : ''}`}
          onClick={() => setShowAdvancedFormat(s => !s)}
        >
          Erkannt: {eff.teams} Teams · {eff.type} · {String(eff.scoring_type).toUpperCase()}
          {eff.superflex ? ' · Superflex' : ' · kein Superflex'} · Anpassen
        </button>
        {showAdvancedFormat && (
          <div className="collapse-body">
            <div className="form-row">
              <label className="field">
                <span>Scoring</span>
                <select
                  className="control"
                  value={overrides.scoring_type ?? detected.scoringType}
                  onChange={e => patchOverrides({ scoring_type: e.target.value || null })}
                >
                  <option value="ppr">PPR</option>
                  <option value="half_ppr">Half-PPR</option>
                  <option value="standard">Standard</option>
                </select>
                <div className="muted text-xs mt-1">Erkannt: {detected.scoringType || '—'} (Quelle: {detected.source})</div>
              </label>

              <label className="field">
                <span>Superflex</span>
                <select
                  className="control"
                  value={String(overrides.superflex ?? detected.isSuperflex)}
                  onChange={e => patchOverrides({ superflex: e.target.value === 'true' })}
                >
                  <option value="true">An</option>
                  <option value="false">Aus</option>
                </select>
                <div className="muted text-xs mt-1">Erkannt: {detected.isSuperflex ? 'Ja' : 'Nein'}</div>
              </label>
            </div>

            <div className="form-row">
              <label className="field">
                <span>Teams / Runden / Typ</span>
                <div className="row">
                  <input
                    className="control" type="number" min={2}
                    value={overrides.teams ?? detected.teams ?? FORMAT_DEFAULTS.teams}
                    onChange={e => patchOverrides({ teams: Number(e.target.value || 0) || null })}
                    aria-label="Teams" title="Teams"
                  />
                  <input
                    className="control" type="number" min={1}
                    value={overrides.rounds ?? detected.rounds ?? FORMAT_DEFAULTS.rounds}
                    onChange={e => patchOverrides({ rounds: Number(e.target.value || 0) || null })}
                    aria-label="Runden" title="Runden"
                  />
                  <select
                    className="control"
                    value={overrides.type ?? detected.type ?? FORMAT_DEFAULTS.type}
                    onChange={e => patchOverrides({ type: e.target.value || null })}
                    aria-label="Draft-Typ" title="Draft-Typ"
                  >
                    <option value="snake">Snake</option>
                    <option value="linear">Linear</option>
                    <option value="auction">Auction</option>
                  </select>
                </div>
                <div className="muted text-xs mt-1">Erkannt: {(detected.teams ?? '—')} Teams · {(detected.rounds ?? '—')} Runden · {(detected.type || '—')}</div>
              </label>
            </div>

            <label className="field">
              <span>Roster-Positionen (Override — optional)</span>
              <div className="muted text-xs mb-1">Erkannt:</div>
              <div className="chips">
                {(detected.rosterPositions || []).map((r, i) => <span key={i} className="chip chip--small">{r}</span>)}
              </div>
              <textarea
                rows={2}
                placeholder="Optionaler Override, kommagetrennt: QB,RB,RB,WR,WR,TE,FLEX,SUPER_FLEX"
                defaultValue=""
                onBlur={(e) => {
                  const raw = (e.target.value || '').trim()
                  if (!raw) { patchOverrides({ roster_positions: null }); return }
                  const arr = raw.split(',').map(s => s.trim().toUpperCase()).filter(Boolean)
                  patchOverrides({ roster_positions: arr.length ? arr : null })
                }}
              />
              <div className="muted text-xs mt-1">
                Effektiv: {(overrides.roster_positions ?? detected.rosterPositions)?.join(', ') || '—'}
              </div>
              <div className="row mt-2">
                <button
                  type="button" className="btn btn-secondary control"
                  onClick={() => patchOverrides({
                    scoring_type: FORMAT_DEFAULTS.scoringType, superflex: false,
                    roster_positions: FORMAT_DEFAULTS.rosterPositions,
                    teams: FORMAT_DEFAULTS.teams, rounds: FORMAT_DEFAULTS.rounds, type: FORMAT_DEFAULTS.type,
                  })}
                >
                  Standardwerte übernehmen
                </button>
                <span className="muted text-xs">Standard: 12 Teams · Snake · PPR · kein Superflex · Roster: QB, 2×RB, 2×WR, TE, FLEX, DEF; 6×BN</span>
              </div>
            </label>
          </div>
        )}
      </div>

      <StrategySection
        profile={profile}
        onSaveStrategy={saveStrategy}
        principles={principles}
        onSavePrinciples={handlePrinciplesChange}
        format={{
          teams: strategyFormat.teams, scoringType: strategyFormat.scoringType,
          superflex: strategyFormat.isSuperflex, rosterPositions: strategyFormat.rosterPositions,
        }}
        season={season}
        draftMode={draftMode}
        draftSlot={null}
      />
    </div>
  )
}
