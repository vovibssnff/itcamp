export function formatValue(value: number, decimals = 1): string {
  return value.toFixed(decimals)
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function formatTimestamp(ts: number, locale = 'ru-RU'): string {
  return new Date(ts).toLocaleTimeString(locale)
}

export function formatModelTime(modelTimeSec: number): string {
  return formatDuration(Math.floor(modelTimeSec))
}
