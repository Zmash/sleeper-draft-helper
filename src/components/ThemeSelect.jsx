import { useState, useRef, useEffect } from 'react'
import Icon from './Icon'
import { THEMES } from '../theme/themes'

export default function ThemeSelect({ themeId, setTheme }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  return (
    <div className="theme-select" ref={ref}>
      <button
        className="icnbtn"
        aria-label="Theme wählen"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <Icon name="palette" size={18} />
      </button>
      {open && (
        <div className="theme-menu" role="menu">
          {THEMES.map((t) => (
            <button
              key={t.id}
              role="menuitemradio"
              aria-checked={t.id === themeId}
              className={t.id === themeId ? 'theme-opt is-active' : 'theme-opt'}
              onClick={() => {
                setTheme(t.id)
                setOpen(false)
              }}
            >
              <span>{t.label}</span>
              {t.id === themeId && <Icon name="check" size={15} />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
