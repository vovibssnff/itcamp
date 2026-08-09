import { describe, it, expect } from 'vitest'
import { formatValue, formatDuration, formatTimestamp, formatModelTime } from './format'

describe('formatValue', () => {
  it('formats with default 1 decimal', () => {
    expect(formatValue(3.14159)).toBe('3.1')
  })
  it('respects custom decimals', () => {
    expect(formatValue(3.14159, 3)).toBe('3.142')
  })
  it('handles zero', () => {
    expect(formatValue(0)).toBe('0.0')
  })
})

describe('formatDuration', () => {
  it('formats seconds under a minute', () => {
    expect(formatDuration(45)).toBe('00:45')
  })
  it('formats minutes and seconds', () => {
    expect(formatDuration(125)).toBe('02:05')
  })
  it('formats hours', () => {
    expect(formatDuration(3661)).toBe('1:01:01')
  })
})

describe('formatModelTime', () => {
  it('floors fractional seconds', () => {
    expect(formatModelTime(65.9)).toBe('01:05')
  })
})

describe('formatTimestamp', () => {
  it('returns a time string', () => {
    const result = formatTimestamp(Date.UTC(2026, 0, 1, 12, 30, 0), 'en-US')
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })
})
