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
  t.setAttribute('font-family', "'Caveat', cursive")
  t.setAttribute('font-size', '13')
  t.setAttribute('fill', '#1a1a2e')
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
  }, [store.elements, containerRef])

  // Renderer is purely imperative — renders nothing into the React tree
  return null
}
