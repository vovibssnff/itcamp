import { http, HttpResponse } from 'msw'
import { SCENARIOS } from '../fixtures/scenarios'

const scenarios = [...SCENARIOS]

export const scenarioHandlers = [
  http.get('/api/scenarios', () => {
    return HttpResponse.json(scenarios)
  }),

  http.get('/api/scenarios/:id', ({ params }) => {
    const s = scenarios.find((sc) => sc.id === params.id)
    if (!s) return HttpResponse.json({ error: 'Not found' }, { status: 404 })
    return HttpResponse.json(s)
  }),

  http.post('/api/scenarios', async ({ request }) => {
    const body = (await request.json()) as (typeof SCENARIOS)[0]
    const created = { ...body, id: `sc-${Date.now()}` }
    scenarios.push(created)
    return HttpResponse.json(created, { status: 201 })
  }),

  http.put('/api/scenarios/:id', async ({ params, request }) => {
    const body = (await request.json()) as (typeof SCENARIOS)[0]
    const idx = scenarios.findIndex((s) => s.id === params.id)
    if (idx === -1) return HttpResponse.json({ error: 'Not found' }, { status: 404 })
    scenarios[idx] = { ...scenarios[idx], ...body }
    return HttpResponse.json(scenarios[idx])
  }),

  http.delete('/api/scenarios/:id', ({ params }) => {
    const idx = scenarios.findIndex((s) => s.id === params.id)
    if (idx === -1) return HttpResponse.json({ error: 'Not found' }, { status: 404 })
    scenarios.splice(idx, 1)
    return new HttpResponse(null, { status: 204 })
  }),

  http.get('/api/faults', () => {
    return HttpResponse.json(
      scenarios.flatMap((s) =>
        s.faults.map((f) => ({
          ...f,
          scenarioId: s.id,
          scenarioName: s.name,
        })),
      ),
    )
  }),
]
