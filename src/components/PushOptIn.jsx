import { useEffect, useState } from 'react'
import { useSessionStore } from '../stores/useSessionStore'
import { getPushState, subscribePush, unsubscribePush } from '../services/pushClient'
import Icon from './Icon'

export default function PushOptIn() {
  const { sleeperUsername } = useSessionStore()
  const [state, setState] = useState('loading')
  const [error, setError] = useState(null)

  useEffect(() => { getPushState().then(setState).catch(() => setState('unsupported')) }, [])

  async function toggle() {
    setError(null)
    try {
      if (state === 'subscribed') {
        await unsubscribePush()
        setState('unsubscribed')
      } else {
        await subscribePush(sleeperUsername)
        setState('subscribed')
      }
    } catch (e) {
      setError(e.message || 'Fehlgeschlagen')
    }
  }

  if (state === 'loading' || state === 'unsupported') return null
  if (state === 'denied') return <span className="an-head-meta">Push im Browser blockiert</span>
  return (
    <span className="an-head-meta">
      <button type="button" className="btn btn-secondary btn-sm" onClick={toggle} title={state === 'subscribed' ? 'Push abbestellen' : 'Bei Lineup-Problemen + Waiver benachrichtigen'}>
        <Icon name="bell" size={14} /> {state === 'subscribed' ? 'Push an' : 'Benachrichtigungen'}
      </button>
      {error && <span className="muted"> · {error}</span>}
    </span>
  )
}
