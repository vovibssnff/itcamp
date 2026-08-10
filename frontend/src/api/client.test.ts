import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Must mock BEFORE importing client.ts so module-level createClient() sees the mock.
vi.mock('openapi-fetch', () => ({
  default: vi.fn(() => ({ use: vi.fn() })),
}))

vi.mock('@/store/auth', () => {
  const setTokens = vi.fn()
  const logout = vi.fn()
  let refreshToken: string | null = 'rt-initial'
  let accessToken: string | null = null
  const getState = vi.fn(() => ({ refreshToken, accessToken, setTokens, logout }))
  return {
    useAuthStore: { getState },
    _setRefreshToken: (v: string | null) => {
      refreshToken = v
    },
    _setAccessToken: (v: string | null) => {
      accessToken = v
    },
    _setTokensMock: setTokens,
  }
})

import { refreshAccessToken, ensureAccessToken } from './client'
import * as AuthModule from '@/store/auth'

const authExtras = AuthModule as unknown as {
  _setRefreshToken: (v: string | null) => void
  _setAccessToken: (v: string | null) => void
  _setTokensMock: ReturnType<typeof vi.fn>
}

const REFRESH_URL = '/api/v1/auth/refresh'

function makeOkResponse(accessToken = 'new-access', refreshToken = 'new-refresh'): Response {
  return {
    ok: true,
    status: 200,
    json: async () => ({ access_token: accessToken, refresh_token: refreshToken }),
  } as unknown as Response
}

describe('refreshAccessToken', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    authExtras._setRefreshToken('rt-initial')
    authExtras._setAccessToken(null)
    authExtras._setTokensMock.mockClear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns the access token from the refresh response', async () => {
    fetchMock.mockResolvedValueOnce(makeOkResponse('tok-1'))
    const result = await refreshAccessToken()
    expect(result).toBe('tok-1')
  })

  it('two concurrent calls produce exactly one /auth/refresh HTTP request', async () => {
    // Use a deferred promise so both callers enter the function before fetch resolves.
    let resolveRefresh!: (value: Response) => void
    fetchMock.mockReturnValueOnce(
      new Promise<Response>((resolve) => {
        resolveRefresh = resolve
      }),
    )

    const p1 = refreshAccessToken()
    const p2 = refreshAccessToken()

    resolveRefresh(makeOkResponse('shared-token'))

    const [r1, r2] = await Promise.all([p1, p2])

    expect(r1).toBe('shared-token')
    expect(r2).toBe('shared-token')

    const refreshHits = fetchMock.mock.calls.filter(([url]) => String(url).includes(REFRESH_URL))
    expect(refreshHits).toHaveLength(1)
  })

  it('rejects when no refresh token is available', async () => {
    authExtras._setRefreshToken(null)
    await expect(refreshAccessToken()).rejects.toThrow('No refresh token')
  })

  it('rejects and clears the in-flight promise on a failed refresh', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 401 } as Response)
    await expect(refreshAccessToken()).rejects.toThrow()
    // After rejection the next call should start a fresh request.
    fetchMock.mockResolvedValueOnce(makeOkResponse('after-failure'))
    const result = await refreshAccessToken()
    expect(result).toBe('after-failure')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

describe('ensureAccessToken', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    authExtras._setRefreshToken('rt-initial')
    authExtras._setAccessToken(null)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns existing access token without fetching', async () => {
    authExtras._setAccessToken('existing-token')
    const result = await ensureAccessToken()
    expect(result).toBe('existing-token')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('refreshes when access token is missing but refresh token exists', async () => {
    fetchMock.mockResolvedValueOnce(makeOkResponse('refreshed-token'))
    const result = await ensureAccessToken()
    expect(result).toBe('refreshed-token')
  })

  it('returns null when both tokens are absent', async () => {
    authExtras._setRefreshToken(null)
    const result = await ensureAccessToken()
    expect(result).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns null (does not throw) when refresh fails', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 401 } as Response)
    const result = await ensureAccessToken()
    expect(result).toBeNull()
  })
})
