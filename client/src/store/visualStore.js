/**
 * VisualStore — sole source of truth for rendering the canvas.
 * Contains everything needed to redraw the diagram faithfully.
 * Carries no semantic meaning.
 *
 * Shape of the store:
 *   elements.shapes[]  — boundaries, circles, freehand paths
 *   elements.arrows[]  — connections, style variants
 *   elements.icons[]   — placed actor/concept images
 *   elements.texts[]   — labels and annotations
 *   styleState         — globalRoughness, activePalette, activeFont
 *   canvasHash         — fingerprint for change detection (computed on demand)
 */

// ---------------------------------------------------------------------------
// ID generation
// ---------------------------------------------------------------------------

export function generateId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

// ---------------------------------------------------------------------------
// Element factories — return a well-typed element with defaults
// ---------------------------------------------------------------------------

export function createShape({
  type = 'freehand',   // 'freehand' | 'rectangle' | 'ellipse'
  points = [],         // array of {x, y} — freehand path or polygon vertices
  x = 0,
  y = 0,
  width = 100,
  height = 100,
  roughness = 1.5,
  stroke = '#1a1a2e',
  fill = 'none',
  strokeWidth = 2,
  label = '',
} = {}) {
  return { id: generateId(), kind: 'shape', type, points, x, y, width, height, roughness, stroke, fill, strokeWidth, label }
}

export function createArrow({
  type = 'directional',  // 'directional' | 'bidirectional' | 'undirected' | 'tension'
  startPoint = { x: 0, y: 0 },
  endPoint   = { x: 100, y: 100 },
  midPoints  = [],       // optional intermediate {x,y} for curved arrows
  roughness  = 1.2,
  stroke     = '#1a1a2e',
  strokeWidth = 2,
  label = '',
} = {}) {
  return { id: generateId(), kind: 'arrow', type, startPoint, endPoint, midPoints, roughness, stroke, strokeWidth, label }
}

export function createIcon({
  src        = '',         // URL or data URI — used when renderMode = 'image'
  x          = 0,
  y          = 0,
  width      = 80,
  height     = 80,
  label      = '',
  actorType  = null,       // 'individual' | 'role' | 'group' | etc
  // Rough rendering (built-in library icons)
  renderMode = 'image',    // 'image' | 'rough'
  paths      = [],         // [{d, stroke?, fill?, strokeWidth?}] for rough mode
  viewBoxW   = 100,
  viewBoxH   = 100,
  roughness  = 1.5,
  stroke     = '#1a1a2e',
  strokeWidth = 2,
  // Semantic description — used by LLM export; optionally rendered on canvas
  description        = label || '',  // defaults to library icon label if available
  descriptionVisible = false,        // whether to render it as visible text on canvas
} = {}) {
  return { id: generateId(), kind: 'icon', src, x, y, width, height, label, actorType, renderMode, paths, viewBoxW, viewBoxH, roughness, stroke, strokeWidth, description, descriptionVisible }
}

export function createGroup({
  memberIds = [],     // ids of member elements
  label     = '',
} = {}) {
  return { id: generateId(), kind: 'group', memberIds, label }
}

export function createText({
  content    = '',
  x          = 0,
  y          = 0,
  font       = 'Caveat',
  fontSize   = 18,
  fontWeight = 'normal',  // 'normal' | 'bold'
  fontStyle  = 'normal',  // 'normal' | 'italic'
  rotation   = 0,         // degrees, slight random skew for hand-drawn feel
  color      = '#1a1a2e',
  parentId   = null,      // id of a shape/icon this text is anchored to (moves with parent)
} = {}) {
  return { id: generateId(), kind: 'text', content, x, y, font, fontSize, fontWeight, fontStyle, rotation, color, parentId }
}

// ---------------------------------------------------------------------------
// Initial store state
// ---------------------------------------------------------------------------

export const INITIAL_STYLE_STATE = {
  globalRoughness: 1.5,
  activePalette: 'default',
  activeFont: 'Caveat',
  // Drawing defaults — applied to newly created elements
  defaultStroke:     '#1a1a2e',
  defaultFill:       'none',
  defaultTextColor:  '#1a1a2e',
  defaultFont:       'Caveat',
  defaultFontSize:   18,
  defaultFontWeight: 'normal',
  defaultFontStyle:  'normal',
}

export function createInitialState() {
  return {
    elements: {
      shapes: [],
      arrows: [],
      icons:  [],
      texts:  [],
      groups: [],
    },
    styleState: { ...INITIAL_STYLE_STATE },
  }
}

// ---------------------------------------------------------------------------
// Action types
// ---------------------------------------------------------------------------

export const ACTIONS = {
  // Shapes
  ADD_SHAPE:    'ADD_SHAPE',
  UPDATE_SHAPE: 'UPDATE_SHAPE',
  DELETE_SHAPE: 'DELETE_SHAPE',
  // Arrows
  ADD_ARROW:    'ADD_ARROW',
  UPDATE_ARROW: 'UPDATE_ARROW',
  DELETE_ARROW: 'DELETE_ARROW',
  // Icons
  ADD_ICON:    'ADD_ICON',
  UPDATE_ICON: 'UPDATE_ICON',
  DELETE_ICON: 'DELETE_ICON',
  // Texts
  ADD_TEXT:    'ADD_TEXT',
  UPDATE_TEXT: 'UPDATE_TEXT',
  DELETE_TEXT: 'DELETE_TEXT',
  // Groups
  ADD_GROUP:    'ADD_GROUP',
  UPDATE_GROUP: 'UPDATE_GROUP',
  DELETE_GROUP: 'DELETE_GROUP',
  UNGROUP:      'UNGROUP',      // removes group container, keeps members
  // Style
  SET_STYLE: 'SET_STYLE',
  // Bulk move / delete / scale (multi-element, one undo step)
  MOVE_ELEMENTS:   'MOVE_ELEMENTS',    // payload: { ids: string[], dx, dy } — expands group memberIds
  DELETE_ELEMENTS: 'DELETE_ELEMENTS',  // payload: string[] — group ids also deletes members
  SCALE_ELEMENTS:  'SCALE_ELEMENTS',   // payload: { ids, ox, oy, sx, sy } — expands group memberIds
  // Bulk
  LOAD_STORE:  'LOAD_STORE',
  CLEAR_STORE: 'CLEAR_STORE',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function upsert(list, item) {
  return list.some(el => el.id === item.id)
    ? list.map(el => el.id === item.id ? { ...el, ...item } : el)
    : [...list, item]
}

function remove(list, id) {
  return list.filter(el => el.id !== id)
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

export function visualStoreReducer(state, action) {
  const { elements } = state

  switch (action.type) {
    // --- shapes ---
    case ACTIONS.ADD_SHAPE:
      return { ...state, elements: { ...elements, shapes: [...elements.shapes, action.payload] } }
    case ACTIONS.UPDATE_SHAPE:
      return { ...state, elements: { ...elements, shapes: upsert(elements.shapes, action.payload) } }
    case ACTIONS.DELETE_SHAPE:
      return { ...state, elements: { ...elements, shapes: remove(elements.shapes, action.payload.id) } }

    // --- arrows ---
    case ACTIONS.ADD_ARROW:
      return { ...state, elements: { ...elements, arrows: [...elements.arrows, action.payload] } }
    case ACTIONS.UPDATE_ARROW:
      return { ...state, elements: { ...elements, arrows: upsert(elements.arrows, action.payload) } }
    case ACTIONS.DELETE_ARROW:
      return { ...state, elements: { ...elements, arrows: remove(elements.arrows, action.payload.id) } }

    // --- icons ---
    case ACTIONS.ADD_ICON:
      return { ...state, elements: { ...elements, icons: [...elements.icons, action.payload] } }
    case ACTIONS.UPDATE_ICON:
      return { ...state, elements: { ...elements, icons: upsert(elements.icons, action.payload) } }
    case ACTIONS.DELETE_ICON:
      return { ...state, elements: { ...elements, icons: remove(elements.icons, action.payload.id) } }

    // --- texts ---
    case ACTIONS.ADD_TEXT:
      return { ...state, elements: { ...elements, texts: [...elements.texts, action.payload] } }
    case ACTIONS.UPDATE_TEXT:
      return { ...state, elements: { ...elements, texts: upsert(elements.texts, action.payload) } }
    case ACTIONS.DELETE_TEXT:
      return { ...state, elements: { ...elements, texts: remove(elements.texts, action.payload.id) } }

    // --- groups ---
    case ACTIONS.ADD_GROUP:
      return { ...state, elements: { ...elements, groups: [...(elements.groups ?? []), action.payload] } }
    case ACTIONS.UPDATE_GROUP:
      return { ...state, elements: { ...elements, groups: upsert(elements.groups ?? [], action.payload) } }
    case ACTIONS.DELETE_GROUP:
      return { ...state, elements: { ...elements, groups: remove(elements.groups ?? [], action.payload.id) } }
    case ACTIONS.UNGROUP:
      // Remove only the group container; members stay untouched
      return { ...state, elements: { ...elements, groups: (elements.groups ?? []).filter(g => g.id !== action.payload) } }

    // --- style ---
    case ACTIONS.SET_STYLE:
      return { ...state, styleState: { ...state.styleState, ...action.payload } }

    // --- move (multi-element, one undo step) ---
    case ACTIONS.MOVE_ELEMENTS: {
      const { ids, dx, dy } = action.payload
      // Expand group ids to their member ids
      const idSet = new Set(ids)
      ;(elements.groups ?? []).forEach(g => { if (idSet.has(g.id)) g.memberIds.forEach(mid => idSet.add(mid)) })
      const moveShape = el => {
        if (!idSet.has(el.id)) return el
        if (el.type === 'freehand') return { ...el, points: el.points.map(p => ({ x: p.x + dx, y: p.y + dy })) }
        return { ...el, x: el.x + dx, y: el.y + dy }
      }
      const moveArrow = el => {
        if (!idSet.has(el.id)) return el
        return {
          ...el,
          startPoint: { x: el.startPoint.x + dx, y: el.startPoint.y + dy },
          endPoint:   { x: el.endPoint.x   + dx, y: el.endPoint.y   + dy },
          midPoints:  el.midPoints.map(p => ({ x: p.x + dx, y: p.y + dy })),
        }
      }
      const moveText = el => {
        // A text moves if its own id is selected OR its parent element is being moved.
        // If parentId is in the moved set, the parent's move already carries it — skip own-id check.
        if (idSet.has(el.parentId)) return { ...el, x: el.x + dx, y: el.y + dy }
        if (idSet.has(el.id))       return { ...el, x: el.x + dx, y: el.y + dy }
        return el
      }
      const moveIcon = el => {
        if (!idSet.has(el.id)) return el
        return { ...el, x: el.x + dx, y: el.y + dy }
      }
      return {
        ...state,
        elements: {
          shapes: elements.shapes.map(moveShape),
          arrows: elements.arrows.map(moveArrow),
          texts:  elements.texts.map(moveText),
          icons:  elements.icons.map(moveIcon),
          groups: elements.groups ?? [],  // groups themselves don't have position
        },
      }
    }

    // --- delete (multi-element; group ids also delete all members) ---
    case ACTIONS.DELETE_ELEMENTS: {
      const idSet = new Set(action.payload)
      // Expand group ids → also delete all members
      ;(elements.groups ?? []).forEach(g => { if (idSet.has(g.id)) g.memberIds.forEach(mid => idSet.add(mid)) })
      return {
        ...state,
        elements: {
          shapes: elements.shapes.filter(el => !idSet.has(el.id)),
          arrows: elements.arrows.filter(el => !idSet.has(el.id)),
          icons:  elements.icons.filter(el =>  !idSet.has(el.id)),
          texts:  elements.texts.filter(el => !idSet.has(el.id) && !idSet.has(el.parentId)),
          // Remove groups that were explicitly deleted, or that have become empty
          groups: (elements.groups ?? []).filter(g =>
            !idSet.has(g.id) && g.memberIds.some(mid => !idSet.has(mid))
          ),
        },
      }
    }

    // --- scale (resize, multi-element, one undo step) ---
    case ACTIONS.SCALE_ELEMENTS: {
      const { ids, ox, oy, sx, sy } = action.payload
      const idSet = new Set(ids)
      // Expand group ids to their member ids
      ;(elements.groups ?? []).forEach(g => { if (idSet.has(g.id)) g.memberIds.forEach(mid => idSet.add(mid)) })

      const scalePoint = p => ({ x: ox + (p.x - ox) * sx, y: oy + (p.y - oy) * sy })

      const scaleShape = el => {
        if (!idSet.has(el.id)) return el
        if (el.type === 'freehand') return { ...el, points: el.points.map(scalePoint) }
        const sp = scalePoint({ x: el.x, y: el.y })
        return { ...el, x: sp.x, y: sp.y, width: Math.max(4, el.width * sx), height: Math.max(4, el.height * sy) }
      }
      const scaleArrow = el => {
        if (!idSet.has(el.id)) return el
        return {
          ...el,
          startPoint: scalePoint(el.startPoint),
          endPoint:   scalePoint(el.endPoint),
          midPoints:  el.midPoints.map(scalePoint),
        }
      }
      const scaleText = el => {
        if (!idSet.has(el.id) && !idSet.has(el.parentId)) return el
        const sp = scalePoint({ x: el.x, y: el.y })
        return { ...el, x: sp.x, y: sp.y }
      }
      const scaleIcon = el => {
        if (!idSet.has(el.id)) return el
        const sp = scalePoint({ x: el.x, y: el.y })
        return { ...el, x: sp.x, y: sp.y, width: Math.max(8, (el.width ?? 64) * sx), height: Math.max(8, (el.height ?? 64) * sy) }
      }
      return {
        ...state,
        elements: {
          shapes: elements.shapes.map(scaleShape),
          arrows: elements.arrows.map(scaleArrow),
          texts:  elements.texts.map(scaleText),
          icons:  elements.icons.map(scaleIcon),
          groups: elements.groups ?? [],
        },
      }
    }

    // --- bulk ---
    case ACTIONS.LOAD_STORE:
      return { ...action.payload }
    case ACTIONS.CLEAR_STORE:
      return createInitialState()

    default:
      return state
  }
}

// ---------------------------------------------------------------------------
// Canvas hash — simple fingerprint for change detection
// ---------------------------------------------------------------------------

export function computeCanvasHash(state) {
  const str = JSON.stringify(state.elements)
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (Math.imul(31, hash) + str.charCodeAt(i)) | 0
  }
  return hash.toString(16)
}
