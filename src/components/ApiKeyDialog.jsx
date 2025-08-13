// src/components/ApiKeyDialog.jsx
import React from 'react'
import { getOpenAIKey, setOpenAIKey, maskKey } from '../services/key'

export default function ApiKeyDialog({
  open,
  onClose,
  onSaved,            // async (key) -> parent validiert
  validating = false, // spinner-state von außen
  validationError = '', // text von außen
}) {
  const [value, setValue] = React.useState('')
  const [show, setShow] = React.useState(false)
  const [localErr, setLocalErr] = React.useState('')

  React.useEffect(() => {
    if (open) {
      const k = getOpenAIKey() || ''
      setValue(k)
      setLocalErr('')
    }
  }, [open])

  if (!open) return null

  function validateFormat(k) {
    const t = String(k || '').trim()
    if (!t) return 'Bitte gib einen API-Key ein.'
    if (t.length < 20) return 'Der Key ist zu kurz.'
    // akzeptiere neue und alte Formate
    if (!/^sk-/.test(t)) return 'Ungewöhnliches Format. Beginnt üblicherweise mit "sk-".'
    return ''
  }

  async function handleSave(e) {
    e?.preventDefault?.()
    const err = validateFormat(value)
    setLocalErr(err)
    if (err) return
    // Übergib den Key an den Parent -> der validiert gegen /api/validate-key
    await onSaved?.(String(value).trim())
  }

  function handleClear() {
    setOpenAIKey('')
    setValue('')
    setLocalErr('')
    onClose?.()
  }

  return (
    <div style={backdropStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ margin: 0, fontSize: 18 }}>OpenAI API-Key</h3>
        <p className="muted" style={{ marginTop: 6 }}>
          Dein Key wird <b>nur lokal</b> im Browser gespeichert (LocalStorage) und bei Aufrufen
          im Header <code>X-OpenAI-Key</code> an die API geschickt.
        </p>

        <form onSubmit={handleSave} style={{ marginTop: 12 }}>
          <label className="muted" style={{ fontSize: 12 }}>Aktueller Key</label>
          <div style={boxStyle}>
            <code>{maskKey(value || getOpenAIKey() || '') || '—'}</code>
          </div>

          <label className="muted" style={{ fontSize: 12, marginTop: 10 }}>Neuen Key eingeben</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type={show ? 'text' : 'password'}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="sk-..."
              autoFocus
              spellCheck={false}
              style={{ flex: 1, padding: '10px 12px', borderRadius: 8, border: '1px solid #444', background: 'transparent', color: 'inherit' }}
            />
            <button
              type="button"
              onClick={() => setShow(s => !s)}
              style={btnGhost}
              title={show ? 'Verbergen' : 'Anzeigen'}
            >
              {show ? '🙈' : '👁️'}
            </button>
          </div>

          {(localErr || validationError) && (
            <div style={{ color: '#ef4444', marginTop: 8, fontSize: 13 }}>
              {localErr || validationError}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14, gap: 8 }}>
            <button type="button" onClick={onClose} style={btnGhost}>Abbrechen</button>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={handleClear} style={btnDanger}>Löschen</button>
              <button type="submit" disabled={validating} style={btnPrimary}>
                {validating ? 'Prüfe…' : 'Speichern & Prüfen'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

const backdropStyle = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
  display: 'grid', placeItems: 'center', zIndex: 1000
}
const modalStyle = {
  width: 'min(560px, 90vw)', background: '#111', border: '1px solid #333', borderRadius: 12, padding: 16, color: 'inherit', boxShadow: '0 6px 24px rgba(0,0,0,0.4)'
}
const boxStyle = {
  border: '1px solid #333', padding: '8px 10px', borderRadius: 8, marginTop: 4
}
const btnBase = {
  padding: '8px 12px', borderRadius: 8, border: '1px solid #444', background: 'transparent', color: 'inherit', cursor: 'pointer'
}
const btnPrimary = { ...btnBase, borderColor: '#7c3aed' }
const btnDanger  = { ...btnBase, borderColor: '#ef4444' }
const btnGhost   = { ...btnBase }
