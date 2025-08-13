import React, { useEffect, useState } from 'react'
import { getOpenAIKey, setOpenAIKey, maskKey } from '../services/key'

export default function ApiKeyDialog({ open, onClose, onSaved, validating = false, validationError = '' }) {
  const [value, setValue] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setValue(getOpenAIKey() || '')
    setError('')
  }, [open])

  if (!open) return null

  function handleSave(e) {
    e?.preventDefault?.()
    const v = (value || '').trim()
    if (!/^sk-[\w-]{10,}/i.test(v)) {
      setError('Bitte einen gültigen OpenAI API Key eingeben (beginnt meist mit "sk-").')
      return
    }
    const ok = setOpenAIKey(v)
    if (!ok) {
      setError('Konnte Schlüssel lokal nicht speichern (LocalStorage?).')
      return
    }
    onSaved?.(v)
  }

  return (
    <div style={backdrop}>
      <div style={dialog} role="dialog" aria-modal="true" aria-label="OpenAI API Key">
        <h3 style={{ marginTop: 0 }}>OpenAI API Key</h3>
        <p style={{ margin: '8px 0 12px 0' }}>
          Dein Key wird <strong>nur lokal</strong> im Browser gespeichert und für Anfragen an OpenAI verwendet.
          Kosten laufen über <em>deinen</em> Key.
        </p>

        <form onSubmit={handleSave}>
          <label style={{ display: 'block', marginBottom: 6 }}>API Key</label>
          <input
            type="password"
            placeholder="sk-..."
            value={value}
            onChange={e => setValue(e.target.value)}
            autoFocus
            style={input}
          />
          {value ? (
            <div style={{ fontSize: 12, opacity: 0.8, marginTop: 6 }}>
              Vorschau: {maskKey(value)}
            </div>
          ) : null}

          {(error || validationError) && (
            <div style={{ color: 'crimson', marginTop: 8 }}>{error || validationError}</div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 14, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={btnGhost} disabled={validating}>Abbrechen</button>
            <button type="submit" style={btnPrimary} disabled={validating}>
              {validating ? 'Validiere…' : 'Speichern'}
            </button>
          </div>
        </form>

        <details style={{ marginTop: 12 }}>
          <summary>Woher bekomme ich einen Key?</summary>
          <div style={{ fontSize: 13, opacity: 0.9, marginTop: 6 }}>
            Im OpenAI Dashboard unter „API Keys“. Achte auf deine Usage-Limits.
          </div>
        </details>
      </div>
    </div>
  )
}

const backdrop = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'grid', placeItems: 'center', zIndex: 1000 }
const dialog = { background: 'var(--bg,#161616)', color:'var(--fg,#eaeaea)', minWidth: 420, maxWidth: 720, width:'90%', borderRadius: 10, padding: 16, boxShadow: '0 10px 24px rgba(0,0,0,0.4)' }
const input = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #444', background: 'transparent', color: 'inherit' }
const btnGhost = { background: 'transparent', border: '1px solid #444', color: 'inherit', borderRadius: 8, padding: '6px 10px', cursor: 'pointer' }
const btnPrimary = { background: '#2c7be5', border: '1px solid #2c7be5', color: '#fff', borderRadius: 8, padding: '6px 12px', cursor: 'pointer' }
