/**
 * useSelectTool — selection, move, resize, rubber-band, group-aware.
 *
 * Modes (tracked in modeRef):
 *   null         — idle
 *   'move'       — dragging selected element(s)
 *   'resize'     — dragging a corner handle
 *   'rubberband' — dragging on empty canvas to lasso-select
 *
 * Props:
 *   svgRef, screenToDiagram, activeTool
 *   viewportScale  — current viewport zoom; used to size handles in screen pixels
 *   onGroupCreated — called with memberIds[] when rubber-band completes in 'group' tool mode
 *
 * Returns:
 *   selectedIds, setSelectedIds
 *   dragOffset        — { dx, dy } live preview during move
 *   resizePreview     — new bbox { x, y, width, height } during resize, else null
 *   rubberBand        — { x1,y1,x2,y2 } diagram coords during rubber-band, else null
 *   resizeHandles     — [{ id, x, y, cursor }] corner handles; only for single-entity selection
 *   cursor            — CSS cursor string for the SVG element
 *   selectHandlers    — pointer event handlers
 */

import { useState, useCallback, useRef } from 'react'
import { useVisualStore } from '../../store/VisualStoreContext'
import { ACTIONS } from '../../store/visualStore'
import { hitTestAll, elementsWithinRect, elementBBox, groupBBox, unionBBoxes } from './hitTest'

const DRAG_THRESHOLD = 3    // diagram px before a move becomes a drag
const HANDLE_HIT_PX  = 10   // hit-area radius in screen pixels
const SELECTION_PAD  = 6    // padding around selection rect in diagram px

// ---------------------------------------------------------------------------
// Handle geometry
// ---------------------------------------------------------------------------

// Returns 4 corner handle descriptors for a given element bbox.
// Handles are displayed at padded corners; anchor is unpadded opposite corner.
function computeCornerHandles(bbox) {
  const { x, y, width: w, height: h } = bbox
  const P = SELECTION_PAD
  return [
    { id: 'nw', x: x - P,     y: y - P,     anchor: { x: x + w, y: y + h }, initPt: { x,         y         }, cursor: 'nw-resize' },
    { id: 'ne', x: x + w + P, y: y - P,     anchor: { x,        y: y + h }, initPt: { x: x + w,   y         }, cursor: 'ne-resize' },
    { id: 'se', x: x + w + P, y: y + h + P, anchor: { x,        y        }, initPt: { x: x + w,   y: y + h  }, cursor: 'se-resize' },
    { id: 'sw', x: x - P,     y: y + h + P, anchor: { x: x + w, y        }, initPt: { x,           y: y + h }, cursor: 'sw-resize' },
  ]
}

function hitHandle(handles, px, py, hitR) {
  return handles.find(h => Math.hypot(px - h.x, py - h.y) < hitR) ?? null
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useSelectTool({
  svgRef,
  screenToDiagram,
  activeTool,
  viewportScale = 1,
  onGroupCreated,
}) {
  const { store, dispatch } = useVisualStore()

  const [selectedIds,   setSelectedIdsState] = useState(new Set())
  const [dragOffset,    setDragOffset]        = useState({ dx: 0, dy: 0 })
  const [resizePreview, setResizePreview]     = useState(null)
  const [rubberBand,    setRubberBand]        = useState(null)
  const [cursor,        setCursor]            = useState('default')

  const modeRef        = useRef(null)      // null | 'move' | 'resize' | 'rubberband'
  const selectedIdsRef = useRef(new Set())
  const moveRef        = useRef(null)      // { originClient:{x,y}, ids, isDragging }
  const resizeRef      = useRef(null)      // { ox, oy, initPt, origBbox, ids }
  const rubberRef      = useRef(null)      // { x1, y1, additive }

  // Keep a always-current ref to viewportScale so move callbacks never go stale.
  const viewportScaleRef = useRef(viewportScale)
  viewportScaleRef.current = viewportScale

  const enabled = activeTool === 'select' || activeTool === 'group'

  const updateSelected = useCallback((nextSet) => {
    selectedIdsRef.current = nextSet
    setSelectedIdsState(nextSet)
  }, [])

  const todiagram = useCallback((e) => {
    const rect = svgRef.current?.getBoundingClientRect() ?? { left: 0, top: 0 }
    return screenToDiagram(e.clientX - rect.left, e.clientY - rect.top)
  }, [svgRef, screenToDiagram])

  // Compute bbox for an arbitrary set of ids (handles groups)
  const selBBox = useCallback((ids) => {
    const elements = store.elements
    const all = [
      ...(elements.shapes ?? []), ...(elements.arrows ?? []),
      ...(elements.texts  ?? []), ...(elements.icons  ?? []),
      ...(elements.groups ?? []),
    ]
    return unionBBoxes([...ids].map(id => {
      const el = all.find(e => e.id === id)
      if (!el) return null
      return el.kind === 'group' ? groupBBox(el, elements) : elementBBox(el)
    }))
  }, [store.elements])

  // ---- Pointer down ----
  const onPointerDown = useCallback((e) => {
    if (e.button !== 0 || !enabled) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const pt      = todiagram(e)
    const current = selectedIdsRef.current
    const hitR    = HANDLE_HIT_PX / viewportScale

    // 1. Check corner handles (only with single entity selected)
    if (current.size === 1) {
      const bbox = selBBox(current)
      if (bbox) {
        const hHit = hitHandle(computeCornerHandles(bbox), pt.x, pt.y, hitR)
        if (hHit) {
          modeRef.current   = 'resize'
          resizeRef.current = { ox: hHit.anchor.x, oy: hHit.anchor.y, initPt: hHit.initPt, origBbox: bbox, ids: new Set(current) }
          setCursor(hHit.cursor)
          return
        }
      }
    }

    // 2. Hit test elements
    const hit = hitTestAll(store.elements, pt.x, pt.y)

    if (hit) {
      let id = hit.element.id
      // If the hit element belongs to a group, select the group instead
      const ownerGroup = (store.elements.groups ?? []).find(g => g.memberIds.includes(id))
      if (ownerGroup) id = ownerGroup.id

      let nextSet
      if (e.shiftKey) {
        nextSet = new Set(current)
        if (nextSet.has(id)) nextSet.delete(id)
        else nextSet.add(id)
      } else {
        nextSet = current.has(id) ? current : new Set([id])
      }
      updateSelected(nextSet)
      modeRef.current = 'move'
      moveRef.current = { originClient: { x: e.clientX, y: e.clientY }, ids: nextSet, isDragging: false, dx: 0, dy: 0 }
      setCursor('grab')
    } else {
      // Drag on empty canvas → rubber-band
      if (!e.shiftKey) updateSelected(new Set())
      modeRef.current   = 'rubberband'
      rubberRef.current = { x1: pt.x, y1: pt.y, x2: pt.x, y2: pt.y, additive: e.shiftKey }
      setRubberBand({ x1: pt.x, y1: pt.y, x2: pt.x, y2: pt.y })
      setCursor('crosshair')
    }
  }, [enabled, todiagram, store.elements, viewportScale, selBBox, updateSelected])

  // ---- Pointer move ----
  const onPointerMove = useCallback((e) => {
    const mode = modeRef.current
    if (!mode) return
    const pt = todiagram(e)

    if (mode === 'move') {
      const mv    = moveRef.current
      const scale = viewportScaleRef.current
      const rawDx = e.clientX - mv.originClient.x
      const rawDy = e.clientY - mv.originClient.y
      const dx    = rawDx / scale
      const dy    = rawDy / scale
      // Accumulate into the ref so onPointerUp can read the final value directly
      // without going through stale state or anti-pattern side effects in updaters.
      mv.dx = dx
      mv.dy = dy
      if (!mv.isDragging && Math.hypot(rawDx, rawDy) > DRAG_THRESHOLD) mv.isDragging = true
      if (mv.isDragging) { setDragOffset({ dx, dy }); setCursor('grabbing') }
    }

    if (mode === 'resize') {
      const { ox, oy, initPt, origBbox } = resizeRef.current
      const sx = initPt.x !== ox ? Math.max(0.05, (pt.x - ox) / (initPt.x - ox)) : 1
      const sy = initPt.y !== oy ? Math.max(0.05, (pt.y - oy) / (initPt.y - oy)) : 1
      // Accumulate into ref so onPointerUp reads final value directly.
      resizeRef.current.lastSx = sx
      resizeRef.current.lastSy = sy
      setResizePreview({
        x:      ox + (origBbox.x      - ox) * sx,
        y:      oy + (origBbox.y      - oy) * sy,
        width:  Math.max(4, origBbox.width  * sx),
        height: Math.max(4, origBbox.height * sy),
      })
    }

    if (mode === 'rubberband') {
      const rb = rubberRef.current
      rb.x2 = pt.x
      rb.y2 = pt.y
      setRubberBand({ x1: rb.x1, y1: rb.y1, x2: pt.x, y2: pt.y })
    }
  }, [todiagram])

  // ---- Pointer up ----
  const onPointerUp = useCallback((e) => {
    const mode = modeRef.current
    if (!mode) return
    modeRef.current = null
    setCursor('default')

    if (mode === 'move') {
      const mv = moveRef.current
      moveRef.current = null
      // Read dx/dy directly from the ref — avoids calling dispatch inside a state
      // updater (React anti-pattern that can fire twice in Strict Mode).
      if (mv?.isDragging && mv.ids.size > 0 && Math.hypot(mv.dx, mv.dy) > 0.5) {
        dispatch({ type: ACTIONS.MOVE_ELEMENTS, payload: { ids: [...mv.ids], dx: mv.dx, dy: mv.dy } })
      }
      setDragOffset({ dx: 0, dy: 0 })
    }

    if (mode === 'resize') {
      const rs = resizeRef.current
      resizeRef.current = null
      setResizePreview(null)
      if (rs?.lastSx !== undefined && rs.ids.size > 0) {
        dispatch({ type: ACTIONS.SCALE_ELEMENTS, payload: { ids: [...rs.ids], ox: rs.ox, oy: rs.oy, sx: rs.lastSx, sy: rs.lastSy } })
      }
    }

    if (mode === 'rubberband') {
      const rb = rubberRef.current
      rubberRef.current = null
      setRubberBand(null)
      if (rb) {
        const rx = Math.min(rb.x1, rb.x2), ry = Math.min(rb.y1, rb.y2)
        const rw = Math.abs(rb.x2 - rb.x1),  rh = Math.abs(rb.y2 - rb.y1)
        if (rw > 4 && rh > 4) {
          const captured = elementsWithinRect(store.elements, rx, ry, rw, rh)
          if (activeTool === 'group' && captured.length >= 2) {
            onGroupCreated?.(captured)
          } else {
            const nextSet = rb.additive
              ? new Set([...selectedIdsRef.current, ...captured])
              : new Set(captured)
            updateSelected(nextSet)
          }
        }
      }
    }
  }, [dispatch, activeTool, store.elements, onGroupCreated, updateSelected])

  const onPointerCancel = useCallback(() => {
    modeRef.current   = null
    moveRef.current   = null
    resizeRef.current = null
    rubberRef.current = null
    setDragOffset({ dx: 0, dy: 0 })
    setResizePreview(null)
    setRubberBand(null)
    setCursor('default')
  }, [])

  // Corner handles for the active selection (only for single-entity)
  const bbox         = selectedIds.size === 1 ? selBBox(selectedIds) : null
  const resizeHandles = bbox ? computeCornerHandles(bbox) : []

  return {
    selectedIds,
    setSelectedIds: updateSelected,
    dragOffset,
    resizePreview,
    rubberBand,
    resizeHandles,
    cursor,
    selectHandlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel },
  }
}
