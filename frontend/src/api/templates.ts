import { apiClient } from './client'
import { unwrap, unwrapVoid } from './request'
import { mapTemplate, mapTemplateSummary, toTemplateBody, type TemplateSummary } from './mappers'
import type { Template } from '@/mocks/fixtures/templates'

export interface ValidationResult {
  valid: boolean
  errors: { nodeId: string | null; message: string; code?: string; edgeId?: string }[]
}

export const templatesApi = {
  async list(): Promise<TemplateSummary[]> {
    const raw = await unwrap<unknown[]>(apiClient.GET('/api/v1/templates'))
    return (raw ?? []).map(mapTemplateSummary)
  },

  async get(id: string): Promise<Template> {
    const raw = await unwrap<unknown>(
      apiClient.GET('/api/v1/templates/{id}', { params: { path: { id } } }),
    )
    return mapTemplate(raw)
  },

  async create(input: { name: string; description?: string }): Promise<Template> {
    const raw = await unwrap<unknown>(
      apiClient.POST('/api/v1/templates', {
        body: toTemplateBody({ name: input.name, description: input.description }) as never,
      }),
    )
    return mapTemplate(raw)
  },

  async update(id: string, template: Template): Promise<Template> {
    const raw = await unwrap<unknown>(
      apiClient.PUT('/api/v1/templates/{id}', {
        params: { path: { id } },
        body: toTemplateBody(template) as never,
      }),
    )
    return mapTemplate(raw)
  },

  async remove(id: string): Promise<void> {
    await unwrapVoid(apiClient.DELETE('/api/v1/templates/{id}', { params: { path: { id } } }))
  },

  async copy(id: string, newName: string): Promise<Template> {
    const raw = await unwrap<unknown>(
      apiClient.POST('/api/v1/templates/{id}/copy', {
        params: { path: { id } },
        body: { new_name: newName } as never,
      }),
    )
    return mapTemplate(raw)
  },

  async validate(id: string): Promise<ValidationResult> {
    const raw = await unwrap<{
      valid?: boolean
      errors?: {
        node_id?: string
        nodeId?: string | null
        message?: string
        code?: string
        edge_id?: string
      }[]
    }>(apiClient.POST('/api/v1/templates/{id}/validate', { params: { path: { id } } }))

    return {
      valid: Boolean(raw?.valid),
      errors: (raw?.errors ?? []).map((e) => ({
        nodeId: e.node_id ?? e.nodeId ?? null,
        message: e.message ?? '',
        code: e.code,
        edgeId: e.edge_id,
      })),
    }
  },
}
