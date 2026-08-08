import type { UserProfile } from '@/store/auth'

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

interface LoginResponse {
  access_token: string
  refresh_token: string
  user: UserProfile
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

export const authApi = {
  login: (username: string, password: string) =>
    post<LoginResponse>('/api/auth/login', { username, password }),

  refresh: (refresh_token: string) => post<LoginResponse>('/api/auth/refresh', { refresh_token }),
}
