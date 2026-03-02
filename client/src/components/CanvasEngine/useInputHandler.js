/**
 * useInputHandler — pointer events → VisualStore, driven by the selected tool.
 *
 * The active tool determines what element is created on pen-up.
 * No gesture classification — the user's intent is explicit via the palette.
 *
 *   freehand      → shape { type: 'freehand', points }
 *   rectangle     → shape { type: 'rectangle', ...boundingRect }
 *   ellipse       → shape { type: 'ellipse',   ...boundingRect }
 *   line          → arrow { type: 'undirected', start, end }
 *   arrow         → arrow { type: 'directional', start, end }
 *   bidirectional → arrow { type: 'bidirectional', start, end }
 *   select        → no drawing (handled by SelectTool, Phase 1 step 9)
 */

import { useCallback } from 'react'
import { useStrokeAccumulator } from './useStrokeAccumulator'
import { useVisualStore } from '../../store/VisualStoreContext'
import { createShape, createArrow, ACTIONS } from '../../store/visualStore'

// ---------------------------------------------------------------------------
// Snap helpers
// ---------------------------------------------------------------------------

function boundingRect(pts) {
  const xs = pts.map(p => p.x)
  const ys = pts.map(p => p.y)
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y }
}

function buildElement(tool, points, styleState) {
  const roughness = styleState?.globalRoughness ?? 1.5

  switch (tool) {
    case 'rectangle': {
      const r = boundingRect(points)
      return { kind: 'shape', element: createShape({ type: 'rectangle', ...r, roughness }) }
    }
    case 'ellipse': {
      const r = boundingRect(points)
      return { kind: 'shape', element: createShape({ type: 'ellipse', ...r, roughness }) }
    }
    case 'line': {
      return {
        kind: 'arrow',
        element: createArrow({ type: 'undirected', startPoint: points[0], endPoint: points[points.length - 1] }),
      }
    }
    case 'arrow': {
      return {
        kind: 'arrow',
        element: createArrow({ type: 'directional', startPoint: points[0], endPoint: points[points.length - 1] }),
      }
    }
    case 'bidirectional': {
      return {
        kind: 'arrow',
        element: createArrow({ type: 'bidirectional', startPoint: points[0], endPoint: points[points.length - 1] }),
      }
    }
    case 'freehand':
    default:
      return { kind: 'shape', element: createShape({ type: 'freehand', points, roughness }) }
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useInputHandler({ svgRef, screenToDiagram, activeTool = 'freehand' }) {
  const { dispatch, store } = useVisualStore()
  const { startStroke, addPoint, finishStroke, cancelStroke, isDrawing, stroke } =
    useStrokeAccumulator()

  // Tools that draw on the canvas (select handled separately later)
  const isDrawingTool = activeTool !== 'select'

  const todiagram = useCallback((e) => {
    const rect = svgRef.current?.getBoundingClientRect() ?? { left: 0, top: 0 }
    return screenToDiagram(e.clientX - rect.left, e.clientY - rect.top)
  }, [svgRef, screenToDiagram])

  const onPointerDown = useCallback((e) => {
    if (e.button !== 0 || !isDrawingTool) return
    e.currentTarget.setPointerCapture(e.pointerId)
    startStroke(todiagram(e))
  }, [isDrawingTool, startStroke, todiagram])

  const onPointerMove = useCallback((e) => {
    if (!isDrawing) return
    addPoint(todiagram(e))
  }, [isDrawing, addPoint, todiagram])

  const onPointerUp = useCallback((e) => {
    if (e.button !== 0 || !isDrawing) return
    const points = finishStroke()
    if (points.length < 2) return

    const { kind, element } = buildElement(activeTool, points, store.styleState)
    dispatch({
      type:    kind === 'arrow' ? ACTIONS.ADD_ARROW : ACTIONS.ADD_SHAPE,
      payload: element,
    })
  }, [isDrawing, finishStroke, activeTool, dispatch, store.styleState])

  const onPointerCancel = useCallback(() => {
    cancelStroke()
  }, [cancelStroke])

  return {
    isDrawing,
    stroke,
    drawHandlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel },
  }
}
