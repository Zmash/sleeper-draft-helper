import { useState } from 'react'

// Sleepers Avatar-CDN. "thumbs" liefert die kleine Variante -- fuer 22-34px
// Anzeige reicht sie und spart auf dem Handy spuerbar Daten.
const AVATAR_BASE = 'https://sleepercdn.com/avatars/thumbs'

export function initials(name) {
  const words = String(name || '').trim().split(/\s+/).filter(Boolean)
  if (!words.length) return '?'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

/**
 * Liga- oder Team-Avatar. `avatar` ist der Sleeper-Hash und bei sehr vielen
 * Ligen und Nutzern schlicht null -- dann (und wenn das CDN nicht antwortet,
 * in der Capacitor-App keine Seltenheit) steht das Monogramm da. Feste Groesse
 * an Element UND Style, damit beim Nachladen nichts im Grid springt.
 */
export default function SleeperAvatar({ avatar, name, size = 34, className = '' }) {
  const [failed, setFailed] = useState(false)
  const style = { width: `${size}px`, height: `${size}px` }
  const cls = `sdh-avatar ${className}`.trim()

  if (!avatar || failed) {
    return (
      <span className={`${cls} sdh-avatar--fallback`} style={style} aria-hidden="true">
        {initials(name)}
      </span>
    )
  }

  return (
    <img
      className={cls}
      style={style}
      width={size}
      height={size}
      src={`${AVATAR_BASE}/${encodeURIComponent(avatar)}`}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
    />
  )
}
