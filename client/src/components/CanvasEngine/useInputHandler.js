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
 *   text          → calls onTextClick({ screenPos, diagramPos }) on a tap/click
 *   select        → no-op (handled by useSelectTool)
 */

import { useCallback, useRef } from 'react'
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
  const stroke    = styleState?.defaultStroke   ?? '#1a1a2e'
  const fill      = styleState?.defaultFill     ?? 'none'

  switch (tool) {
    case 'rectangle': {
      const r = boundingRect(points)
      return { kind: 'shape', element: createShape({ type: 'rectangle', ...r, roughness, stroke, fill }) }
    }
    case 'ellipse': {
      const r = boundingRect(points)
      return { kind: 'shape', element: createShape({ type: 'ellipse', ...r, roughness, stroke, fill }) }
    }
    case 'line':
    case 'arrow':
    case 'bidirectional': {
      const start = points[0]
      const end   = points[points.length - 1]
      const arrowType = tool === 'line' ? 'undirected' : tool === 'bidirectional' ? 'bidirectional' : 'directional'
      return { kind: 'arrow', element: createArrow({ type: arrowType, startPoint: start, endPoint: end, stroke }) }
    }
    case 'freehand':
    default:
      return { kind: 'shape', element: createShape({ type: 'freehand', points, roughness, stroke }) }
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useInputHandler({ svgRef, screenToDiagram, activeTool = 'freehand', onTextClick }) {
  const { dispatch, store } = useVisualStore()
  const { startStroke, addPoint, finishStroke, cancelStroke, isDrawing, stroke } =
    useStrokeAccumulator()

  // For text-tool click detection: track where pointer went down
  const textDownRef = useRef(null)

  const isDrawingTool = activeTool !== 'select' && activeTool !== 'group' && activeTool !== 'text'

  const todiagram = useCallback((e) => {
    const rect = svgRef.current?.getBoundingClientRect() ?? { left: 0, top: 0 }
    return screenToDiagram(e.clientX - rect.left, e.clientY - rect.top)
  }, [svgRef, screenToDiagram])

  const onPointerDown = useCallback((e) => {
    if (e.button !== 0) return

    if (activeTool === 'text') {
      const rect = svgRef.current?.getBoundingClientRect() ?? { left: 0, top: 0 }
      textDownRef.current = {
        clientX: e.clientX,
        clientY: e.clientY,
        // Position relative to the canvas div (= SVG origin) for the overlay
        screenX: e.clientX - rect.left,
        screenY: e.clientY - rect.top,
      }
      return
    }

    if (!isDrawingTool) return  // select handled by useSelectTool

    e.currentTarget.setPointerCapture(e.pointerId)
    startStroke(todiagram(e))
  }, [activeTool, isDrawingTool, svgRef, startStroke, todiagram])

  const onPointerMove = useCallback((e) => {
    if (!isDrawing) return
    addPoint(todiagram(e))
  }, [isDrawing, addPoint, todiagram])

  const onPointerUp = useCallback((e) => {
    if (e.button !== 0) return

    // Text tool: treat as a click if pointer barely moved
    if (activeTool === 'text') {
      const down = textDownRef.current
      textDownRef.current = null
      if (!down) return
      const dist = Math.hypot(e.clientX - down.clientX, e.clientY - down.clientY)
      if (dist < 8) {
        const diagramPos = todiagram(e)
        onTextClick?.({ screenPos: { x: down.screenX, y: down.screenY }, diagramPos })
      }
      return
    }

    if (!isDrawing) return
    const points = finishStroke()
    if (points.length < 2) return

    const { kind, element } = buildElement(activeTool, points, store.styleState)
    dispatch({
      type:    kind === 'arrow' ? ACTIONS.ADD_ARROW : ACTIONS.ADD_SHAPE,
      payload: element,
    })
  }, [activeTool, isDrawing, finishStroke, onTextClick, todiagram, dispatch, store.styleState])

  const onPointerCancel = useCallback(() => {
    textDownRef.current = null
    cancelStroke()
  }, [cancelStroke])

  return {
    isDrawing,
    stroke,
    drawHandlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel },
  }
}
