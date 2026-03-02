/**
 * IconLibrary — scrollable panel of bundled rough-drawn icons.
 *
 * Click an icon → calls onPlace(iconDef), which the parent uses to place it
 * at the current viewport centre via CanvasEngine's pendingIcon mechanism.
 *
 * Thumbnails are rendered as clean (non-rough) SVGs for speed.  The actual
 * canvas element uses rough.js path() in the Renderer.
 */

import { useState } from 'react'
import { ICON_LIBRARY, ICON_CATEGORIES } from '../../assets/iconLibrary'

const DRAG_TYPE = 'application/richpicture-icon'

// Render a plain SVG thumbnail (no rough treatment) for the palette grid
function IconThumb({ icon, onClick }) {
  function handleDragStart(e) {
    e.dataTransfer.setData(DRAG_TYPE, icon.id)
    e.dataTransfer.effectAllowed = 'copy'
  }

  return (
    <button
      draggable
      onDragStart={handleDragStart}
      onClick={() => onClick(icon)}
      title={`${icon.label} — drag onto canvas or click to place`}
      className="flex flex-col items-center gap-1 p-1.5 rounded hover:bg-stone-100 active:bg-stone-200 transition-colors cursor-grab active:cursor-grabbing"
    >
      <svg
        viewBox="0 0 100 100"
        className="w-10 h-10"
        fill="none"
        stroke="#1a1a2e"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {icon.paths.map((p, i) => (
          <path
            key={i}
            d={p.d}
            stroke={p.stroke ?? '#1a1a2e'}
            fill={p.fill ?? 'none'}
            strokeWidth={p.strokeWidth ?? 3}
          />
        ))}
      </svg>
      <span className="text-xs text-stone-500 leading-none text-center w-full truncate">{icon.label}</span>
    </button>
  )
}

export default function IconLibrary({ onPlace }) {
  const [activeCategory, setActiveCategory] = useState(ICON_CATEGORIES[0])

  const filtered = ICON_LIBRARY.filter(ic => ic.category === activeCategory)

  return (
    <div className="w-44 h-full bg-white border-r border-stone-200 flex flex-col shrink-0">
      {/* Header */}
      <div className="px-3 py-2 border-b border-stone-200">
        <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Icons</p>
        <p className="text-xs text-stone-400 mt-0.5">Click to place on canvas</p>
      </div>

      {/* Category tabs */}
      <div className="flex flex-wrap gap-1 px-2 py-2 border-b border-stone-100">
        {ICON_CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={[
              'px-2 py-0.5 rounded text-xs transition-colors',
              activeCategory === cat
                ? 'bg-stone-800 text-white'
                : 'text-stone-500 hover:bg-stone-100',
            ].join(' ')}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Icon grid */}
      <div className="flex-1 overflow-y-auto p-2 grid grid-cols-3 gap-1 content-start">
        {filtered.map(icon => (
          <IconThumb key={icon.id} icon={icon} onClick={onPlace} />
        ))}
      </div>

      {/* Footer hint */}
      <div className="px-3 py-2 border-t border-stone-100">
        <p className="text-xs text-stone-400">Drop or paste images onto canvas to add photos & SVGs</p>
      </div>
    </div>
  )
}
