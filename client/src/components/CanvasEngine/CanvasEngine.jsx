// CanvasEngine — Phase 1
// Hosts: SVG canvas, Renderer (Rough.js), ViewportManager,
// InputHandler + StrokeAccumulator, GestureRecogniser

import { useRef, useEffect } from 'react'
import Renderer from './Renderer'
import { useViewport } from './useViewport'
import { useInputHandler } from './useInputHandler'

export default function CanvasEngine({ activeTool = 'freehand' }) {
  const svgRef      = useRef(null)
  const viewportRef = useRef(null)

  const { transformString, screenToDiagram, handlers: viewportHandlers } = useViewport()
  const { onWheel, onTouchMove, ...viewportPointerHandlers } = viewportHandlers

  // Non-passive wheel + touchmove
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    svg.addEventListener('wheel',     onWheel,    { passive: false })
    svg.addEventListener('touchmove', onTouchMove, { passive: false })
    return () => {
      svg.removeEventListener('wheel',     onWheel)
      svg.removeEventListener('touchmove', onTouchMove)
    }
  }, [onWheel, onTouchMove])

  const { isDrawing, stroke, drawHandlers } = useInputHandler({
    svgRef,
    screenToDiagram,
    activeTool,
  })

  // Combine handlers: viewport pan uses middle-mouse (button 1);
  // draw uses left-mouse (button 0) — they share the same pointer events safely.
  function combineHandlers(a, b) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)])
    const combined = {}
    keys.forEach(k => {
      combined[k] = (e) => { a[k]?.(e); b[k]?.(e) }
    })
    return combined
  }

  const combinedHandlers = combineHandlers(viewportPointerHandlers, drawHandlers)

  return (
    <div className="flex-1 relative overflow-hidden">
      <svg
        ref={svgRef}
        className="w-full h-full"
        style={{ touchAction: 'none', cursor: isDrawing ? 'crosshair' : 'crosshair' }}
        {...combinedHandlers}
      >
        <g ref={viewportRef} transform={transformString}>
          {/* Renderer populates layer groups inside this group */}

          {/* In-progress stroke ghost */}
          {isDrawing && stroke.length > 1 && (
            <polyline
              points={stroke.map(p => `${p.x},${p.y}`).join(' ')}
              fill="none"
              stroke="#94a3b8"
              strokeWidth="1.5"
              strokeDasharray="4 3"
              strokeLinecap="round"
            />
          )}
        </g>
      </svg>
      <Renderer containerRef={viewportRef} />
    </div>
  )
}
