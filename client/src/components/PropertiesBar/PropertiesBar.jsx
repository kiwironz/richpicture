/**
 * PropertiesBar — top toolbar showing undo/redo and context-sensitive
 * style controls for the current selection.
 *
 * Shows:
 *   Always:              Undo / Redo buttons
 *   Shapes / arrows:     Stroke colour, Fill colour (toggle + picker)
 *   Texts:               Text colour, Font size, Bold, Italic
 *
 * Props:
 *   selectedIds — Set of selected element ids
 */

import { useVisualStore } from '../../store/VisualStoreContext'
import { ACTIONS } from '../../store/visualStore'

const FONT_SIZES = [10, 12, 14, 16, 18, 22, 28, 36, 48]

// ---------------------------------------------------------------------------
// Small reusable sub-components
// ---------------------------------------------------------------------------

function Btn({ onClick, disabled, title, active, children }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={[
        'h-7 px-2 rounded text-sm flex items-center gap-1 transition-colors select-none',
        active   ? 'bg-stone-800 text-white'   : 'text-stone-600',
        disabled ? 'opacity-30 cursor-not-allowed' : 'hover:bg-stone-100',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

function Sep() {
  return <div className="w-px h-6 bg-stone-200 mx-1 shrink-0" />
}

function ColorSwatch({ label, value, onChange, title }) {
  return (
    <label className="flex items-center gap-1.5 cursor-pointer select-none" title={title}>
      <span className="text-xs text-stone-400">{label}</span>
      <span className="relative">
        <span
          className="block w-6 h-6 rounded border border-stone-300"
          style={{ background: value }}
        />
        <input
          type="color"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
        />
      </span>
    </label>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function PropertiesBar({ selectedIds }) {
  const { store, dispatch, undo, redo, canUndo, canRedo } = useVisualStore()

  // Expand group ids to their member ids so we can directly edit member props
  const expandedIds = new Set(selectedIds)
  ;(store.elements.groups ?? []).forEach(g => {
    if (expandedIds.has(g.id)) g.memberIds.forEach(id => expandedIds.add(id))
  })

  const allElements = [
    ...(store.elements.shapes ?? []),
    ...(store.elements.arrows ?? []),
    ...(store.elements.texts  ?? []),
    ...(store.elements.icons  ?? []),
  ]
  const selected = allElements.filter(el => expandedIds.has(el.id))
  const texts  = selected.filter(el => el.kind === 'text')
  const shapes = selected.filter(el => el.kind === 'shape')
  const arrows = selected.filter(el => el.kind === 'arrow')

  const hasAny      = selected.length > 0
  const hasText     = texts.length  > 0
  const hasShape    = shapes.length > 0
  const hasStrokeable = shapes.length > 0 || arrows.length > 0

  // Representative values from first item in each kind
  const firstShape  = shapes[0]
  const firstArrow  = arrows[0]
  const firstText   = texts[0]
  const strokeVal   = firstShape?.stroke ?? firstArrow?.stroke ?? '#1a1a2e'
  const fillVal     = firstShape?.fill ?? 'none'
  const hasFill     = fillVal && fillVal !== 'none'
  const textColorVal = firstText?.color ?? '#1a1a2e'
  const fontSizeVal  = firstText?.fontSize ?? 18
  const isBold       = hasText && texts.every(t => t.fontWeight === 'bold')
  const isItalic     = hasText && texts.every(t => t.fontStyle  === 'italic')

  // ---- update helpers ----
  // Multiple dispatches for multiple selected items — each adds an undo entry,
  // which is acceptable for now; batching can be added later if needed.

  function setStroke(color) {
    shapes.forEach(el => dispatch({ type: ACTIONS.UPDATE_SHAPE, payload: { ...el, stroke: color } }))
    arrows.forEach(el => dispatch({ type: ACTIONS.UPDATE_ARROW, payload: { ...el, stroke: color } }))
  }

  function setFill(color) {
    shapes.forEach(el => dispatch({ type: ACTIONS.UPDATE_SHAPE, payload: { ...el, fill: color } }))
  }

  function toggleFill() {
    if (hasFill) {
      shapes.forEach(el => dispatch({ type: ACTIONS.UPDATE_SHAPE, payload: { ...el, fill: 'none' } }))
    } else {
      const base = fillVal !== 'none' ? fillVal : '#fffbeb'
      shapes.forEach(el => dispatch({ type: ACTIONS.UPDATE_SHAPE, payload: { ...el, fill: base } }))
    }
  }

  function setTextColor(color) {
    texts.forEach(el => dispatch({ type: ACTIONS.UPDATE_TEXT, payload: { ...el, color } }))
  }

  function setFontSize(size) {
    texts.forEach(el => dispatch({ type: ACTIONS.UPDATE_TEXT, payload: { ...el, fontSize: Number(size) } }))
  }

  function toggleBold() {
    const next = isBold ? 'normal' : 'bold'
    texts.forEach(el => dispatch({ type: ACTIONS.UPDATE_TEXT, payload: { ...el, fontWeight: next } }))
  }

  function toggleItalic() {
    const next = isItalic ? 'normal' : 'italic'
    texts.forEach(el => dispatch({ type: ACTIONS.UPDATE_TEXT, payload: { ...el, fontStyle: next } }))
  }

  return (
    <div className="h-10 bg-white border-b border-stone-200 flex items-center px-3 gap-1 shrink-0 overflow-x-auto">

      {/* Undo */}
      <Btn onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)">
        <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 7a5 5 0 1 1 .9 5.5" />
          <polyline points="1,4 3,7 6,5" />
        </svg>
        <span>Undo</span>
      </Btn>

      {/* Redo */}
      <Btn onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Y)">
        <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M13 7a5 5 0 1 0-.9 5.5" />
          <polyline points="15,4 13,7 10,5" />
        </svg>
        <span>Redo</span>
      </Btn>

      {/* --- Selection-specific controls --- */}
      {hasAny && <Sep />}

      {/* Stroke colour (shapes + arrows) */}
      {hasStrokeable && (
        <ColorSwatch
          label="Stroke"
          value={strokeVal}
          onChange={setStroke}
          title="Stroke colour"
        />
      )}

      {/* Fill colour (shapes only) */}
      {hasShape && (
        <label className="flex items-center gap-1.5 cursor-pointer select-none" title="Fill colour">
          <span className="text-xs text-stone-400">Fill</span>
          {/* Toggle button — shows a cross when no fill */}
          <button
            onClick={toggleFill}
            title={hasFill ? 'Remove fill' : 'Add fill'}
            className="w-6 h-6 rounded border border-stone-300 flex items-center justify-center hover:bg-stone-50"
            style={{ background: hasFill ? fillVal : 'white' }}
          >
            {!hasFill && (
              <svg viewBox="0 0 10 10" className="w-3 h-3 text-stone-400" stroke="currentColor" strokeWidth="1.5">
                <line x1="1" y1="1" x2="9" y2="9" />
                <line x1="9" y1="1" x2="1" y2="9" />
              </svg>
            )}
          </button>
          {/* Color picker only shown when fill is active */}
          {hasFill && (
            <span className="relative">
              <span className="block w-6 h-6 rounded border border-stone-300" style={{ background: fillVal }} />
              <input
                type="color"
                value={fillVal}
                onChange={e => setFill(e.target.value)}
                className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
              />
            </span>
          )}
        </label>
      )}

      {/* Text attributes */}
      {hasText && (
        <>
          {hasStrokeable && <Sep />}

          {/* Text colour */}
          <ColorSwatch
            label="Colour"
            value={textColorVal}
            onChange={setTextColor}
            title="Text colour"
          />

          <Sep />

          {/* Font size */}
          <select
            value={fontSizeVal}
            onChange={e => setFontSize(e.target.value)}
            className="h-7 text-sm bg-stone-50 border border-stone-200 rounded px-1 text-stone-600"
            title="Font size"
          >
            {FONT_SIZES.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          {/* Bold */}
          <Btn onClick={toggleBold} active={isBold} title="Bold">
            <span className="font-bold w-4 text-center">B</span>
          </Btn>

          {/* Italic */}
          <Btn onClick={toggleItalic} active={isItalic} title="Italic">
            <span className="italic w-4 text-center">I</span>
          </Btn>
        </>
      )}
    </div>
  )
}
