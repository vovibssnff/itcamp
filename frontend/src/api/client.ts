import createClient, { type Middleware } from 'openapi-fetch'
import { useAuthStore } from '@/store/auth'
import type { GatewayPaths } from './generated'

// In mock mode always use same-origin so MSW can intercept `/api/v1/*`.
const BASE_URL =
  import.meta.env.VITE_MOCK_API === 'true' ? '' : (import.meta.env.VITE_API_BASE_URL ?? '')

// Typed against the API Gateway OpenAPI spec (generated via `pnpm openapi:gen`).
export const apiClient = createClient<GatewayPaths>({ baseUrl: BASE_URL })

/**
 * Refresh tokens are single-use (the auth service rotates them), so concurrent
 * refreshes would revoke each other and sign the user out. Every caller —
 * app bootstrap, the 401 retry path, and raw `fetch` helpers — must share this
 * one in-flight promise.
 */
let refreshPromise: Promise<string> | null = null

async function requestRefresh(refreshToken: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/v1/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  })
  if (!res.ok) throw new Error(`Refresh failed: ${res.status}`)
  const data = (await res.json()) as { access_token: string; refresh_token: string }
  useAuthStore.getState().setTokens(data.access_token, data.refresh_token)
  return data.access_token
}

export function refreshAccessToken(): Promise<string> {
  if (refreshPromise) return refreshPromise
  const refreshToken = useAuthStore.getState().refreshToken
  if (!refreshToken) return Promise.reject(new Error('No refresh token'))

  const pending = requestRefresh(refreshToken)
  refreshPromise = pending
  void pending
    .catch(() => undefined)
    .finally(() => {
      if (refreshPromise === pending) refreshPromise = null
    })
  return pending
}

/**
 * Access tokens are not persisted, so after a reload we only hold a refresh
 * token until bootstrap completes. Returns a usable access token or null.
 */
export async function ensureAccessToken(): Promise<string | null> {
  const { accessToken, refreshToken } = useAuthStore.getState()
  if (accessToken) return accessToken
  if (!refreshToken) return null
  try {
    return await refreshAccessToken()
  } catch {
    return null
  }
}

function isAuthEndpoint(url: string): boolean {
  const path = new URL(url, 'http://local').pathname
  return (
    path.includes('/api/v1/auth/login') ||
    path.includes('/api/v1/auth/refresh') ||
    path.includes('/api/v1/auth/mfa/enrollment')
  )
}

const authMiddleware: Middleware = {
  async onRequest({ request }) {
    if (isAuthEndpoint(request.url)) return request
    const token = await ensureAccessToken()
    if (token) {
      request.headers.set('Authorization', `Bearer ${token}`)
    }
    return request
  },

  async onResponse({ response, request }) {
    if (response.status !== 401) return response
    if (isAuthEndpoint(request.url)) return response

    const store = useAuthStore.getState()
    if (!store.refreshToken) {
      store.logout()
      window.location.href = '/login'
      return response
    }

    try {
      const token = await refreshAccessToken()
      request.headers.set('Authorization', `Bearer ${token}`)
      return await fetch(request)
    } catch {
      useAuthStore.getState().logout()
      window.location.href = '/login'
      return response
    }
  },
}

apiClient.use(authMiddleware)
