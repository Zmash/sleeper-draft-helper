import React, { useState } from 'react'
import { callAiDraftStrategy } from '../services/aiStrategyClient'

function scoringLabel(t) {
  if (t === 'half_ppr') return 'Half-PPR'
  if (t === 'standard') return 'Standard'
  return String(t || 'ppr').toUpperCase()
}

const EMPTY_STRATEGY = { summary: '', rules: [], sources: [], contested: [], source: 'manual', updatedAt: null }

export default function StrategySection({
  profile, onSaveStrategy, principles, onSavePrinciples,
  format, season, draftMode, draftSlot = null,
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [editing, setEditing] = useState(false)

  const strategy = profile?.strategy || EMPTY_STRATEGY
  const hasStrategy = !!(strategy.summary || strategy.rules?.length)

  async function generate() {
    setBusy(true)
    setError(null)
    try {
      const { parsed } = await callAiDraftStrategy({ format, season, draftMode, draftSlot, principles })
      onSaveStrategy({
        summary: parsed.summary || '', rules: parsed.rules || [],
        sources: parsed.sources || [], contested: parsed.contested || [],
        source: 'ai', updatedAt: new Date().toISOString(),
      })
    } catch (e) {
      setError(e?.message || 'Strategie konnte nicht erzeugt werden')
    } finally {
      setBusy(false)
    }
  }

  function saveEdit(summary, rulesText) {
    onSaveStrategy({
      summary,
      rules: rulesText.split('\n').map(r => r.trim()).filter(Boolean),
      source: 'manual', updatedAt: new Date().toISOString(),
    })
    setEditing(false)
  }

  function remove() {
    if (!window.confirm('Diese Strategie wirklich löschen? Das kann nicht rückgängig gemacht werden.')) return
    onSaveStrategy({ ...EMPTY_STRATEGY })
  }

  return (
    <div className="strategy-section">
      <h3>Draft-Strategie</h3>

      <label className="muted" style={{ fontSize: 12 }}>Meine Grundsätze (gelten immer, für alle Profile)</label>
      <textarea
        className="control"
        rows={3}
        value={principles}
        onChange={e => onSavePrinciples(e.target.value)}
        placeholder="z. B. Defense wird gestreamt — letzter Pick oder gar nicht."
      />

      {!hasStrategy && (
        <p className="muted">
          Für dieses Profil ({format.teams} Teams, {scoringLabel(format.scoringType)}, {season}) ist
          noch keine Strategie hinterlegt.
        </p>
      )}

      {hasStrategy && (
        <div className="strategy-active">
          <div className="strategy-head">
            <strong>{profile.name}</strong>
            <span className="badge">{strategy.source === 'ai' ? 'KI-recherchiert' : 'manuell'}</span>
          </div>

          {editing ? (
            <EditForm strategy={strategy} onCancel={() => setEditing(false)} onSave={saveEdit} />
          ) : (
            <>
              <p>{strategy.summary}</p>
              <ul>{(strategy.rules || []).map((r, i) => <li key={i}>{r}</li>)}</ul>

              {strategy.contested?.length > 0 && (
                <div className="strategy-contested">
                  <strong>Uneinig in den Quellen:</strong>
                  <ul>{strategy.contested.map((c, i) => <li key={i}>{c}</li>)}</ul>
                </div>
              )}

              {strategy.sources?.length > 0 && (
                <div className="strategy-sources">
                  <strong>Quellen:</strong>
                  <ul>
                    {strategy.sources.map((s, i) => (
                      <li key={i}><a href={s.url} target="_blank" rel="noreferrer noopener">{s.title || s.url}</a></li>
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
          {busy ? 'Recherchiere…' : hasStrategy ? 'Neu erzeugen (KI)' : 'Strategie erzeugen (KI)'}
        </button>
        {hasStrategy && !editing && (
          <button type="button" className="btn btn-secondary" onClick={() => setEditing(true)}>Bearbeiten</button>
        )}
        {hasStrategy && (
          <button type="button" className="btn btn-secondary" onClick={remove}>Löschen</button>
        )}
      </div>

      {busy && <p className="muted">Die KI durchsucht Experten-Quellen. Das dauert typischerweise 20–40 Sekunden.</p>}
    </div>
  )
}

function EditForm({ strategy, onCancel, onSave }) {
  const [summary, setSummary] = useState(strategy.summary)
  const [rules, setRules] = useState((strategy.rules || []).join('\n'))
  return (
    <div className="strategy-edit">
      <label className="muted" style={{ fontSize: 12 }}>Leitlinie</label>
      <textarea className="control" rows={2} value={summary} onChange={e => setSummary(e.target.value)} />
      <label className="muted" style={{ fontSize: 12 }}>Regeln (eine pro Zeile)</label>
      <textarea className="control" rows={6} value={rules} onChange={e => setRules(e.target.value)} />
      <div className="strategy-actions">
        <button type="button" className="btn btn-primary" onClick={() => onSave(summary, rules)}>Speichern</button>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>Abbrechen</button>
      </div>
    </div>
  )
}
