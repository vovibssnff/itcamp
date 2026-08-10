import { apiClient } from './client'
import { unwrap, unwrapVoid } from './request'
import { mapUser, toCreateUserBody } from './mappers'
import type { UserProfile, UserRole } from '@/store/auth'

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

  async create(input: {
    username: string
    displayName: string
    role: UserRole
  }): Promise<UserProfile> {
    const raw = await unwrap<unknown>(
      apiClient.POST('/api/v1/users', { body: toCreateUserBody(input) as never }),
    )
    return mapUser(raw)
  },

  async update(
    id: string,
    input: { username: string; displayName: string; role: UserRole },
  ): Promise<UserProfile> {
    const raw = await unwrap<unknown>(
      apiClient.PUT('/api/v1/users/{id}', {
        params: { path: { id } },
        body: {
          login: input.username,
          full_name: input.displayName,
          roles: [input.role],
        } as never,
      }),
    )
    return mapUser(raw)
  },

  async remove(id: string): Promise<void> {
    await unwrapVoid(apiClient.DELETE('/api/v1/users/{id}', { params: { path: { id } } }))
  },
}
