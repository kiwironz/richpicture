/**
 * gestureTemplates.js — Template point sets for the $1 recogniser.
 *
 * Each template is a representative stroke for a gesture type.
 * Points are normalised to a 250×250 space; the recogniser re-scales
 * and rotates everything anyway, so absolute values don't matter —
 * only the shape of the path matters.
 *
 * Recognised gesture names map directly to VisualStore shape types:
 *   'boundary'  → createShape({ type: 'boundary' })
 *   'circle'    → createShape({ type: 'circle' })
 *   'freehand'  → createShape({ type: 'freehand' })   (fallback)
 *   'arrow'     → createArrow({ type: 'directional' })
 *   'zigzag'    → tension annotation
 */

import { DollarRecogniser } from './dollarN'

// ---------------------------------------------------------------------------
// Helper: generate template point arrays
// ---------------------------------------------------------------------------

// Rectangle drawn clockwise from top-left
function rectangle(x, y, w, h, steps = 20) {
  const pts = []
  const perimeter = 2 * (w + h)
  const total = steps * 4
  // top edge
  for (let i = 0; i <= steps; i++) pts.push({ x: x + (w * i) / steps, y })
  // right edge
  for (let i = 1; i <= steps; i++) pts.push({ x: x + w, y: y + (h * i) / steps })
  // bottom edge (right to left)
  for (let i = 1; i <= steps; i++) pts.push({ x: x + w - (w * i) / steps, y: y + h })
  // left edge (bottom to top)
  for (let i = 1; i <= steps; i++) pts.push({ x, y: y + h - (h * i) / steps })
  return pts
}

// Circle
function circle(cx, cy, r, steps = 64) {
  const pts = []
  for (let i = 0; i <= steps; i++) {
    const a = (2 * Math.PI * i) / steps
    pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) })
  }
  return pts
}

// Arrow: straight line with a small V arrowhead at the end
function arrow(x1, y1, x2, y2) {
  const pts = []
  const steps = 20
  for (let i = 0; i <= steps; i++) {
    pts.push({
      x: x1 + ((x2 - x1) * i) / steps,
      y: y1 + ((y2 - y1) * i) / steps,
    })
  }
  // Arrowhead
  const headLen = 20
  const angle   = Math.atan2(y2 - y1, x2 - x1)
  const a1 = angle - Math.PI / 6
  const a2 = angle + Math.PI / 6
  pts.push({ x: x2 - headLen * Math.cos(a1), y: y2 - headLen * Math.sin(a1) })
  pts.push({ x: x2, y: y2 })
  pts.push({ x: x2 - headLen * Math.cos(a2), y: y2 - headLen * Math.sin(a2) })
  return pts
}

// Zigzag
function zigzag(x, y, w, h, teeth = 5) {
  const pts = []
  const step = w / teeth
  for (let i = 0; i <= teeth; i++) {
    pts.push({ x: x + step * i, y: i % 2 === 0 ? y : y + h })
  }
  return pts
}

// ---------------------------------------------------------------------------
// Build and export the recogniser singleton
// ---------------------------------------------------------------------------

const recogniser = new DollarRecogniser()

// Boundary — rectangle (multiple orientations for robustness)
recogniser.addTemplate('boundary', rectangle(20, 20, 210, 160))
recogniser.addTemplate('boundary', rectangle(20, 20, 160, 210))
recogniser.addTemplate('boundary', rectangle(20, 20, 210, 210))

// Circle
recogniser.addTemplate('circle', circle(125, 125, 100))

// Arrow (multiple directions)
recogniser.addTemplate('arrow', arrow(20, 125, 230, 125))
recogniser.addTemplate('arrow', arrow(20, 20,  230, 230))
recogniser.addTemplate('arrow', arrow(125, 20, 125, 230))

// Zigzag / tension
recogniser.addTemplate('zigzag', zigzag(10, 80, 230, 90, 5))
recogniser.addTemplate('zigzag', zigzag(10, 80, 230, 90, 4))
recogniser.addTemplate('zigzag', zigzag(10, 80, 230, 90, 6))

export default recogniser

/**
 * Minimum confidence threshold below which a gesture falls back to 'freehand'.
 */
export const MIN_CONFIDENCE = 0.60
