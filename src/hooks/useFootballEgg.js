import { useEffect } from 'react'
import { openFootballEgg } from '../utils/easterEgg.js'

// Tastatur-Trigger fuers Field-Goal-Easter-Egg: "football" tippen.
// In Eingabefeldern (z. B. Command-Palette, Suche) wird nichts abgefangen,
// damit man dort ungestört tippen kann.
export function useFootballEgg() {
  useEffect(() => {
    let buffer = ''

    const onKey = (e) => {
      if (e.key.length !== 1) return
      const el = e.target
      if (
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        el instanceof HTMLSelectElement
      ) {
        return
      }
      buffer += e.key.toLowerCase()

      // Wenn buffer länger als "football" ist, vorne abschneiden
      if (buffer.length > 8) {
        buffer = buffer.slice(-8)
      }

      if (buffer === 'football') {
        buffer = ''
        openFootballEgg()
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
