import { useNavigate } from 'react-router-dom'
import { useSessionStore } from '../stores/useSessionStore'
import { useBoardStore } from '../stores/useBoardStore'
import { formatDraftLabel } from '../services/api'
import { parseDraftId } from '../utils/parse'
import SetupForm from '../components/SetupForm'

const noop = () => {}

export default function SetupPage({ selectedLeague, selectedDraft, isAndroid }) {
  const navigate = useNavigate()

  const {
    sleeperUsername, sleeperUserId, seasonYear,
    availableLeagues, selectedLeagueId, leagueUsers,
    availableDrafts, selectedDraftId, manualDraftInput,
    setSleeperUsername, setSleeperUserId, setSeasonYear,
    setSelectedLeagueId, setSelectedDraftId, setManualDraftInput,
    resolveUserId, loadLeagues, loadDraftOptions, loadLeagueUsers, attachDraftByIdOrUrl,
  } = useSessionStore()

  const {
    csvRawText, draftMode,
    setCsvRawText, setDraftMode,
    handleCsvLoad, handleAutoImport, handleKtcRookieImport,
  } = useBoardStore()

  const leaguesById = new Map((availableLeagues || []).map((l) => [l.league_id, l]))

  async function wrappedCsvLoad() {
    const ok = await handleCsvLoad()
    if (ok) navigate('/board')
  }

  async function wrappedAutoImport() {
    try {
      const numQbs = selectedLeague?.roster_positions?.some((r) =>
        String(r).toUpperCase().includes('SUPER')
      ) ? 2 : 1
      const rec = Number(selectedLeague?.scoring_settings?.rec ?? 1)
      const effScoringType = rec >= 0.95 ? 'ppr' : rec >= 0.45 ? 'half_ppr' : 'standard'
      const numTeams = selectedLeague?.total_rosters || 12
      const ok = await handleAutoImport({ isSuperflex: numQbs === 2, effScoringType, numTeams })
      if (ok) navigate('/board')
    } catch (e) {
      alert('Fehler beim Auto-Import: ' + (e.message || e))
    }
  }

  async function wrappedKtcImport() {
    try {
      const ok = await handleKtcRookieImport()
      if (ok) navigate('/board')
    } catch (e) {
      alert('Fehler beim KTC-Import: ' + (e.message || e))
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
  )
}
