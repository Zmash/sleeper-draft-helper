import React from 'react'
import Icon from './Icon'

// FFC rechnet ADP ueber ein rollierendes 7-Tage-Fenster. Aelter als das Fenster
// = die Zahl beschreibt einen Markt, den es so nicht mehr gibt.
const STALE_AFTER_DAYS = 7

const MODE_LABEL = { redraft: 'Redraft', rookie: 'Rookie Draft' }
const FORMAT_LABEL = { ppr: 'PPR', 'half-ppr': 'Half-PPR', standard: 'Standard', '2qb': '2QB / Superflex' }
// Welche ADP-Quelle das Board speist. Alt-Boards ohne marketMeta.source: Fallback
// FFC, das war vor der Sleeper-Quelle die einzige ADP-Herkunft. Die Zeile luegt nie.
const ADP_SOURCE_LABEL = { ffc: 'Fantasy Football Calculator', sleeper: 'Sleeper (RotoWire)' }

function daysBetween(dateStr, now) {
  if (!dateStr) return null
  const then = new Date(dateStr)
  if (Number.isNaN(then.getTime())) return null
  return Math.floor((now.getTime() - then.getTime()) / 86400000)
}

export function formatMarketAge(dateStr, now = new Date()) {
  const d = daysBetween(dateStr, now)
  if (d == null) return null
  if (d <= 0) return 'heute'
  if (d === 1) return 'gestern'
  return `vor ${d} Tagen`
}

export function isStale(dateStr, now = new Date()) {
  const d = daysBetween(dateStr, now)
  return d == null ? false : d > STALE_AFTER_DAYS
}

export default function DataProvenanceBar({
  marketMeta = null,
  rankingSource = null,
  draftMode = 'redraft',
  hasCsvBoard = false,
  csvFileName = '',
  onRefresh,
  refreshing = false,
  error = null,
  now = new Date(),
}) {
  const mode = MODE_LABEL[draftMode] || draftMode

  // Die Zeile luegt nie: beim CSV-Board gibt es nichts zu aktualisieren.
  if (hasCsvBoard) {
    return (
      <div className="provenance-bar">
        <span className="provenance-item">
          <Icon name="clipboard" size={13} /> Rangliste &amp; ADP aus CSV
          {csvFileName ? <> · {csvFileName}</> : null}
        </span>
        <span className="provenance-item">Modus <strong>{mode}</strong></span>
      </div>
    )
  }

  const age = formatMarketAge(marketMeta?.end_date, now)
  const stale = isStale(marketMeta?.end_date, now)

  return (
    <div className="provenance-bar">
      {/* Alt-Boards ohne gespeicherte Quelle: fallback FantasyCalc, das war
          vor dem FantasyPros-Import die einzige Markt-Rangliste. */}
      <span className="provenance-item">Rangliste <strong>{rankingSource || 'FantasyCalc'}</strong></span>
      {marketMeta ? (
        <span className={`provenance-item${stale ? ' provenance-stale' : ''}`}>
          ADP <strong>{ADP_SOURCE_LABEL[marketMeta.source] || 'Fantasy Football Calculator'}</strong>
          {marketMeta.total_drafts ? <>, {marketMeta.total_drafts} Mocks</> : null}
          {marketMeta.format ? <> ({FORMAT_LABEL[marketMeta.format] || marketMeta.format})</> : null}
          {age ? <> · Stand <strong>{age}</strong></> : null}
        </span>
      ) : (
        <span className="provenance-item provenance-stale">
          <Icon name="warning" size={13} /> ADP fehlt
        </span>
      )}
      <span className="provenance-item">Modus <strong>{mode}</strong></span>
      {onRefresh && (
        <button className="btn-compact" onClick={onRefresh} disabled={refreshing} title="Marktdaten neu laden — deine Reihenfolge bleibt">
          {refreshing ? '…' : <Icon name="refresh" size={13} />} Aktualisieren
        </button>
      )}
      {error && <span className="provenance-item provenance-stale">{error}</span>}
    </div>
  )
}
