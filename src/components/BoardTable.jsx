// src/components/BoardTable.jsx
import React, { useMemo, useRef, useEffect, useState } from 'react'
import { cx } from '../utils/formatting'
import { PlayerPreference } from '../services/preferences'

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
}) {
  // Helpers für Highlight-Logik (AI/ALT)
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

  useEffect(() => {
    function onDocClick(e) {
      if (!menuRef.current) return
      if (!menuRef.current.contains(e.target)) setMenuOpenFor(null)
    }
    function onKey(e) {
      if (e.key === 'Escape') setMenuOpenFor(null)
    }
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
    // Grobmaße des Popups (Breite~120, Höhe~40); wir clampen gegen Fenstergröße
    const pad = 8
    const menuW = 120
    const menuH = 44
    const vw = window.innerWidth
    const vh = window.innerHeight
    const x = Math.max(pad, Math.min(clickX - menuW / 2, vw - menuW - pad))
    const y = Math.max(pad, Math.min(clickY + 12, vh - menuH - pad)) // etwas unterhalb vom Klick
    setMenuPos({ x, y })
    setMenuOpenFor(player.player_id || player.id)
  }

  function setPref(playerId, pref) {
    if (onSetPlayerPref) onSetPlayerPref(playerId, pref)
    setMenuOpenFor(null)
  }

  const rows = useMemo(() => filteredPlayers || [], [filteredPlayers])

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
              <th className="col-rk">#</th>
              <th className="col-name">Name</th>
              <th className="col-team">Team</th>
              <th className="col-pos">Pos</th>
              <th className="col-bye">Bye</th>
              <th className="col-sos">SOS</th>
              <th className="col-ecr">ECR±ADP</th>
              <th className="col-pick">Pick</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((p) => {
              const keyN = toKey(p.nname || p.name)
              const isHighlighted = highlightSet.has(keyN)
              const isPrimary = primaryKey && keyN === primaryKey
              const reason = (adviceReasons && adviceReasons[keyN]) || ''
              const pid = p.player_id || p.id
              const pref = playerPrefs ? (playerPrefs[pid] || null) : null

              return (
                <tr
                  key={`${p.id ?? p.nname ?? p.name}`}
                  id={`row-${p.nname}`}
                  className={cx(
                    p.status === 'me' && 'row-me',
                    p.status === 'other' && 'row-other',
                    isHighlighted && 'row-ai',
                    isPrimary && 'row-ai-primary'
                  )}
                  title={reason || undefined}
                  data-nname={p.nname || ''}
                  data-ai={isHighlighted ? (isPrimary ? 'primary' : 'alt') : 'none'}
                >
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

                      {/* AI/ALT Badges – jetzt layout-stabil */}
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

                    {/* Mobile-Subline: kompakte Zusatzinfos */}
                    <div className="row-subline mobile-only">
                      {p.team} · {p.pos}
                      {p.bye ? ` · Bye ${p.bye}` : ''}
                      {p.sos ? ` · SOS ${p.sos}` : ''}
                      {p.ecrVsAdp ? ` · Δ ${p.ecrVsAdp}` : ''}
                    </div>
                  </td>

                  <td className="col-team">{p.team}</td>
                  <td className="col-pos">{p.pos}</td>
                  <td className="col-bye">{p.bye}</td>
                  <td className="col-sos">{p.sos}</td>
                  <td className="col-ecr">{p.ecrVsAdp}</td>
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
