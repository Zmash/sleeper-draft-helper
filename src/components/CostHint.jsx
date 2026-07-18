import { useState } from 'react'

// Dezenter Kostenhinweis: standardmaessig nur ein kleines Info-Symbol. Die Zahlen
// (Schaetzung vor dem Call, Verbrauch danach) erscheinen erst auf Klick/Tap —
// Kosten sind manchmal interessant, sollen aber nicht dauerhaft im Weg stehen.
// Klick-Toggle statt Hover, damit es auch auf dem Touch-Geraet (Capacitor) geht.
export function CostHint({ text, prefix = '' }) {
  const [open, setOpen] = useState(false)
  if (!text) return null
  return (
    <span className="cost-hint">
      <button
        type="button"
        className="cost-hint-toggle"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-label={open ? 'Kosten ausblenden' : 'Kosten anzeigen'}
        title="Kosten anzeigen"
      >
        ⓘ
      </button>
      {open && <span className="cost-hint-text muted">{prefix}{text}</span>}
    </span>
  )
}
