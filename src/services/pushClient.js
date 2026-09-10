async function vapidKey() {
  const res = await fetch('/api/push/vapid-key')
  if (!res.ok) throw new Error('Push ist auf dem Server nicht konfiguriert')
  const { publicKey } = await res.json()
  return publicKey
}

function urlBase64ToUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}

export async function getPushState() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  return sub ? 'subscribed' : 'unsubscribed'
}

export async function subscribePush(sleeperUsername) {
  const user = String(sleeperUsername || '').trim()
  if (!user) throw new Error('Bitte zuerst Sleeper-Username verbinden')
  const key = await vapidKey()
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) })
  const res = await fetch('/api/push/subscribe', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscription: sub.toJSON(), sleeperUsername: user }),
  })
  if (!res.ok) throw new Error('Anmeldung fehlgeschlagen')
  return true
}

export async function unsubscribePush() {
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  const endpoint = sub?.endpoint
  if (sub) await sub.unsubscribe()
  if (endpoint) {
    await fetch('/api/push/unsubscribe', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint }),
    })
  }
  return true
}
