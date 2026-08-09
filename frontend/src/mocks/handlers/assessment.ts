import { http, HttpResponse } from 'msw'

export const assessmentHandlers = [
  http.get('/api/assessment/session/:id/score', ({ params }) => {
    return HttpResponse.json({
      sessionId: params.id,
      score: 87,
      maxScore: 100,
      penalties: [
        {
          id: 'pen-1',
          description: 'Задержка переключения на резервный насос',
          deduction: 5,
          timestamp: 450,
        },
        {
          id: 'pen-2',
          description: 'Несоблюдение последовательности операций при пуске',
          deduction: 3,
          timestamp: 1200,
        },
        {
          id: 'pen-3',
          description: 'Превышение допустимой температуры верха колонны',
          deduction: 5,
          isCritical: true,
          timestamp: 800,
        },
      ],
      criticalErrors: [
        { id: 'ce-1', description: 'Кратковременное превышение ТТ-202 выше 140°C', timestamp: 800 },
      ],
      aiAnalysis:
        'Оператор продемонстрировал удовлетворительные навыки управления процессом. Основные замечания: недостаточная скорость реакции при аварийных переключениях и несоблюдение порядка операций при пуске. Рекомендуется дополнительная тренировка по нештатным ситуациям.',
      completedAt: new Date(Date.now() - 3600000).toISOString(),
    })
  }),

  http.put('/api/assessment/session/:id/override', async ({ params, request }) => {
    const body = (await request.json()) as { score: number; comment: string }
    return HttpResponse.json({
      sessionId: params.id,
      overriddenScore: body.score,
      comment: body.comment,
      overriddenBy: 'u2',
      overriddenAt: new Date().toISOString(),
    })
  }),
]
