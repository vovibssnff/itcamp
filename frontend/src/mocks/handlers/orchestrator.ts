import { http, HttpResponse } from 'msw'
import { SESSIONS } from '../fixtures/sessions'

const sessions = SESSIONS.map((s) => ({ ...s }))

function toBackendSession(s: (typeof sessions)[0]) {
  return {
    id: s.id,
    template_id: s.templateId,
    template_name: s.templateName,
    scenario_id: s.scenarioId,
    scenario_name: s.scenarioName,
    operator_ids: [s.operatorId],
    operator_id: s.operatorId,
    operator_name: s.operatorName,
    instructor_id: s.instructorId,
    mode: s.mode,
    speed: s.speed,
    status: s.status === 'idle' ? 'created' : s.status,
    started_at: s.startedAt,
    stopped_at: s.finishedAt,
    report_id: s.reportId,
  }
}

export const orchestratorHandlers = [
  http.get('/api/v1/sessions', () => {
    return HttpResponse.json(sessions.map(toBackendSession))
  }),

  http.get('/api/v1/sessions/:id', ({ params }) => {
    const s = sessions.find((sess) => sess.id === params.id)
    if (!s) return HttpResponse.json({ error: 'Not found' }, { status: 404 })
    return HttpResponse.json(toBackendSession(s))
  }),

  http.post('/api/v1/sessions', async ({ request }) => {
    const body = (await request.json()) as {
      template_id: string
      operator_ids: string[]
      scenario_id?: string
      mode: 'training' | 'exam' | 'demo'
      speed?: number
    }
    const created = {
      id: `sess-${Date.now()}`,
      templateId: body.template_id,
      templateName: 'ЭЛОУ-АВТ демо',
      operatorId: body.operator_ids?.[0] ?? 'u3',
      operatorName: 'Петров П.П.',
      instructorId: 'u2',
      scenarioId: body.scenario_id,
      scenarioName: undefined,
      mode: (body.mode === 'exam' ? 'exam' : 'training') as 'training' | 'exam',
      status: 'idle' as const,
      startedAt: null,
      finishedAt: null,
      speed: body.speed ?? 1,
    }
    sessions.push(created)
    return HttpResponse.json(toBackendSession(created), { status: 201 })
  }),

  http.post('/api/v1/sessions/:id/:action', async ({ params, request }) => {
    const action = String(params.action)
    const s = sessions.find((sess) => sess.id === params.id)
    if (!s) return HttpResponse.json({ error: 'Not found' }, { status: 404 })

    if (action === 'start' || action === 'resume') {
      s.status = 'running'
      s.startedAt = s.startedAt ?? new Date().toISOString()
      return HttpResponse.json(toBackendSession(s))
    }
    if (action === 'pause') {
      s.status = 'paused'
      return HttpResponse.json(toBackendSession(s))
    }
    if (action === 'stop') {
      s.status = 'stopped'
      s.finishedAt = new Date().toISOString()
      return HttpResponse.json(toBackendSession(s))
    }
    if (action === 'checkpoint') {
      const body = (await request.json().catch(() => ({}))) as { name?: string }
      return HttpResponse.json(
        {
          id: `snap-${Date.now()}`,
          session_id: params.id,
          name: body.name ?? 'checkpoint',
          created_at: new Date().toISOString(),
        },
        { status: 200 },
      )
    }
    if (action === 'restore') {
      const body = (await request.json()) as { snapshot_id: string }
      return HttpResponse.json({ message: `Restored snapshot ${body.snapshot_id}` })
    }
    if (action === 'actuator') {
      return HttpResponse.json({ ok: true })
    }
    return HttpResponse.json({ error: `Unknown action ${action}` }, { status: 400 })
  }),

  http.put('/api/v1/sessions/:id/speed', async ({ params, request }) => {
    const body = (await request.json()) as { factor?: number; speed?: number }
    const s = sessions.find((sess) => sess.id === params.id)
    if (!s) return HttpResponse.json({ error: 'Not found' }, { status: 404 })
    s.speed = body.factor ?? body.speed ?? s.speed
    return HttpResponse.json(toBackendSession(s))
  }),
]
