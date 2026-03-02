/**
 * hitTest — hit-testing pointer positions against VisualStore elements.
 * All coordinates are in diagram space.
 *
 * Also exports elementBBox / unionBBoxes for selection-overlay computation.
 */

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

function distToSegment(px, py, ax, ay, bx, by) {
  const abx = bx - ax, aby = by - ay
  const len2 = abx * abx + aby * aby
  if (len2 === 0) return Math.hypot(px - ax, py - ay)
  const t = Math.max(0, Math.min(1, ((px - ax) * abx + (py - ay) * aby) / len2))
  return Math.hypot(px - (ax + t * abx), py - (ay + t * aby))
}

// ---------------------------------------------------------------------------
// Per-kind hit tests
// ---------------------------------------------------------------------------

function hitTestRectangle(el, x, y) {
  return x >= el.x && x <= el.x + el.width && y >= el.y && y <= el.y + el.height
}

function hitTestEllipse(el, x, y) {
  const cx = el.x + el.width  / 2
  const cy = el.y + el.height / 2
  const rx = el.width  / 2
  const ry = el.height / 2
  if (rx === 0 || ry === 0) return false
  return ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1
}

function hitTestFreehand(el, x, y, tol = 8) {
  for (let i = 0; i < el.points.length - 1; i++) {
    const a = el.points[i], b = el.points[i + 1]
    if (distToSegment(x, y, a.x, a.y, b.x, b.y) < tol) return true
  }
  return false
}

export function hitTestShape(el, x, y) {
  switch (el.type) {
    case 'rectangle': return hitTestRectangle(el, x, y)
    case 'ellipse':   return hitTestEllipse(el, x, y)
    case 'freehand':  return hitTestFreehand(el, x, y)
    default:          return false
  }
}

export function hitTestArrow(el, x, y, tol = 8) {
  const pts = [el.startPoint, ...(el.midPoints ?? []), el.endPoint]
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1]
    if (distToSegment(x, y, a.x, a.y, b.x, b.y) < tol) return true
  }
  return false
}

export function hitTestText(el, x, y) {
  // Approximate bounding box: ascent-based (text y is the baseline)
  const w = (el.content?.length ?? 0) * (el.fontSize ?? 18) * 0.6
  const h = (el.fontSize ?? 18) * 1.4
  return x >= el.x && x <= el.x + w && y >= el.y - h && y <= el.y + 4
}

// Returns the topmost element under (x, y), checking layers top-to-bottom.
// Returns { kind, element } or null.
export function hitTestAll(elements, x, y) {
  const { texts, icons, arrows, shapes } = elements
  for (let i = texts.length - 1;  i >= 0; i--) if (hitTestText(texts[i],  x, y)) return { kind: 'text',  element: texts[i]  }
  for (let i = icons.length - 1;  i >= 0; i--) if (hitTestShape(icons[i], x, y)) return { kind: 'icon',  element: icons[i]  }
  for (let i = arrows.length - 1; i >= 0; i--) if (hitTestArrow(arrows[i],x, y)) return { kind: 'arrow', element: arrows[i] }
  for (let i = shapes.length - 1; i >= 0; i--) if (hitTestShape(shapes[i],x, y)) return { kind: 'shape', element: shapes[i] }
  return null
}

// Returns the id of the topmost SHAPE under (x, y), for text parentId detection.
export function findParentShape(elements, x, y) {
  const { shapes } = elements
  for (let i = shapes.length - 1; i >= 0; i--) {
    if (hitTestShape(shapes[i], x, y)) return shapes[i].id
  }
  return null
}

// ---------------------------------------------------------------------------
// Bounding boxes (diagram coordinates)
// ---------------------------------------------------------------------------

export function elementBBox(el) {
  if (!el) return null

  if (el.kind === 'shape') {
    if (el.type === 'freehand') {
      if (!el.points?.length) return null
      const xs = el.points.map(p => p.x), ys = el.points.map(p => p.y)
      const x = Math.min(...xs), y = Math.min(...ys)
      return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y }
    }
    return { x: el.x, y: el.y, width: el.width, height: el.height }
  }

  if (el.kind === 'arrow') {
    const pts = [el.startPoint, ...(el.midPoints ?? []), el.endPoint]
    const xs = pts.map(p => p.x), ys = pts.map(p => p.y)
    const x = Math.min(...xs), y = Math.min(...ys)
    return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y }
  }

  if (el.kind === 'text') {
    const w = (el.content?.length ?? 4) * (el.fontSize ?? 18) * 0.6
    const h = (el.fontSize ?? 18) * 1.4
    return { x: el.x, y: el.y - h, width: w, height: h + 4 }
  }

  if (el.kind === 'icon') {
    return { x: el.x, y: el.y, width: el.width ?? 64, height: el.height ?? 64 }
  }

  return null
}

// Returns the smallest bbox enclosing all provided bboxes.
export function unionBBoxes(bboxes) {
  const valid = bboxes.filter(Boolean)
  if (!valid.length) return null
  const x1 = Math.min(...valid.map(b => b.x))
  const y1 = Math.min(...valid.map(b => b.y))
  const x2 = Math.max(...valid.map(b => b.x + b.width))
  const y2 = Math.max(...valid.map(b => b.y + b.height))
  return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 }
}

// Bounding box for a group — union of all member element bboxes.
export function groupBBox(group, elements) {
  const all = [
    ...(elements.shapes ?? []),
    ...(elements.arrows ?? []),
    ...(elements.texts  ?? []),
    ...(elements.icons  ?? []),
  ]
  return unionBBoxes(
    group.memberIds.map(id => {
      const el = all.find(e => e.id === id)
      return el ? elementBBox(el) : null
    })
  )
}

// Returns ALL element ids whose bbox overlaps the given rect (rubber-band selection).
// Excludes standalone group containers (groups are found via their members).
export function elementsWithinRect(elements, rx, ry, rw, rh) {
  const x1 = Math.min(rx, rx + rw), y1 = Math.min(ry, ry + rh)
  const x2 = Math.max(rx, rx + rw), y2 = Math.max(ry, ry + rh)
  const all = [
    ...(elements.shapes ?? []),
    ...(elements.arrows ?? []),
    ...(elements.icons  ?? []),
    ...(elements.texts  ?? []),
  ]
  return all
    .filter(el => {
      const b = elementBBox(el)
      if (!b) return false
      return b.x < x2 && b.x + b.width > x1 && b.y < y2 && b.y + b.height > y1
    })
    .map(el => el.id)
}
