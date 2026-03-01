/**
 * useInputHandler — wires pointer events → StrokeAccumulator → GestureRecogniser → VisualStore.
 *
 * Active mode: 'freehand' (default for Phase 1 — all gestures go through recogniser).
 * On pen-up the stroke is:
 *   1. Passed to the $1 recogniser
 *   2. If confidence ≥ MIN_CONFIDENCE → geometry is derived and element added to store
 *   3. Otherwise → added as a raw freehand path
 *
 * Returns { drawHandlers } — pointer event handlers to spread onto the <svg> element.
 * The activeTool prop controls the active drawing mode.
 */

import { useCallback } from 'react'
import { useStrokeAccumulator } from './useStrokeAccumulator'
import { useVisualStore } from '../../store/VisualStoreContext'
import { createShape, createArrow, ACTIONS } from '../../store/visualStore'
import recogniser, { MIN_CONFIDENCE } from '../../gestures/gestureTemplates'

// ---------------------------------------------------------------------------
// Geometry helpers: derive clean element geometry from raw stroke points
// ---------------------------------------------------------------------------

function boundingRect(pts) {
  const xs = pts.map(p => p.x)
  const ys = pts.map(p => p.y)
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y }
}

function buildElement(gestureName, points, styleState) {
  const roughness = styleState?.globalRoughness ?? 1.5

  switch (gestureName) {
    case 'boundary': {
      const r = boundingRect(points)
      return {
        kind:    'shape',
        element: createShape({ type: 'boundary', ...r, roughness: roughness + 0.4, fill: 'none' }),
      }
    }
    case 'circle': {
      const r = boundingRect(points)
      return {
        kind:    'shape',
        element: createShape({ type: 'circle', ...r, roughness }),
      }
    }
    case 'arrow': {
      // Use stroke endpoints as start/end; ignore head points added in template
      return {
        kind:    'arrow',
        element: createArrow({
          type:       'directional',
          startPoint: points[0],
          endPoint:   points[points.length - 1],
        }),
      }
    }
    case 'zigzag': {
      // Render as a freehand path with tension styling
      return {
        kind:    'shape',
        element: createShape({
          type:        'freehand',
          points,
          stroke:      '#dc2626',
          strokeWidth: 2.5,
          roughness:   roughness + 0.5,
        }),
      }
    }
    default: {
      // Freehand fallback
      return {
        kind:    'shape',
        element: createShape({ type: 'freehand', points, roughness }),
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useInputHandler({ svgRef, screenToDiagram, activeTool = 'freehand' }) {
  const { dispatch, store } = useVisualStore()
  const { startStroke, addPoint, finishStroke, cancelStroke, isDrawing, stroke } =
    useStrokeAccumulator()

  const todiagram = useCallback((e) => {
    const rect = svgRef.current?.getBoundingClientRect() ?? { left: 0, top: 0 }
    return screenToDiagram(e.clientX - rect.left, e.clientY - rect.top)
  }, [svgRef, screenToDiagram])

  const onPointerDown = useCallback((e) => {
    if (e.button !== 0) return                    // left button only
    if (activeTool !== 'freehand') return
    e.currentTarget.setPointerCapture(e.pointerId)
    startStroke(todiagram(e))
  }, [activeTool, startStroke, todiagram])

  const onPointerMove = useCallback((e) => {
    if (!isDrawing) return
    addPoint(todiagram(e))
  }, [isDrawing, addPoint, todiagram])

  const onPointerUp = useCallback((e) => {
    if (e.button !== 0 || !isDrawing) return
    const points = finishStroke()
    if (points.length < 3) return                 // too short, ignore

    const result = recogniser.recognise(points)
    const gestureName = (result && result.confidence >= MIN_CONFIDENCE)
      ? result.name
      : 'freehand'

    const { kind, element } = buildElement(gestureName, points, store.styleState)
    dispatch({
      type:    kind === 'arrow' ? ACTIONS.ADD_ARROW : ACTIONS.ADD_SHAPE,
      payload: element,
    })
  }, [isDrawing, finishStroke, dispatch, store.styleState])

  const onPointerCancel = useCallback(() => {
    cancelStroke()
  }, [cancelStroke])

  return {
    isDrawing,
    stroke,
    drawHandlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
    },
  }
}
