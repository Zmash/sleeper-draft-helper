import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSessionStore } from '../stores/useSessionStore'
import { parseDraftId } from '../utils/parse'

// Ziel des Web-Share-Target (site.webmanifest): Android navigiert hierher,
// wenn man aus WhatsApp/Telegram etwas an die installierte PWA "teilt".
// Gleicher Import-Pfad wie das manuelle Einfuegen im Mock-Draft-Feld
// (MockDraftCard) -- nur die Quelle des Textes ist die Query-String statt
// ein Eingabefeld.
export default function ShareTargetPage() {
  const navigate = useNavigate()
  const { attachDraftByIdOrUrl, setSelectedDraftId, setSelectedLeagueId } = useSessionStore()
  const [error, setError] = useState(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const raw = params.get('url') || params.get('text') || ''

    async function run() {
      const draftId = await attachDraftByIdOrUrl(raw, parseDraftId).catch(() => null)
      if (!draftId) {
        setError('Kein Sleeper-Draft-Link im geteilten Inhalt gefunden.')
        return
      }
      setSelectedLeagueId(null)
      setSelectedDraftId(String(draftId))
      navigate('/board', { replace: true })
    }
    run()
  }, []) // eslint-disable-line

  return (
    <section className="card dashboard-empty">
      <h2>{error ? 'Draft nicht gefunden' : 'Draft wird geladen…'}</h2>
      {error && <p className="muted" role="alert">{error}</p>}
    </section>
  )
}
