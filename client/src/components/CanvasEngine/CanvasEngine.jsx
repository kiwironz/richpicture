// CanvasEngine — Phase 1
// Hosts: SVG canvas, Renderer (Rough.js), ViewportManager,
// InputHandler + StrokeAccumulator [next], GestureRecogniser [next]

import { useRef, useEffect } from 'react'
import Renderer from './Renderer'
import { useViewport } from './useViewport'

export default function CanvasEngine() {
  const svgRef      = useRef(null)
  const viewportRef = useRef(null)     // the <g> that carries the transform

  const { transformString, handlers } = useViewport()
  const { onWheel, onTouchMove, ...pointerHandlers } = handlers

  // wheel and touchmove must be registered as non-passive to allow preventDefault
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const wheelOpts  = { passive: false }
    const touchOpts  = { passive: false }
    svg.addEventListener('wheel',     onWheel,    wheelOpts)
    svg.addEventListener('touchmove', onTouchMove, touchOpts)
    return () => {
      svg.removeEventListener('wheel',     onWheel)
      svg.removeEventListener('touchmove', onTouchMove)
    }
  }, [onWheel, onTouchMove])

  return (
    <div className="flex-1 relative overflow-hidden">
      <svg
        ref={svgRef}
        className="w-full h-full"
        style={{ touchAction: 'none', cursor: 'crosshair' }}
        {...pointerHandlers}
      >
        <g ref={viewportRef} transform={transformString}>
          {/* Renderer populates layer groups inside this group */}
        </g>
      </svg>
      <Renderer containerRef={viewportRef} />
    </div>
  )
}
