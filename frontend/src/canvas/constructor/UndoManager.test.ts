import { describe, it, expect } from 'vitest'
import { UndoManager, type Command } from './UndoManager'

type State = { count: number }

const inc: Command<State> = {
  apply: (s) => ({ count: s.count + 1 }),
  revert: (s) => ({ count: s.count - 1 }),
}

describe('UndoManager', () => {
  it('applies a command and tracks undo availability', () => {
    const mgr = new UndoManager<State>()
    let state = { count: 0 }
    state = mgr.execute(state, inc)
    expect(state.count).toBe(1)
    expect(mgr.canUndo()).toBe(true)
    expect(mgr.canRedo()).toBe(false)
  })

  it('undoes and redoes', () => {
    const mgr = new UndoManager<State>()
    let state = { count: 0 }
    state = mgr.execute(state, inc)
    state = mgr.undo(state)!
    expect(state.count).toBe(0)
    expect(mgr.canRedo()).toBe(true)
    state = mgr.redo(state)!
    expect(state.count).toBe(1)
  })

  it('returns null when nothing to undo/redo', () => {
    const mgr = new UndoManager<State>()
    expect(mgr.undo({ count: 0 })).toBeNull()
    expect(mgr.redo({ count: 0 })).toBeNull()
  })

  it('respects max size', () => {
    const mgr = new UndoManager<State>(2)
    let state = { count: 0 }
    state = mgr.execute(state, inc)
    state = mgr.execute(state, inc)
    state = mgr.execute(state, inc)
    // Only 2 undos retained
    expect(mgr.undo(state)).not.toBeNull()
    expect(mgr.undo({ count: 2 })).not.toBeNull()
    expect(mgr.undo({ count: 1 })).toBeNull()
  })

  it('clears history and new command wipes redo stack', () => {
    const mgr = new UndoManager<State>()
    let state = mgr.execute({ count: 0 }, inc)
    mgr.undo(state)
    expect(mgr.canRedo()).toBe(true)
    state = mgr.execute({ count: 0 }, inc)
    expect(mgr.canRedo()).toBe(false)
    mgr.clear()
    expect(mgr.canUndo()).toBe(false)
  })
})
