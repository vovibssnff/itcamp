import { useCallback } from 'react'
import { useConstructorStore } from '@/store/constructor'

export function useUndo() {
  const undo = useConstructorStore((s) => s.undo)
  const redo = useConstructorStore((s) => s.redo)
  const canUndo = useConstructorStore((s) => s.undoStack.length > 0)
  const canRedo = useConstructorStore((s) => s.redoStack.length > 0)

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault()
        redo()
      }
    },
    [undo, redo],
  )

  return { undo, redo, canUndo, canRedo, handleKeyDown }
}
