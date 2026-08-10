import { apiClient } from './client'
import { unwrap, unwrapVoid } from './request'
import { mapComponent } from './mappers'
import { postImport, type ImportResult } from './import'
import type { ComponentType } from '@/mocks/fixtures/components'

export const componentsApi = {
  async list(): Promise<ComponentType[]> {
    const raw = await unwrap<unknown[]>(apiClient.GET('/api/v1/components'))
    return (raw ?? []).map(mapComponent)
  },

  async get(id: string): Promise<ComponentType> {
    const raw = await unwrap<unknown>(
      apiClient.GET('/api/v1/components/{id}', { params: { path: { id } } }),
    )
    return mapComponent(raw)
  },

  async create(component: ComponentType): Promise<ComponentType> {
    const raw = await unwrap<unknown>(
      apiClient.POST('/api/v1/components', { body: component as never }),
    )
    return mapComponent(raw)
  },

  async update(id: string, component: ComponentType): Promise<ComponentType> {
    const raw = await unwrap<unknown>(
      apiClient.PUT('/api/v1/components/{id}', {
        params: { path: { id } },
        body: component as never,
      }),
    )
    return mapComponent(raw)
  },

  async remove(id: string): Promise<void> {
    await unwrapVoid(apiClient.DELETE('/api/v1/components/{id}', { params: { path: { id } } }))
  },

  async import(payload: { components: unknown[] } | unknown[]): Promise<ImportResult> {
    const body = Array.isArray(payload) ? { components: payload } : payload
    return postImport<ImportResult>('/api/v1/components/import', body)
  },
}
