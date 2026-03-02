/**
 * ToolPalette — explicit shape-selection sidebar.
 * The user picks a shape type before drawing; the stroke is then snapped
 * to that type on pen-up.  No gesture recognition required.
 *
 * Props:
 *   activeTool   — currently selected tool id
 *   onToolChange — callback(toolId)
 */

export const TOOLS = [
  {
    id: 'select',
    label: 'Select',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 3l14 9-7 1-4 7z" />
      </svg>
    ),
  },
  {
    id: 'freehand',
    label: 'Freehand',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 17 C5 14, 7 20, 9 16 S13 10, 15 14 S19 20, 21 16" />
      </svg>
    ),
  },
  {
    id: 'rectangle',
    label: 'Rectangle',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="6" width="18" height="12" rx="1" />
      </svg>
    ),
  },
  {
    id: 'ellipse',
    label: 'Ellipse',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="12" cy="12" rx="9" ry="6" />
      </svg>
    ),
  },
  {
    id: 'line',
    label: 'Line',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <line x1="4" y1="20" x2="20" y2="4" />
      </svg>
    ),
  },
  {
    id: 'arrow',
    label: 'Arrow',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <line x1="4" y1="20" x2="19" y2="5" />
        <polyline points="10,5 19,5 19,14" />
      </svg>
    ),
  },
  {
    id: 'bidirectional',
    label: 'Both-way arrow',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <line x1="4" y1="12" x2="20" y2="12" />
        <polyline points="8,8 4,12 8,16" />
        <polyline points="16,8 20,12 16,16" />
      </svg>
    ),
  },
  {
    id: 'text',
    label: 'Text',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <line x1="4" y1="7" x2="20" y2="7" />
        <line x1="12" y1="7" x2="12" y2="20" />
      </svg>
    ),
  },
]

export default function ToolPalette({ activeTool, onToolChange }) {
  return (
    <aside className="w-14 h-full bg-white border-r border-stone-200 flex flex-col items-center py-3 gap-1 shrink-0">
      {TOOLS.map(tool => (
        <button
          key={tool.id}
          title={tool.label}
          onClick={() => onToolChange(tool.id)}
          className={[
            'w-10 h-10 rounded-lg flex items-center justify-center transition-colors',
            activeTool === tool.id
              ? 'bg-stone-800 text-white'
              : 'text-stone-500 hover:bg-stone-100 hover:text-stone-800',
          ].join(' ')}
        >
          <span className="w-5 h-5">{tool.icon}</span>
        </button>
      ))}
    </aside>
  )
}
