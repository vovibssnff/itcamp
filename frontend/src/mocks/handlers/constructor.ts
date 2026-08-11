import { http, HttpResponse } from 'msw'
import { COMPONENT_TYPES, type ComponentType } from '../fixtures/components'
import { TEMPLATES } from '../fixtures/templates'

const templates = TEMPLATES.map((t) => ({ ...t }))
const components = [...COMPONENT_TYPES]

function toBackendTemplate(t: (typeof templates)[0]) {
  return {
    id: t.id,
    name: t.name,
    description: t.description,
    status: t.isValid ? 'published' : 'draft',
    created_at: t.createdAt,
    updated_at: t.updatedAt,
    graph: {
      schema_version: '2.0',
      nodes: t.nodes.map((n) => ({
        id: n.id,
        component_type_id: n.typeId,
        label: n.label,
        position: { x: n.x, y: n.y },
        parameters: {
          ...n.parameters,
          ...(n.tags ? { tags: n.tags } : {}),
          ...(n.width != null ? { width: n.width } : {}),
          ...(n.height != null ? { height: n.height } : {}),
        },
        tags: n.tags,
        ports: {},
      })),
      edges: t.edges.map((e) => ({
        id: e.id,
        type: e.type ?? 'liquid',
        from: { node_id: e.sourceNodeId, port: e.sourcePortId },
        to: { node_id: e.targetNodeId, port: e.targetPortId },
      })),
      layout: {
        mnemo_positions: Object.fromEntries(t.nodes.map((n) => [n.id, { x: n.x, y: n.y }])),
        custom_labels: {},
      },
    },
  }
}

export const constructorHandlers = [
  http.get('/api/v1/components', () => {
    return HttpResponse.json(components)
  }),

  http.get('/api/v1/components/:id', ({ params }) => {
    const ct = components.find((c) => c.id === params.id)
    if (!ct) return HttpResponse.json({ error: 'Not found' }, { status: 404 })
    return HttpResponse.json(ct)
  }),

  http.post('/api/v1/components', async ({ request }) => {
    const body = (await request.json()) as ComponentType
    const created = { ...body, id: body.id || `ct-${Date.now()}` }
    components.push(created)
    return HttpResponse.json(created, { status: 201 })
  }),

  http.put('/api/v1/components/:id', async ({ params, request }) => {
    const body = (await request.json()) as ComponentType
    const idx = components.findIndex((c) => c.id === params.id)
    if (idx === -1) return HttpResponse.json({ error: 'Not found' }, { status: 404 })
    components[idx] = { ...components[idx], ...body, id: String(params.id) }
    return HttpResponse.json(components[idx])
  }),

  http.delete('/api/v1/components/:id', ({ params }) => {
    const idx = components.findIndex((c) => c.id === params.id)
    if (idx === -1) return HttpResponse.json({ error: 'Not found' }, { status: 404 })
    components.splice(idx, 1)
    return new HttpResponse(null, { status: 204 })
  }),

  http.get('/api/v1/templates', () => {
    return HttpResponse.json(
      templates.map((t) => {
        const backend = toBackendTemplate(t)
        return {
          id: backend.id,
          name: backend.name,
          description: backend.description,
          status: backend.status,
          created_at: backend.created_at,
          updated_at: backend.updated_at,
          // Keep nodes in list responses so isValid mapping stays useful in UI.
          graph: backend.graph,
        }
      }),
    )
  }),

  http.get('/api/v1/templates/:id', ({ params }) => {
    const tmpl = templates.find((t) => t.id === params.id)
    if (!tmpl) return HttpResponse.json({ error: 'Not found' }, { status: 404 })
    return HttpResponse.json(toBackendTemplate(tmpl))
  }),

  http.post('/api/v1/templates', async ({ request }) => {
    const body = (await request.json()) as {
      name: string
      description?: string
      graph?: { nodes?: unknown[]; edges?: unknown[] }
    }
    const newTemplate = {
      id: `tmpl-${Date.now()}`,
      name: body.name,
      description: body.description ?? '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      nodes: (body.graph?.nodes ?? []) as (typeof TEMPLATES)[0]['nodes'],
      edges: (body.graph?.edges ?? []) as (typeof TEMPLATES)[0]['edges'],
      isValid: false,
    }
    templates.push(newTemplate)
    return HttpResponse.json(toBackendTemplate(newTemplate), { status: 201 })
  }),

  http.put('/api/v1/templates/:id', async ({ params, request }) => {
    const body = (await request.json()) as {
      name?: string
      description?: string
      graph?: { nodes?: (typeof TEMPLATES)[0]['nodes']; edges?: (typeof TEMPLATES)[0]['edges'] }
    }
    const idx = templates.findIndex((t) => t.id === params.id)
    if (idx === -1) return HttpResponse.json({ error: 'Not found' }, { status: 404 })
    const prev = templates[idx]!
    templates[idx] = {
      ...prev,
      name: body.name ?? prev.name,
      description: body.description ?? prev.description,
      nodes: body.graph?.nodes ?? prev.nodes,
      edges: body.graph?.edges ?? prev.edges,
      updatedAt: new Date().toISOString(),
    }
    return HttpResponse.json(toBackendTemplate(templates[idx]!))
  }),

  http.delete('/api/v1/templates/:id', ({ params }) => {
    const idx = templates.findIndex((t) => t.id === params.id)
    if (idx === -1) return HttpResponse.json({ error: 'Not found' }, { status: 404 })
    templates.splice(idx, 1)
    return new HttpResponse(null, { status: 204 })
  }),

  http.post('/api/v1/templates/:id/copy', async ({ params, request }) => {
    const body = (await request.json()) as { new_name?: string }
    const src = templates.find((t) => t.id === params.id)
    if (!src) return HttpResponse.json({ error: 'Not found' }, { status: 404 })
    const copy = {
      ...src,
      id: `tmpl-${Date.now()}`,
      name: body.new_name ?? `${src.name} (копия)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      nodes: structuredClone(src.nodes),
      edges: structuredClone(src.edges),
    }
    templates.push(copy)
    return HttpResponse.json(toBackendTemplate(copy), { status: 201 })
  }),

  http.post('/api/v1/templates/:id/validate', ({ params }) => {
    const tmpl = templates.find((t) => t.id === params.id)
    if (!tmpl) return HttpResponse.json({ error: 'Not found' }, { status: 404 })
    return HttpResponse.json({
      valid: tmpl.nodes.length > 0,
      errors:
        tmpl.nodes.length === 0
          ? [{ node_id: null, message: 'Шаблон не содержит компонентов' }]
          : [],
    })
  }),

  http.post('/api/v1/components/import', async ({ request }) => {
    const body = (await request.json()) as { components?: ComponentType[] }
    let created = 0
    let updated = 0
    for (const c of body.components ?? []) {
      const idx = components.findIndex((x) => x.id === c.id)
      if (idx === -1) {
        components.push(c)
        created++
      } else {
        components[idx] = { ...components[idx], ...c }
        updated++
      }
    }
    return HttpResponse.json({ created, updated, errors: [] })
  }),

  http.post('/api/v1/templates/import', async ({ request }) => {
    const body = (await request.json()) as {
      name: string
      description?: string
      graph?: { nodes?: unknown[]; edges?: unknown[] }
    }
    const newTemplate = {
      id: `tmpl-${Date.now()}`,
      name: body.name,
      description: body.description ?? '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      nodes: (body.graph?.nodes ?? []) as (typeof TEMPLATES)[0]['nodes'],
      edges: (body.graph?.edges ?? []) as (typeof TEMPLATES)[0]['edges'],
      isValid: (body.graph?.nodes?.length ?? 0) > 0,
    }
    templates.push(newTemplate)
    return HttpResponse.json(
      {
        template: toBackendTemplate(newTemplate),
        validation: { valid: newTemplate.isValid, errors: [] },
      },
      { status: 201 },
    )
  }),
]
