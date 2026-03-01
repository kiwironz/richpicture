/**
 * useStrokeAccumulator — collects raw pointer points during a single draw stroke.
 *
 * Returns:
 *   stroke         — current in-progress [{x, y}, ...] in diagram coordinates
 *   isDrawing      — true while pointer is held down
 *   startStroke    — call on pointerdown with diagram {x,y}
 *   addPoint       — call on pointermove with diagram {x,y}
 *   finishStroke   — call on pointerup; returns completed points array
 *   cancelStroke   — call on pointercancel / escape
 */

import { useState, useCallback, useRef } from 'react'

// Minimum distance (diagram px) a new point must be from the last to be recorded.
// Keeps the point array lean without losing gesture shape.
const MIN_DIST = 3

export function useStrokeAccumulator() {
  const [stroke, setStroke] = useState([])
  const [isDrawing, setIsDrawing] = useState(false)
  const pointsRef = useRef([])   // mutable buffer — avoids stale closure in addPoint

  const startStroke = useCallback((pt) => {
    pointsRef.current = [pt]
    setStroke([pt])
    setIsDrawing(true)
  }, [])

  const addPoint = useCallback((pt) => {
    const last = pointsRef.current[pointsRef.current.length - 1]
    if (!last) return
    const dist = Math.hypot(pt.x - last.x, pt.y - last.y)
    if (dist < MIN_DIST) return
    pointsRef.current = [...pointsRef.current, pt]
    setStroke(pointsRef.current)
  }, [])

  const finishStroke = useCallback(() => {
    const completed = pointsRef.current
    pointsRef.current = []
    setStroke([])
    setIsDrawing(false)
    return completed
  }, [])

  const cancelStroke = useCallback(() => {
    pointsRef.current = []
    setStroke([])
    setIsDrawing(false)
  }, [])

  return { stroke, isDrawing, startStroke, addPoint, finishStroke, cancelStroke }
}
