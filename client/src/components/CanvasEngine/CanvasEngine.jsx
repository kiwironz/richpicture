// CanvasEngine — Phase 1
// Hosts: SVG canvas, Renderer (Rough.js), ViewportManager,
// InputHandler + StrokeAccumulator, SelectTool, GroupTool, TextTool

import { useRef, useEffect, useState, useCallback } from 'react'
import Renderer from './Renderer'
import { useViewport } from './useViewport'
import { useInputHandler } from './useInputHandler'
import { useSelectTool } from './useSelectTool'
import TextInputOverlay from './TextInputOverlay'
import PropertiesBar from '../PropertiesBar/PropertiesBar'
import { elementBBox, groupBBox, unionBBoxes, findParentShape } from './hitTest'
import { useVisualStore } from '../../store/VisualStoreContext'
import { createText, createGroup, createIcon, ACTIONS } from '../../store/visualStore'
import { ICON_LIBRARY } from '../../assets/iconLibrary'

export default function CanvasEngine({
  activeTool = 'freehand',
  pendingIcon = null,
  onIconPlaced,
  pendingImageFile = null,
  onImagePlaced,
}) {
  const svgRef      = useRef(null)
  const viewportRef = useRef(null)

  const { store, dispatch, undo, redo } = useVisualStore()

  const { transform, transformString, screenToDiagram, handlers: viewportHandlers } = useViewport()
  const viewportScale = transform.scale

  // ---- Place-icon mode: track cursor position for ghost, place on click ----
  const [placePos, setPlacePos] = useState(null)   // diagram coords of cursor

  const placeHandlers = {
    onPointerMove(e) {
      if (!svgRef.current) return
      const rect = svgRef.current.getBoundingClientRect()
      setPlacePos(screenToDiagram(e.clientX - rect.left, e.clientY - rect.top))
    },
    onPointerLeave() { setPlacePos(null) },
    onPointerDown(e) {
      if (e.button !== 0 || !pendingIcon) return
      e.preventDefault()
      const rect = svgRef.current.getBoundingClientRect()
      const pos  = screenToDiagram(e.clientX - rect.left, e.clientY - rect.top)
      dispatch({
        type: ACTIONS.ADD_ICON,
        payload: createIcon({
          ...pendingIcon,
          x: pos.x - 40,
          y: pos.y - 40,
          width:  80,
          height: 80,
          renderMode: 'rough',
        }),
      })
      setPlacePos(null)
      onIconPlaced?.()
    },
  }

  // ---- Place image file when selected via file picker (places at viewport centre) ----
  useEffect(() => {
    if (!pendingImageFile) return
    placeImageFile(pendingImageFile, null)
    onImagePlaced?.()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingImageFile])
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
    const { diagramPos, editingId, editingKind } = textInput ?? {}

    if (editingId) {
      // Editing an existing element's text
      switch (editingKind) {
        case 'text': {
          const el = (store.elements.texts ?? []).find(t => t.id === editingId)
          if (el) dispatch({ type: ACTIONS.UPDATE_TEXT, payload: { ...el, content } })
          break
        }
        case 'arrow': {
          const el = (store.elements.arrows ?? []).find(a => a.id === editingId)
          if (el) dispatch({ type: ACTIONS.UPDATE_ARROW, payload: { ...el, label: content } })
          break
        }
        case 'icon': {
          const el = (store.elements.icons ?? []).find(i => i.id === editingId)
          if (el) dispatch({ type: ACTIONS.UPDATE_ICON, payload: { ...el, description: content, descriptionVisible: true } })
          break
        }
        default: break
      }
      setTextInput(null)
      return
    }

    // Creating a new text element (text tool)
    const parentId = findParentShape(store.elements, diagramPos.x, diagramPos.y)
    const ss = store.styleState
    dispatch({
      type:    ACTIONS.ADD_TEXT,
      payload: createText({
        content,
        x:          diagramPos.x,
        y:          diagramPos.y,
        parentId,
        color:      ss.defaultTextColor  ?? '#1a1a2e',
        font:       ss.defaultFont       ?? 'Caveat',
        fontSize:   ss.defaultFontSize   ?? 18,
        fontWeight: ss.defaultFontWeight ?? 'normal',
        fontStyle:  ss.defaultFontStyle  ?? 'normal',
      }),
    })
    setTextInput(null)
  }, [textInput, store.elements, store.styleState, dispatch])

  const cancelText = useCallback(() => setTextInput(null), [])

  // ---- Double-click detection: manual tracker on pointerdown ----
  // Browser dblclick is unreliable on SVG when Rough.js recreates nodes.
  // Instead we track the last pointerdown's element-id + timestamp ourselves.
  const dblClickTracker = useRef({ id: null, time: 0 })

  const openEditForId = useCallback((dataId, clientX, clientY) => {
    const rect = svgRef.current.getBoundingClientRect()
    const screenPos  = { x: clientX - rect.left, y: clientY - rect.top }
    const diagramPos = screenToDiagram(screenPos.x, screenPos.y)

    const textEl = (store.elements.texts  ?? []).find(t => t.id === dataId)
    if (textEl) {
      setTextInput({ screenPos, diagramPos, editingId: dataId, editingKind: 'text',  currentValue: textEl.content })
      return
    }
    const arrowEl = (store.elements.arrows ?? []).find(a => a.id === dataId)
    if (arrowEl) {
      setTextInput({ screenPos, diagramPos, editingId: dataId, editingKind: 'arrow', currentValue: arrowEl.label ?? '' })
      return
    }
    const iconEl = (store.elements.icons ?? []).find(i => i.id === dataId)
    if (iconEl) {
      setTextInput({ screenPos, diagramPos, editingId: dataId, editingKind: 'icon',  currentValue: iconEl.description ?? '' })
    }
  }, [svgRef, screenToDiagram, store.elements])

  const handleDblClickPointer = useCallback((e) => {
    if (e.button !== 0) return
    // Walk up from the pointer target to find a data-id
    let node = e.target
    let dataId = null
    while (node && node !== svgRef.current) {
      const id = node.getAttribute?.('data-id')
      if (id) { dataId = id; break }
      node = node.parentElement
    }

    const now = Date.now()
    const prev = dblClickTracker.current
    if (dataId && prev.id === dataId && now - prev.time < 450) {
      // Double-click confirmed — open editor
      dblClickTracker.current = { id: null, time: 0 }
      e.stopPropagation()
      openEditForId(dataId, e.clientX, e.clientY)
    } else {
      dblClickTracker.current = { id: dataId, time: now }
    }
  }, [svgRef, openEditForId])

  // ---- Image drop & paste ----
  const placeImageFile = useCallback((file, dropPos) => {
    const reader = new FileReader()
    reader.onload = ev => {
      const rect = svgRef.current?.getBoundingClientRect() ?? { width: 800, height: 600 }
      const pos  = dropPos ?? screenToDiagram(rect.width / 2, rect.height / 2)
      dispatch({
        type: ACTIONS.ADD_ICON,
        payload: createIcon({
          src:        ev.target.result,
          renderMode: 'image',
          x:          pos.x - 60,
          y:          pos.y - 60,
          width:      120,
          height:     120,
        }),
      })
    }
    reader.readAsDataURL(file)
  }, [svgRef, screenToDiagram, dispatch])

  const handleDragOver = useCallback((e) => {
    const types = Array.from(e.dataTransfer.types)
    if (types.includes('Files') || types.includes('application/richpicture-icon')) {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
    }
  }, [])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    const rect = svgRef.current?.getBoundingClientRect() ?? { left: 0, top: 0 }
    const pos  = screenToDiagram(e.clientX - rect.left, e.clientY - rect.top)

    // Library icon drag-and-drop
    const iconId = e.dataTransfer.getData('application/richpicture-icon')
    if (iconId) {
      const iconDef = ICON_LIBRARY.find(ic => ic.id === iconId)
      if (iconDef) {
        dispatch({
          type: ACTIONS.ADD_ICON,
          payload: createIcon({
            ...iconDef,
            x: pos.x - 40,
            y: pos.y - 40,
            width:  80,
            height: 80,
            renderMode: 'rough',
          }),
        })
      }
      return
    }

    // File (image) drop
    const file = Array.from(e.dataTransfer.files).find(f => f.type.startsWith('image/'))
    if (file) placeImageFile(file, pos)
  }, [svgRef, screenToDiagram, dispatch, placeImageFile])

  useEffect(() => {
    function onPaste(e) {
      if (textInput) return  // don't intercept while text overlay is open
      const item = Array.from(e.clipboardData?.items ?? []).find(i => i.type.startsWith('image/'))
      if (!item) return
      const file = item.getAsFile()
      if (file) placeImageFile(file, null)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [textInput, placeImageFile])

  // ---- Group creation callback ----
  // Uses a stable ref so the callback can access setSelectedIds even though
  // useSelectTool is called after this definition.
  const onGroupCreatedRef = useRef(null)
  const stableGroupCreated = useCallback((...args) => onGroupCreatedRef.current?.(...args), [])

  // ---- Select / Group tool ----
  const { selectedIds, setSelectedIds, dragOffset, resizePreview, rubberBand, resizeHandles, cursor: selectCursor, selectHandlers } = useSelectTool({
    svgRef,
    screenToDiagram,
    activeTool,
    viewportScale,
    onGroupCreated: stableGroupCreated,
  })

  // Wire the real callback now that setSelectedIds is available.
  // Plain render-time assignment (not a hook) — stableGroupCreated is the stable ref,
  // this closure just needs to be fresh on each render to capture latest setSelectedIds.
  onGroupCreatedRef.current = (memberIds) => {
    const group = createGroup({ memberIds })
    dispatch({ type: ACTIONS.ADD_GROUP, payload: group })
    setSelectedIds(new Set([group.id]))
  }

  // Clear selection when switching away from select/group tools
  useEffect(() => {
    if (activeTool !== 'select' && activeTool !== 'group') setSelectedIds(new Set())
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
      if (textInput) return
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return

      if (e.key === 'Escape') {
        setSelectedIds(new Set())
        setTextInput(null)
        if (activeTool === 'place-icon') { setPlacePos(null); onIconPlaced?.() }
        return
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.size > 0) {
        e.preventDefault()
        dispatch({ type: ACTIONS.DELETE_ELEMENTS, payload: [...selectedIds] })
        setSelectedIds(new Set())
        return
      }

      // G — group current multi-selection (select or group tool)
      if ((e.key === 'g' || e.key === 'G') && !e.ctrlKey && !e.metaKey) {
        if ((activeTool === 'select' || activeTool === 'group') && selectedIds.size >= 2) {
          e.preventDefault()
          const group = createGroup({ memberIds: [...selectedIds] })
          dispatch({ type: ACTIONS.ADD_GROUP, payload: group })
          setSelectedIds(new Set([group.id]))
        }
        return
      }

      // U — ungroup selected group
      if ((e.key === 'u' || e.key === 'U') && !e.ctrlKey && !e.metaKey) {
        if (selectedIds.size === 1) {
          const id    = [...selectedIds][0]
          const group = (store.elements.groups ?? []).find(g => g.id === id)
          if (group) {
            e.preventDefault()
            dispatch({ type: ACTIONS.UNGROUP, payload: id })
            setSelectedIds(new Set(group.memberIds))
          }
        }
        return
      }

      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z') { e.preventDefault(); undo() }
        if (e.key === 'y') { e.preventDefault(); redo() }
        if (e.key === 'Z') { e.preventDefault(); redo() }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [textInput, selectedIds, activeTool, onIconPlaced, dispatch, undo, redo, setSelectedIds, store.elements.groups])

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

  // Inject the manual double-click tracker into the combined pointer-down
  const combinedWithDbl = {
    ...combinedHandlers,
    onPointerDown(e) {
      handleDblClickPointer(e)
      combinedHandlers.onPointerDown?.(e)
    },
  }

  // ---- Selection overlay geometry ----
  // Compute union bounding box of all selected elements (handles groups)
  const allElements = [
    ...(store.elements.shapes ?? []),
    ...(store.elements.arrows ?? []),
    ...(store.elements.texts  ?? []),
    ...(store.elements.icons  ?? []),
    ...(store.elements.groups ?? []),
  ]
  const selectionBBox = selectedIds.size > 0
    ? unionBBoxes(
        allElements
          .filter(el => selectedIds.has(el.id))
          .map(el => el.kind === 'group' ? groupBBox(el, store.elements) : elementBBox(el))
      )
    : null

  const PAD  = 6    // selection outline padding in diagram px
  const isDragging     = dragOffset.dx !== 0 || dragOffset.dy !== 0
  const HANDLE_DIM_D   = 8  / viewportScale  // handle square size in diagram px
  const HANDLE_SW_D    = 1.5 / viewportScale  // handle stroke-width in diagram px
  const SEL_SW_D       = 1.5 / viewportScale
  const SEL_DASH_D     = `${5 / viewportScale} ${3 / viewportScale}`
  const RB_SW_D        = 1 / viewportScale
  const RB_DASH_D      = `${4 / viewportScale} ${3 / viewportScale}`

  // Font info for the text editing overlay — matches the element being edited
  let overlayFont     = store.styleState.defaultFont     ?? 'Caveat'
  let overlayFontSize = store.styleState.defaultFontSize ?? 18
  if (textInput?.editingKind === 'text') {
    const el = (store.elements.texts  ?? []).find(t => t.id === textInput.editingId)
    if (el) { overlayFont = el.font;            overlayFontSize = el.fontSize }
  } else if (textInput?.editingKind === 'arrow') {
    const el = (store.elements.arrows ?? []).find(a => a.id === textInput.editingId)
    if (el) { overlayFont = el.labelFont;        overlayFontSize = el.labelFontSize }
  } else if (textInput?.editingKind === 'icon') {
    const el = (store.elements.icons  ?? []).find(i => i.id === textInput.editingId)
    if (el) { overlayFont = el.descriptionFont; overlayFontSize = el.descriptionFontSize }
  }

  const svgCursor = activeTool === 'place-icon'
    ? 'cell'
    : (activeTool === 'select' || activeTool === 'group')
      ? selectCursor
      : (activeTool === 'text' ? 'text' : 'crosshair')

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <PropertiesBar selectedIds={selectedIds} activeTool={activeTool} />

      <div className="flex-1 relative overflow-hidden">
        <svg
        ref={svgRef}
        className="w-full h-full"
        style={{ touchAction: 'none', cursor: svgCursor }}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        {...(activeTool === 'place-icon' ? placeHandlers : combinedWithDbl)}
      >
        <g ref={viewportRef} transform={transformString}>
          {/* Renderer populates layer groups inside this group imperatively */}

          {/* Place-icon ghost — dashed rect that follows the cursor */}
          {activeTool === 'place-icon' && placePos && (
            <g style={{ pointerEvents: 'none' }}>
              <rect
                x={placePos.x - 40}
                y={placePos.y - 40}
                width={80}
                height={80}
                fill="rgba(59,130,246,0.08)"
                stroke="#3b82f6"
                strokeWidth={1.5 / viewportScale}
                strokeDasharray={`${5 / viewportScale} ${3 / viewportScale}`}
                rx={3 / viewportScale}
              />
              <line
                x1={placePos.x - 8 / viewportScale} y1={placePos.y}
                x2={placePos.x + 8 / viewportScale} y2={placePos.y}
                stroke="#3b82f6" strokeWidth={1.5 / viewportScale}
              />
              <line
                x1={placePos.x} y1={placePos.y - 8 / viewportScale}
                x2={placePos.x} y2={placePos.y + 8 / viewportScale}
                stroke="#3b82f6" strokeWidth={1.5 / viewportScale}
              />
            </g>
          )}

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

          {/* Selection overlay — moves with drag preview */}
          {selectionBBox && (
            <g
              transform={isDragging ? `translate(${dragOffset.dx}, ${dragOffset.dy})` : undefined}
              style={{ pointerEvents: 'none' }}
            >
              {/* Dashed selection outline */}
              <rect
                x={selectionBBox.x - PAD}
                y={selectionBBox.y - PAD}
                width={selectionBBox.width  + PAD * 2}
                height={selectionBBox.height + PAD * 2}
                fill="none"
                stroke="#3b82f6"
                strokeWidth={SEL_SW_D}
                strokeDasharray={SEL_DASH_D}
                rx={3 / viewportScale}
              />
              {/* Corner resize handles — hidden while dragging or resizing */}
              {!isDragging && !resizePreview && resizeHandles.map(h => (
                <rect
                  key={h.id}
                  x={h.x - HANDLE_DIM_D / 2}
                  y={h.y - HANDLE_DIM_D / 2}
                  width={HANDLE_DIM_D}
                  height={HANDLE_DIM_D}
                  fill="white"
                  stroke="#3b82f6"
                  strokeWidth={HANDLE_SW_D}
                  rx={HANDLE_SW_D}
                  style={{ pointerEvents: 'all', cursor: h.cursor }}
                />
              ))}
            </g>
          )}

          {/* Resize preview bbox */}
          {resizePreview && (
            <rect
              x={resizePreview.x}
              y={resizePreview.y}
              width={resizePreview.width}
              height={resizePreview.height}
              fill="none"
              stroke="#f59e0b"
              strokeWidth={SEL_SW_D}
              strokeDasharray={SEL_DASH_D}
              rx={3 / viewportScale}
              style={{ pointerEvents: 'none' }}
            />
          )}

          {/* Rubber-band selection rect */}
          {rubberBand && (
            <rect
              x={Math.min(rubberBand.x1, rubberBand.x2)}
              y={Math.min(rubberBand.y1, rubberBand.y2)}
              width={Math.abs(rubberBand.x2 - rubberBand.x1)}
              height={Math.abs(rubberBand.y2 - rubberBand.y1)}
              fill="rgba(59, 130, 246, 0.07)"
              stroke="#3b82f6"
              strokeWidth={RB_SW_D}
              strokeDasharray={RB_DASH_D}
              style={{ pointerEvents: 'none' }}
            />
          )}
        </g>
      </svg>

      {/* Text input overlay — screen-space, outside SVG */}
      {textInput && (
        <TextInputOverlay
          screenPos={textInput.screenPos}
          onCommit={commitText}
          onCancel={cancelText}
          font={overlayFont}
          fontSize={overlayFontSize}
          initialValue={textInput.currentValue ?? ''}
        />
      )}

      <Renderer containerRef={viewportRef} />
      </div>
    </div>
  )
}

