import { Capacitor, registerPlugin } from '@capacitor/core'

// Natives Android-Plugin (android/.../ShareReceiverPlugin.java): faengt Text
// ab, den eine andere App (WhatsApp, Telegram, ...) per "Teilen" an uns
// schickt -- z.B. einen Sleeper-Draft-Link, den ein Kumpel schickt.
const ShareReceiver = registerPlugin('ShareReceiver')

// Kaltstart: die App wurde gerade erst per "Teilen" geoeffnet. Web/iOS haben
// keine native Implementierung -- dort einfach null liefern statt zu werfen.
export async function getInitialSharedText() {
  if (!Capacitor.isNativePlatform()) return null
  try {
    const { text } = await ShareReceiver.getInitialShare()
    return text || null
  } catch {
    return null
  }
}

// App laeuft bereits, Nutzer teilt waehrenddessen erneut etwas dorthin.
// Gibt eine Unsubscribe-Funktion zurueck.
export function onSharedText(callback) {
  if (!Capacitor.isNativePlatform()) return () => {}
  let handle = null
  let cancelled = false
  ShareReceiver.addListener('shared', ({ text }) => {
    if (text) callback(text)
  }).then((h) => {
    if (cancelled) h.remove()
    else handle = h
  })
  return () => {
    cancelled = true
    handle?.remove()
  }
}
