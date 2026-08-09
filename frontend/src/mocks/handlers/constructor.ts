import { http, HttpResponse } from 'msw'
import { COMPONENT_TYPES } from '../fixtures/components'
import { TEMPLATES } from '../fixtures/templates'

const templates = [...TEMPLATES]

export const constructorHandlers = [
  http.get('/api/components', () => {
    return HttpResponse.json(COMPONENT_TYPES)
  }),

  http.get('/api/components/:id', ({ params }) => {
    const ct = COMPONENT_TYPES.find((c) => c.id === params.id)
    if (!ct) return HttpResponse.json({ error: 'Not found' }, { status: 404 })
    return HttpResponse.json(ct)
  }),

  http.get('/api/templates', () => {
    return HttpResponse.json(templates.map(({ nodes: _, edges: __, ...t }) => t))
  }),

  http.get('/api/templates/:id', ({ params }) => {
    const tmpl = templates.find((t) => t.id === params.id)
    if (!tmpl) return HttpResponse.json({ error: 'Not found' }, { status: 404 })
    return HttpResponse.json(tmpl)
  }),

  http.post('/api/templates', async ({ request }) => {
    const body = (await request.json()) as { name: string; description?: string }
    const newTemplate = {
      id: `tmpl-${Date.now()}`,
      name: body.name,
      description: body.description ?? '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      nodes: [],
      edges: [],
      isValid: false,
    }
    templates.push(newTemplate)
    return HttpResponse.json(newTemplate, { status: 201 })
  }),

  http.put('/api/templates/:id', async ({ params, request }) => {
    const body = (await request.json()) as (typeof TEMPLATES)[0]
    const idx = templates.findIndex((t) => t.id === params.id)
    if (idx === -1) return HttpResponse.json({ error: 'Not found' }, { status: 404 })
    templates[idx] = { ...templates[idx], ...body, updatedAt: new Date().toISOString() }
    return HttpResponse.json(templates[idx])
  }),

  http.delete('/api/templates/:id', ({ params }) => {
    const idx = templates.findIndex((t) => t.id === params.id)
    if (idx === -1) return HttpResponse.json({ error: 'Not found' }, { status: 404 })
    templates.splice(idx, 1)
    return new HttpResponse(null, { status: 204 })
  }),

  http.post('/api/templates/:id/validate', ({ params }) => {
    const tmpl = templates.find((t) => t.id === params.id)
    if (!tmpl) return HttpResponse.json({ error: 'Not found' }, { status: 404 })
    return HttpResponse.json({
      valid: tmpl.nodes.length > 0,
      errors:
        tmpl.nodes.length === 0
          ? [{ nodeId: null, message: 'Шаблон не содержит компонентов' }]
          : [],
    })
  }),
]
