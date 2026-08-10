export interface ExamAssignment {
  id: string
  operatorId: string
  operatorName: string
  scenarioId: string
  scenarioName: string
  dueDate: string
  note?: string
  status: 'scheduled' | 'completed'
  createdAt: string
  createdBy: string
}

export const ASSIGNMENTS: ExamAssignment[] = [
  {
    id: 'asg-001',
    operatorId: 'u3',
    operatorName: 'Петров П.П.',
    scenarioId: 'sc-column-flood',
    scenarioName: 'Захлёбывание колонны К-2',
    dueDate: new Date(Date.now() + 3 * 86_400_000).toISOString(),
    note: 'Повторно отработать после низкого результата на прошлом экзамене',
    status: 'scheduled',
    createdAt: new Date(Date.now() - 86_400_000).toISOString(),
    createdBy: 'u2',
  },
]

export interface OperatorRecommendation {
  operatorId: string
  generatedAt: string
  summary: string
  weakTopics: { scenarioId: string; scenarioName: string; detail: string }[]
}

// Canned per-operator analysis — same "deterministic mock AI" pattern as
// mocks/handlers/ai.ts and the aiAnalysis field in mocks/handlers/assessment.ts,
// grounded in scenario names that actually exist in fixtures/scenarios.ts.
const RECOMMENDATIONS: Record<string, OperatorRecommendation> = {
  u3: {
    operatorId: 'u3',
    generatedAt: new Date().toISOString(),
    summary:
      'Петров П.П. уверенно проходит штатный пуск установки, но стабильно теряет баллы в сценариях с быстро развивающимися нештатными ситуациями.',
    weakTopics: [
      {
        scenarioId: 'sc-column-flood',
        scenarioName: 'Захлёбывание колонны К-2',
        detail:
          'Средний результат 54% за 2 попытки — поздно распознаёт рост уровня L-2 и задерживает открытие клапана V-3.',
      },
      {
        scenarioId: 'sc-temp-runaway',
        scenarioName: 'Перегрев теплообменника Т-101',
        detail:
          'Результат 61% — время реакции на сигнализацию по температуре почти вдвое выше нормативного.',
      },
    ],
  },
}

export function getRecommendation(operatorId: string): OperatorRecommendation {
  return (
    RECOMMENDATIONS[operatorId] ?? {
      operatorId,
      generatedAt: new Date().toISOString(),
      summary:
        'Недостаточно завершённых сессий для рекомендации — нужно пройти минимум 2 сценария.',
      weakTopics: [],
    }
  )
}
