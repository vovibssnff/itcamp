import { apiClient } from './client'
import { unwrap, unwrapVoid } from './request'
import { mapComponent } from './mappers'
import { postImport, type ImportResult } from './import'
import { categoryToApi } from '@/utils/component-display'
import type { ComponentType } from '@/mocks/fixtures/components'

export type ComponentListOpts = {
  /** SPA key or raw API category; omitted / empty = all categories. */
  category?: string
  q?: string
  limit?: number
  offset?: number
}

export const componentsApi = {
  async list(opts?: ComponentListOpts): Promise<ComponentType[]> {
    // Gateway OpenAPI typings omit list query; constructor supports category/q/limit/offset.
    const query: Record<string, string | number> = {
      limit: opts?.limit ?? 500,
      offset: opts?.offset ?? 0,
    }
    if (opts?.category) {
      query.category = categoryToApi(opts.category)
    }
    if (opts?.q) {
      query.q = opts.q
    }
    const raw = await unwrap<unknown[]>(
      apiClient.GET('/api/v1/components', {
        params: { query: query as never },
      }),
    )
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
      apiClient.POST('/api/v1/components', {
        body: { ...component, category: categoryToApi(component.category) } as never,
      }),
    )
    return mapComponent(raw)
  },

  async update(id: string, component: ComponentType): Promise<ComponentType> {
    const raw = await unwrap<unknown>(
      apiClient.PUT('/api/v1/components/{id}', {
        params: { path: { id } },
        body: { ...component, category: categoryToApi(component.category) } as never,
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
