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
  src      = '',         // URL or data URI
  x        = 0,
  y        = 0,
  width    = 64,
  height   = 64,
  label    = '',
  actorType = null,      // 'individual' | 'role' | 'group' | 'organisation' | 'external_agent' | null
} = {}) {
  return { id: generateId(), kind: 'icon', src, x, y, width, height, label, actorType }
}

export function createText({
  content    = '',
  x          = 0,
  y          = 0,
  font       = 'Caveat',
  fontSize   = 18,
  rotation   = 0,         // degrees, slight random skew for hand-drawn feel
  color      = '#1a1a2e',
} = {}) {
  return { id: generateId(), kind: 'text', content, x, y, font, fontSize, rotation, color }
}

// ---------------------------------------------------------------------------
// Initial store state
// ---------------------------------------------------------------------------

export const INITIAL_STYLE_STATE = {
  globalRoughness: 1.5,
  activePalette: 'default',
  activeFont: 'Caveat',
}

export function createInitialState() {
  return {
    elements: {
      shapes: [],
      arrows: [],
      icons:  [],
      texts:  [],
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
  // Style
  SET_STYLE: 'SET_STYLE',
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

    // --- style ---
    case ACTIONS.SET_STYLE:
      return { ...state, styleState: { ...state.styleState, ...action.payload } }

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
