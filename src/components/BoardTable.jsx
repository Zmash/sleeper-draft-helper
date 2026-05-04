// src/components/BoardTable.jsx
import React, { useMemo, useRef, useEffect, useState } from 'react'
import { cx } from '../utils/formatting'
import { PlayerPreference, playerKey } from '../services/preferences'

export default function BoardTable({
  progressPercent,
  pickedCount,
  totalCount,
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
  const hasEcrVsAdp     = useMemo(() => (filteredPlayers || []).some(p => p.ecrVsAdp), [filteredPlayers])
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

  // DnD State
  const [draggedNname, setDraggedNname] = useState(null)
  const [dragOverNname, setDragOverNname] = useState(null)

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
      {/* Progress */}
      <div className="progress mt-2">
        <div style={{ width: `${progressPercent}%` }} />
      </div>
      <div className="muted text-xs mt-1">
        {pickedCount} von {totalCount} Spielern markiert
      </div>

      {/* Table */}
      <div className="table-wrap mt-3">
        <table className="nowrap board-table">
          <thead>
            <tr>
              {canDrag && <th className="col-drag" title="Reihenfolge per Drag-and-Drop anpassen" />}
              <th className="col-rk">#</th>
              <th className="col-name">Name</th>
              <th className="col-team">Team</th>
              <th className="col-pos">Pos</th>
              {hasBye          && <th className="col-bye">Bye</th>}
              {hasSos          && <th className="col-sos">SOS</th>}
              {hasDynastyValue && <th className="col-dyn" title="Dynasty Value">Dyn.Val</th>}
              {hasEcrVsAdp     && <th className="col-ecr">ECR±ADP</th>}
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
                  )}
                  title={reason || undefined}
                  data-nname={p.nname || ''}
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
                >
                  {canDrag && (
                    <td className="col-drag" style={{ cursor: 'grab', color: 'var(--text-muted, #888)', userSelect: 'none' }}>
                      ⠿
                    </td>
                  )}
                  <td className="col-rk">{p.rk}</td>

                  <td className="col-name">
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
                            ⭐
                          </span>
                        )}
                        {pref === PlayerPreference.AVOID && (
                          <span className="pref-icon pref-avoid" aria-hidden>
                            ❌
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

                    {/* Mobile-Subline */}
                    <div className="row-subline mobile-only">
                      {p.team} · {p.pos}
                      {hasBye && p.bye ? ` · Bye ${p.bye}` : ''}
                      {hasSos && p.sos ? ` · SOS ${p.sos}` : ''}
                      {hasDynastyValue && p.dynasty_value != null ? ` · ${p.dynasty_value}` : ''}
                      {hasEcrVsAdp && p.ecrVsAdp ? ` · Δ ${p.ecrVsAdp}` : ''}
                    </div>
                  </td>

                  <td className="col-team">{p.team}</td>
                  <td className="col-pos">{p.pos}</td>
                  {hasBye          && <td className="col-bye">{p.bye}</td>}
                  {hasSos          && <td className="col-sos">{p.sos}</td>}
                  {hasDynastyValue && <td className="col-dyn">{p.dynasty_value ?? ''}</td>}
                  {hasEcrVsAdp     && <td className="col-ecr">{p.ecrVsAdp}</td>}
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
            ⭐
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
            ❌
          </button>
        </div>
      )}
    </>
  )
}
