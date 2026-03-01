/**
 * VisualStoreContext — React context wrapping the VisualStore.
 *
 * Provides:
 *   store         — current VisualStore state
 *   dispatch      — dispatch an ACTIONS action (auto-pushes to undo stack)
 *   undo / redo   — step through history
 *   canUndo / canRedo
 *   canvasHash    — memoised fingerprint of current elements
 */

import { createContext, useContext, useReducer, useCallback, useMemo, useRef } from 'react'
import {
  createInitialState,
  visualStoreReducer,
  computeCanvasHash,
  ACTIONS,
} from './visualStore'

const UNDO_LIMIT = 50

const VisualStoreContext = createContext(null)

// Actions that mutate elements and should be pushed onto the undo stack
const UNDOABLE_ACTIONS = new Set([
  ACTIONS.ADD_SHAPE,    ACTIONS.UPDATE_SHAPE,   ACTIONS.DELETE_SHAPE,
  ACTIONS.ADD_ARROW,    ACTIONS.UPDATE_ARROW,   ACTIONS.DELETE_ARROW,
  ACTIONS.ADD_ICON,     ACTIONS.UPDATE_ICON,    ACTIONS.DELETE_ICON,
  ACTIONS.ADD_TEXT,     ACTIONS.UPDATE_TEXT,    ACTIONS.DELETE_TEXT,
  ACTIONS.CLEAR_STORE,
])

export function VisualStoreProvider({ children }) {
  const [store, baseDispatch] = useReducer(visualStoreReducer, undefined, createInitialState)

  // Undo/redo history held in refs to avoid re-render on history change alone
  const past   = useRef([])   // stack of previous states
  const future = useRef([])   // stack of undone states

  const dispatch = useCallback((action) => {
    if (UNDOABLE_ACTIONS.has(action.type)) {
      // Capture current state before mutation
      past.current = [...past.current.slice(-(UNDO_LIMIT - 1)), store]
      future.current = []
    }
    baseDispatch(action)
  }, [store])

  const undo = useCallback(() => {
    if (past.current.length === 0) return
    const previous = past.current[past.current.length - 1]
    past.current   = past.current.slice(0, -1)
    future.current = [store, ...future.current]
    baseDispatch({ type: ACTIONS.LOAD_STORE, payload: previous })
  }, [store])

  const redo = useCallback(() => {
    if (future.current.length === 0) return
    const next     = future.current[0]
    future.current = future.current.slice(1)
    past.current   = [...past.current, store]
    baseDispatch({ type: ACTIONS.LOAD_STORE, payload: next })
  }, [store])

  const canvasHash = useMemo(() => computeCanvasHash(store), [store])

  const value = useMemo(() => ({
    store,
    dispatch,
    undo,
    redo,
    canUndo:  past.current.length > 0,
    canRedo:  future.current.length > 0,
    canvasHash,
  }), [store, dispatch, undo, redo, canvasHash])

  return (
    <VisualStoreContext.Provider value={value}>
      {children}
    </VisualStoreContext.Provider>
  )
}

export function useVisualStore() {
  const ctx = useContext(VisualStoreContext)
  if (!ctx) throw new Error('useVisualStore must be used within a VisualStoreProvider')
  return ctx
}
