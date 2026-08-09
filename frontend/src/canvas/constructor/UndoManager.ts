export interface Command<T> {
  apply: (state: T) => T
  revert: (state: T) => T
  description?: string
}

export class UndoManager<T> {
  private undoStack: Command<T>[] = []
  private redoStack: Command<T>[] = []
  private maxSize: number

  constructor(maxSize = 50) {
    this.maxSize = maxSize
  }

  execute(state: T, cmd: Command<T>): T {
    const next = cmd.apply(state)
    this.undoStack.push(cmd)
    if (this.undoStack.length > this.maxSize) {
      this.undoStack.shift()
    }
    this.redoStack = []
    return next
  }

  undo(state: T): T | null {
    const cmd = this.undoStack.pop()
    if (!cmd) return null
    const prev = cmd.revert(state)
    this.redoStack.push(cmd)
    return prev
  }

  redo(state: T): T | null {
    const cmd = this.redoStack.pop()
    if (!cmd) return null
    const next = cmd.apply(state)
    this.undoStack.push(cmd)
    return next
  }

  canUndo() {
    return this.undoStack.length > 0
  }

  canRedo() {
    return this.redoStack.length > 0
  }

  clear() {
    this.undoStack = []
    this.redoStack = []
  }
}
