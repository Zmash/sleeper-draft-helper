// src/hooks/useTouchReorder.js
//
// Touch-Fenster-fuer-DnD auf dem Board. HTML5-`draggable` funktioniert nur
// mit Maus — auf Touch-Geraeten gibt es keine Drag-Events. Dieser Hook
// ergaenzt also rein touch/pen-Aktionen, Maus bleibt beim bestehenden
// HTML5-DnD in BoardTable.jsx.
//
// Ablauf:
//   1. onPointerDown(e) pro Zeile. Filtert auf pointerType === 'touch'
//      (oder 'pen'), startet einen Long-Press-Timer (LONG_PRESS_MS).
//   2. Nach Ablauf des Timers: "active" = true, Ghost-Zeile erscheint,
//      Pointer wird captured, document-Listener auf pointermove/-up registriert.
//   3. pointermove: dy (= Finger relativ zum Start) wird per RAF auf den
//      Ghost angewendet. Ausserdem wird via findTarget() die Drop-Position
//      (target-Nname + above/below) bestimmt und als `insert` exponiert.
//   4. pointerup/cancel: Drop ausfuehren (onReorder(source, target, direction)),
//      Listener abbauen, Ghost/insert zuruecksetzen.
//
// Auto-Scroll: waehrend pointermove pruefen wir, ob der Finger im
// EDGE_ZONE_PX-Bereich des naechstliegenden .table-wrap-Containers ist.
// Wenn ja, scrollen wir per RAF und refetchen die Zeilen-Rektangles.
//
// API:
//   const { ghost, insert, handlers } = useTouchReorder({ onReorder })
//   ...handlers(nname)        => { onPointerDown } — pro <tr> setzen
//   ghost: { nname, dy }|null
//   insert: { nname, dir: 'above'|'below' } | null

import { useCallback, useEffect, useRef, useState } from 'react'

const LONG_PRESS_MS = 300
const EDGE_ZONE_PX = 60   // Scroll-Auto-Trigger nahe dem Container-Rand
const AUTO_SCROLL_SPEED = 18  // px / Frame

const noop = () => {}

export default function useTouchReorder({ onReorder } = {}) {
  const [ghost, setGhost] = useState(null)   // { nname, dy }
  const [insert, setInsert] = useState(null) // { nname, dir }

  // Der gesamte Mutable-State steckt in einem ref, damit die document-Listener
  // keine stale-Closures erzeugen. React-State bleibt nur fuer das Rendering
  // (ghost/insert) und wird synchron aus drag.current nachgezogen.
  const drag = useRef({
    active: false,
    pressTimer: null,
    pointerId: null,
    source: null,
    sourceEl: null,
    listEl: null,
    startY: 0,
    pendingDy: 0,
    pendingClientY: 0,
    rows: [],
    lastTarget: null,
    rafId: null,
    bodyTouchAction: null,
    bound: false,
  })

  // Snapshot aller Zeilen inkl. Bounding-Rects. Wir iterieren ueber die
  // <tbody>-Kinder; die Quell-Zeile wird NICHT uebersprungen (ihre Position
  // bleibt im Layout erhalten — wir rendern sie nur als Ghost obendrauf).
  const snapshotRows = (listEl) => {
    const trs = listEl.querySelectorAll('tr[data-nname]')
    const out = []
    for (const el of trs) {
      const nname = el.dataset.nname
      if (!nname) continue
      const r = el.getBoundingClientRect()
      out.push({ nname, top: r.top, bottom: r.bottom, mid: (r.top + r.bottom) / 2 })
    }
    return out
  }

  const findTarget = (rows, y, source) => {
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]
      if (r.nname === source) continue
      if (y < r.mid) return { nname: r.nname, dir: 'above' }
      // Wenn wir unter der Row sind, aber sie ist die source, weiter
      if (i < rows.length - 1) continue
    }
    // Unter der letzten nicht-source Zeile
    for (let i = rows.length - 1; i >= 0; i--) {
      if (rows[i].nname !== source) return { nname: rows[i].nname, dir: 'below' }
    }
    return null
  }

  // Event-Handler als stabile Refs, damit die document.bind/unbind konsistent
  // dieselben Funktionen trifft auch wenn die Komponente re-rendert.
  const handlersRef = useRef({ move: noop, up: noop })

  const cancelRaf = () => {
    if (drag.current.rafId) cancelAnimationFrame(drag.current.rafId)
    drag.current.rafId = null
  }

  const cancelAll = useCallback(() => {
    const d = drag.current
    if (d.pressTimer) clearTimeout(d.pressTimer)
    d.pressTimer = null
    cancelRaf()
    if (d.bound) {
      document.removeEventListener('pointermove', handlersRef.current.move)
      document.removeEventListener('pointerup', handlersRef.current.up)
      document.removeEventListener('pointercancel', handlersRef.current.up)
      d.bound = false
    }
    if (d.bodyTouchAction !== null) {
      document.body.style.touchAction = d.bodyTouchAction
      d.bodyTouchAction = null
    }
    if (d.sourceEl) {
      try { d.sourceEl.releasePointerCapture(d.pointerId) } catch { /* ignore */ }
    }
    d.active = false
    d.source = null
    d.sourceEl = null
    d.listEl = null
    d.rows = []
    d.lastTarget = null
    d.pointerId = null
    setGhost(null)
    setInsert(null)
  }, [])

  // Cleanup bei Unmount
  useEffect(() => cancelAll, [cancelAll])

  const tick = () => {
    const d = drag.current
    if (!d.active) return

    // Auto-Scroll
    const listEl = d.listEl
    if (listEl) {
      const y = d.pendingClientY
      const rect = listEl.getBoundingClientRect()
      let delta = 0
      if (y - rect.top < EDGE_ZONE_PX) delta = -AUTO_SCROLL_SPEED
      else if (rect.bottom - y < EDGE_ZONE_PX) delta = AUTO_SCROLL_SPEED
      if (delta) {
        listEl.scrollTop += delta
        d.rows = snapshotRows(listEl)
        // Target nach dem Scroll neu bestimmen
        const hit = findTarget(d.rows, d.pendingClientY, d.source)
        const next = hit ? `${hit.nname}:${hit.dir}` : null
        const prev = d.lastTarget
        if (next !== prev) {
          d.lastTarget = next
          setInsert(hit ? { nname: hit.nname, dir: hit.dir } : null)
        }
      }
    }

    setGhost({ nname: d.source, dy: d.pendingDy })
    d.rafId = requestAnimationFrame(tick)
  }

  // onMove/onUp als "lebende" Funktionen, die ueber handlersRef.current
  // stabil an document gebunden werden.
  useEffect(() => {
    handlersRef.current.move = (e) => {
      const d = drag.current
      if (!d.active) return
      // Prevent scroll-while-drag nur auf Touch
      if (e.pointerType === 'touch' || e.pointerType === 'pen') e.preventDefault()
      d.pendingClientY = e.clientY
      d.pendingDy = e.clientY - d.startY
      const hit = findTarget(d.rows, e.clientY, d.source)
      const next = hit ? `${hit.nname}:${hit.dir}` : null
      if (next !== d.lastTarget) {
        d.lastTarget = next
        setInsert(hit ? { nname: hit.nname, dir: hit.dir } : null)
      }
    }
    handlersRef.current.up = () => {
      const d = drag.current
      if (d.pressTimer) {
        // Long-Press laeuft noch — nur ein Tap, abbrechen ohne Commit
        clearTimeout(d.pressTimer)
        d.pressTimer = null
        cancelAll()
        return
      }
      if (d.lastTarget && onReorder) {
        const last = d.lastTarget
        const [nname, dir] = last.split(':')
        onReorder(d.source, nname, dir)
      }
      cancelAll()
    }
  }, [onReorder, cancelAll])

  const onPointerDown = useCallback((rowNname) => (e) => {
    // Maus-Nutzung bleibt beim bestehenden HTML5-DnD — wir hoeren nur auf Touch/Pen
    if (e.pointerType !== 'touch' && e.pointerType !== 'pen') return
    const tr = e.currentTarget
    const listEl = tr.closest('tbody') ? tr.closest('tbody').parentElement.closest('.table-wrap')
                                        : tr.closest('.table-wrap')
    if (!listEl) return

    const d = drag.current
    // Sicherstellen, dass kein Drag parallel laeuft
    if (d.active) return
    if (d.pressTimer) clearTimeout(d.pressTimer)

    d.pressTimer = setTimeout(() => {
      d.pressTimer = null
      d.active = true
      d.source = rowNname
      d.sourceEl = tr
      d.listEl = listEl
      d.pointerId = e.pointerId
      d.startY = e.clientY
      d.pendingDy = 0
      d.pendingClientY = e.clientY
      d.rows = snapshotRows(listEl)
      d.lastTarget = null

      // Pointer capture: Move/Up kommen auch an, wenn der Finger ausserhalb wandert
      try { tr.setPointerCapture(e.pointerId) } catch { /* ignore */ }
      // Touch-Scroll auf document.body unterbinden — wir scrollen selbst
      d.bodyTouchAction = document.body.style.touchAction
      document.body.style.touchAction = 'none'

      // Listener registrieren
      document.addEventListener('pointermove', handlersRef.current.move, { passive: false })
      document.addEventListener('pointerup', handlersRef.current.up)
      document.addEventListener('pointercancel', handlersRef.current.up)
      d.bound = true

      setGhost({ nname: rowNname, dy: 0 })
      d.rafId = requestAnimationFrame(tick)
    }, LONG_PRESS_MS)

    // Waehrend des Long-Press kein Scroll (nur Touch — damit Maus-Klicks
    // auf Buttons etc. weiterhin funktionieren)
    if (e.pointerType === 'touch' || e.pointerType === 'pen') {
      e.preventDefault()
    }
  }, [])

  const handlers = useCallback((rowNname) => ({
    onPointerDown: onPointerDown(rowNname),
  }), [onPointerDown])

  return { ghost, insert, handlers, cancel: cancelAll }
}
