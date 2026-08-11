import { apiClient } from './client'
import { unwrap } from './request'
import { mapUser } from './mappers'
import type { UserProfile } from '@/store/auth'
import { useAuthStore } from '@/store/auth'
import { rolesFromAccessToken, pickPrimaryRole } from './mappers'

export interface TokenResponse {
  access_token: string
  refresh_token: string
  expires_in?: number
  token_type?: string
}

export type LoginResult = TokenResponse

export const authApi = {
  async login(login: string, password: string): Promise<LoginResult> {
    return unwrap<LoginResult>(apiClient.POST('/api/v1/auth/login', { body: { login, password } }))
  },

  async refresh(refreshToken: string): Promise<TokenResponse> {
    return unwrap<TokenResponse>(
      apiClient.POST('/api/v1/auth/refresh', {
        body: { refresh_token: refreshToken } as never,
      }),
    )
  },

  async logout(refreshToken: string | null): Promise<void> {
    await unwrap<unknown>(
      apiClient.POST('/api/v1/auth/logout', {
        body: { refresh_token: refreshToken ?? undefined } as never,
      }),
    )
  },

  async me(): Promise<UserProfile> {
    const raw = await unwrap<unknown>(apiClient.GET('/api/v1/auth/me'))
    const mapped = mapUser(raw)
    if (!mapped.roles?.length) {
      const fromJwt = rolesFromAccessToken(useAuthStore.getState().accessToken)
      if (fromJwt.length) {
        mapped.roles = fromJwt
        mapped.role = pickPrimaryRole(fromJwt)
      }
    }
    return mapped
  },
}
