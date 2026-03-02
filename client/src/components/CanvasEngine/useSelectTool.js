/**
 * useSelectTool — click-to-select and drag-to-move elements.
 *
 * Behaviour:
 *   Left-click on an element   → select it (clears previous selection)
 *   Shift + left-click          → toggle element in/out of selection
 *   Click empty canvas          → deselect all
 *   Drag selected element(s)    → preview offset via dragOffset; dispatch MOVE_ELEMENTS on pointer-up
 *
 * Returns:
 *   selectedIds   — Set<string> of currently selected element ids
 *   setSelectedIds — setter so the parent can clear on tool change / Escape
 *   dragOffset    — { dx, dy } preview translation applied during a live drag
 *   selectHandlers — pointer event handlers to spread on the SVG element
 */

import { useState, useCallback, useRef } from 'react'
import { useVisualStore } from '../../store/VisualStoreContext'
import { ACTIONS } from '../../store/visualStore'
import { hitTestAll } from './hitTest'

const DRAG_THRESHOLD = 3  // diagram px before a move is treated as a drag

export function useSelectTool({ svgRef, screenToDiagram, activeTool }) {
  const { store, dispatch } = useVisualStore()

  const [selectedIds, setSelectedIds] = useState(new Set())
  const [dragOffset, setDragOffset]   = useState({ dx: 0, dy: 0 })

  // Refs let callbacks read current values without stale closures
  const dragStateRef    = useRef(null)  // { origin, lastPt, ids, isDragging }
  const dragOffsetRef   = useRef({ dx: 0, dy: 0 })
  const selectedIdsRef  = useRef(new Set())

  // Keep ref in sync with state
  const updateSelected = useCallback((nextSet) => {
    selectedIdsRef.current = nextSet
    setSelectedIds(nextSet)
  }, [])

  const enabled = activeTool === 'select'

  const todiagram = useCallback((e) => {
    const rect = svgRef.current?.getBoundingClientRect() ?? { left: 0, top: 0 }
    return screenToDiagram(e.clientX - rect.left, e.clientY - rect.top)
  }, [svgRef, screenToDiagram])

  const onPointerDown = useCallback((e) => {
    if (e.button !== 0 || !enabled) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const pt  = todiagram(e)
    const hit = hitTestAll(store.elements, pt.x, pt.y)

    if (hit) {
      const id      = hit.element.id
      const current = selectedIdsRef.current
      let nextSet

      if (e.shiftKey) {
        // Toggle membership
        nextSet = new Set(current)
        if (nextSet.has(id)) nextSet.delete(id)
        else nextSet.add(id)
      } else {
        // If clicking something already in selection, keep the group; otherwise select only this
        nextSet = current.has(id) ? current : new Set([id])
      }

      updateSelected(nextSet)
      dragStateRef.current  = { origin: pt, ids: nextSet, isDragging: false }
    } else if (!e.shiftKey) {
      updateSelected(new Set())
      dragStateRef.current = null
    }
  }, [enabled, store.elements, todiagram, updateSelected])

  const onPointerMove = useCallback((e) => {
    if (!dragStateRef.current) return
    const pt = todiagram(e)
    const ds = dragStateRef.current
    const dx = pt.x - ds.origin.x
    const dy = pt.y - ds.origin.y

    if (!ds.isDragging && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
      ds.isDragging = true
    }
    if (ds.isDragging) {
      const offset = { dx, dy }
      dragOffsetRef.current = offset
      setDragOffset(offset)
    }
  }, [todiagram])

  const onPointerUp = useCallback(() => {
    const ds = dragStateRef.current
    if (!ds) return
    dragStateRef.current = null

    if (ds.isDragging) {
      const { dx, dy } = dragOffsetRef.current
      if (Math.hypot(dx, dy) > 0.5 && ds.ids.size > 0) {
        dispatch({
          type:    ACTIONS.MOVE_ELEMENTS,
          payload: { ids: [...ds.ids], dx, dy },
        })
      }
      const zero = { dx: 0, dy: 0 }
      dragOffsetRef.current = zero
      setDragOffset(zero)
    }
  }, [dispatch])

  const onPointerCancel = useCallback(() => {
    dragStateRef.current  = null
    const zero = { dx: 0, dy: 0 }
    dragOffsetRef.current = zero
    setDragOffset(zero)
  }, [])

  return {
    selectedIds,
    setSelectedIds: updateSelected,
    dragOffset,
    selectHandlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel },
  }
}
