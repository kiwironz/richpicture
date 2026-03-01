/**
 * useViewport — pan and zoom state for the SVG canvas.
 *
 * Pan:  middle-mouse drag, or two-finger drag on touch
 * Zoom: scroll wheel (zoom toward cursor), ctrl+wheel / pinch
 *
 * Returns:
 *   transform        — { x, y, scale } current viewport state
 *   transformString  — CSS/SVG transform string to apply to the viewport <g>
 *   screenToDiagram  — converts screen px coords → diagram coords
 *   handlers         — event handlers to spread onto the <svg> element
 */

import { useState, useCallback, useRef } from 'react'

const MIN_SCALE = 0.1
const MAX_SCALE = 10
const ZOOM_FACTOR = 0.0008   // wheel delta multiplier

export function useViewport() {
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 })
  const isPanning   = useRef(false)
  const lastPt      = useRef({ x: 0, y: 0 })
  const pinchDist   = useRef(null)

  // -------------------------------------------------------------------------
  // Pointer pan (middle mouse = button 1)
  // -------------------------------------------------------------------------
  const onPointerDown = useCallback((e) => {
    if (e.button !== 1) return          // middle mouse only — left stays for drawing
    e.preventDefault()
    isPanning.current = true
    lastPt.current = { x: e.clientX, y: e.clientY }
    e.currentTarget.setPointerCapture(e.pointerId)
  }, [])

  const onPointerMove = useCallback((e) => {
    if (!isPanning.current) return
    const dx = e.clientX - lastPt.current.x
    const dy = e.clientY - lastPt.current.y
    lastPt.current = { x: e.clientX, y: e.clientY }
    setTransform(t => ({ ...t, x: t.x + dx, y: t.y + dy }))
  }, [])

  const onPointerUp = useCallback((e) => {
    if (e.button !== 1) return
    isPanning.current = false
  }, [])

  // -------------------------------------------------------------------------
  // Wheel zoom (zoom toward cursor; ctrl+wheel = trackpad pinch gesture)
  // -------------------------------------------------------------------------
  const onWheel = useCallback((e) => {
    e.preventDefault()
    const delta  = e.deltaY * (e.ctrlKey ? 0.02 : ZOOM_FACTOR)
    const factor = Math.exp(-delta)
    const rect   = e.currentTarget.getBoundingClientRect()
    const svgX   = e.clientX - rect.left
    const svgY   = e.clientY - rect.top

    setTransform(t => {
      const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, t.scale * factor))
      const ratio    = newScale / t.scale
      return {
        scale: newScale,
        x: svgX - ratio * (svgX - t.x),
        y: svgY - ratio * (svgY - t.y),
      }
    })
  }, [])

  // -------------------------------------------------------------------------
  // Touch pinch zoom
  // -------------------------------------------------------------------------
  const onTouchStart = useCallback((e) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      pinchDist.current = Math.hypot(dx, dy)
    }
  }, [])

  const onTouchMove = useCallback((e) => {
    if (e.touches.length !== 2 || pinchDist.current === null) return
    e.preventDefault()
    const dx   = e.touches[0].clientX - e.touches[1].clientX
    const dy   = e.touches[0].clientY - e.touches[1].clientY
    const dist = Math.hypot(dx, dy)
    const factor = dist / pinchDist.current
    pinchDist.current = dist

    const rect = e.currentTarget.getBoundingClientRect()
    const mx = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left
    const my = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top

    setTransform(t => {
      const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, t.scale * factor))
      const ratio    = newScale / t.scale
      return {
        scale: newScale,
        x: mx - ratio * (mx - t.x),
        y: my - ratio * (my - t.y),
      }
    })
  }, [])

  const onTouchEnd = useCallback(() => {
    pinchDist.current = null
  }, [])

  // -------------------------------------------------------------------------
  // Coordinate conversion
  // -------------------------------------------------------------------------
  const screenToDiagram = useCallback((sx, sy) => ({
    x: (sx - transform.x) / transform.scale,
    y: (sy - transform.y) / transform.scale,
  }), [transform])

  const diagramToScreen = useCallback((dx, dy) => ({
    x: dx * transform.scale + transform.x,
    y: dy * transform.scale + transform.y,
  }), [transform])

  const transformString = `translate(${transform.x}, ${transform.y}) scale(${transform.scale})`

  return {
    transform,
    transformString,
    screenToDiagram,
    diagramToScreen,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onWheel,
      onTouchStart,
      onTouchMove,
      onTouchEnd,
    },
  }
}
