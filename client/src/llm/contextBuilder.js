/**
 * contextBuilder — LLM Bridge / ContextBuilder module.
 *
 * Produces a faithful geometric description of the Visual Store for an LLM.
 * NO semantic or structural inference is applied here — the LLM receives the
 * raw visual facts (positions, labels, shapes, arrows) and reasons about
 * relationships and meaning itself, just as a human would read the diagram.
 *
 * Coordinate convention:
 *   Positions are reported as (x, y) fractions normalised to the bounding box
 *   of all diagram content: (0,0) = top-left, (1,1) = bottom-right.
 *   A quadrant label (e.g. "top-left", "centre") is added for readability.
 */

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

/** Bounding box for an element. */
function elBbox(el) {
  if (el.kind === 'shape') {
    if (el.type === 'freehand') {
      if (!el.points?.length) return null
      const xs = el.points.map(p => p.x), ys = el.points.map(p => p.y)
      const x = Math.min(...xs), y = Math.min(...ys)
      return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y }
    }
    return { x: el.x, y: el.y, w: el.width, h: el.height }
  }
  if (el.kind === 'icon')  return { x: el.x, y: el.y, w: el.width ?? 80, h: el.height ?? 80 }
  if (el.kind === 'text') {
    const w = (el.content?.length ?? 4) * (el.fontSize ?? 18) * 0.6
    const h = (el.fontSize ?? 18) * 1.4
    return { x: el.x, y: el.y - h, w, h: h + 4 }
  }
  return null
}

/** Bounding box of the entire diagram content. */
function diagramBbox(elements) {
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity
  const all = [
    ...(elements.shapes ?? []),
    ...(elements.icons  ?? []),
    ...(elements.texts  ?? []),
  ]
  for (const el of all) {
    const b = elBbox(el)
    if (b) {
      x1 = Math.min(x1, b.x);       y1 = Math.min(y1, b.y)
      x2 = Math.max(x2, b.x + b.w); y2 = Math.max(y2, b.y + b.h)
    }
  }
  for (const ar of (elements.arrows ?? [])) {
    for (const pt of [ar.startPoint, ...(ar.midPoints ?? []), ar.endPoint]) {
      x1 = Math.min(x1, pt.x); y1 = Math.min(y1, pt.y)
      x2 = Math.max(x2, pt.x); y2 = Math.max(y2, pt.y)
    }
  }
  if (!isFinite(x1)) return { x: 0, y: 0, w: 1, h: 1 }
  return { x: x1, y: y1, w: Math.max(x2 - x1, 1), h: Math.max(y2 - y1, 1) }
}

/** Normalise a canvas point to 0–1 within the diagram bbox, 2 d.p. */
function norm(px, py, db) {
  return {
    nx: Math.round(((px - db.x) / db.w) * 100) / 100,
    ny: Math.round(((py - db.y) / db.h) * 100) / 100,
  }
}

/** Human-readable position quadrant from normalised coords. */
function quadrant(nx, ny) {
  const hz = nx < 0.33 ? 'left'   : nx > 0.66 ? 'right'  : 'centre'
  const vt = ny < 0.33 ? 'top'    : ny > 0.66 ? 'bottom' : 'middle'
  return vt === 'middle' && hz === 'centre' ? 'centre' : `${vt}-${hz}`
}

/** Primary display label for an element. */
function labelOf(el) {
  return el.description && el.description !== el.label
    ? el.description
    : el.label || el.content || null
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * buildContext(elements) → string
 *
 * Produces a geometric plain-text description of the diagram.
 * Positions are normalised fractions of the diagram bounding box.
 * No inference is performed — the LLM reasons from position and proximity.
 */
export function buildContext(elements) {
  const shapes = elements.shapes ?? []
  const arrows = elements.arrows ?? []
  const icons  = elements.icons  ?? []
  const texts  = elements.texts  ?? []

  const db = diagramBbox(elements)
  const lines = []

  lines.push('RICH PICTURE — canvas geometry')
  lines.push(`  ${icons.length} icons, ${shapes.length} shapes, ${arrows.length} arrows, ${texts.length} text annotations`)
  lines.push(`  Positions: (x, y) normalised 0–1 within diagram bounds; (0,0) = top-left, (1,1) = bottom-right`)
  lines.push('')

  // Icons
  if (icons.length > 0) {
    lines.push('ICONS')
    for (const el of icons) {
      const b  = elBbox(el)
      const cx = el.x + (el.width ?? 80) / 2
      const cy = el.y + (el.height ?? 80) / 2
      const { nx, ny } = norm(cx, cy, db)
      const q   = quadrant(nx, ny)
      const lbl = labelOf(el) ?? '(unlabelled)'
      const type = el.label ? `[${el.label}]` : '[icon]'
      lines.push(`  ${type}  "${lbl}"  at ${q} (${nx}, ${ny})`)
    }
    lines.push('')
  }

  // Shapes
  if (shapes.length > 0) {
    lines.push('SHAPES')
    for (const el of shapes) {
      const b = elBbox(el)
      if (!b) continue
      const { nx: cx, ny: cy } = norm(b.x + b.w / 2, b.y + b.h / 2, db)
      const { nx: x0, ny: y0 } = norm(b.x,       b.y,       db)
      const { nx: x1, ny: y1 } = norm(b.x + b.w, b.y + b.h, db)
      const q   = quadrant(cx, cy)
      const lbl = el.label ? `  label "${el.label}"` : ''
      lines.push(`  [${el.type}]  centre ${q} (${cx}, ${cy})  spans (${x0},${y0})–(${x1},${y1})${lbl}`)
    }
    lines.push('')
  }

  // Arrows
  if (arrows.length > 0) {
    lines.push('ARROWS')
    for (const ar of arrows) {
      const { nx: sx, ny: sy } = norm(ar.startPoint.x, ar.startPoint.y, db)
      const { nx: ex, ny: ey } = norm(ar.endPoint.x,   ar.endPoint.y,   db)
      const sq  = quadrant(sx, sy)
      const eq  = quadrant(ex, ey)
      const dir = ar.type === 'bidirectional' ? '↔' : ar.type === 'undirected' ? '—' : '→'
      const lbl = ar.label ? `  label "${ar.label}"` : ''
      lines.push(`  [${ar.type}] ${dir}  from ${sq} (${sx},${sy})  to ${eq} (${ex},${ey})${lbl}`)
    }
    lines.push('')
  }

  // Text annotations
  if (texts.length > 0) {
    lines.push('TEXT ANNOTATIONS')
    for (const el of texts) {
      const { nx, ny } = norm(el.x, el.y, db)
      const q = quadrant(nx, ny)
      lines.push(`  "${el.content}"  at ${q} (${nx}, ${ny})`)
    }
    lines.push('')
  }

  if (lines[lines.length - 1] === '') lines.pop()
  return lines.join('\n')
}

/**
 * buildPrompt(elements) → string
 *
 * Wraps buildContext() with a system instruction for an LLM.
 * Asks the LLM to infer relationships spatially from the geometry,
 * not from pre-computed structure.
 */
export function buildPrompt(elements) {
  const context = buildContext(elements)
  return [
    'You are analysing a Rich Picture — an informal Soft Systems Methodology (SSM) diagram',
    'that captures actors, systems, processes, relationships and tensions.',
    '',
    'Below is a geometric description of the canvas. Positions are normalised fractions',
    '(0,0) = top-left, (1,1) = bottom-right. No relationships have been pre-computed.',
    'Infer connections and meaning from spatial proximity and direction, exactly as a',
    'human reader would look at the diagram.',
    '',
    context,
    '',
    '---',
    'Please analyse this Rich Picture. Based on positions and visual arrangement:',
    '1. Which icons does each arrow most likely connect, and what might the relationship mean?',
    '2. What do the shapes appear to group or delimit?',
    '3. Who are the key actors and what systems or processes are shown?',
    '4. What tensions, issues or missing connections stand out?',
    '5. Provide a brief narrative summary of the situation depicted.',
  ].join('\n')
}
