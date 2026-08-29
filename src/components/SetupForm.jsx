import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { deriveFormat } from '../services/draftFormat'
import { loadPreferences, clearPreferencesForMode } from '../services/preferences'
import ProfileBadgeCard from './ProfileBadgeCard'
import ProfileEditor from './ProfileEditor'
import SyncSection from './SyncSection'
import Icon from './Icon'

// Scoring-Label fuer den FantasyPros-Button: der Import laedt die zum aktiven
// Format passende Cheatsheet-Variante (half_ppr -> half etc.), das Label soll
// das sichtbar machen statt eines generischen "Consensus".
function fpScoringLabel(scoringType) {
  if (scoringType === 'half_ppr') return 'Half-PPR'
  if (scoringType === 'standard') return 'Standard'
  if (scoringType === 'ppr') return 'PPR'
  return String(scoringType || 'PPR').toUpperCase()
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
    attachDraftByIdOrUrl, handleCsvLoad, handleAutoImport, handleFantasyProsImport, handleKtcRookieImport, formatDraftLabel,
    draftMode, setDraftMode, selectedLeague: selectedLeagueProp,
    profile, profileDeviations, isNewProfile, allProfiles,
    onProfileChange, onRebindProfile, onRenameProfile,
  } = props

  const navigate = useNavigate()

  // --- UI State
  const [showAttachAlt, setShowAttachAlt] = useState(false)
  const [showCsvAdvanced, setShowCsvAdvanced] = useState(false)
  const [busyResolveAndLoad, setBusyResolveAndLoad] = useState(false)
  const [busyAutoImport, setBusyAutoImport] = useState(false)
  const [busyKtcImport, setBusyKtcImport] = useState(false)
  const [busyFpImport, setBusyFpImport] = useState(false)
  const [formError, setFormError] = useState(null)

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

  // --- Detected vs Overrides (Overrides kommen jetzt aus dem Profil, s. SetupPage)
  const detected = useMemo(
    () => deriveFormat({ draft: selectedDraft, league: selectedLeague, overrides: {} }),
    [selectedDraft, selectedLeague]
  )

  const resolvedFormat = useMemo(
    () => deriveFormat({ draft: selectedDraft, league: selectedLeague, overrides: profile.overrides }),
    [selectedDraft, selectedLeague, profile.overrides]
  )

  const eff = {
    teams: resolvedFormat.teams, type: resolvedFormat.type,
    scoring_type: resolvedFormat.scoringType, superflex: resolvedFormat.isSuperflex,
  }

  // file import
  function onFileChange(e){
    const f = e?.target?.files?.[0]; if (!f) return
    setCsvFileName(f.name)
    const reader = new FileReader()
    reader.onload = () => {
      try { setCsvRawText(String(reader.result||'')); handleCsvLoad() }
      catch (err) { setFormError(`CSV konnte nicht gelesen werden: ${err?.message || err}. Prüfe, ob es eine gültige FantasyPros-CSV ist.`) }
    }
    reader.readAsText(f)
  }

  // Combined action: resolve user -> load leagues
  async function handleResolveAndLoad() {
    try {
      setBusyResolveAndLoad(true)
      setFormError(null)
      const id = await resolveUserId()
      if (id) {
        setSleeperUserId(id)
        saveToLocalStorage({ userId: id })
      }
      await loadLeagues()
    } catch (e) {
      setFormError(`Ligen konnten nicht geladen werden: ${e?.message || e}. Prüfe den Sleeper-Username und deine Verbindung.`)
    } finally {
      setBusyResolveAndLoad(false)
    }
  }

  function handleClearMarkings() {
    const label = draftMode === 'rookie' ? 'Rookie Draft' : 'Redraft'
    if (!window.confirm(`Alle Fav/Avoid-Markierungen für ${label} löschen? Das kann nicht rückgängig gemacht werden.`)) return
    clearPreferencesForMode(loadPreferences(), draftMode)
  }

  return (
    <section className="card">
      <h2>Setup</h2>
      <p className="muted">Liga & Draft auswählen, Rankings importieren — dann loslegen.</p>

      {!sleeperUserId && (
        <div className="setup-no-account-banner">
          Kein Sleeper-Account verbunden.{' '}
          <a href="/dashboard" onClick={e => { e.preventDefault(); window.history.back() }}>
            Bitte auf dem Dashboard verbinden.
          </a>
        </div>
      )}

      {formError && <div className="form-error" role="alert">{formError}</div>}

      <div className="summary-card summary-card--sticky">
        <div className="summary-grid">
          <div className="summary-item"><span className="k">Liga</span><span className="v">{selectedLeague?.name || '—'}</span></div>
          <div className="summary-item"><span className="k">Draft</span><span className="v">{selectedDraft ? (formatDraftLabel ? formatDraftLabel(selectedDraft, leaguesById || new Map()) : selectedDraft.draft_id) : '—'}</span></div>
          <div className="summary-item"><span className="k">Modus</span><span className="v">{draftMode === 'rookie' ? 'Rookie Draft (Dynasty)' : 'Redraft'}</span></div>
          <div className="summary-item"><span className="k">Format</span><span className="v">{eff.teams} Teams · {eff.type} · {String(eff.scoring_type).toUpperCase()}{eff.superflex ? ' · Superflex' : ''}</span></div>
        </div>
      </div>

      <div className="card">
        <h3>Liga & Draft</h3>
        <div className="form-row">
          <label className="field">
            <span>Liga</span>
            <div className="row">
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
                <option value="">— keine —</option>
                {(availableLeagues || []).map(l => (
                  <option key={l.league_id} value={l.league_id}>{l.name || l.league_id}</option>
                ))}
              </select>
              <button className="btn btn-secondary control" disabled={busyResolveAndLoad} onClick={handleResolveAndLoad} title="Ligen erneut von Sleeper laden">
                {busyResolveAndLoad ? '…' : 'Ligen neu laden'}
              </button>
            </div>
          </label>

          <label className="field">
            <span>Draft</span>
            <div className="row">
              <select
                className="control"
                value={selectedDraftId || ''}
                onChange={(e) => { const val = e.target.value; setSelectedDraftId(val); saveToLocalStorage({ draftId: val }) }}
              >
                <option value="" disabled>— auswählen —</option>
                {(availableDrafts || []).map(d => (
                  <option key={d.draft_id} value={d.draft_id}>{formatDraftLabel ? formatDraftLabel(d, leaguesById || new Map()) : (d?.metadata?.name || d.draft_id)}</option>
                ))}
              </select>
              <button
                className="btn btn-secondary control"
                onClick={async () => {
                  if (!selectedLeagueId) { setFormError('Wähle zuerst eine Liga — oder hänge den Draft unten per ID/Link an.'); return }
                  setFormError(null)
                  try { await loadDraftOptions(selectedLeagueId) } catch (e) { setFormError(`Drafts konnten nicht geladen werden: ${e?.message || e}. Prüfe deine Verbindung und versuche es erneut.`) }
                }}
              >
                Drafts neu laden
              </button>
            </div>

            <div className="collapse">
              <button type="button" className={`collapse-toggle ${showAttachAlt ? 'is-open' : ''}`} onClick={() => setShowAttachAlt(s => !s)}>
                {showAttachAlt ? 'Ausblenden' : 'Draft per ID/Link anhängen'}
              </button>
              {showAttachAlt && (
                <div className="collapse-body">
                  <div className="row">
                    <input
                      className="control"
                      value={manualDraftInput || ''}
                      onChange={(e) => setManualDraftInput(e.target.value)}
                      placeholder="https://sleeper.com/draft/nfl/123... oder 123..."
                    />
                    <button
                      className="btn btn-primary control"
                      onClick={async () => {
                        if (!manualDraftInput) return
                        setFormError(null)
                        try {
                          const ok = await attachDraftByIdOrUrl(manualDraftInput)
                          if (ok) { setManualDraftInput(''); saveToLocalStorage({ manualDraftInput: '' }) }
                          else setFormError('Kein Draft unter dieser ID/diesem Link gefunden — prüfe, ob er auf einen Sleeper-Draft zeigt (sleeper.com/draft/nfl/…).')
                        } catch (e) { setFormError(`Draft konnte nicht angehängt werden: ${e?.message || e}.`) }
                      }}
                    >
                      Anhängen
                    </button>
                  </div>
                </div>
              )}
            </div>
          </label>

          <label className="field">
            <span>Draft-Modus</span>
            <div className="row">
              {['redraft', 'rookie'].map(mode => (
                <label key={mode} className="radio-option" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer' }}>
                  <input type="radio" name="draftMode" value={mode} checked={draftMode === mode} onChange={() => setDraftMode(mode)} />
                  {mode === 'redraft' ? 'Redraft' : 'Rookie Draft (Dynasty)'}
                </label>
              ))}
            </div>
            {selectedLeague?.league_type === 'dynasty' && draftMode === 'redraft' && (
              <div className="muted text-xs mt-1">Dynasty-Liga erkannt — Rookie Draft empfohlen</div>
            )}
            {selectedLeague?.league_type && selectedLeague.league_type !== 'dynasty' && draftMode === 'rookie' && (
              <div className="muted text-xs mt-1">Erkannt: {selectedLeague.league_type}</div>
            )}
          </label>
        </div>

        <div className="row" style={{ justifyContent: 'flex-end', marginTop: '0.5rem' }}>
          <button
            type="button" className="btn-compact btn-icon" onClick={handleClearMarkings}
            title={`Alle Fav/Avoid-Markierungen für ${draftMode === 'rookie' ? 'Rookie Draft' : 'Redraft'} löschen`}
            aria-label="Markierungen löschen"
          >
            <Icon name="trash-2" size={14} />
          </button>
        </div>
      </div>

      <ProfileBadgeCard
        key={`badge-${profile.id}`}
        profile={profile}
        deviations={profileDeviations}
        isNew={isNewProfile}
        allProfiles={allProfiles}
        onRebind={onRebindProfile}
        onRename={onRenameProfile}
      />

      <ProfileEditor
        key={`editor-${profile.id}`}
        profile={profile}
        detected={detected}
        strategyFormat={resolvedFormat}
        season={seasonYear}
        draftMode={draftMode}
        onProfileChange={onProfileChange}
      />

      <SyncSection />

      <div className="card">
        <h3>Rankings importieren</h3>
        {draftMode !== 'rookie' && (
          <div className="form-row">
            <label className="field">
              <span>Auto-Import – Quelle wählen</span>
              <div className="muted text-xs mb-1">Rangliste direkt importieren, ADP &amp; Byes inklusive – kein CSV nötig.</div>
              <div className="row" style={{ gap: 8 }}>
                <button
                  className="btn btn-primary control" disabled={busyFpImport || busyAutoImport}
                  onClick={async () => { setBusyFpImport(true); try { await handleFantasyProsImport() } finally { setBusyFpImport(false) } }}
                >
                  {busyFpImport ? 'Wird geladen…' : `FantasyPros (${fpScoringLabel(eff.scoring_type)} ECR)`}
                </button>
                <button
                  className="btn btn-secondary control" disabled={busyAutoImport || busyFpImport}
                  onClick={async () => { setBusyAutoImport(true); try { await handleAutoImport() } finally { setBusyAutoImport(false) } }}
                >
                  {busyAutoImport ? 'Wird geladen…' : 'FantasyCalc'}
                </button>
              </div>
            </label>
          </div>
        )}
        {draftMode === 'rookie' && (
          <div className="form-row">
            <label className="field">
              <span>Auto-Import – Quelle wählen</span>
              <div className="muted text-xs mb-1">Rookie-Rankings direkt importieren – kein CSV nötig. Wähle eine Quelle:</div>
              <div className="row" style={{ gap: 8 }}>
                <button
                  className="btn btn-primary control" disabled={busyKtcImport || busyAutoImport}
                  onClick={async () => { setBusyKtcImport(true); try { await handleKtcRookieImport() } finally { setBusyKtcImport(false) } }}
                >
                  {busyKtcImport ? 'Wird geladen…' : 'KTC Rookies'}
                </button>
                <button
                  className="btn btn-secondary control" disabled={busyAutoImport || busyKtcImport}
                  onClick={async () => { setBusyAutoImport(true); try { await handleAutoImport() } finally { setBusyAutoImport(false) } }}
                >
                  {busyAutoImport ? 'Wird geladen…' : 'FantasyCalc'}
                </button>
              </div>
            </label>
          </div>
        )}
        <div className="form-row">
          <label className="field">
            <span>FantasyPros CSV (file)</span>
            {draftMode === 'rookie' && (
              <div className="muted text-xs mb-1">Rookie-Modus: Lade ein Rookie-Only-Ranking hoch (z.B. FantasyPros Dynasty Rookies)</div>
            )}
            <div className="row">
              <input ref={fileRef} type="file" accept=".csv,text/csv" className="sr-only" onChange={onFileChange} />
              <button className="btn btn-primary control" onClick={() => fileRef.current?.click()}>CSV-Datei wählen</button>
              <span className="muted text-ellipsis" title={csvFileName}>{csvFileName || 'Keine Datei gewählt'}</span>
            </div>
            <div className="collapse">
              <button type="button" className={`collapse-toggle ${showCsvAdvanced ? 'is-open' : ''}`} onClick={() => setShowCsvAdvanced(s => !s)}>
                {showCsvAdvanced ? 'Einfügefeld ausblenden' : 'CSV-Text einfügen'}
              </button>
              {showCsvAdvanced && (
                <div className="collapse-body">
                  <textarea
                    value={csvRawText || ''} spellCheck={false}
                    onChange={(e) => setCsvRawText(e.target.value)}
                    placeholder="CSV-Inhalt hier einfügen…"
                    rows={isAndroid ? 6 : 8}
                  />
                  <div className="row">
                    <button className="btn btn-primary control" onClick={() => handleCsvLoad()}>CSV laden</button>
                    <button className="btn btn-secondary control" onClick={() => { setCsvRawText(''); saveToLocalStorage({ csvRawText: '' }); setCsvFileName('') }}>Leeren</button>
                  </div>
                </div>
              )}
            </div>
          </label>
        </div>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn btn-primary" onClick={() => navigate('/board')}>Fertig → Board</button>
        </div>
      </div>
    </section>
  )
}
