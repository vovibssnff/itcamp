import { http, HttpResponse } from 'msw'
import type { UserProfile, UserRole } from '@/store/auth'

interface MockAccount {
  username: string
  password: string
  user: UserProfile
}

const DEFAULT_USERS: MockAccount[] = [
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

// Accounts registered at runtime are persisted to localStorage so they
// survive page reloads (the token-refresh bootstrap needs to find them).
const STORAGE_KEY = 'ktk-mock-users'

function loadRegistered(): MockAccount[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as MockAccount[]) : []
  } catch {
    return []
  }
}

function saveRegistered(accounts: MockAccount[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts))
  } catch {
    // storage unavailable; keep in-memory only
  }
}

const registered = loadRegistered()
const USERS: MockAccount[] = [...DEFAULT_USERS, ...registered]

function tokensFor(account: MockAccount) {
  return {
    access_token: `mock-access-${account.user.id}`,
    refresh_token: `mock-refresh-${account.user.id}`,
    user: account.user,
  }
}

export const authHandlers = [
  http.post('/api/auth/login', async ({ request }) => {
    const body = (await request.json()) as { username: string; password: string }
    const found = USERS.find((u) => u.username === body.username && u.password === body.password)
    if (!found) {
      return HttpResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }
    return HttpResponse.json(tokensFor(found))
  }),

  http.post('/api/auth/register', async ({ request }) => {
    const body = (await request.json()) as {
      username: string
      password: string
      displayName?: string
      role?: UserRole
    }
    if (!body.username || !body.password) {
      return HttpResponse.json({ error: 'Missing credentials' }, { status: 400 })
    }
    if (USERS.some((u) => u.username === body.username)) {
      return HttpResponse.json({ error: 'User already exists' }, { status: 409 })
    }
    const account: MockAccount = {
      username: body.username,
      password: body.password,
      user: {
        id: `u${Date.now()}`,
        username: body.username,
        displayName: body.displayName?.trim() || body.username,
        role: body.role ?? 'operator',
      },
    }
    USERS.push(account)
    registered.push(account)
    saveRegistered(registered)
    return HttpResponse.json(tokensFor(account), { status: 201 })
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
