/**
 * DevSeeder — seeds the VisualStore with test elements so the Renderer
 * can be verified visually. Runs once on mount, dev only.
 * Remove or comment out before Phase 2 work begins.
 */

import { useEffect, useRef } from 'react'
import { useVisualStore } from '../store/VisualStoreContext'
import { createShape, createArrow, createText, ACTIONS } from '../store/visualStore'

export default function DevSeeder() {
  const { dispatch, store } = useVisualStore()
  const seeded = useRef(false)

  useEffect(() => {
    if (seeded.current) return
    seeded.current = true

    // Skip if canvas already has content (e.g. restored from localStorage)
    const el = store.elements
    if (el.shapes.length || el.arrows.length || el.texts.length || el.icons.length) return

    // A rectangle drawn around an organisational system (semantics inferred by LLM, not encoded here)
    dispatch({ type: ACTIONS.ADD_SHAPE, payload: createShape({
      type: 'rectangle',
      x: 80, y: 80, width: 320, height: 200,
      roughness: 2.2,
      stroke: '#1a1a2e',
      fill: '#f5f0e8',
    }) })

    // An ellipse representing a concept/force
    dispatch({ type: ACTIONS.ADD_SHAPE, payload: createShape({
      type: 'ellipse',
      x: 520, y: 110, width: 130, height: 130,
      roughness: 1.8,
      stroke: '#4a3728',
      fill: '#fef3c7',
    }) })

    // A freehand squiggle
    dispatch({ type: ACTIONS.ADD_SHAPE, payload: createShape({
      type: 'freehand',
      points: [
        { x: 160, y: 340 }, { x: 185, y: 320 }, { x: 210, y: 345 },
        { x: 235, y: 318 }, { x: 260, y: 342 }, { x: 285, y: 315 },
        { x: 310, y: 340 },
      ],
      roughness: 2.5,
      stroke: '#7c3aed',
      strokeWidth: 2.5,
    }) })

    // A directional arrow
    dispatch({ type: ACTIONS.ADD_ARROW, payload: createArrow({
      type: 'directional',
      startPoint: { x: 240, y: 180 },
      endPoint:   { x: 520, y: 175 },
      stroke: '#1a1a2e',
    }) })

    // A tension arrow
    dispatch({ type: ACTIONS.ADD_ARROW, payload: createArrow({
      type: 'tension',
      startPoint: { x: 180, y: 390 },
      endPoint:   { x: 460, y: 390 },
      stroke: '#dc2626',
      strokeWidth: 2.5,
    }) })

    // Labels
    dispatch({ type: ACTIONS.ADD_TEXT, payload: createText({
      content: 'Organisation',
      x: 200, y: 72,
      fontSize: 22,
      rotation: -1,
    }) })

    dispatch({ type: ACTIONS.ADD_TEXT, payload: createText({
      content: 'Pressure',
      x: 545, y: 185,
      fontSize: 18,
      rotation: 1,
    }) })

    dispatch({ type: ACTIONS.ADD_TEXT, payload: createText({
      content: 'tension',
      x: 270, y: 382,
      fontSize: 15,
      color: '#dc2626',
      rotation: -0.8,
    }) })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch])

  return null
}
