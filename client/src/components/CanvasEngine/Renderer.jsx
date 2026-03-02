/**
 * Renderer — draws all VisualStore elements onto the SVG canvas via Rough.js.
 * Reads exclusively from the VisualStore; never writes to it.
 *
 * Renders four layered <g> groups (back to front):
 *   #layer-shapes  — boundaries, circles, freehand paths
 *   #layer-arrows  — directional, bidirectional, tension arrows
 *   #layer-icons   — actor / concept images
 *   #layer-texts   — labels and annotations
 */

import { useEffect, useRef } from 'react'
import rough from 'roughjs'
import { useVisualStore } from '../../store/VisualStoreContext'

// ---------------------------------------------------------------------------
// Rough.js option builders — translate VisualStore element props to rc options
// ---------------------------------------------------------------------------

function shapeOptions(el) {
  return {
    roughness:   el.roughness  ?? 1.5,
    stroke:      el.stroke     ?? '#1a1a2e',
    strokeWidth: el.strokeWidth ?? 2,
    fill:        el.fill !== 'none' ? el.fill : undefined,
    fillStyle:   'hachure',
    hachureAngle: 45,
    hachureGap:   8,
  }
}

function arrowOptions(el) {
  return {
    roughness:   el.roughness   ?? 1.2,
    stroke:      el.stroke      ?? '#1a1a2e',
    strokeWidth: el.strokeWidth ?? 2,
  }
}

// ---------------------------------------------------------------------------
// Arrow label helper
// ---------------------------------------------------------------------------

function drawArrowLabel(svgNS, el) {
  if (!el.label) return null
  const pts = [el.startPoint, ...(el.midPoints ?? []), el.endPoint]

  // Midpoint position — average of centre two points or middle point
  const midIdx = Math.floor((pts.length - 1) / 2)
  const mid = pts.length % 2 === 1
    ? pts[midIdx + 1]
    : { x: (pts[midIdx].x + pts[midIdx + 1].x) / 2, y: (pts[midIdx].y + pts[midIdx + 1].y) / 2 }

  // Segment at the midpoint — determines angle and perpendicular offset direction
  const segA = pts[midIdx]
  const segB = pts[Math.min(midIdx + 1, pts.length - 1)]
  const dx = segB.x - segA.x
  const dy = segB.y - segA.y
  const len = Math.hypot(dx, dy) || 1

  // Normalised direction and perpendicular (always pick the "up" side in screen space)
  const ux = dx / len, uy = dy / len          // unit along arrow
  const nx1 = -uy,     ny1 =  ux             // left-hand perpendicular
  const nx2 =  uy,     ny2 = -ux             // right-hand perpendicular
  const [nx, ny] = ny1 <= ny2 ? [nx1, ny1] : [nx2, ny2]

  // Angle of the arrow in degrees — flip if pointing left to keep text readable
  let angleDeg = Math.atan2(dy, dx) * (180 / Math.PI)
  if (angleDeg > 90 || angleDeg < -90) angleDeg += 180

  const OFFSET   = 14
  const fontSize = el.labelFontSize ?? 14
  // Label sits offset perpendicular to the line, centred at midpoint
  const tx = mid.x + nx * OFFSET
  const ty = mid.y + ny * OFFSET

  // Rough estimated width for the background pill
  const estW = el.label.length * (fontSize * 0.56)
  const padX = 5, padY = 2

  const g = document.createElementNS(svgNS, 'g')
  // Rotate the whole label group around the text anchor point
  g.setAttribute('transform', `rotate(${angleDeg}, ${tx}, ${ty})`)

  const bg = document.createElementNS(svgNS, 'rect')
  bg.setAttribute('x',      tx - estW / 2 - padX)
  bg.setAttribute('y',      ty - fontSize / 2 - padY)
  bg.setAttribute('width',  estW + padX * 2)
  bg.setAttribute('height', fontSize + padY * 2)
  bg.setAttribute('fill',   'rgba(255,255,255,0.82)')
  bg.setAttribute('rx',     '3')
  g.appendChild(bg)

  const t = document.createElementNS(svgNS, 'text')
  t.setAttribute('x',                 tx)
  t.setAttribute('y',                 ty)
  t.setAttribute('text-anchor',       'middle')
  t.setAttribute('dominant-baseline', 'middle')
  t.setAttribute('font-family',       `'${el.labelFont ?? 'Caveat'}', cursive`)
  t.setAttribute('font-size',         fontSize)
  t.setAttribute('font-weight',       el.labelFontWeight ?? 'normal')
  t.setAttribute('font-style',        el.labelFontStyle  ?? 'normal')
  t.setAttribute('fill',              el.labelColor      ?? '#1a1a2e')
  t.textContent = el.label
  g.appendChild(t)

  return g
}

// ---------------------------------------------------------------------------
// Canvas background
// ---------------------------------------------------------------------------

const BG_BASE = { white: '#ffffff', cream: '#fef9ef', lined: '#fef9ef', dots: '#fef9ef', grid: '#fffdf5' }
const LINE_COLOR = '#cdc4b5'
const DOT_COLOR  = '#b0a898'

function renderBackground(container, svg, svgNS, background) {
  const bg = background ?? 'cream'

  let bgGroup = container.querySelector('#layer-background')
  if (!bgGroup) {
    bgGroup = document.createElementNS(svgNS, 'g')
    bgGroup.setAttribute('id', 'layer-background')
    container.insertBefore(bgGroup, container.firstChild)
  }
  bgGroup.innerHTML = ''

  const EXTENT    = 12000
  const baseColor = BG_BASE[bg] ?? BG_BASE.cream
  const baseRect  = document.createElementNS(svgNS, 'rect')
  baseRect.setAttribute('x',      -EXTENT)
  baseRect.setAttribute('y',      -EXTENT)
  baseRect.setAttribute('width',   EXTENT * 2)
  baseRect.setAttribute('height',  EXTENT * 2)

  if (bg === 'white' || bg === 'cream') {
    baseRect.setAttribute('fill', baseColor)
    bgGroup.appendChild(baseRect)
    return
  }

  // Pattern-based backgrounds — define pattern in a shared <defs> on the SVG root
  let svgDefs = svg.querySelector('defs#rp-defs')
  if (!svgDefs) {
    svgDefs = document.createElementNS(svgNS, 'defs')
    svgDefs.setAttribute('id', 'rp-defs')
    svg.insertBefore(svgDefs, svg.firstChild)
  }
  svgDefs.querySelector('#rp-bg-pattern')?.remove()

  const pat = document.createElementNS(svgNS, 'pattern')
  pat.setAttribute('id',           'rp-bg-pattern')
  pat.setAttribute('patternUnits', 'userSpaceOnUse')

  function tile(S) {
    const r = document.createElementNS(svgNS, 'rect')
    r.setAttribute('width', S); r.setAttribute('height', S)
    r.setAttribute('fill', baseColor)
    pat.appendChild(r)
    return r
  }
  function hline(S, color, width) {
    const l = document.createElementNS(svgNS, 'line')
    l.setAttribute('x1', 0); l.setAttribute('y1', S)
    l.setAttribute('x2', S); l.setAttribute('y2', S)
    l.setAttribute('stroke', color); l.setAttribute('stroke-width', width)
    pat.appendChild(l)
  }
  function vline(S, color, width) {
    const l = document.createElementNS(svgNS, 'line')
    l.setAttribute('x1', S); l.setAttribute('y1', 0)
    l.setAttribute('x2', S); l.setAttribute('y2', S)
    l.setAttribute('stroke', color); l.setAttribute('stroke-width', width)
    pat.appendChild(l)
  }

  if (bg === 'lined') {
    const S = 28
    pat.setAttribute('width', S); pat.setAttribute('height', S)
    tile(S)
    hline(S - 0.5, LINE_COLOR, '0.7')
  } else if (bg === 'dots') {
    const S = 24
    pat.setAttribute('width', S); pat.setAttribute('height', S)
    tile(S)
    const dot = document.createElementNS(svgNS, 'circle')
    dot.setAttribute('cx', S / 2); dot.setAttribute('cy', S / 2); dot.setAttribute('r', '1.3')
    dot.setAttribute('fill', DOT_COLOR)
    pat.appendChild(dot)
  } else if (bg === 'grid') {
    const S = 28
    pat.setAttribute('width', S); pat.setAttribute('height', S)
    tile(S)
    hline(S, LINE_COLOR, '0.6')
    vline(S, LINE_COLOR, '0.6')
  }

  svgDefs.appendChild(pat)
  baseRect.setAttribute('fill', 'url(#rp-bg-pattern)')
  bgGroup.appendChild(baseRect)
}

// ---------------------------------------------------------------------------
// Per-element draw helpers
// ---------------------------------------------------------------------------

function drawShape(rc, svgNS, el) {
  const opts = shapeOptions(el)
  let node

  switch (el.type) {
    case 'rectangle':
      node = rc.rectangle(el.x, el.y, el.width, el.height, { ...opts, roughness: opts.roughness + 0.3 })
      break
    case 'ellipse':
      node = rc.ellipse(
        el.x + el.width / 2,
        el.y + el.height / 2,
        el.width,
        el.height,
        opts,
      )
      break
    case 'freehand':
    default:
      if (el.points.length < 2) return null
      node = rc.linearPath(el.points.map(p => [p.x, p.y]), opts)
      break
  }

  if (node && el.label) {
    // Label is rendered by the text layer; nothing extra here
  }
  return node
}

function drawArrow(rc, svgNS, el) {
  const opts = arrowOptions(el)
  const { startPoint: s, endPoint: e, midPoints = [] } = el

  // Build point list for the main line
  const pts = [s, ...midPoints, e]
  let lineNode

  if (pts.length === 2) {
    lineNode = rc.line(s.x, s.y, e.x, e.y, opts)
  } else {
    lineNode = rc.linearPath(pts.map(p => [p.x, p.y]), opts)
  }

  // Arrowhead(s)
  const heads = []
  const headLen = 12
  const headAngle = Math.PI / 7

  function arrowHead(from, to) {
    const angle = Math.atan2(to.y - from.y, to.x - from.x)
    const x1 = to.x - headLen * Math.cos(angle - headAngle)
    const y1 = to.y - headLen * Math.sin(angle - headAngle)
    const x2 = to.x - headLen * Math.cos(angle + headAngle)
    const y2 = to.y - headLen * Math.sin(angle + headAngle)
    return rc.linearPath([[x1, y1], [to.x, to.y], [x2, y2]], { ...opts, roughness: 0.8 })
  }

  if (el.type !== 'undirected') {
    const last  = pts[pts.length - 1]
    const prev  = pts[pts.length - 2]
    heads.push(arrowHead(prev, last))
  }
  if (el.type === 'bidirectional') {
    heads.push(arrowHead(pts[1] ?? e, pts[0]))
  }
  if (el.type === 'tension') {
    // Tension arrows get a zigzag — draw a small X crossing the midpoint
    const mid = {
      x: (s.x + e.x) / 2,
      y: (s.y + e.y) / 2,
    }
    const sz = 8
    heads.push(rc.line(mid.x - sz, mid.y - sz, mid.x + sz, mid.y + sz, { ...opts, roughness: 1.5 }))
    heads.push(rc.line(mid.x + sz, mid.y - sz, mid.x - sz, mid.y + sz, { ...opts, roughness: 1.5 }))
  }

  return [lineNode, ...heads]
}

function drawText(svgNS, el) {
  const text = document.createElementNS(svgNS, 'text')
  text.setAttribute('x', el.x)
  text.setAttribute('y', el.y)
  text.setAttribute('font-family', `'${el.font}', cursive`)
  text.setAttribute('font-size', el.fontSize ?? 18)
  text.setAttribute('font-weight', el.fontWeight ?? 'normal')
  text.setAttribute('font-style',  el.fontStyle  ?? 'normal')
  text.setAttribute('fill', el.color ?? '#1a1a2e')
  if (el.rotation) {
    text.setAttribute('transform', `rotate(${el.rotation}, ${el.x}, ${el.y})`)
  }
  text.textContent = el.content
  return text
}

function descriptionText(svgNS, el) {
  if (!el.descriptionVisible || !el.description) return null
  const t = document.createElementNS(svgNS, 'text')
  t.setAttribute('x', el.x + (el.width ?? 80) / 2)
  t.setAttribute('y', el.y + (el.height ?? 80) + 15)
  t.setAttribute('text-anchor', 'middle')
  t.setAttribute('font-family', `'${el.descriptionFont ?? 'Caveat'}', cursive`)
  t.setAttribute('font-size',   el.descriptionFontSize   ?? 13)
  t.setAttribute('font-weight', el.descriptionFontWeight ?? 'normal')
  t.setAttribute('font-style',  el.descriptionFontStyle  ?? 'normal')
  t.setAttribute('fill',        el.descriptionColor      ?? '#1a1a2e')
  t.setAttribute('pointer-events', 'none')
  t.textContent = el.description
  return t
}

function drawIcon(rc, svgNS, el) {
  // Always wrap in a <g> so description text can be appended alongside the graphic.
  const wrapper = document.createElementNS(svgNS, 'g')

  // Rough-path mode: library icons rendered sketchy via rough.js path()
  if (el.renderMode === 'rough' && el.paths?.length) {
    const inner = document.createElementNS(svgNS, 'g')
    const scaleX = (el.width  ?? 80) / (el.viewBoxW ?? 100)
    const scaleY = (el.height ?? 80) / (el.viewBoxH ?? 100)
    inner.setAttribute('transform', `translate(${el.x}, ${el.y}) scale(${scaleX}, ${scaleY})`)
    el.paths.forEach(p => {
      const node = rc.path(p.d, {
        roughness:   el.roughness  ?? 1.5,
        stroke:      p.stroke      ?? el.stroke     ?? '#1a1a2e',
        strokeWidth: p.strokeWidth ?? el.strokeWidth ?? 2,
        fill:        p.fill        ?? 'none',
        fillStyle:   'hachure',
        hachureGap:  8,
      })
      inner.appendChild(node)
    })
    wrapper.appendChild(inner)
  } else if (el.src) {
    // Image mode: plain <image> element (PNG, JPG, SVG data URI)
    const img = document.createElementNS(svgNS, 'image')
    img.setAttribute('href', el.src)
    img.setAttribute('x', el.x)
    img.setAttribute('y', el.y)
    img.setAttribute('width',  el.width  ?? 80)
    img.setAttribute('height', el.height ?? 80)
    wrapper.appendChild(img)
  } else {
    return null
  }

  const desc = descriptionText(svgNS, el)
  if (desc) wrapper.appendChild(desc)

  return wrapper
}

// ---------------------------------------------------------------------------
// Renderer component
// ---------------------------------------------------------------------------

export default function Renderer({ containerRef }) {
  const { store } = useVisualStore()
  const layersRef = useRef({})

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // Rough.js needs an svg element — walk up to find it
    const svg = container.ownerSVGElement ?? container
    const svgNS = 'http://www.w3.org/2000/svg'
    const rc = rough.svg(svg)

    // Ensure layer groups exist inside the viewport container (idempotent)
    const layerIds = ['layer-shapes', 'layer-arrows', 'layer-icons', 'layer-texts']
    layerIds.forEach(id => {
      const existing = container.querySelector(`#${id}`)
      if (!existing) {
        const g = document.createElementNS(svgNS, 'g')
        g.setAttribute('id', id)
        container.appendChild(g)
        layersRef.current[id] = g
      } else {
        layersRef.current[id] = existing
      }
    })

    const { shapes, arrows, icons, texts } = store.elements
    const background = store.styleState?.canvasBackground

    // --- Background ---
    renderBackground(container, svg, svgNS, background)

    // --- Shapes ---
    const shapesLayer = layersRef.current['layer-shapes']
    shapesLayer.innerHTML = ''
    shapes.forEach(el => {
      const node = drawShape(rc, svgNS, el)
      if (node) {
        node.setAttribute('data-id', el.id)
        shapesLayer.appendChild(node)
      }
    })

    // --- Arrows ---
    const arrowsLayer = layersRef.current['layer-arrows']
    arrowsLayer.innerHTML = ''
    arrows.forEach(el => {
      const nodes = drawArrow(rc, svgNS, el)
      const g = document.createElementNS(svgNS, 'g')
      g.setAttribute('data-id', el.id)
      nodes.filter(Boolean).forEach(n => g.appendChild(n))
      const labelNode = drawArrowLabel(svgNS, el)
      if (labelNode) g.appendChild(labelNode)
      arrowsLayer.appendChild(g)
    })

    // --- Icons ---
    const iconsLayer = layersRef.current['layer-icons']
    iconsLayer.innerHTML = ''
    icons.forEach(el => {
      const node = drawIcon(rc, svgNS, el)
      if (node) {
        node.setAttribute('data-id', el.id)
        iconsLayer.appendChild(node)
      }
    })

    // --- Texts ---
    const textsLayer = layersRef.current['layer-texts']
    textsLayer.innerHTML = ''
    texts.forEach(el => {
      const node = drawText(svgNS, el)
      node.setAttribute('data-id', el.id)
      textsLayer.appendChild(node)
    })
  }, [store.elements, store.styleState, containerRef])

  // Renderer is purely imperative — renders nothing into the React tree
  return null
}
