import { http, HttpResponse } from 'msw'
import type { UserProfile } from '@/store/auth'

const USERS: Array<{ username: string; password: string; user: UserProfile }> = [
  {
    username: 'admin',
    password: 'admin',
    user: { id: 'u1', username: 'admin', displayName: 'Администратор', role: 'admin' },
  },
  {
    username: 'instructor',
    password: 'instructor',
    user: { id: 'u2', username: 'instructor', displayName: 'Иванов И.И.', role: 'instructor' },
  },
  {
    username: 'operator',
    password: 'operator',
    user: { id: 'u3', username: 'operator', displayName: 'Петров П.П.', role: 'operator' },
  },
]

export const authHandlers = [
  http.post('/api/auth/login', async ({ request }) => {
    const body = (await request.json()) as { username: string; password: string }
    const found = USERS.find((u) => u.username === body.username && u.password === body.password)
    if (!found) {
      return HttpResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }
    return HttpResponse.json({
      access_token: `mock-access-${found.user.id}`,
      refresh_token: `mock-refresh-${found.user.id}`,
      user: found.user,
    })
  }),

  http.post('/api/auth/refresh', async ({ request }) => {
    const body = (await request.json()) as { refresh_token: string }
    const userId = body.refresh_token.replace('mock-refresh-', '')
    const found = USERS.find((u) => u.user.id === userId)
    if (!found) {
      return HttpResponse.json({ error: 'Invalid refresh token' }, { status: 401 })
    }
    return HttpResponse.json({
      access_token: `mock-access-${found.user.id}`,
      refresh_token: `mock-refresh-${found.user.id}`,
      user: found.user,
    })
  }),

  http.get('/api/auth/me', ({ request }) => {
    const auth = request.headers.get('Authorization') ?? ''
    const userId = auth.replace('Bearer mock-access-', '')
    const found = USERS.find((u) => u.user.id === userId)
    if (!found) return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return HttpResponse.json(found.user)
  }),

  http.get('/api/users', () => {
    return HttpResponse.json(USERS.map((u) => u.user))
  }),

  http.post('/api/users', async ({ request }) => {
    const body = (await request.json()) as UserProfile
    return HttpResponse.json({ ...body, id: `u${Date.now()}` }, { status: 201 })
  }),

  http.put('/api/users/:id', async ({ request }) => {
    const body = (await request.json()) as UserProfile
    return HttpResponse.json(body)
  }),

  http.delete('/api/users/:id', () => {
    return new HttpResponse(null, { status: 204 })
  }),
]
