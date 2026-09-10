import { precacheAndRoute } from 'workbox-precaching'

precacheAndRoute(self.__WB_MANIFEST)

self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch { /* kein JSON */ }
  const title = data.title || 'Sleeper Draft Helper'
  const body = data.body || 'Es gibt Neuigkeiten zu deinen Ligen.'
  const url = data.url || '/lineup'
  event.waitUntil(
    self.registration.showNotification(title, { body, icon: '/android-chrome-192x192.png', badge: '/favicon-32x32.png', tag: data.tag || 'sdh', data: { url } })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification?.data?.url || '/lineup'
  event.waitUntil(
    (async () => {
      const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const w of wins) {
        if (w.url.includes(new URL(url, self.location.origin).pathname)) { await w.focus(); return }
      }
      await self.clients.openWindow(url)
    })()
  )
})
