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
import Modal from '../components/Modal'
import ImportResultBanner from '../components/ImportResultBanner'

const noop = () => {}

// Reine Ableitung, isoliert testbar: Undo darf nur angeboten werden, wenn
// (a) der Import-Pfad, der DIESES Banner erzeugt hat, ueberhaupt einen
// Snapshot anlegt (importDone.canUndo) UND (b) im Store tatsaechlich noch
// ein Snapshot liegt. Sonst wuerde z.B. ein CSV-Import (der nie einen
// eigenen Snapshot setzt) faelschlich den Snapshot eines frueheren
// Auto-/KTC-Imports anbieten und beim Klick den falschen Board-Stand
// wiederherstellen — stiller Datenverlust.
export function canOfferUndo(importDone, lastBoardSnapshot) {
  return !!(importDone?.canUndo && lastBoardSnapshot)
}

export default function SetupPage({ selectedLeague, selectedDraft, isAndroid }) {
  const navigate = useNavigate()
  const location = useLocation()
  const mode = location.state?.mode // 'add' | 'edit' | undefined

  const [importDone, setImportDone] = useState(null)
  const [importError, setImportError] = useState(null)
  const [confirmOverwrite, setConfirmOverwrite] = useState(false)

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
    setCsvRawText, setDraftMode, setBoardSource,
    handleCsvLoad, handleAutoImport, handleKtcRookieImport, undoImport,
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
      useBoardStore.getState().setBoardSource(null)
      useLiveStore.getState().setLivePicks([])
      setImportDone(null)
    }
  }, []) // eslint-disable-line

  const leaguesById = new Map((availableLeagues || []).map((l) => [l.league_id, l]))

  function statsForCount(count) {
    return { total: count, withAdp: 0, withoutAdp: 0, unmatchedNames: [] }
  }

  async function wrappedCsvLoad() {
    const ok = await handleCsvLoad()
    if (ok) {
      // handleCsvLoad selbst ist tabu (bleibt wie es ist) — die Herkunft wird hier vom
      // Aufrufer gesetzt, und zwar nur bei tatsaechlichem Erfolg. Tippen im Setup-Feld
      // oder ein abgebrochener Overwrite-Dialog aendern boardSource dadurch nicht.
      setBoardSource('csv')
      const count = useBoardStore.getState().boardPlayers.length
      // handleCsvLoad setzt bewusst keinen lastBoardSnapshot (manueller Import
      // bleibt unveraendert, sichert sich stattdessen ueber window.confirm ab)
      // — also darf dieses Banner kein Undo anbieten.
      setImportDone({ method: 'CSV', stats: statsForCount(count), canUndo: false })
    }
  }

  async function wrappedAutoImport(force = false) {
    const fmt = deriveFormat({ draft: selectedDraft, league: selectedLeague, overrides: loadSetup()?.overrides || {} })
    const res = await handleAutoImport({
      isSuperflex: fmt.isSuperflex,
      effScoringType: fmt.scoringType,
      numTeams: fmt.teams,
      draftMode,
      force,
    })
    if (res.needsConfirm) {
      setConfirmOverwrite(true)
      return res
    }
    if (res.ok) {
      setImportDone({
        method: res.marketMissing ? 'FantasyCalc' : 'FantasyCalc + FFC',
        stats: res.stats,
        marketMissing: res.marketMissing,
        canUndo: true, // handleAutoImport setzt lastBoardSnapshot
      })
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
        // handleKtcRookieImport setzt lastBoardSnapshot — Undo ist hier sicher.
        setImportDone({ method: 'KTC', stats: statsForCount(count), canUndo: true })
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
        <ImportResultBanner
          stats={importDone.stats}
          method={importDone.method}
          marketMissing={importDone.marketMissing}
          onUndo={canOfferUndo(importDone, useBoardStore.getState().lastBoardSnapshot) ? () => { undoImport(); setImportDone(null) } : undefined}
          onClose={() => setImportDone(null)}
          onGoToBoard={() => navigate('/board')}
        />
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
      <Modal open={confirmOverwrite} onClose={() => setConfirmOverwrite(false)} title="Rankings überschreiben?">
        <p>Es sind bereits Rankings geladen. Beim Neu-Import geht deine eigene Reihenfolge verloren.</p>
        <p className="muted text-xs">Nur die Marktdaten aktualisieren? Das geht ohne Datenverlust über „Aktualisieren" am Board.</p>
        <div className="confirm-overwrite-actions">
          <button className="btn btn-secondary" onClick={() => setConfirmOverwrite(false)}>Abbrechen</button>
          <button className="btn btn-primary" onClick={() => { setConfirmOverwrite(false); wrappedAutoImport(true) }}>Überschreiben</button>
        </div>
      </Modal>
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
