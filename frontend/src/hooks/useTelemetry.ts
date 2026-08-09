import { useSessionStore, type TagValue } from '@/store/session'

export function useTelemetry(tags: string[]): Record<string, TagValue> {
  const telemetry = useSessionStore((s) => s.telemetry)
  const result: Record<string, TagValue> = {}
  for (const tag of tags) {
    const val = telemetry[tag]
    if (val) result[tag] = val
  }
  return result
}

export function useTagValue(tag: string): TagValue | undefined {
  return useSessionStore((s) => s.telemetry[tag])
}
