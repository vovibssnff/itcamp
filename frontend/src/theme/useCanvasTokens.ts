import { useUIStore } from '@/store/ui'
import { getCanvasTokens, type CanvasTokens } from './tokens'

/** Returns the Konva canvas palette for the currently active theme. */
export function useCanvasTokens(): CanvasTokens {
  const theme = useUIStore((s) => s.theme)
  return getCanvasTokens(theme)
}
