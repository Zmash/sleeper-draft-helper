import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSessionStore } from '../stores/useSessionStore'
import { useLiveStore } from '../stores/useLiveStore'
import { parseDraftId } from '../utils/parse'
import { isDraftParticipant, resolveDraftParticipants } from '../utils/teamLabels'
import Icon from './Icon'

// Bewusst NICHT ueber /setup: der Add-Modus dort loescht das Board mit.
// Ein Mock ist Vorbereitung, kein Neuanfang — die gepflegte Rangliste bleibt.
export default function MockDraftCard() {
  const navigate = useNavigate()
  const { sleeperUserId, attachDraftByIdOrUrl, setSelectedDraftId, setSelectedLeagueId, setDraftViewAs } =
    useSessionStore()
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  // Freundes-Draft: bin ich kein Teilnehmer, erst Team waehlen statt sofort oeffnen.
  const [pendingDraftId, setPendingDraftId] = useState(null)
  const [participants, setParticipants] = useState(null)
  const [chosenUserId, setChosenUserId] = useState('')

  function finishAndOpen(draftId) {
    // Ein per Link angehaengter Mock gehoert zu keiner Liga. Ohne das bleibt eine zuvor
    // gewaehlte Liga stehen und resolveDraftMode erkennt den Mock-Wechsel nicht (Regression B6).
    setSelectedLeagueId(null)
    setSelectedDraftId(String(draftId))
    setInput('')
    setPendingDraftId(null)
    setParticipants(null)
    setChosenUserId('')
    navigate('/board')
  }

  async function handleStart() {
    const raw = input.trim()
    if (!raw) return
    setBusy(true)
    setError(null)
    try {
      const draftId = await attachDraftByIdOrUrl(raw, parseDraftId)
      if (!draftId) {
        setError('Kein Draft unter diesem Link gefunden — prüfe, ob der Link auf einen Sleeper-Draft zeigt (sleeper.com/draft/nfl/…).')
        return
      }
      const draft = useSessionStore.getState().availableDrafts.find((d) => String(d.draft_id) === String(draftId))
      const picks = useLiveStore.getState().livePicks
      if (isDraftParticipant(draft, picks, sleeperUserId)) {
        finishAndOpen(draftId)
        return
      }
      // Nicht mein eigener Draft -- vermutlich der eines Freundes: erst sein Team waehlen lassen.
      const list = await resolveDraftParticipants(draft)
      setParticipants(list)
      setPendingDraftId(draftId)
    } catch (e) {
      setError(`Draft konnte nicht geladen werden: ${e?.message || e}. Prüfe deine Verbindung und versuche es erneut.`)
    } finally {
      setBusy(false)
    }
  }

  function handleConfirmTeam() {
    if (!chosenUserId) return
    const team = participants.find((p) => String(p.userId) === String(chosenUserId))
    setDraftViewAs(String(pendingDraftId), { userId: chosenUserId, label: team?.label || '' })
    finishAndOpen(pendingDraftId)
  }

  function handleCancelPicker() {
    setPendingDraftId(null)
    setParticipants(null)
    setChosenUserId('')
  }

  if (pendingDraftId) {
    return (
      <div className="league-card league-card--mock">
        <div className="lc-mock-head">
          <Icon name="anchor" size={16} /> <span className="lc-mock-title">Welches Team ist deins?</span>
        </div>
        <p className="lc-mock-desc muted">Du bist nicht Teil dieses Drafts — wähle das Team, das du verfolgen willst.</p>
        <div className="lc-mock-row">
          <select
            className="control control--sm"
            value={chosenUserId}
            onChange={(e) => setChosenUserId(e.target.value)}
            aria-label="Team wählen"
          >
            <option value="">Team wählen…</option>
            {(participants || []).map((p) => (
              <option key={p.slot} value={p.userId || ''} disabled={!p.userId}>
                {p.slot}. {p.label}
              </option>
            ))}
          </select>
          <button className="btn btn-primary btn-sm" onClick={handleConfirmTeam} disabled={!chosenUserId}>
            Anpinnen
          </button>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={handleCancelPicker}>Abbrechen</button>
      </div>
    )
  }

  return (
    <div className="league-card league-card--mock">
      <div className="lc-mock-head">
        <Icon name="zap" size={16} /> <span className="lc-mock-title">Mock-Draft starten</span>
      </div>
      <p className="lc-mock-desc muted">Sleeper-Link einfügen — eigener Mock oder der Draft eines Freundes.</p>
      <div className="lc-mock-row">
        <input
          className="control control--sm"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleStart()}
          placeholder="sleeper.com/draft/nfl/…"
          aria-label="Sleeper-Draft-Link"
        />
        <button className="btn btn-primary btn-sm" onClick={handleStart} disabled={busy}>
          {busy ? '…' : 'Starten'}
        </button>
      </div>
      {error && <p className="lc-mock-error" role="alert">{error}</p>}
    </div>
  )
}
