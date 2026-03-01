// CanvasEngine — Phase 1
// Hosts: SVG canvas, Renderer (Rough.js), ViewportManager [next],
// InputHandler + StrokeAccumulator [next], GestureRecogniser [next]

import { useRef } from 'react'
import Renderer from './Renderer'

export default function CanvasEngine() {
  const svgRef = useRef(null)

  return (
    <div className="flex-1 relative overflow-hidden">
      <svg
        ref={svgRef}
        className="w-full h-full"
        style={{ touchAction: 'none' }}
      >
        {/* Renderer populates layer groups imperatively */}
      </svg>
      <Renderer svgRef={svgRef} />
    </div>
  )
}
