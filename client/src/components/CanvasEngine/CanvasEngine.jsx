// CanvasEngine — Phase 1
// Will host: SVG canvas, Rough.js Renderer, ViewportManager,
// InputHandler + StrokeAccumulator, GestureRecogniser, TransitionAnimator

export default function CanvasEngine() {
  return (
    <div className="flex-1 relative overflow-hidden">
      <svg
        className="w-full h-full"
        style={{ touchAction: 'none' }}
      >
        {/* Renderer output goes here */}
      </svg>
    </div>
  )
}
