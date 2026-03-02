/**
 * TextInputOverlay — an HTML <textarea> positioned absolutely over the canvas.
 *
 * Appears at the clicked screen position.  Commits on Enter (without Shift)
 * or on blur; cancels on Escape.
 *
 * Props:
 *   screenPos  — { x, y } offset within the canvas container (px)
 *   onCommit(text) — called with trimmed text string when user confirms
 *   onCancel()     — called when user cancels (Escape or empty blur)
 */

import { useEffect, useRef } from 'react'

export default function TextInputOverlay({ screenPos, onCommit, onCancel, font = 'Caveat', fontSize = 18, initialValue = '' }) {
  const ref = useRef(null)

  // Auto-focus and select-all on mount
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.focus()
    el.select()
  }, [])

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      const text = ref.current?.value?.trim()
      if (text) onCommit(text)
      else onCancel()
    }
    if (e.key === 'Escape') {
      e.stopPropagation()
      onCancel()
    }
  }

  function handleBlur(e) {
    const text = e.target.value.trim()
    if (text) onCommit(text)
    else onCancel()
  }

  // Stop pointer events propagating to the canvas while textarea is open
  function stopProp(e) { e.stopPropagation() }

  return (
    <textarea
      ref={ref}
      rows={1}
      defaultValue={initialValue}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      onPointerDown={stopProp}
      onPointerUp={stopProp}
      style={{
        position:   'absolute',
        left:       screenPos.x,
        top:        screenPos.y,
        minWidth:   120,
        maxWidth:   340,
        background: 'rgba(255, 255, 255, 0.92)',
        border:     '1.5px dashed #94a3b8',
        borderRadius: 4,
        padding:    '2px 6px',
        fontFamily: `'${font}', cursive`,
        fontSize,
        lineHeight: 1.35,
        color:      '#1a1a2e',
        outline:    'none',
        resize:     'none',
        overflow:   'hidden',
        zIndex:     999,
        // Auto-grow trick: rows=1 but can expand via JS if needed
      }}
    />
  )
}
