/**
 * dollarN.js — Vendored $1 Unistroke Recogniser (Wobbrock et al.)
 * Extended with multi-template support and confidence scoring.
 *
 * Reference: https://depts.washington.edu/acelab/proj/dollar/index.html
 * Adapted for Rich Picture Studio — Phase 1 gesture recognition.
 *
 * Public API:
 *   const r = new DollarRecogniser()
 *   r.addTemplate(name, points)              // points: [{x,y}, ...]
 *   const result = r.recognise(points)       // → { name, score, confidence }
 */

const NUM_POINTS = 64
const SQUARE_SIZE = 250
const ORIGIN = { x: 0, y: 0 }
const DIAGONAL = Math.sqrt(SQUARE_SIZE ** 2 + SQUARE_SIZE ** 2)
const HALF_DIAGONAL = DIAGONAL / 2
const ANGLE_RANGE = Math.PI * 0.25   // ±45°
const ANGLE_PRECISION = Math.PI / 180  // 1°
const PHI = 0.5 * (-1 + Math.sqrt(5))  // golden ratio

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

function pathLength(pts) {
  let d = 0
  for (let i = 1; i < pts.length; i++) {
    d += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y)
  }
  return d
}

function resample(pts, n) {
  const interval = pathLength(pts) / (n - 1)
  let D = 0
  const out = [{ ...pts[0] }]
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y)
    if (D + d >= interval) {
      const t = (interval - D) / d
      const q = {
        x: pts[i - 1].x + t * (pts[i].x - pts[i - 1].x),
        y: pts[i - 1].y + t * (pts[i].y - pts[i - 1].y),
      }
      out.push(q)
      pts = [q, ...pts.slice(i)]
      i = 0
      D = 0
    } else {
      D += d
    }
  }
  // Pad to exactly n points if rounding fell short
  while (out.length < n) out.push({ ...pts[pts.length - 1] })
  return out.slice(0, n)
}

function indicativeAngle(pts) {
  const c = centroid(pts)
  return Math.atan2(c.y - pts[0].y, c.x - pts[0].x)
}

function rotateBy(pts, angle) {
  const c = centroid(pts)
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  return pts.map(p => ({
    x: (p.x - c.x) * cos - (p.y - c.y) * sin + c.x,
    y: (p.x - c.x) * sin + (p.y - c.y) * cos + c.y,
  }))
}

function scaleTo(pts, size) {
  const b = boundingBox(pts)
  const scaleX = size / (b.width  || 1)
  const scaleY = size / (b.height || 1)
  return pts.map(p => ({
    x: p.x * scaleX,
    y: p.y * scaleY,
  }))
}

function translateTo(pts, target) {
  const c = centroid(pts)
  return pts.map(p => ({
    x: p.x + target.x - c.x,
    y: p.y + target.y - c.y,
  }))
}

function centroid(pts) {
  return {
    x: pts.reduce((a, p) => a + p.x, 0) / pts.length,
    y: pts.reduce((a, p) => a + p.y, 0) / pts.length,
  }
}

function boundingBox(pts) {
  const minX = Math.min(...pts.map(p => p.x))
  const maxX = Math.max(...pts.map(p => p.x))
  const minY = Math.min(...pts.map(p => p.y))
  const maxY = Math.max(...pts.map(p => p.y))
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

function pathDistance(a, b) {
  let d = 0
  for (let i = 0; i < a.length; i++) {
    d += Math.hypot(a[i].x - b[i].x, a[i].y - b[i].y)
  }
  return d / a.length
}

// Golden section search for best rotation angle
function distanceAtBestAngle(pts, template, from, to, threshold) {
  let x1 = PHI * from + (1 - PHI) * to
  let f1 = distanceAtAngle(pts, template, x1)
  let x2 = (1 - PHI) * from + PHI * to
  let f2 = distanceAtAngle(pts, template, x2)
  while (Math.abs(to - from) > threshold) {
    if (f1 < f2) {
      to = x2; x2 = x1; f2 = f1
      x1 = PHI * from + (1 - PHI) * to
      f1 = distanceAtAngle(pts, template, x1)
    } else {
      from = x1; x1 = x2; f1 = f2
      x2 = (1 - PHI) * from + PHI * to
      f2 = distanceAtAngle(pts, template, x2)
    }
  }
  return Math.min(f1, f2)
}

function distanceAtAngle(pts, template, angle) {
  const rotated = rotateBy(pts, angle)
  return pathDistance(rotated, template.points)
}

// ---------------------------------------------------------------------------
// Recogniser class
// ---------------------------------------------------------------------------

export class DollarRecogniser {
  constructor() {
    this.templates = []  // [{ name, points }]
  }

  addTemplate(name, rawPoints) {
    const pts = this._process(rawPoints)
    this.templates.push({ name, points: pts })
  }

  _process(rawPoints) {
    let pts = resample(rawPoints, NUM_POINTS)
    pts = rotateBy(pts, -indicativeAngle(pts))
    pts = scaleTo(pts, SQUARE_SIZE)
    pts = translateTo(pts, ORIGIN)
    return pts
  }

  recognise(rawPoints) {
    if (!rawPoints || rawPoints.length < 2) return null
    if (this.templates.length === 0) return null

    const pts = this._process(rawPoints)
    let bestDist = Infinity
    let bestName = null

    for (const t of this.templates) {
      const d = distanceAtBestAngle(pts, t, -ANGLE_RANGE, ANGLE_RANGE, ANGLE_PRECISION)
      if (d < bestDist) {
        bestDist = d
        bestName = t.name
      }
    }

    const score = 1 - bestDist / HALF_DIAGONAL
    return {
      name:       bestName,
      score,
      confidence: Math.max(0, Math.min(1, score)),
    }
  }
}
