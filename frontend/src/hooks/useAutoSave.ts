import { useEffect, useRef } from 'react'

export function useAutoSave(
  isDirty: boolean,
  save: () => Promise<void> | void,
  intervalMs = 30000,
) {
  const saveRef = useRef(save)
  saveRef.current = save

  useEffect(() => {
    if (!isDirty) return
    const id = setTimeout(() => {
      void saveRef.current()
    }, intervalMs)
    return () => clearTimeout(id)
  }, [isDirty, intervalMs])
}
