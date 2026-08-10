import { apiClient } from './client'
import { unwrap } from './request'
import { mapUser, pickPrimaryRole, rolesFromAccessToken } from './mappers'
import type { UserProfile } from '@/store/auth'
import { useAuthStore } from '@/store/auth'

const BASE_URL =
  import.meta.env.VITE_MOCK_API === 'true' ? '' : (import.meta.env.VITE_API_BASE_URL ?? '')

export interface TokenResponse {
  access_token: string
  refresh_token: string
  expires_in?: number
  token_type?: string
}

export interface MfaRequiredResponse {
  mfa_required: true
  user_id?: string
  login?: string
  /** Short-lived; exchange via enrollmentSetup for QR/secret. */
  enrollment_token?: string
  /** @deprecated Prefer enrollment_token + enrollmentSetup. */
  secret?: string
  otpauth_uri?: string
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

  async enrollmentSetup(
    enrollmentToken: string,
  ): Promise<{ secret: string; otpauth_uri: string; login?: string }> {
    const res = await fetch(`${BASE_URL}/api/v1/auth/mfa/enrollment`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${enrollmentToken}`,
        Accept: 'application/json',
      },
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(text || `HTTP ${res.status}`)
    }
    return (await res.json()) as { secret: string; otpauth_uri: string; login?: string }
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
    const mapped = mapUser(raw)
    // Backend historically omitted user_roles; JWT still has roles from login.
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
