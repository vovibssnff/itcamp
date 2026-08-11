import type { SessionRecord } from '@/types'
export type { SessionRecord } from '@/types'

export const SESSIONS: SessionRecord[] = [
  {
    id: 'sess-001',
    templateId: 'tmpl-elou-avt',
    templateName: 'ЭЛОУ-АВТ демо',
    operatorId: 'u3',
    operatorName: 'Петров П.П.',
    instructorId: 'u2',
    scenarioId: 'sc-normal-startup',
    scenarioName: 'Нормальный пуск установки',
    mode: 'training',
    status: 'running',
    startedAt: new Date(Date.now() - 900000).toISOString(),
    finishedAt: null,
    speed: 1,
  },
  {
    id: 'sess-002',
    templateId: 'tmpl-elou-avt',
    templateName: 'ЭЛОУ-АВТ демо',
    operatorId: 'u3',
    operatorName: 'Петров П.П.',
    instructorId: 'u2',
    scenarioId: 'sc-pump-trip',
    scenarioName: 'Останов насоса нефти',
    mode: 'exam',
    status: 'finished',
    startedAt: new Date(Date.now() - 86400000).toISOString(),
    finishedAt: new Date(Date.now() - 83400000).toISOString(),
    speed: 1,
    reportId: 'rep-001',
  },
]
