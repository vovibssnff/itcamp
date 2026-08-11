import { apiClient } from './client'
import { unwrap } from './request'
import { mapUser } from './mappers'
import type { UserProfile } from '@/store/auth'

export const usersApi = {
  async list(): Promise<UserProfile[]> {
    const raw = await unwrap<unknown[]>(apiClient.GET('/api/v1/users'))
    return (raw ?? []).map(mapUser)
  },

  async get(id: string): Promise<UserProfile> {
    const raw = await unwrap<unknown>(
      apiClient.GET('/api/v1/users/{id}', { params: { path: { id } } }),
    )
    return mapUser(raw)
  },
}
