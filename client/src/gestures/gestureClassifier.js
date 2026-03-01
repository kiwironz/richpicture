/**
 * gestureClassifier.js — Geometric stroke classifier for Rich Picture Studio.
 *
 * Replaces $1 template matching for the core shape set.  Pure geometry is
 * more reliable than template matching for rectangles, circles, lines and
 * zigzags because those shapes have strong, measurable mathematical properties.
 *
 * Classification priority (tested in order):
 *   1. zigzag    — ≥ 3 direction reversals along dominant axis
 *   2. arrow     — high linearity ratio (nearly straight line)
 *   3. boundary  — closed path with detectable corners (≥ 3)
 *   4. circle    — closed path with few corners
 *   5. freehand  — fallback
 *
 * Returns: { name: 'boundary'|'circle'|'arrow'|'zigzag'|'freehand', debug: {} }
 */

// ---------------------------------------------------------------------------
// Basic geometry
// ---------------------------------------------------------------------------

function pathLength(pts) {
  let d = 0
  for (let i = 1; i < pts.length; i++) {
    d += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y)
  }
  return d
}

function directLength(pts) {
  const s = pts[0]
  const e = pts[pts.length - 1]
  return Math.hypot(e.x - s.x, e.y - s.y)
}

function closureDistance(pts) {
  return Math.hypot(pts[pts.length - 1].x - pts[0].x, pts[pts.length - 1].y - pts[0].y)
}

// ---------------------------------------------------------------------------
// Zigzag detection
// Count how many times the stroke reverses direction along its dominant axis.
// ---------------------------------------------------------------------------

function countReversals(pts) {
  if (pts.length < 3) return 0

  // Smooth the points slightly to ignore micro-jitter
  const smoothed = pts.filter((_, i) => i % 3 === 0)
  if (smoothed.length < 3) return 0

  // Determine dominant axis (larger bounding box dimension)
  const xs = pts.map(p => p.x)
  const ys = pts.map(p => p.y)
  const xRange = Math.max(...xs) - Math.min(...xs)
  const yRange = Math.max(...ys) - Math.min(...ys)
  const axis = xRange >= yRange ? 'x' : 'y'

  let reversals = 0
  let prevDir = null
  for (let i = 1; i < smoothed.length; i++) {
    const delta = smoothed[i][axis] - smoothed[i - 1][axis]
    if (Math.abs(delta) < 2) continue     // ignore near-stationary movement
    const dir = delta > 0 ? 1 : -1
    if (prevDir !== null && dir !== prevDir) reversals++
    prevDir = dir
  }
  return reversals
}

// ---------------------------------------------------------------------------
// Corner detection
// A corner is a point where the stroke direction changes sharply (> threshold°).
// ---------------------------------------------------------------------------

function countCorners(pts, thresholdDeg = 40) {
  if (pts.length < 5) return 0
  const threshold = (thresholdDeg * Math.PI) / 180

  // Sample every few points for stability
  const step   = Math.max(1, Math.floor(pts.length / 40))
  const sample = pts.filter((_, i) => i % step === 0)

  let corners = 0
  for (let i = 2; i < sample.length - 1; i++) {
    const ax = sample[i - 1].x - sample[i - 2].x
    const ay = sample[i - 1].y - sample[i - 2].y
    const bx = sample[i].x - sample[i - 1].x
    const by = sample[i].y - sample[i - 1].y
    const lenA = Math.hypot(ax, ay)
    const lenB = Math.hypot(bx, by)
    if (lenA < 1 || lenB < 1) continue
    const dot   = (ax * bx + ay * by) / (lenA * lenB)
    const angle = Math.acos(Math.max(-1, Math.min(1, dot)))
    if (angle > threshold) {
      corners++
      i += 2  // skip ahead to avoid double-counting the same corner region
    }
  }
  return corners
}

// ---------------------------------------------------------------------------
// Main classifier
// ---------------------------------------------------------------------------

export function classifyGesture(pts) {
  if (!pts || pts.length < 4) return { name: 'freehand', debug: {} }

  const total    = pathLength(pts)
  const direct   = directLength(pts)
  const closure  = closureDistance(pts)
  const linear   = direct / total          // 1 = perfectly straight, 0 = complex/closed
  const closed   = closure / total < 0.30  // end within 30% of total path from start
  const reversals = countReversals(pts)
  const corners  = closed ? countCorners(pts) : 0

  const debug = { total: total.toFixed(1), direct: direct.toFixed(1), linear: linear.toFixed(2), closure: (closure / total).toFixed(2), reversals, corners, closed }

  // 1. Zigzag — many direction reversals, not a simple straight line
  if (reversals >= 3 && linear < 0.9) {
    return { name: 'zigzag', debug }
  }

  // 2. Arrow — nearly straight stroke (high linearity), not closed
  //    Threshold 0.82: allows gentle curves but excludes S-curves and shapes
  if (!closed && linear > 0.82) {
    return { name: 'arrow', debug }
  }

  // 3. Closed shapes
  if (closed) {
    // Rectangle/boundary: 3+ detectable corners
    if (corners >= 3) {
      return { name: 'boundary', debug }
    }
    // Circle: closed but smooth (few corners)
    return { name: 'circle', debug }
  }

  // 4. Freehand fallback
  return { name: 'freehand', debug }
}
