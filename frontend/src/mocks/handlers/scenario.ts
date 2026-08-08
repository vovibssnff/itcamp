import { http, HttpResponse } from 'msw'
import { SCENARIOS, FAULT_CATALOG, type Scenario } from '../fixtures/scenarios'

// Mutable in-memory copy
const scenarios: Scenario[] = SCENARIOS.map((s) => ({ ...s }))

/** Filter helper */
function applyFilters(
  list: Scenario[],
  params: { template_id?: string; type?: string; status?: string; q?: string },
) {
  return list.filter((s) => {
    if (params.template_id && s.template_id !== params.template_id) return false
    if (params.type && s.type !== params.type) return false
    if (params.status && s.status !== params.status) return false
    if (params.q) {
      const q = params.q.toLowerCase()
      if (!s.name.toLowerCase().includes(q) && !s.description.toLowerCase().includes(q))
        return false
    }
    return true
  })
}

export const scenarioHandlers = [
  // ── List (with filters) ────────────────────────────────────────────────────
  http.get('/api/scenarios', ({ request }) => {
    const url = new URL(request.url)
    const filtered = applyFilters(scenarios, {
      template_id: url.searchParams.get('template_id') ?? undefined,
      type: url.searchParams.get('type') ?? undefined,
      status: url.searchParams.get('status') ?? undefined,
      q: url.searchParams.get('q') ?? undefined,
    })
    // Return summary (omit heavy fields)
    return HttpResponse.json(
      filtered.map(({ faults: _f, reference_actions: _ra, criteria: _cr, ...rest }) => rest),
    )
  }),

  // ── Exam scenarios (must precede /:id so "exam" isn't matched as an id) ─────
  http.get('/api/scenarios/exam', ({ request }) => {
    const url = new URL(request.url)
    const tid = url.searchParams.get('template_id')
    return HttpResponse.json(
      scenarios.filter(
        (s) => s.type === 'exam' && s.status === 'published' && (!tid || s.template_id === tid),
      ),
    )
  }),

  // ── Get one ────────────────────────────────────────────────────────────────
  http.get('/api/scenarios/:id', ({ params }) => {
    const s = scenarios.find((sc) => sc.id === params.id)
    if (!s) return HttpResponse.json({ error: 'Not found' }, { status: 404 })
    return HttpResponse.json(s)
  }),

  // ── Get full (with all sub-objects) ───────────────────────────────────────
  http.get('/api/scenarios/:id/full', ({ params }) => {
    const s = scenarios.find((sc) => sc.id === params.id)
    if (!s) return HttpResponse.json({ error: 'Not found' }, { status: 404 })
    return HttpResponse.json(s)
  }),

  // ── Create ─────────────────────────────────────────────────────────────────
  http.post('/api/scenarios', async ({ request }) => {
    const body = (await request.json()) as Partial<Scenario>
    const now = new Date().toISOString()
    const created: Scenario = {
      name: '',
      description: '',
      template_id: 'tmpl-elou-avt',
      type: 'training',
      author_id: 'user-instructor',
      status: 'draft',
      faults: [],
      reference_actions: [],
      criteria: {
        max_score: 100,
        penalty_late: 0.5,
        penalty_miss: 10,
        penalty_forbidden: 5,
        critical_actions: [],
        pass_threshold: 60,
      },
      created_at: now,
      updated_at: now,
      ...body,
      id: `sc-${Date.now()}`,
    }
    scenarios.push(created)
    return HttpResponse.json(created, { status: 201 })
  }),

  // ── Update ─────────────────────────────────────────────────────────────────
  http.put('/api/scenarios/:id', async ({ params, request }) => {
    const body = (await request.json()) as Partial<Scenario>
    const idx = scenarios.findIndex((s) => s.id === params.id)
    if (idx === -1) return HttpResponse.json({ error: 'Not found' }, { status: 404 })
    scenarios[idx] = {
      ...scenarios[idx]!,
      ...body,
      id: scenarios[idx]!.id,
      updated_at: new Date().toISOString(),
    }
    return HttpResponse.json(scenarios[idx])
  }),

  // ── Delete ─────────────────────────────────────────────────────────────────
  http.delete('/api/scenarios/:id', ({ params }) => {
    const idx = scenarios.findIndex((s) => s.id === params.id)
    if (idx === -1) return HttpResponse.json({ error: 'Not found' }, { status: 404 })
    scenarios.splice(idx, 1)
    return new HttpResponse(null, { status: 204 })
  }),

  // ── Clone ──────────────────────────────────────────────────────────────────
  http.post('/api/scenarios/:id/clone', async ({ params, request }) => {
    const src = scenarios.find((s) => s.id === params.id)
    if (!src) return HttpResponse.json({ error: 'Not found' }, { status: 404 })
    const body = (await request.json()) as { template_id?: string } | null
    const now = new Date().toISOString()
    const clone: Scenario = {
      ...(JSON.parse(JSON.stringify(src)) as Scenario),
      id: `sc-${Date.now()}`,
      name: `${src.name} (копия)`,
      status: 'draft',
      created_at: now,
      updated_at: now,
      template_id: (body as { template_id?: string } | null)?.template_id ?? src.template_id,
    }
    clone.faults = clone.faults.map((f) => ({ ...f, id: `sf-${Date.now()}-${Math.random()}` }))
    scenarios.push(clone)
    return HttpResponse.json(clone, { status: 201 })
  }),

  // ── AI-generate draft ──────────────────────────────────────────────────────
  http.post('/api/scenarios/ai-generate', async ({ request }) => {
    const body = (await request.json()) as { template_id: string; description?: string }
    const now = new Date().toISOString()
    const draft: Scenario = {
      id: `sc-ai-${Date.now()}`,
      name: `Сценарий ИИ: ${body.description ?? 'Авто-генерация'}`,
      description: body.description ?? 'Автоматически сгенерированный сценарий на основе шаблона',
      template_id: body.template_id ?? 'tmpl-elou-avt',
      type: 'training',
      author_id: 'user-instructor',
      status: 'draft',
      faults: [
        {
          id: `sf-ai-${Date.now()}`,
          fault_id: 'flt-pump-trip',
          component_instance_id: 'H-101A',
          params: { severity_pct: 80, ramp_seconds: 0 },
          trigger: { type: 'time', at_model_time: 180 },
          hidden: false,
        },
      ],
      reference_actions: [
        {
          step: 1,
          description: 'Устранить неисправность',
          expected: { target: 'H-101B', action: 'start' },
          deadline_seconds: 60,
          mandatory: true,
        },
      ],
      criteria: {
        max_score: 100,
        penalty_late: 0.5,
        penalty_miss: 10,
        penalty_forbidden: 5,
        critical_actions: ['1'],
        pass_threshold: 60,
      },
      created_at: now,
      updated_at: now,
    }
    scenarios.push(draft)
    return HttpResponse.json(draft, { status: 201 })
  }),

  // ── Moderation ─────────────────────────────────────────────────────────────
  http.post('/api/scenarios/:id/publish', ({ params }) => {
    const s = scenarios.find((sc) => sc.id === params.id)
    if (!s) return HttpResponse.json({ error: 'Not found' }, { status: 404 })
    if (s.status === 'archived')
      return HttpResponse.json({ error: 'Cannot publish archived' }, { status: 422 })
    s.status = 'published'
    s.updated_at = new Date().toISOString()
    return HttpResponse.json(s)
  }),

  http.post('/api/scenarios/:id/archive', ({ params }) => {
    const s = scenarios.find((sc) => sc.id === params.id)
    if (!s) return HttpResponse.json({ error: 'Not found' }, { status: 404 })
    s.status = 'archived'
    s.updated_at = new Date().toISOString()
    return HttpResponse.json(s)
  }),

  http.post('/api/scenarios/:id/unpublish', ({ params }) => {
    const s = scenarios.find((sc) => sc.id === params.id)
    if (!s) return HttpResponse.json({ error: 'Not found' }, { status: 404 })
    s.status = 'draft'
    s.updated_at = new Date().toISOString()
    return HttpResponse.json(s)
  }),

  // ── Fault catalog ──────────────────────────────────────────────────────────
  http.get('/api/faults', ({ request }) => {
    const url = new URL(request.url)
    const ct = url.searchParams.get('component_type')
    const sev = url.searchParams.get('severity')
    let faults = FAULT_CATALOG
    if (ct) faults = faults.filter((f) => f.applicable_component_types.includes(ct))
    if (sev) faults = faults.filter((f) => f.severity === sev)
    return HttpResponse.json(faults)
  }),

  http.get('/api/faults/:id', ({ params }) => {
    const f = FAULT_CATALOG.find((fc) => fc.fault_id === params.id)
    if (!f) return HttpResponse.json({ error: 'Not found' }, { status: 404 })
    return HttpResponse.json(f)
  }),
]
