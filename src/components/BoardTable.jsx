// src/components/BoardTable.jsx
import React, { useMemo, useRef, useEffect, useState } from 'react'
import { cx } from '../utils/formatting'
import { PlayerPreference, playerKey } from '../services/preferences'
import Icon from './Icon'

// Konvention: adp - rk, positiv = Value (faellt dir zu).
// Nicht umdrehen — csv.js:56 und useDraftTips.js:89 haengen daran.
export function deltaAdp(p) {
  const rk = Number(p?.rk)
  const adp = p?.adp
  if (Number.isFinite(rk) && Number.isFinite(adp)) return Math.round((adp - rk) * 10) / 10
  if (!p?.ecrVsAdp) return null
  const csvDelta = Number(String(p.ecrVsAdp).replace('+', ''))
  return Number.isFinite(csvDelta) ? csvDelta : null
}

export function formatDeltaAdp(d) {
  if (d == null || !Number.isFinite(Number(d))) return '—'
  const n = Math.round(Number(d) * 10) / 10
  return n > 0 ? `+${n}` : String(n)
}

export default function BoardTable({
  filteredPlayers,
  highlightedNnames = [],
  primaryNname = null,
  adviceReasons = {},
  playerPrefs = {},
  onSetPlayerPref,
  onReorder,
  draftMode = 'redraft',
}) {
  const isRookie = draftMode === 'rookie'
  const hasBye          = useMemo(() => (filteredPlayers || []).some(p => p.bye), [filteredPlayers])
  const hasSos          = useMemo(() => (filteredPlayers || []).some(p => p.sos), [filteredPlayers])
  const hasAdp          = useMemo(() => (filteredPlayers || []).some(p => p.adp != null || p.ecrVsAdp), [filteredPlayers])
  const hasDynastyValue = useMemo(() => (filteredPlayers || []).some(p => p.dynasty_value != null), [filteredPlayers])
  const toKey = (s) => String(s || '').trim().toLowerCase()
  const highlightSet = useMemo(
    () => new Set((highlightedNnames || []).map(toKey)),
    [highlightedNnames]
  )
  const primaryKey = useMemo(() => toKey(primaryNname), [primaryNname])

  // Popup-State
  const [menuOpenFor, setMenuOpenFor] = useState(null)
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 })
  const menuRef = useRef(null)

  // DnD State (Desktop-HTML5-DnD)
  const [draggedNname, setDraggedNname] = useState(null)
  const [dragOverNname, setDragOverNname] = useState(null)

  // Mobile Reorder per Long-Press + Pfeil-Menu.
  // Long-Press (>= 350 ms) auf einer Zeile oeffnet ein kleines Overlay mit
  // Pfeil-Buttons zum Hoch-/Runterschieben. Einfacher als freier Drag —
  // kein Ghost, kein Scroll-Konflikt.
  const [reorderMenu, setReorderMenu] = useState(null) // { nname, top, bottom } oder null
  const longPressTimer = useRef(null)
  const longPressStartY = useRef(0)
  const longPressActive = useRef(false)
  const reorderMenuRef = useRef(null)

  function openReorderMenu(tr, nname) {
    const rect = tr.getBoundingClientRect()
    setReorderMenu({ nname, top: rect.top, bottom: rect.bottom })
  }
  function closeReorderMenu() {
    setReorderMenu(null)
  }
  // Per-Zeile pointer handler. pointerdown (nur touch) startet den Timer;
  // bewegt sich der Finger zu weit oder kommt pointerup zu frueh, wird der
  // Timer abgebrochen.
  function onRowPointerDown(e, nname) {
    if (e.pointerType !== 'touch' && e.pointerType !== 'pen') return
    const tr = e.currentTarget
    clearTimeout(longPressTimer.current)
    longPressActive.current = false
    longPressStartY.current = e.clientY
    longPressTimer.current = setTimeout(() => {
      longPressActive.current = true
      // Haptisches Feedback, wenn verfuegbar — macht das "Menue ist offen"
      // spuerbar ohne ein lauter Vibrieren.
      if (window.navigator && window.navigator.vibrate) window.navigator.vibrate(25)
      openReorderMenu(tr, nname)
    }, 350)
  }
  function onRowPointerMove(e) {
    if (!longPressTimer.current) return
    // Finger weiter als 10px bewegt -> kein Long-Press, Timer abbrechen
    if (Math.abs(e.clientY - longPressStartY.current) > 10) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }
  function onRowPointerUp() {
    clearTimeout(longPressTimer.current)
    longPressTimer.current = null
  }
  // prevRow / nextRow der Ziel-Zeile im gefilterten Array
  const reorderNeighbors = useMemo(() => {
    if (!reorderMenu) return { prev: null, next: null }
    const arr = filteredPlayers || []
    const idx = arr.findIndex((p) => p.nname === reorderMenu.nname)
    if (idx === -1) return { prev: null, next: null }
    return {
      prev: idx > 0 ? arr[idx - 1] : null,
      next: idx < arr.length - 1 ? arr[idx + 1] : null,
    }
  }, [reorderMenu, filteredPlayers])
  function moveStep(direction) {
    if (!reorderMenu || !onReorder) return
    const target = direction === 'up' ? reorderNeighbors.prev : reorderNeighbors.next
    if (target) onReorder(reorderMenu.nname, target.nname)
    // Menu bleibt offen, damit der User mehrfach schieben kann
  }
  useEffect(() => {
    function onDocPointer(e) {
      if (!reorderMenu) return
      const target = e.target
      // Klick innerhalb des Menues ignoriert
      if (reorderMenuRef.current && reorderMenuRef.current.contains(target)) return
      closeReorderMenu()
    }
    function onKey(e) {
      if (e.key === 'Escape') closeReorderMenu()
    }
    function onScroll() {
      // Bei Scroll das Menu schliessen, damit es nicht an der alten Position haengt
      closeReorderMenu()
    }
    document.addEventListener('pointerdown', onDocPointer)
    document.addEventListener('keydown', onKey)
    document.addEventListener('scroll', onScroll, { capture: true })
    return () => {
      document.removeEventListener('pointerdown', onDocPointer)
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('scroll', onScroll, true)
    }
  }, [reorderMenu])

  useEffect(() => {
    function onDocClick(e) {
      if (!menuRef.current) return
      if (!menuRef.current.contains(e.target)) setMenuOpenFor(null)
    }
    function onKey(e) {
      if (e.key === 'Escape') setMenuOpenFor(null)
    }
  document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
      return () => {
        document.removeEventListener('mousedown', onDocClick)
        document.removeEventListener('keydown', onKey)
      }
  }, [])

  function openPrefMenu(e, player) {
    e.preventDefault()
    const clickX = e.clientX
    const clickY = e.clientY
    const pad = 8
    const menuW = 120
    const menuH = 44
    const vw = window.innerWidth
    const vh = window.innerHeight
    const x = Math.max(pad, Math.min(clickX - menuW / 2, vw - menuW - pad))
    const y = Math.max(pad, Math.min(clickY + 12, vh - menuH - pad))
    setMenuPos({ x, y })
    setMenuOpenFor(playerKey(player))
  }

  function setPref(playerId, pref) {
    if (onSetPlayerPref) onSetPlayerPref(playerId, pref)
    setMenuOpenFor(null)
  }

  const rows = useMemo(() => filteredPlayers || [], [filteredPlayers])

  const canDrag = !!onReorder

  return (
    <>
      {/* Table — Fortschritt zeigt die Meta-Zeile (DataProvenanceBar) bzw.
          mobil die kompakte .board-status-line */}
      <div className="table-wrap mt-3">
        <table className="nowrap board-table">
          <thead>
            <tr>
              {canDrag && <th className="col-drag" title="Reihenfolge per Drag-and-Drop anpassen" />}
              <th className="col-rk">#</th>
              <th className="col-name">Name</th>
              <th className="col-team">Team</th>
              <th className="col-pos">Pos</th>
              {hasAdp          && <th className="col-adp" title="Average Draft Position">ADP</th>}
              {hasAdp          && <th className="col-delta" title="ADP minus Rang — positiv heisst, er faellt dir zu">Δ ADP</th>}
              {hasBye          && <th className="col-bye">Bye</th>}
              {hasSos          && <th className="col-sos">SOS</th>}
              {/* Das Feld heisst historisch dynasty_value, traegt im Redraft aber den
                  FantasyCalc-Redraft-Wert (isDynasty=false). "Dyn.Val" waere dort schlicht
                  gelogen — der Kopf richtet sich deshalb nach dem Modus, nicht nach dem Feldnamen. */}
              {hasDynastyValue && (
                <th className="col-dyn" title={isRookie ? 'Dynasty-Wert (FantasyCalc)' : 'Marktwert (FantasyCalc)'}>
                  {isRookie ? 'Dyn.Val' : 'Wert'}
                </th>
              )}
              <th className="col-pick">Pick</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((p) => {
              const keyN = toKey(p.nname || p.name)
              const isHighlighted = highlightSet.has(keyN)
              const isPrimary = primaryKey && keyN === primaryKey
              const reason = (adviceReasons && adviceReasons[keyN]) || ''
              const pref = playerPrefs[playerKey(p)] || null
              const isDragOver = dragOverNname === p.nname
              const isDragging = draggedNname === p.nname
              // Mobile-Reorder: lange gedrueckte Zeile hervorheben
              const isReorderTarget = reorderMenu && reorderMenu.nname === p.nname

              return (
                <tr
                  key={playerKey(p)}
                  id={`row-${p.nname}`}
                  className={cx(
                    p.status === 'me' && 'row-me',
                    p.status === 'other' && 'row-other',
                    isHighlighted && 'row-ai',
                    isPrimary && 'row-ai-primary',
                    isDragging && 'row-dragging',
                    isDragOver && 'row-drag-over',
                    isReorderTarget && 'row-reorder-active',
                  )}
                  title={reason || undefined}
                  data-nname={p.nname || ''}
                  data-pos={p.pos ? String(p.pos).toLowerCase() : undefined}
                  data-ai={isHighlighted ? (isPrimary ? 'primary' : 'alt') : 'none'}
                  draggable={canDrag}
                  onDragStart={canDrag ? () => setDraggedNname(p.nname) : undefined}
                  onDragOver={canDrag ? (e) => { e.preventDefault(); setDragOverNname(p.nname) } : undefined}
                  onDragEnd={canDrag ? () => { setDraggedNname(null); setDragOverNname(null) } : undefined}
                  onDrop={canDrag ? (e) => {
                    e.preventDefault()
                    if (draggedNname && draggedNname !== p.nname) onReorder(draggedNname, p.nname)
                    setDraggedNname(null)
                    setDragOverNname(null)
                  } : undefined}
                  // Long-Press auf Touch: oeffnet das Reorder-Pfeil-Menue.
                  // Wir nutzen Pointer-Events (statt Touch-Events), weil die
                  // auch auf Tablet/Stylus funktionieren und zuverlässiger
                  // gebubblt werden als reine Touch-Events auf <tr>.
                  onPointerDown={(e) => {
                    if (!canDrag) return
                    onRowPointerDown(e, p.nname)
                  }}
                  onPointerMove={onRowPointerMove}
                  onPointerUp={onRowPointerUp}
                  onPointerCancel={onRowPointerUp}
                >
                  {canDrag && (
                    <td className="col-drag" style={{ cursor: 'grab', color: 'var(--text-muted, #888)', userSelect: 'none' }}>
                      ⠿
                    </td>
                  )}
                  <td className="col-rk">{p.rk}</td>

                  <td className="col-name">
                    {/* .mcol ist auf Mobile eine 2-Spalten-Zeile (Name/Team·Pos
                        links, ADP/Δ·Bye rechts); auf dem Desktop ein simpler
                        Block, der nur den Namen zeigt (Team/Pos/ADP haben dort
                        eigene Spalten, die Mobile-Teile sind .mobile-only). */}
                    <div className="mcol">
                      <div className="mcol-main">
                        <div
                          className="cell-content"
                          style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}
                        >
                          <button
                            className={cx(
                              'player-name-btn',
                              pref === PlayerPreference.FAVORITE && 'is-favorite',
                              pref === PlayerPreference.AVOID && 'is-avoid'
                            )}
                            onClick={(e) => openPrefMenu(e, p)}
                            title="Präferenz setzen"
                          >
                            {pref === PlayerPreference.FAVORITE && (
                              <span className="pref-icon pref-fav" aria-hidden>
                                <Icon name="star" size={13} />
                              </span>
                            )}
                            {pref === PlayerPreference.AVOID && (
                              <span className="pref-icon pref-avoid" aria-hidden>
                                <Icon name="x" size={13} />
                              </span>
                            )}
                            <span className="player-name-text">{p.name}</span>
                          </button>

                          {/* AI/ALT Badges */}
                          <span className="ai-badge-wrap">
                            {isHighlighted && (
                              <span
                                className={cx(
                                  'ai-badge',
                                  isPrimary ? 'ai-badge-primary' : 'ai-badge-alt'
                                )}
                                title={isPrimary ? 'Primäre AI-Empfehlung' : 'AI-Alternative'}
                              >
                                {isPrimary ? 'AI' : 'alt'}
                              </span>
                            )}
                          </span>
                        </div>

                        <div className="mcol-teampos mobile-only">
                          {p.team} · {p.pos}
                          {hasSos && p.sos ? ` · SOS ${p.sos}` : ''}
                          {hasDynastyValue && p.dynasty_value != null ? ` · ${p.dynasty_value}` : ''}
                        </div>
                      </div>

                      {hasAdp && (() => {
                        const d = deltaAdp(p)
                        const deltaCls = d == null ? '' : d > 0 ? 'rs-delta-good' : d < 0 ? 'rs-delta-bad' : ''
                        return (
                          <div className="mcol-stats mobile-only">
                            <div className="mcol-adp">{p.adp != null ? Math.round(p.adp * 10) / 10 : '—'}</div>
                            <div className="mcol-sub">
                              <span className={deltaCls}>Δ{formatDeltaAdp(d)}</span>
                              {hasBye && p.bye ? ` · Bye ${p.bye}` : ''}
                            </div>
                          </div>
                        )
                      })()}
                    </div>
                  </td>

                  <td className="col-team">{p.team}</td>
                  <td className="col-pos">
                    {p.pos ? <span className={cx('pos-badge', String(p.pos).toLowerCase())}>{p.pos}</span> : null}
                  </td>
                  {hasAdp && <td className="col-adp">{p.adp != null ? Math.round(p.adp * 10) / 10 : '—'}</td>}
                  {hasAdp && (() => {
                    const d = deltaAdp(p)
                    return (
                      <td className={`col-delta${d == null ? '' : d > 0 ? ' delta-good' : d < 0 ? ' delta-bad' : ''}`}>
                        {formatDeltaAdp(d)}
                      </td>
                    )
                  })()}
                  {hasBye          && <td className="col-bye">{p.bye}</td>}
                  {hasSos          && <td className="col-sos">{p.sos}</td>}
                  {hasDynastyValue && <td className="col-dyn">{p.dynasty_value ?? ''}</td>}
                  <td className="col-pick">{p.pick_no || ''}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Mini-Popup für Präferenzen */}
      {menuOpenFor && (
        <div
          ref={menuRef}
          className="pref-menu"
          style={{ left: `${menuPos.x}px`, top: `${menuPos.y}px` }}
        >
          <button
            className="pref-action"
            onClick={() => setPref(menuOpenFor, PlayerPreference.FAVORITE)}
            title="Favorite"
            aria-label="Favorite"
          >
            <Icon name="star" size={15} />
          </button>
          <button
            className="pref-action"
            onClick={() => setPref(menuOpenFor, null)}
            title="Neutral"
            aria-label="Neutral"
          >
            •
          </button>
          <button
            className="pref-action"
            onClick={() => setPref(menuOpenFor, PlayerPreference.AVOID)}
            title="Avoid"
            aria-label="Avoid"
          >
            <Icon name="x" size={15} />
          </button>
        </div>
      )}

      {/* Reorder-Pfeil-Menue (Mobile): erscheint nach Long-Press auf einer
          Zeile und bietet ↑/↓-Buttons zum schrittweisen Verschieben.
          Position: fixed rechts neben der Zeile (bei Platzmangel links). */}
      {reorderMenu && (
        <div
          ref={reorderMenuRef}
          className="reorder-menu"
          style={{
            position: 'fixed',
            right: 8,
            top: (reorderMenu.top + reorderMenu.bottom) / 2 - 36,
            zIndex: 80,
          }}
        >
          <button
            type="button"
            className="reorder-btn"
            onClick={() => moveStep('up')}
            disabled={!reorderNeighbors.prev}
            aria-label="Player eine Position nach oben"
            title="Hoch"
          >
            <Icon name="chevron-up" size={22} />
          </button>
          <button
            type="button"
            className="reorder-btn"
            onClick={() => moveStep('down')}
            disabled={!reorderNeighbors.next}
            aria-label="Player eine Position nach unten"
            title="Runter"
          >
            <Icon name="chevron-down" size={22} />
          </button>
          <button
            type="button"
            className="reorder-btn reorder-close"
            onClick={closeReorderMenu}
            aria-label="Verschieben beenden"
            title="Schließen"
          >
            <Icon name="x" size={18} />
          </button>
        </div>
      )}
    </>
  )
}
