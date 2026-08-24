import React, { useEffect, useMemo, useRef, useState } from 'react'
import { makeFingerprint, pickStrategy } from '../services/strategyMatch'
import { loadStrategies, saveStrategies, newStrategyItem } from '../services/strategyStore'
import { callAiDraftStrategy } from '../services/aiStrategyClient'

// Der rohe Wert ("half_ppr") taucht sonst im gespeicherten Strategie-Namen auf
// und bleibt dort dauerhaft stehen.
function scoringLabel(t) {
  if (t === 'half_ppr') return 'Half-PPR'
  if (t === 'standard') return 'Standard'
  return String(t || 'ppr').toUpperCase()
}

export default function StrategySection({ format, season, draftMode, draftSlot = null }) {
  const [store, setStore] = useState(() => loadStrategies())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [editing, setEditing] = useState(null) // null | itemId

  const fingerprint = useMemo(
    () => makeFingerprint({ format, season, draftMode }),
    [JSON.stringify(format), season, draftMode]
  )

  const hit = useMemo(() => pickStrategy(store.items, fingerprint), [store.items, fingerprint])

  // Nicht beim ersten Mount schreiben — sonst persistiert das blosse Oeffnen
  // von /setup einen leeren Store und ueberschreibt migrateLegacyStrategy()'s
  // "Key existiert noch nicht"-Guard, bevor die Migration je laufen konnte.
  const didMount = useRef(false)
  useEffect(() => {
    if (!didMount.current) { didMount.current = true; return }
    saveStrategies(store)
  }, [JSON.stringify(store)])

  // Genau der Kopplungsweg: das hinzukommende Geraet landet auf /setup, diese
  // Komponente steht da schon mit leerem Store, und erst danach bringt der erste
  // Pull die Strategien in localStorage. Ohne dieses Neulesen schriebe die
  // naechste Bearbeitung den leeren Stand darueber — und pushte ihn auch noch.
  useEffect(() => {
    const onChanged = () => setStore(loadStrategies())
    window.addEventListener('sdh:setup-changed', onChanged)
    return () => window.removeEventListener('sdh:setup-changed', onChanged)
  }, [])

  function setPrinciples(principles) {
    setStore(s => ({ ...s, principles }))
  }

  async function generate() {
    setBusy(true)
    setError(null)
    try {
      const { parsed } = await callAiDraftStrategy({
        format, season, draftMode, draftSlot, principles: store.principles,
      })
      const label = `${format.teams}er ${scoringLabel(format.scoringType)} ${season}`
      const item = newStrategyItem({
        label,
        fingerprint,
        summary: parsed.summary || '',
        rules: parsed.rules || [],
        sources: parsed.sources || [],
        contested: parsed.contested || [],
        source: 'ai',
      })
      // Ersetzt ein vorhandenes Item mit identischem Fingerprint statt es
      // anzuhaengen — sonst waehlt pickStrategy immer nur das neueste und
      // aeltere (auch handbearbeitete) Items werden unsichtbar & unerreichbar.
      setStore(s => {
        const fp = JSON.stringify(fingerprint)
        const idx = s.items.findIndex(i => JSON.stringify(i.fingerprint) === fp)
        const items = idx >= 0
          ? s.items.map((i, n) => n === idx ? item : i)
          : [...s.items, item]
        return { ...s, items }
      })
    } catch (e) {
      setError(e?.message || 'Strategie konnte nicht erzeugt werden')
    } finally {
      setBusy(false)
    }
  }

  function saveEdit(id, summary, rules) {
    setStore(s => ({
      ...s,
      items: s.items.map(i => i.id === id
        ? { ...i, summary, rules: rules.split('\n').map(r => r.trim()).filter(Boolean), source: 'manual' }
        : i),
    }))
    setEditing(null)
  }

  function remove(id) {
    if (!window.confirm('Diese Strategie wirklich löschen? Das kann nicht rückgängig gemacht werden.')) return
    setStore(s => ({ ...s, items: s.items.filter(i => i.id !== id) }))
  }

  return (
    <div className="strategy-section">
      <h3>Draft-Strategie</h3>

      <label className="muted" style={{ fontSize: 12 }}>Meine Grundsätze (gelten immer)</label>
      <textarea
        className="control"
        rows={3}
        value={store.principles}
        onChange={e => setPrinciples(e.target.value)}
        placeholder="z. B. Defense wird gestreamt — letzter Pick oder gar nicht."
      />

      {!hit && (
        <p className="muted">
          Für dieses Format ({format.teams} Teams, {scoringLabel(format.scoringType)}, {season}) ist
          noch keine Strategie hinterlegt.
        </p>
      )}

      {hit && (
        <div className="strategy-active">
          <div className="strategy-head">
            <strong>{hit.item.label || 'Strategie'}</strong>
            <span className="badge">{hit.item.source === 'ai' ? 'KI-recherchiert' : 'manuell'}</span>
          </div>

          {hit.deviations.length > 0 && (
            <p className="form-error">Achtung: {hit.deviations.join('; ')}</p>
          )}

          {editing === hit.item.id ? (
            <EditForm item={hit.item} onCancel={() => setEditing(null)} onSave={saveEdit} />
          ) : (
            <>
              <p>{hit.item.summary}</p>
              <ul>{(hit.item.rules || []).map((r, i) => <li key={i}>{r}</li>)}</ul>

              {hit.item.contested?.length > 0 && (
                <div className="strategy-contested">
                  <strong>Uneinig in den Quellen:</strong>
                  <ul>{hit.item.contested.map((c, i) => <li key={i}>{c}</li>)}</ul>
                </div>
              )}

              {hit.item.sources?.length > 0 && (
                <div className="strategy-sources">
                  <strong>Quellen:</strong>
                  <ul>
                    {hit.item.sources.map((s, i) => (
                      <li key={i}>
                        <a href={s.url} target="_blank" rel="noreferrer noopener">{s.title || s.url}</a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {error && <p className="form-error" role="alert">{error}</p>}

      <div className="strategy-actions">
        <button type="button" className="btn btn-primary" onClick={generate} disabled={busy}>
          {busy ? 'Recherchiere…' : hit ? 'Neu erzeugen (KI)' : 'Strategie erzeugen (KI)'}
        </button>
        {hit && editing !== hit.item.id && (
          <button type="button" className="btn btn-secondary" onClick={() => setEditing(hit.item.id)}>Bearbeiten</button>
        )}
        {hit && (
          <button type="button" className="btn btn-secondary" onClick={() => remove(hit.item.id)}>Löschen</button>
        )}
      </div>

      {busy && (
        <p className="muted">
          Die KI durchsucht Experten-Quellen. Das dauert typischerweise 20–40 Sekunden.
        </p>
      )}
    </div>
  )
}

function EditForm({ item, onCancel, onSave }) {
  const [summary, setSummary] = useState(item.summary)
  const [rules, setRules] = useState((item.rules || []).join('\n'))
  return (
    <div className="strategy-edit">
      <label className="muted" style={{ fontSize: 12 }}>Leitlinie</label>
      <textarea className="control" rows={2} value={summary} onChange={e => setSummary(e.target.value)} />
      <label className="muted" style={{ fontSize: 12 }}>Regeln (eine pro Zeile)</label>
      <textarea className="control" rows={6} value={rules} onChange={e => setRules(e.target.value)} />
      <div className="strategy-actions">
        <button type="button" className="btn btn-primary" onClick={() => onSave(item.id, summary, rules)}>Speichern</button>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>Abbrechen</button>
      </div>
    </div>
  )
}
