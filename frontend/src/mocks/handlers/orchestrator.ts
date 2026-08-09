import { http, HttpResponse } from 'msw'
import { SESSIONS } from '../fixtures/sessions'

const sessions = [...SESSIONS]

export const orchestratorHandlers = [
  http.get('/api/sessions', () => {
    return HttpResponse.json(sessions)
  }),

  http.get('/api/sessions/:id', ({ params }) => {
    const s = sessions.find((sess) => sess.id === params.id)
    if (!s) return HttpResponse.json({ error: 'Not found' }, { status: 404 })
    return HttpResponse.json(s)
  }),

  http.post('/api/sessions', async ({ request }) => {
    const body = (await request.json()) as {
      templateId: string
      operatorId: string
      scenarioId?: string
      mode: 'training' | 'exam'
    }
    const created = {
      id: `sess-${Date.now()}`,
      templateId: body.templateId,
      templateName: 'ЭЛОУ-АВТ демо',
      operatorId: body.operatorId,
      operatorName: 'Петров П.П.',
      instructorId: 'u2',
      scenarioId: body.scenarioId,
      scenarioName: undefined,
      mode: body.mode,
      status: 'idle' as const,
      startedAt: null,
      finishedAt: null,
      speed: 1,
    }
    sessions.push(created)
    return HttpResponse.json(created, { status: 201 })
  }),

  http.post('/api/sessions/:id/start', ({ params }) => {
    const s = sessions.find((sess) => sess.id === params.id)
    if (!s) return HttpResponse.json({ error: 'Not found' }, { status: 404 })
    s.status = 'running'
    s.startedAt = new Date().toISOString()
    return HttpResponse.json(s)
  }),

  http.post('/api/sessions/:id/pause', ({ params }) => {
    const s = sessions.find((sess) => sess.id === params.id)
    if (!s) return HttpResponse.json({ error: 'Not found' }, { status: 404 })
    s.status = 'paused'
    return HttpResponse.json(s)
  }),

  http.post('/api/sessions/:id/resume', ({ params }) => {
    const s = sessions.find((sess) => sess.id === params.id)
    if (!s) return HttpResponse.json({ error: 'Not found' }, { status: 404 })
    s.status = 'running'
    return HttpResponse.json(s)
  }),

  http.post('/api/sessions/:id/stop', ({ params }) => {
    const s = sessions.find((sess) => sess.id === params.id)
    if (!s) return HttpResponse.json({ error: 'Not found' }, { status: 404 })
    s.status = 'stopped'
    s.finishedAt = new Date().toISOString()
    return HttpResponse.json(s)
  }),

  http.put('/api/sessions/:id/speed', async ({ params, request }) => {
    const body = (await request.json()) as { speed: number }
    const s = sessions.find((sess) => sess.id === params.id)
    if (!s) return HttpResponse.json({ error: 'Not found' }, { status: 404 })
    s.speed = body.speed
    return HttpResponse.json(s)
  }),

  http.get('/api/sessions/:id/snapshots', () => {
    return HttpResponse.json([
      {
        id: 'snap-1',
        sessionId: 'sess-001',
        label: 'Начало пуска',
        createdAt: new Date(Date.now() - 600000).toISOString(),
      },
      {
        id: 'snap-2',
        sessionId: 'sess-001',
        label: 'Выход на режим',
        createdAt: new Date(Date.now() - 300000).toISOString(),
      },
    ])
  }),

  http.post('/api/sessions/:id/snapshots', async ({ params, request }) => {
    const body = (await request.json()) as { label: string }
    return HttpResponse.json(
      {
        id: `snap-${Date.now()}`,
        sessionId: params.id,
        label: body.label,
        createdAt: new Date().toISOString(),
      },
      { status: 201 },
    )
  }),

  http.post('/api/sessions/:id/snapshots/:snapId/restore', ({ params }) => {
    const s = sessions.find((sess) => sess.id === params.id)
    if (!s) return HttpResponse.json({ error: 'Not found' }, { status: 404 })
    return HttpResponse.json({ message: `Restored snapshot ${params.snapId}` })
  }),
]
