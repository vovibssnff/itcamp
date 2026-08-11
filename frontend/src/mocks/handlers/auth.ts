import { http, HttpResponse } from 'msw'
import type { UserProfile, UserRole } from '@/store/auth'

interface MockAccount {
  login: string
  password: string
  user: {
    id: string
    login: string
    full_name: string
    roles: UserRole[]
    status: 'active'
    mfa_enabled: boolean
  }
}

const DEFAULT_USERS: MockAccount[] = [
  {
    login: 'admin',
    password: 'admin',
    user: {
      id: 'u1',
      login: 'admin',
      full_name: 'Администратор',
      roles: ['admin'],
      status: 'active',
      mfa_enabled: false,
    },
  },
  {
    login: 'instructor',
    password: 'instructor',
    user: {
      id: 'u2',
      login: 'instructor',
      full_name: 'Иванов И.И.',
      roles: ['instructor'],
      status: 'active',
      mfa_enabled: false,
    },
  },
  {
    login: 'operator',
    password: 'operator',
    user: {
      id: 'u3',
      login: 'operator',
      full_name: 'Петров П.П.',
      roles: ['operator'],
      status: 'active',
      mfa_enabled: false,
    },
  },
]

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
    // storage unavailable
  }
}

const registered = loadRegistered()
const USERS: MockAccount[] = [...DEFAULT_USERS, ...registered]

function tokensFor(account: MockAccount) {
  return {
    access_token: `mock-access-${account.user.id}`,
    refresh_token: `mock-refresh-${account.user.id}`,
    expires_in: 900,
    token_type: 'Bearer',
  }
}

function toProfile(user: MockAccount['user']): UserProfile {
  return {
    id: user.id,
    username: user.login,
    displayName: user.full_name,
    role: user.roles[0] ?? 'operator',
  }
}

export const authHandlers = [
  http.post('/api/v1/auth/login', async ({ request }) => {
    const body = (await request.json()) as {
      login?: string
      username?: string
      password: string
      mfa_code?: string
    }
    const login = body.login ?? body.username ?? ''
    const found = USERS.find((u) => u.login === login && u.password === body.password)
    if (!found) {
      return HttpResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }
    return HttpResponse.json(tokensFor(found))
  }),

  http.post('/api/v1/auth/refresh', async ({ request }) => {
    const body = (await request.json()) as { refresh_token: string }
    const userId = body.refresh_token.replace('mock-refresh-', '')
    const found = USERS.find((u) => u.user.id === userId)
    if (!found) {
      return HttpResponse.json({ error: 'Invalid refresh token' }, { status: 401 })
    }
    return HttpResponse.json(tokensFor(found))
  }),

  http.post('/api/v1/auth/logout', () => {
    return HttpResponse.json({ ok: true })
  }),

  http.get('/api/v1/auth/me', ({ request }) => {
    const auth = request.headers.get('Authorization') ?? ''
    const userId = auth.replace('Bearer mock-access-', '')
    const found = USERS.find((u) => u.user.id === userId)
    if (!found) return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return HttpResponse.json(found.user)
  }),

  http.get('/api/v1/users', () => {
    return HttpResponse.json(USERS.map((u) => u.user))
  }),

  http.get('/api/v1/users/:id', ({ params }) => {
    const found = USERS.find((u) => u.user.id === params.id)
    if (!found) return HttpResponse.json({ error: 'Not found' }, { status: 404 })
    return HttpResponse.json(found.user)
  }),

  http.post('/api/v1/users', async ({ request }) => {
    const body = (await request.json()) as {
      login: string
      full_name?: string
      roles?: string[]
    }
    const account: MockAccount = {
      login: body.login,
      password: 'changeme',
      user: {
        id: `u${Date.now()}`,
        login: body.login,
        full_name: body.full_name ?? body.login,
        roles: [(body.roles?.[0] as UserRole) ?? 'operator'],
        status: 'active',
        mfa_enabled: false,
      },
    }
    USERS.push(account)
    registered.push(account)
    saveRegistered(registered)
    return HttpResponse.json(account.user, { status: 201 })
  }),

  http.put('/api/v1/users/:id', async ({ params, request }) => {
    const body = (await request.json()) as {
      login?: string
      full_name?: string
      roles?: string[]
    }
    const found = USERS.find((u) => u.user.id === params.id)
    if (!found) return HttpResponse.json({ error: 'Not found' }, { status: 404 })
    if (body.login) found.user.login = body.login
    if (body.full_name) found.user.full_name = body.full_name
    if (body.roles?.length) found.user.roles = [body.roles[0] as UserRole]
    return HttpResponse.json(found.user)
  }),

  http.delete('/api/v1/users/:id', () => {
    return new HttpResponse(null, { status: 204 })
  }),
]

// Exported for tests that still need the profile shape.
export { toProfile }
