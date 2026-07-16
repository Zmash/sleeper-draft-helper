import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useSessionStore } from '../stores/useSessionStore'
import { useBoardStore } from '../stores/useBoardStore'
import { useLiveStore } from '../stores/useLiveStore'
import { formatDraftLabel } from '../services/api'
import { parseDraftId } from '../utils/parse'
import { deriveFormat } from '../services/draftFormat'
import { loadSetup } from '../services/storage'
import SetupForm from '../components/SetupForm'
import Icon from '../components/Icon'

const noop = () => {}

export default function SetupPage({ selectedLeague, selectedDraft, isAndroid }) {
  const navigate = useNavigate()
  const location = useLocation()
  const mode = location.state?.mode // 'add' | 'edit' | undefined

  const [importDone, setImportDone] = useState(null)
  const [importError, setImportError] = useState(null)

  const {
    sleeperUsername, sleeperUserId, seasonYear,
    availableLeagues, selectedLeagueId, leagueUsers,
    availableDrafts, selectedDraftId, manualDraftInput,
    setSleeperUsername, setSleeperUserId, setSeasonYear,
    setAvailableLeagues, setSelectedLeagueId, setLeagueUsers,
    setAvailableDrafts, setSelectedDraftId, setManualDraftInput,
    resolveUserId, loadLeagues, loadDraftOptions, loadLeagueUsers, attachDraftByIdOrUrl,
  } = useSessionStore()

  const {
    csvRawText, draftMode,
    setCsvRawText, setDraftMode,
    handleCsvLoad, handleAutoImport, handleKtcRookieImport,
  } = useBoardStore()

  // Add mode: clear everything except the Sleeper account credentials
  useEffect(() => {
    if (mode === 'add') {
      setAvailableLeagues([])
      setSelectedLeagueId(null)
      setLeagueUsers([])
      setAvailableDrafts([])
      setSelectedDraftId(null)
      setManualDraftInput('')
      setCsvRawText('')
      useBoardStore.getState().setBoardPlayers([])
      useLiveStore.getState().setLivePicks([])
      setImportDone(null)
    }
  }, []) // eslint-disable-line

  const leaguesById = new Map((availableLeagues || []).map((l) => [l.league_id, l]))

  async function wrappedCsvLoad() {
    const ok = await handleCsvLoad()
    if (ok) {
      const count = useBoardStore.getState().boardPlayers.length
      setImportDone({ method: 'CSV', count })
    }
  }

  async function wrappedAutoImport() {
    const fmt = deriveFormat({ draft: selectedDraft, league: selectedLeague, overrides: loadSetup()?.overrides || {} })
    const res = await handleAutoImport({
      isSuperflex: fmt.isSuperflex,
      effScoringType: fmt.scoringType,
      numTeams: fmt.teams,
      draftMode,
    })
    if (res.ok) {
      setImportDone({ method: res.marketMissing ? 'FantasyCalc (ohne Marktdaten)' : 'FantasyCalc + FFC', stats: res.stats })
    } else if (res.error) {
      setImportError(res.error)
    }
    return res
  }

  async function wrappedKtcImport() {
    try {
      const ok = await handleKtcRookieImport()
      if (ok) {
        const count = useBoardStore.getState().boardPlayers.length
        setImportDone({ method: 'KTC', count })
      }
    } catch (e) {
      setImportError(`Fehler beim KTC-Import: ${e?.message || e}. Prüfe deine Verbindung und versuche es erneut.`)
    }
  }

  async function wrappedAttachDraft(input) {
    return attachDraftByIdOrUrl(input, parseDraftId)
  }

  async function wrappedLoadDraftOptions(leagueId) {
    await loadDraftOptions(leagueId)
    if (leagueId) loadLeagueUsers(leagueId).catch(() => {})
  }

  return (
    <>
      {importDone && (
        <div className="import-done-banner">
          <span className="import-done-text">
            {importDone.count ?? importDone.stats?.total} Spieler importiert ({importDone.method}) <Icon name="check" size={14} />
          </span>
          <div className="import-done-actions">
            <button className="btn btn-primary btn-sm" onClick={() => navigate('/board')}>
              → Board
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setImportDone(null)} aria-label="Schließen">
              <Icon name="x" size={14} />
            </button>
          </div>
        </div>
      )}
      {importError && (
        <div className="import-error-banner">
          <span className="import-error-text">
            Import fehlgeschlagen: {importError}
          </span>
          <button className="btn btn-ghost btn-sm" onClick={() => setImportError(null)} aria-label="Schließen">
            <Icon name="x" size={14} />
          </button>
        </div>
      )}
      <SetupForm
        sleeperUsername={sleeperUsername}
        sleeperUserId={sleeperUserId}
        seasonYear={seasonYear}
        availableLeagues={availableLeagues}
        selectedLeagueId={selectedLeagueId}
        availableDrafts={availableDrafts}
        selectedDraftId={selectedDraftId}
        leaguesById={leaguesById}
        manualDraftInput={manualDraftInput}
        csvRawText={csvRawText}
        isAndroid={isAndroid}
        lastSyncAt={null}
        setSleeperUsername={setSleeperUsername}
        setSleeperUserId={setSleeperUserId}
        setSeasonYear={setSeasonYear}
        setSelectedLeagueId={setSelectedLeagueId}
        setSelectedDraftId={setSelectedDraftId}
        setManualDraftInput={setManualDraftInput}
        setCsvRawText={setCsvRawText}
        saveToLocalStorage={noop}
        resolveUserId={resolveUserId}
        loadLeagues={loadLeagues}
        loadDraftOptions={wrappedLoadDraftOptions}
        attachDraftByIdOrUrl={wrappedAttachDraft}
        handleCsvLoad={wrappedCsvLoad}
        handleAutoImport={wrappedAutoImport}
        handleKtcRookieImport={wrappedKtcImport}
        formatDraftLabel={formatDraftLabel}
        draftMode={draftMode}
        setDraftMode={setDraftMode}
        selectedLeague={selectedLeague}
      />
    </>
  )
}
