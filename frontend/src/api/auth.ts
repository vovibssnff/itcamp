import { apiClient } from './client'
import { unwrap } from './request'
import { mapUser } from './mappers'
import type { UserProfile } from '@/store/auth'

export interface TokenResponse {
  access_token: string
  refresh_token: string
  expires_in?: number
  token_type?: string
}

export interface MfaRequiredResponse {
  mfa_required: true
}

export type LoginResult = TokenResponse | MfaRequiredResponse

export function isMfaRequired(result: LoginResult): result is MfaRequiredResponse {
  return 'mfa_required' in result && result.mfa_required === true
}

export const authApi = {
  async login(login: string, password: string, mfaCode?: string): Promise<LoginResult> {
    const body: { login: string; password: string; mfa_code?: string } = { login, password }
    if (mfaCode) body.mfa_code = mfaCode
    return unwrap<LoginResult>(apiClient.POST('/api/v1/auth/login', { body }))
  },

  async refresh(refreshToken: string): Promise<TokenResponse> {
    // Gateway OpenAPI omits the request body schema; auth service expects refresh_token.
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
    return mapUser(raw)
  },
}
