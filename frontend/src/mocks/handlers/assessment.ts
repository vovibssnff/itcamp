import { http, HttpResponse } from 'msw'

export const assessmentHandlers = [
  http.get('/api/v1/assessment/session/:id/score', ({ params }) => {
    return HttpResponse.json({
      session_id: params.id,
      total_score: 87,
      max_score: 100,
      verdict: 'pass',
      penalties: [
        {
          code: 'pen-1',
          description: 'Задержка переключения на резервный насос',
          points: 5,
          model_time: 450,
        },
        {
          code: 'pen-2',
          description: 'Несоблюдение последовательности операций при пуске',
          points: 3,
          model_time: 1200,
        },
        {
          code: 'pen-3',
          description: 'Превышение допустимой температуры верха колонны',
          points: 5,
          model_time: 800,
        },
      ],
      critical_errors: [
        {
          code: 'ce-1',
          description: 'Кратковременное превышение ТТ-202 выше 140°C',
          model_time: 800,
        },
      ],
      ai_analysis:
        'Оператор продемонстрировал удовлетворительные навыки управления процессом. Основные замечания: недостаточная скорость реакции при аварийных переключениях и несоблюдение порядка операций при пуске. Рекомендуется дополнительная тренировка по нештатным ситуациям.',
      completed_at: new Date(Date.now() - 3600000).toISOString(),
    })
  }),

  http.post('/api/v1/assessment/override', async ({ request }) => {
    const body = (await request.json()) as {
      session_id: string
      new_score: number
      verdict: string
      comment: string
    }
    return HttpResponse.json({
      session_id: body.session_id,
      total_score: body.new_score,
      max_score: 100,
      verdict: body.verdict,
      penalties: [],
      critical_errors: [],
      ai_analysis: body.comment,
      completed_at: new Date().toISOString(),
    })
  }),

  http.get('/api/v1/assessment/session/:id/replay', ({ params }) => {
    return HttpResponse.json({
      session_id: params.id,
      duration: 900,
      actions: [
        { model_time: 180, description: 'Переключение на ручной режим TRC-201', type: 'action' },
        { model_time: 360, description: 'Стабилизация температуры', type: 'action' },
      ],
      alarms: [
        { model_time: 120, description: 'HH по TI-201', type: 'alarm', severity: 'critical' },
      ],
      penalties: [{ model_time: 240, description: 'Задержка реакции > 60с', type: 'penalty' }],
      faults: [],
    })
  }),

  // Legacy / mock-only CSV export (not in gateway)
  http.get('/api/assessment/reports/export', () => {
    return new HttpResponse('id,session_id,score\nrep-001,sess-002,87\n', {
      headers: { 'Content-Type': 'text/csv' },
    })
  }),
]
