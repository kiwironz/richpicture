/**
 * PropertiesBar — top toolbar: undo/redo, save/open/new, and contextual style controls.
 *
 * Two modes (automatic):
 *   Nothing selected  → edit drawing defaults (applied to newly created elements)
 *   Selection exists  → edit the selected element(s) in place
 *
 * Props:
 *   selectedIds — Set of selected element ids
 */

import { useRef } from 'react'
import { useVisualStore } from '../../store/VisualStoreContext'
import { ACTIONS } from '../../store/visualStore'

export const FONTS     = ['Caveat', 'Patrick Hand', 'Architects Daughter', 'Kalam']
const FONT_SIZES = [10, 12, 14, 16, 18, 22, 28, 36, 48]

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Btn({ onClick, disabled, title, active, children }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={[
        'h-7 px-2 rounded text-sm flex items-center gap-1 transition-colors select-none whitespace-nowrap shrink-0',
        active   ? 'bg-stone-800 text-white'   : 'text-stone-600',
        disabled ? 'opacity-30 cursor-not-allowed' : 'hover:bg-stone-100',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

function Sep() {
  return <div className="w-px h-5 bg-stone-200 mx-1 shrink-0" />
}

function ColorSwatch({ label, value, onChange, title }) {
  // If value is 'none' or missing, show a crossed-out white square and treat it as toggleable
  const isNone = !value || value === 'none'
  return (
    <label className="flex items-center gap-1 cursor-pointer select-none shrink-0" title={title}>
      {label && <span className="text-xs text-stone-400">{label}</span>}
      <span className="relative w-6 h-6">
        <span
          className="block w-6 h-6 rounded border border-stone-300"
          style={{ background: isNone ? 'white' : value }}
        />
        {isNone && (
          <svg className="absolute inset-0 w-6 h-6 text-stone-300" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
            <line x1="4" y1="4" x2="20" y2="20" />
          </svg>
        )}
        {!isNone && (
          <input
            type="color"
            value={value}
            onChange={e => onChange(e.target.value)}
            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
          />
        )}
      </span>
    </label>
  )
}

function FillControl({ value, onChange }) {
  const isNone = !value || value === 'none'
  return (
    <label className="flex items-center gap-1 cursor-pointer select-none shrink-0" title="Fill (click swatch to change colour, click × to toggle)">
      <span className="text-xs text-stone-400">Fill</span>
      <span className="relative w-6 h-6">
        <span
          className="block w-6 h-6 rounded border border-stone-300"
          style={{ background: isNone ? 'white' : value }}
        />
        {isNone
          ? <svg className="absolute inset-0 w-6 h-6 text-stone-300" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><line x1="4" y1="4" x2="20" y2="20" /></svg>
          : null
        }
        <input
          type="color"
          value={isNone ? '#fffbeb' : value}
          onChange={e => onChange(e.target.value)}
          className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
        />
      </span>
      {/* toggle on/off */}
      <button
        onClick={() => onChange(isNone ? '#fffbeb' : 'none')}
        title={isNone ? 'Enable fill' : 'Remove fill'}
        className="text-stone-400 hover:text-stone-700 leading-none text-base select-none"
      >
        {isNone ? '+' : '×'}
      </button>
    </label>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function PropertiesBar({ selectedIds }) {
  const { store, dispatch, undo, redo, canUndo, canRedo } = useVisualStore()
  const fileInputRef = useRef(null)

  // --- Save / Open / New ---
  function handleNew() {
    if (!window.confirm('Start a new diagram? Unsaved changes will be lost.')) return
    dispatch({ type: ACTIONS.CLEAR_STORE })
  }

  function handleSave() {
    const json = JSON.stringify(store, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = 'diagram.richpicture.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleOpen() {
    fileInputRef.current?.click()
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      try {
        const loaded = JSON.parse(ev.target.result)
        if (loaded?.elements && loaded?.styleState) {
          dispatch({ type: ACTIONS.LOAD_STORE, payload: loaded })
        } else {
          alert('Unrecognised file format.')
        }
      } catch {
        alert('Could not read file.')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  // --- Determine mode ---
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
  const selected      = allElements.filter(el => expandedIds.has(el.id))
  const texts         = selected.filter(el => el.kind === 'text')
  const shapes        = selected.filter(el => el.kind === 'shape')
  const arrows        = selected.filter(el => el.kind === 'arrow')
  const icons         = selected.filter(el => el.kind === 'icon')
  const hasSelection  = selected.length > 0
  const hasText       = texts.length    > 0
  const hasShape      = shapes.length   > 0
  const hasStrokeable = shapes.length > 0 || arrows.length > 0
  const hasIcon       = icons.length   > 0

  // --- Values: selection mode uses element props, default mode uses styleState ---
  const ss = store.styleState
  const strokeVal    = hasStrokeable ? (shapes[0]?.stroke ?? arrows[0]?.stroke ?? '#1a1a2e') : ss.defaultStroke
  const fillVal      = hasShape      ? (shapes[0]?.fill ?? 'none')                           : ss.defaultFill
  const textColorVal = hasText       ? (texts[0]?.color ?? '#1a1a2e')                        : ss.defaultTextColor
  const fontVal      = hasText       ? (texts[0]?.font  ?? 'Caveat')                         : ss.defaultFont
  const fontSizeVal  = hasText       ? (texts[0]?.fontSize ?? 18)                            : ss.defaultFontSize
  const isBold       = hasText ? texts.every(t => t.fontWeight === 'bold')   : ss.defaultFontWeight === 'bold'
  const isItalic     = hasText ? texts.every(t => t.fontStyle  === 'italic') : ss.defaultFontStyle  === 'italic'

  // Icon description
  const descVal     = hasIcon
    ? (icons.every(ic => ic.description === icons[0].description) ? (icons[0].description ?? '') : '')
    : ''
  const descVisible = hasIcon && icons.every(ic => ic.descriptionVisible)
  // Description typography
  const descFontVal      = hasIcon ? (icons[0].descriptionFont       ?? 'Caveat')  : 'Caveat'
  const descFontSizeVal  = hasIcon ? (icons[0].descriptionFontSize   ?? 13)        : 13
  const descIsBold       = hasIcon && icons.every(ic => (ic.descriptionFontWeight ?? 'normal') === 'bold')
  const descIsItalic     = hasIcon && icons.every(ic => (ic.descriptionFontStyle  ?? 'normal') === 'italic')
  const descColorVal     = hasIcon ? (icons[0].descriptionColor ?? '#1a1a2e') : '#1a1a2e'

  // --- Update helpers ---
  function setDefault(key, val) {
    dispatch({ type: ACTIONS.SET_STYLE, payload: { [key]: val } })
  }

  function setStroke(color) {
    if (hasStrokeable) {
      shapes.forEach(el => dispatch({ type: ACTIONS.UPDATE_SHAPE, payload: { ...el, stroke: color } }))
      arrows.forEach(el => dispatch({ type: ACTIONS.UPDATE_ARROW, payload: { ...el, stroke: color } }))
    } else {
      setDefault('defaultStroke', color)
    }
  }

  function setFill(color) {
    if (hasShape) {
      shapes.forEach(el => dispatch({ type: ACTIONS.UPDATE_SHAPE, payload: { ...el, fill: color } }))
    } else {
      setDefault('defaultFill', color)
    }
  }

  function setTextColor(color) {
    if (hasText) {
      texts.forEach(el => dispatch({ type: ACTIONS.UPDATE_TEXT, payload: { ...el, color } }))
    } else {
      setDefault('defaultTextColor', color)
    }
  }

  function setFont(font) {
    if (hasText) {
      texts.forEach(el => dispatch({ type: ACTIONS.UPDATE_TEXT, payload: { ...el, font } }))
    } else {
      setDefault('defaultFont', font)
    }
  }

  function setFontSize(size) {
    if (hasText) {
      texts.forEach(el => dispatch({ type: ACTIONS.UPDATE_TEXT, payload: { ...el, fontSize: Number(size) } }))
    } else {
      setDefault('defaultFontSize', Number(size))
    }
  }

  function toggleBold() {
    if (hasText) {
      const next = isBold ? 'normal' : 'bold'
      texts.forEach(el => dispatch({ type: ACTIONS.UPDATE_TEXT, payload: { ...el, fontWeight: next } }))
    } else {
      setDefault('defaultFontWeight', isBold ? 'normal' : 'bold')
    }
  }

  function toggleItalic() {
    if (hasText) {
      const next = isItalic ? 'normal' : 'italic'
      texts.forEach(el => dispatch({ type: ACTIONS.UPDATE_TEXT, payload: { ...el, fontStyle: next } }))
    } else {
      setDefault('defaultFontStyle', isItalic ? 'normal' : 'italic')
    }
  }

  function setDescription(val) {
    icons.forEach(ic => dispatch({ type: ACTIONS.UPDATE_ICON, payload: { ...ic, description: val } }))
  }

  function toggleDescVisible() {
    const next = !descVisible
    icons.forEach(ic => dispatch({ type: ACTIONS.UPDATE_ICON, payload: { ...ic, descriptionVisible: next } }))
  }

  function setDescFont(font)      { icons.forEach(ic => dispatch({ type: ACTIONS.UPDATE_ICON, payload: { ...ic, descriptionFont: font } })) }
  function setDescFontSize(size)  { icons.forEach(ic => dispatch({ type: ACTIONS.UPDATE_ICON, payload: { ...ic, descriptionFontSize: Number(size) } })) }
  function setDescColor(color)    { icons.forEach(ic => dispatch({ type: ACTIONS.UPDATE_ICON, payload: { ...ic, descriptionColor: color } })) }
  function toggleDescBold()       { const next = descIsBold ? 'normal' : 'bold';   icons.forEach(ic => dispatch({ type: ACTIONS.UPDATE_ICON, payload: { ...ic, descriptionFontWeight: next } })) }
  function toggleDescItalic()     { const next = descIsItalic ? 'normal' : 'italic'; icons.forEach(ic => dispatch({ type: ACTIONS.UPDATE_ICON, payload: { ...ic, descriptionFontStyle: next } })) }

  const modeLabel = hasSelection ? null : (
    <span className="text-xs text-stone-400 italic shrink-0">defaults</span>
  )

  return (
    <div className="h-10 bg-white border-b border-stone-200 flex items-center px-3 gap-1 shrink-0 overflow-x-auto">

      {/* Hidden file input for Open */}
      <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleFileChange} />

      {/* New / Open / Save */}
      <Btn onClick={handleNew} title="New diagram">
        <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="1" width="9" height="13" rx="1" />
          <path d="M8 1v4h3" />
          <line x1="5" y1="8"  x2="10" y2="8" />
          <line x1="5" y1="10" x2="8"  y2="10" />
        </svg>
      </Btn>

      <Btn onClick={handleOpen} title="Open diagram">
        <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 4a1 1 0 0 1 1-1h4l1.5 2H14a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1z" />
        </svg>
      </Btn>

      <Btn onClick={handleSave} title="Save diagram">
        <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M13 13H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1h8l2 2v8a1 1 0 0 1-1 1z" />
          <rect x="5" y="9" width="6" height="4" />
          <rect x="5" y="2" width="5" height="3" />
        </svg>
      </Btn>

      <Sep />

      {/* Undo / Redo */}
      <Btn onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)">
        <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 7a5 5 0 1 1 .9 5.5" />
          <polyline points="1,4 3,7 6,5" />
        </svg>
      </Btn>
      <Btn onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Y)">
        <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M13 7a5 5 0 1 0-.9 5.5" />
          <polyline points="15,4 13,7 10,5" />
        </svg>
      </Btn>

      <Sep />

      {/* Mode label — shows "defaults" when nothing is selected */}
      {modeLabel}

      {/* Stroke colour (shapes + arrows, or default) */}
      {(!hasSelection || hasStrokeable) && (
        <ColorSwatch label="Stroke" value={strokeVal} onChange={setStroke} title={hasSelection ? 'Stroke colour' : 'Default stroke colour'} />
      )}

      {/* Fill (shapes, or default) */}
      {(!hasSelection || hasShape) && (
        <FillControl value={fillVal} onChange={setFill} />
      )}

      {/* Text colour */}
      {(!hasSelection || hasText) && (
        <ColorSwatch label="Text" value={textColorVal} onChange={setTextColor} title={hasSelection ? 'Text colour' : 'Default text colour'} />
      )}

      <Sep />

      {/* Font picker */}
      {(!hasSelection || hasText) && (
        <select
          value={fontVal}
          onChange={e => setFont(e.target.value)}
          title={hasSelection ? 'Font' : 'Default font'}
          className="h-7 text-sm bg-stone-50 border border-stone-200 rounded px-1 text-stone-600 shrink-0"
          style={{ fontFamily: `'${fontVal}', cursive`, maxWidth: 160 }}
        >
          {FONTS.map(f => (
            <option key={f} value={f} style={{ fontFamily: `'${f}', cursive` }}>{f}</option>
          ))}
        </select>
      )}

      {/* Font size */}
      {(!hasSelection || hasText) && (
        <select
          value={fontSizeVal}
          onChange={e => setFontSize(e.target.value)}
          title={hasSelection ? 'Font size' : 'Default font size'}
          className="h-7 text-sm bg-stone-50 border border-stone-200 rounded px-1 text-stone-600 w-14 shrink-0"
        >
          {FONT_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      )}

      {/* Bold */}
      {(!hasSelection || hasText) && (
        <Btn onClick={toggleBold} active={isBold} title={hasSelection ? 'Bold' : 'Default bold'}>
          <span className="font-bold w-3 text-center">B</span>
        </Btn>
      )}

      {/* Italic */}
      {(!hasSelection || hasText) && (
        <Btn onClick={toggleItalic} active={isItalic} title={hasSelection ? 'Italic' : 'Default italic'}>
          <span className="italic w-3 text-center">I</span>
        </Btn>
      )}

      {/* Icon / image description */}
      {hasIcon && (
        <>
          <Sep />
          <span className="text-xs text-stone-400 shrink-0">Desc</span>
          <input
            type="text"
            value={descVal}
            onChange={e => setDescription(e.target.value)}
            placeholder="Add description…"
            title="Semantic description (exported for LLM reading)"
            className="h-7 text-sm bg-stone-50 border border-stone-200 rounded px-2 text-stone-600 w-44 shrink-0"
          />
          <Btn
            onClick={toggleDescVisible}
            active={descVisible}
            title={descVisible ? 'Hide description on canvas' : 'Show description on canvas'}
          >
            {descVisible
              ? <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <ellipse cx="8" cy="8" rx="6" ry="4" />
                  <circle cx="8" cy="8" r="1.8" fill="currentColor" stroke="none" />
                </svg>
              : <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 8c1.5-3 9.5-3 12 0" />
                  <line x1="3" y1="11" x2="5" y2="9" />
                  <line x1="8" y1="12" x2="8" y2="10" />
                  <line x1="13" y1="11" x2="11" y2="9" />
                </svg>
            }
          </Btn>
          {/* Description typography */}
          <ColorSwatch value={descColorVal} onChange={setDescColor} title="Description text colour" />
          <select
            value={descFontVal}
            onChange={e => setDescFont(e.target.value)}
            title="Description font"
            className="h-7 text-sm bg-stone-50 border border-stone-200 rounded px-1 text-stone-600 shrink-0"
            style={{ fontFamily: `'${descFontVal}', cursive`, maxWidth: 130 }}
          >
            {FONTS.map(f => (
              <option key={f} value={f} style={{ fontFamily: `'${f}', cursive` }}>{f}</option>
            ))}
          </select>
          <select
            value={descFontSizeVal}
            onChange={e => setDescFontSize(e.target.value)}
            title="Description font size"
            className="h-7 text-sm bg-stone-50 border border-stone-200 rounded px-1 text-stone-600 w-14 shrink-0"
          >
            {FONT_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <Btn onClick={toggleDescBold}   active={descIsBold}   title="Description bold">
            <span className="font-bold w-3 text-center">B</span>
          </Btn>
          <Btn onClick={toggleDescItalic} active={descIsItalic} title="Description italic">
            <span className="italic w-3 text-center">I</span>
          </Btn>
        </>
      )}
    </div>
  )
}
