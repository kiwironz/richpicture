// CanvasEngine — Phase 1
// Hosts: SVG canvas, Renderer (Rough.js), ViewportManager,
// InputHandler + StrokeAccumulator, SelectTool, TextTool

import { useRef, useEffect, useState, useCallback } from 'react'
import Renderer from './Renderer'
import { useViewport } from './useViewport'
import { useInputHandler } from './useInputHandler'
import { useSelectTool } from './useSelectTool'
import TextInputOverlay from './TextInputOverlay'
import { elementBBox, unionBBoxes, findParentShape } from './hitTest'
import { useVisualStore } from '../../store/VisualStoreContext'
import { createText, ACTIONS } from '../../store/visualStore'

export default function CanvasEngine({ activeTool = 'freehand' }) {
  const svgRef      = useRef(null)
  const viewportRef = useRef(null)

  const { store, dispatch, undo, redo } = useVisualStore()

  const { transformString, screenToDiagram, handlers: viewportHandlers } = useViewport()
  const { onWheel, onTouchMove, ...viewportPointerHandlers } = viewportHandlers

  // Non-passive wheel + touchmove
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    svg.addEventListener('wheel',     onWheel,     { passive: false })
    svg.addEventListener('touchmove', onTouchMove, { passive: false })
    return () => {
      svg.removeEventListener('wheel',     onWheel)
      svg.removeEventListener('touchmove', onTouchMove)
    }
  }, [onWheel, onTouchMove])

  // ---- Text tool state ----
  const [textInput, setTextInput] = useState(null)  // { screenPos, diagramPos } | null

  const handleTextClick = useCallback(({ screenPos, diagramPos }) => {
    setTextInput({ screenPos, diagramPos })
  }, [])

  const commitText = useCallback((content) => {
    const { diagramPos } = textInput
    const parentId = findParentShape(store.elements, diagramPos.x, diagramPos.y)
    dispatch({
      type:    ACTIONS.ADD_TEXT,
      payload: createText({ content, x: diagramPos.x, y: diagramPos.y, parentId }),
    })
    setTextInput(null)
  }, [textInput, store.elements, dispatch])

  const cancelText = useCallback(() => setTextInput(null), [])

  // ---- Select tool ----
  const { selectedIds, setSelectedIds, dragOffset, selectHandlers } = useSelectTool({
    svgRef,
    screenToDiagram,
    activeTool,
  })

  // Clear selection when changing away from select tool
  useEffect(() => {
    if (activeTool !== 'select') setSelectedIds(new Set())
  }, [activeTool, setSelectedIds])

  // ---- Draw tool (input handler) ----
  const { isDrawing, stroke, drawHandlers } = useInputHandler({
    svgRef,
    screenToDiagram,
    activeTool,
    onTextClick: handleTextClick,
  })

  // ---- Keyboard shortcuts ----
  useEffect(() => {
    function onKeyDown(e) {
      // Don't hijack shortcuts when a text input overlay is open
      if (textInput) return

      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return

      if (e.key === 'Escape') {
        setSelectedIds(new Set())
        setTextInput(null)
        return
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.size > 0) {
        e.preventDefault()
        dispatch({ type: ACTIONS.DELETE_ELEMENTS, payload: [...selectedIds] })
        setSelectedIds(new Set())
        return
      }

      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z') { e.preventDefault(); undo() }
        if (e.key === 'y') { e.preventDefault(); redo() }
        if (e.key === 'Z') { e.preventDefault(); redo() }  // Ctrl+Shift+Z
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [textInput, selectedIds, dispatch, undo, redo, setSelectedIds])

  // ---- Combine pointer handlers ----
  // Viewport pan uses middle-mouse (button 1); draw uses left (button 0);
  // select also uses left but checks activeTool — safe to combine.
  function combineHandlers(...handlers) {
    const keys = new Set(handlers.flatMap(h => Object.keys(h)))
    const combined = {}
    keys.forEach(k => {
      combined[k] = (e) => handlers.forEach(h => h[k]?.(e))
    })
    return combined
  }

  const combinedHandlers = combineHandlers(viewportPointerHandlers, drawHandlers, selectHandlers)

  // ---- Selection overlay geometry ----
  // Compute union bounding box of all selected elements (in diagram coords)
  const allElements = [
    ...store.elements.shapes,
    ...store.elements.arrows,
    ...store.elements.texts,
    ...store.elements.icons,
  ]
  const selectionBBox = selectedIds.size > 0
    ? unionBBoxes(allElements.filter(el => selectedIds.has(el.id)).map(elementBBox).filter(Boolean))
    : null

  const PAD = 6   // padding around selection box in diagram px

  return (
    <div className="flex-1 relative overflow-hidden">
      <svg
        ref={svgRef}
        className="w-full h-full"
        style={{ touchAction: 'none', cursor: activeTool === 'select' ? 'default' : 'crosshair' }}
        {...combinedHandlers}
      >
        <g ref={viewportRef} transform={transformString}>
          {/* Renderer populates layer groups inside this group imperatively */}

          {/* In-progress stroke ghost */}
          {isDrawing && stroke.length > 1 && (
            <polyline
              points={stroke.map(p => `${p.x},${p.y}`).join(' ')}
              fill="none"
              stroke="#94a3b8"
              strokeWidth="1.5"
              strokeDasharray="4 3"
              strokeLinecap="round"
            />
          )}

          {/* Selection overlay — transforms with drag preview */}
          {selectionBBox && (
            <g transform={`translate(${dragOffset.dx}, ${dragOffset.dy})`} style={{ pointerEvents: 'none' }}>
              <rect
                x={selectionBBox.x - PAD}
                y={selectionBBox.y - PAD}
                width={selectionBBox.width  + PAD * 2}
                height={selectionBBox.height + PAD * 2}
                fill="none"
                stroke="#3b82f6"
                strokeWidth="1.5"
                strokeDasharray="5 3"
                rx="3"
              />
            </g>
          )}
        </g>
      </svg>

      {/* Text input overlay — screen-space, outside SVG */}
      {textInput && (
        <TextInputOverlay
          screenPos={textInput.screenPos}
          onCommit={commitText}
          onCancel={cancelText}
        />
      )}

      <Renderer containerRef={viewportRef} />
    </div>
  )
}

