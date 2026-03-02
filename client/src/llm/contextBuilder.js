/**
 * contextBuilder — LLM Bridge / ContextBuilder module.
 *
 * Translates the Visual Store (which carries no semantics) into a compact,
 * token-efficient plain-text representation suitable for sending to an LLM.
 *
 * Design principles (from architecture doc):
 *   - The picture is the source of truth — visual positions are authoritative
 *   - Containment is inferred spatially (icon/text centre inside shape bbox)
 *   - Arrow source/target resolved via stored sourceId/targetId (set at draw time)
 *     with positional fallback for arrows drawn before this feature was added
 *   - Semantic classification is always optional — unclassified elements are
 *     still exported as "unnamed element" so nothing is silently lost
 *   - Output is compact structured plain text — most token-efficient format;
 *     avoids JSON rendering noise (coords, colours, font names)
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Primary display name for any element. */
function nameOf(el) {
  if (!el) return null
  return (
    (el.description && el.description !== el.label ? el.description : null) ??
    el.label ??
    el.content ??    // text elements
    null
  )
}

/** Short positional label e.g. "(top-left)" used when an element has no name. */
function positionLabel(el) {
  const x = el.x ?? el.startPoint?.x ?? 0
  const y = el.y ?? el.startPoint?.y ?? 0
  const hz = x < -200 ? 'left' : x > 200 ? 'right' : 'centre'
  const vt = y < -200 ? 'top'  : y > 200 ? 'bottom' : 'middle'
  return `(${vt}-${hz})`
}

function displayName(el) {
  return nameOf(el) ?? positionLabel(el)
}

/** Bounding box for an element (covers shapes, icons, texts). */
function bbox(el) {
  if (el.kind === 'shape') {
    if (el.type === 'freehand') {
      if (!el.points?.length) return null
      const xs = el.points.map(p => p.x), ys = el.points.map(p => p.y)
      const x = Math.min(...xs), y = Math.min(...ys)
      return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y }
    }
    return { x: el.x, y: el.y, w: el.width, h: el.height }
  }
  if (el.kind === 'icon') {
    return { x: el.x, y: el.y, w: el.width ?? 80, h: el.height ?? 80 }
  }
  if (el.kind === 'text') {
    const w = (el.content?.length ?? 4) * (el.fontSize ?? 18) * 0.6
    const h = (el.fontSize ?? 18) * 1.4
    return { x: el.x, y: el.y - h, w, h: h + 4 }
  }
  return null
}

function pointInBbox(px, py, b) {
  return b && px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h
}

/** Find nearest named element to a point (fallback for arrows without IDs). */
function nearestElement(allNamed, px, py) {
  let best = null, bestD = Infinity
  for (const el of allNamed) {
    const b = bbox(el)
    if (!b) continue
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2
    const d = Math.hypot(px - cx, py - cy)
    if (d < bestD) { bestD = d; best = el }
  }
  return best
}

/** Capitalise first letter. */
function cap(s) { return s ? s[0].toUpperCase() + s.slice(1) : s }

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * buildContext(elements) → string
 *
 * Takes the elements object from the Visual Store and returns a plain-text
 * description of the diagram for use as LLM context.
 */
export function buildContext(elements) {
  const shapes = elements.shapes ?? []
  const arrows = elements.arrows ?? []
  const icons  = elements.icons  ?? []
  const texts  = elements.texts  ?? []

  // Index all elements by id for fast lookup
  const byId = {}
  ;[...shapes, ...arrows, ...icons, ...texts].forEach(el => { byId[el.id] = el })

  // All named elements (icons + shapes with labels) — used for spatial inference
  const namedElements = [
    ...icons,
    ...shapes.filter(s => s.label),
    ...texts,
  ]

  // ---- Infer containment: which icons/texts sit inside which shapes --------
  // A shape is a boundary if at least one other element sits inside it.
  const containedBy = {}   // elementId → shapeId
  const boundaries  = []   // shapes that contain something

  // Sort shapes largest-area first so a nested shape wins over its parent
  const sortedShapes = [...shapes]
    .filter(s => s.type !== 'freehand' || s.points?.length > 2)
    .sort((a, b) => {
      const ba = bbox(a), bb = bbox(b)
      return (bb ? bb.w * bb.h : 0) - (ba ? ba.w * ba.h : 0)
    })

  for (const el of [...icons, ...texts]) {
    const b = bbox(el)
    if (!b) continue
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2
    // Find the smallest shape that contains this element's centre
    let bestShape = null, bestArea = Infinity
    for (const shape of sortedShapes) {
      const sb = bbox(shape)
      if (!sb) continue
      if (!pointInBbox(cx, cy, sb)) continue
      const area = sb.w * sb.h
      if (area < bestArea) { bestArea = area; bestShape = shape }
    }
    if (bestShape) {
      containedBy[el.id] = bestShape.id
      if (!boundaries.find(b => b.id === bestShape.id)) boundaries.push(bestShape)
    }
  }

  // ---- Resolve arrow endpoints --------------------------------------------
  const resolvedArrows = arrows.map(ar => {
    const src = ar.sourceId
      ? byId[ar.sourceId]
      : nearestElement(namedElements, ar.startPoint.x, ar.startPoint.y)
    const tgt = ar.targetId
      ? byId[ar.targetId]
      : nearestElement(namedElements, ar.endPoint.x, ar.endPoint.y)
    return { ...ar, resolvedSource: src, resolvedTarget: tgt }
  })

  // ---- Build output -------------------------------------------------------
  const lines = []

  // Header summary
  const nActors  = icons.filter(i => i.actorType || i.label?.toLowerCase().match(/person|actor|user|role|group|org/)).length
  const nSystems = icons.filter(i => !i.actorType && i.label).length
  const nBound   = boundaries.length
  const nRel     = arrows.length
  const nAnno    = texts.length

  lines.push('RICH PICTURE')
  lines.push(`  ${icons.length} icons · ${shapes.length} shapes · ${nRel} relationships · ${nBound} boundaries · ${nAnno} annotations`)
  lines.push('')

  // Elements section
  if (icons.length > 0) {
    lines.push('ELEMENTS')
    for (const el of icons) {
      const name = displayName(el)
      const type = el.label ? `[${el.label}]` : '[icon]'
      const desc = el.description && el.description !== el.label ? `  — ${el.description}` : ''
      const container = containedBy[el.id] ? ` (inside "${displayName(byId[containedBy[el.id]])}")` : ''
      lines.push(`  ${type}  "${name}"${desc}${container}`)
    }
    lines.push('')
  }

  // Shapes without icons inside (i.e. not already listed as boundaries)
  const standaloneShapes = shapes.filter(s => !boundaries.find(b => b.id === s.id) && (s.label || s.type !== 'freehand'))
  if (standaloneShapes.length > 0) {
    lines.push('SHAPES')
    for (const el of standaloneShapes) {
      const name = el.label ? `"${el.label}"` : `[${el.type}]`
      lines.push(`  ${name}`)
    }
    lines.push('')
  }

  // Boundaries
  if (boundaries.length > 0) {
    lines.push('BOUNDARIES')
    for (const shape of boundaries) {
      const name = shape.label ? `"${shape.label}"` : `[${shape.type} boundary]`
      const members = Object.entries(containedBy)
        .filter(([, sid]) => sid === shape.id)
        .map(([eid]) => `"${displayName(byId[eid])}"`)
        .join(', ')
      lines.push(`  ${name}  contains: ${members}`)
    }
    lines.push('')
  }

  // Relationships
  if (resolvedArrows.length > 0) {
    lines.push('RELATIONSHIPS')
    for (const ar of resolvedArrows) {
      const src  = ar.resolvedSource ? `"${displayName(ar.resolvedSource)}"` : '(unknown)'
      const tgt  = ar.resolvedTarget ? `"${displayName(ar.resolvedTarget)}"` : '(unknown)'
      const dir  = ar.type === 'bidirectional' ? '↔' : ar.type === 'undirected' ? '—' : '→'
      const lbl  = ar.label ? `  [${ar.label}]` : ''
      lines.push(`  ${src} ${dir} ${tgt}${lbl}`)
    }
    lines.push('')
  }

  // Annotations (free text elements)
  if (texts.length > 0) {
    lines.push('ANNOTATIONS')
    for (const el of texts) {
      const container = containedBy[el.id] ? ` (near "${displayName(byId[containedBy[el.id]])}")` : ''
      lines.push(`  "${el.content}"${container}`)
    }
    lines.push('')
  }

  if (lines[lines.length - 1] === '') lines.pop()  // trim trailing blank

  return lines.join('\n')
}

/**
 * buildPrompt(elements) → string
 *
 * Wraps buildContext() with a system instruction suitable for pasting
 * directly into any LLM chat interface.
 */
export function buildPrompt(elements) {
  const context = buildContext(elements)
  return [
    'The following is a Rich Picture diagram described in structured plain text.',
    'A Rich Picture is an informal SSM (Soft Systems Methodology) diagram that captures',
    'actors, systems, relationships, boundaries and tensions in a situation.',
    '',
    context,
    '',
    '---',
    'Please analyse this Rich Picture. Identify:',
    '1. The key actors and their roles',
    '2. The main systems and processes',
    '3. Important relationships and flows',
    '4. Boundaries and what they signify',
    '5. Any tensions, issues or gaps that stand out',
  ].join('\n')
}
