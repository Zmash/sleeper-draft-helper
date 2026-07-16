import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSessionStore } from '../stores/useSessionStore'
import { parseDraftId } from '../utils/parse'
import Icon from './Icon'

// Bewusst NICHT ueber /setup: der Add-Modus dort loescht das Board mit.
// Ein Mock ist Vorbereitung, kein Neuanfang — die gepflegte Rangliste bleibt.
export default function MockDraftCard() {
  const navigate = useNavigate()
  const { attachDraftByIdOrUrl, setSelectedDraftId } = useSessionStore()
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

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
      setSelectedDraftId(String(draftId))
      setInput('')
      navigate('/board')
    } catch (e) {
      setError(`Draft konnte nicht geladen werden: ${e?.message || e}. Prüfe deine Verbindung und versuche es erneut.`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="league-card league-card--mock">
      <div className="lc-mock-head">
        <Icon name="zap" size={16} /> <span className="lc-mock-title">Mock-Draft starten</span>
      </div>
      <p className="lc-mock-desc muted">Sleeper-Link einfügen — dein Board bleibt wie es ist.</p>
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
      {error && <p className="lc-mock-error">{error}</p>}
    </div>
  )
}
