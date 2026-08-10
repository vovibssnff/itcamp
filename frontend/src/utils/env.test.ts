import { afterEach, describe, expect, it, vi } from 'vitest'
import { isMockApi } from './env'

describe('isMockApi', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns true when VITE_MOCK_API is true', () => {
    vi.stubEnv('VITE_MOCK_API', 'true')
    expect(isMockApi()).toBe(true)
  })

  it('returns false otherwise', () => {
    vi.stubEnv('VITE_MOCK_API', 'false')
    expect(isMockApi()).toBe(false)
    vi.stubEnv('VITE_MOCK_API', '')
    expect(isMockApi()).toBe(false)
  })
})
