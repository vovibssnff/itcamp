import createClient, { type Middleware } from 'openapi-fetch'
import { useAuthStore } from '@/store/auth'

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

export const apiClient = createClient<Record<string, never>>({ baseUrl: BASE_URL })

let isRefreshing = false
let refreshQueue: Array<(token: string) => void> = []

function flushQueue(token: string) {
  refreshQueue.forEach((fn) => fn(token))
  refreshQueue = []
}

const authMiddleware: Middleware = {
  async onRequest({ request }) {
    const token = useAuthStore.getState().accessToken
    if (token) {
      request.headers.set('Authorization', `Bearer ${token}`)
    }
    return request
  },

  async onResponse({ response, request }) {
    if (response.status !== 401) return response

    const store = useAuthStore.getState()
    if (!store.refreshToken) {
      store.logout()
      window.location.href = '/login'
      return response
    }

    if (isRefreshing) {
      return new Promise<Response>((resolve) => {
        refreshQueue.push((token) => {
          request.headers.set('Authorization', `Bearer ${token}`)
          resolve(fetch(request))
        })
      })
    }

    isRefreshing = true
    try {
      const res = await fetch(`${BASE_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: store.refreshToken }),
      })
      if (!res.ok) throw new Error('Refresh failed')
      const data = (await res.json()) as { access_token: string; refresh_token: string }
      store.setTokens(data.access_token, data.refresh_token)
      flushQueue(data.access_token)
      request.headers.set('Authorization', `Bearer ${data.access_token}`)
      return fetch(request)
    } catch {
      store.logout()
      window.location.href = '/login'
      return response
    } finally {
      isRefreshing = false
    }
  },
}

apiClient.use(authMiddleware)
