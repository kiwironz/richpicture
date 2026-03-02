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
 *   3. rectangle — closed path with detectable corners (≥ 3)
 *   4. ellipse   — closed path with few corners
 *   5. freehand  — fallback
 *
 * Returns: { name: 'rectangle'|'ellipse'|'arrow'|'zigzag'|'freehand', debug: {} }
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
// A zigzag drawn left-to-right has reversals on the Y axis, not the X axis.
// Count reversals on BOTH axes and return the maximum.
// ---------------------------------------------------------------------------

function countReversalsOnAxis(pts, axis) {
  if (pts.length < 3) return 0
  let reversals = 0
  let prevDir = null
  for (let i = 1; i < pts.length; i++) {
    const delta = pts[i][axis] - pts[i - 1][axis]
    if (Math.abs(delta) < 2) continue
    const dir = delta > 0 ? 1 : -1
    if (prevDir !== null && dir !== prevDir) reversals++
    prevDir = dir
  }
  return reversals
}

function countReversals(pts) {
  if (pts.length < 3) return 0
  // Subsample to reduce jitter — but not so aggressively that zigzag peaks are lost
  const step     = Math.max(1, Math.floor(pts.length / 60))
  const smoothed = pts.filter((_, i) => i % step === 0)
  const rx = countReversalsOnAxis(smoothed, 'x')
  const ry = countReversalsOnAxis(smoothed, 'y')
  return Math.max(rx, ry)
}

// ---------------------------------------------------------------------------
// Corner detection
// A corner is a point where the stroke direction changes sharply (> threshold°).
// ---------------------------------------------------------------------------

function countCorners(pts, thresholdDeg = 35) {
  if (pts.length < 5) return 0
  const threshold = (thresholdDeg * Math.PI) / 180

  // Sample at ~60 points — fine enough to catch hand-drawn corners without
  // noise. Using a fixed target rather than pts.length/40 avoids over-smoothing
  // short strokes.
  const step   = Math.max(1, Math.floor(pts.length / 60))
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
      i += 1  // skip one point only — avoids double-counting without skipping adjacent corners
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
  const linear        = direct / total
  const closureRatio  = closure / total
  // Closed: end returns within 28% of total path length from start.
  // Generous enough for quick hand-drawn shapes that leave a small gap;
  // tight enough to exclude open S-curves and spirals.
  const closed   = closureRatio < 0.28
  const reversals = countReversals(pts)
  // Count corners on closed shapes only; open paths use linearity instead.
  const corners  = closed ? countCorners(pts) : 0

  const debug = {
    total: total.toFixed(1),
    direct: direct.toFixed(1),
    linear: linear.toFixed(2),
    closureRatio: closureRatio.toFixed(2),
    reversals,
    corners,
    closed,
  }

  // 1. Zigzag — ≥ 3 direction reversals AND not a nearly-straight line.
  //    linear < 0.75 prevents a slightly wobbly arrow from triggering this.
  if (reversals >= 3 && linear < 0.75) {
    return { name: 'zigzag', debug }
  }

  // 2. Arrow — not closed AND high linearity.
  //    Threshold 0.88: intentional straight lines score > 0.88 in practice;
  //    curves and shapes score < 0.80. The 0.80–0.88 gap falls through to freehand.
  if (!closed && linear > 0.88) {
    return { name: 'arrow', debug }
  }

  // 3. Closed shapes — distinguish by corner count.
  if (closed) {
    // Rectangle: ≥ 3 sharp corners (covers triangles, quads, irregular polygons).
    // Using ≥ 3 rather than ≥ 4 because one corner may be smoothed by natural
    // hand deceleration.
    if (corners >= 3) {
      return { name: 'rectangle', debug }
    }
    // Ellipse: closed and smooth — few or no detectable corners.
    return { name: 'ellipse', debug }
  }

  // 4. Freehand fallback
  return { name: 'freehand', debug }
}
