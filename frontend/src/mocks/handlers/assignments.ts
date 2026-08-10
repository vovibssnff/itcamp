import { http, HttpResponse } from 'msw'
import { ASSIGNMENTS, getRecommendation, type ExamAssignment } from '../fixtures/assignments'

// Mutable in-memory copy
const assignments: ExamAssignment[] = ASSIGNMENTS.map((a) => ({ ...a }))

export const assignmentHandlers = [
  http.get('/api/assignments', () => HttpResponse.json(assignments)),

  http.post('/api/assignments', async ({ request }) => {
    const body = (await request.json()) as {
      operatorId: string
      operatorName: string
      scenarioId: string
      scenarioName: string
      dueDate: string
      note?: string
    }
    const record: ExamAssignment = {
      id: `asg-${Date.now()}`,
      status: 'scheduled',
      createdAt: new Date().toISOString(),
      createdBy: 'u2',
      ...body,
    }
    assignments.unshift(record)
    return HttpResponse.json(record, { status: 201 })
  }),

  http.delete('/api/assignments/:id', ({ params }) => {
    const idx = assignments.findIndex((a) => a.id === params.id)
    if (idx >= 0) assignments.splice(idx, 1)
    return HttpResponse.json({ ok: true })
  }),

  http.get('/api/assessment/operator/:id/recommendation', ({ params }) => {
    return HttpResponse.json(getRecommendation(String(params.id)))
  }),
]
