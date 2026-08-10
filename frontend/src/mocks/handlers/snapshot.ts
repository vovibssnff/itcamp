import { http, HttpResponse } from 'msw'

const PRESETS = [
  {
    id: 'preset-cold',
    session_id: '',
    name: 'Холодный пуск',
    description: 'Исходное состояние перед пуском',
    is_preset: true,
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'preset-warm',
    session_id: '',
    name: 'Тёплый пуск',
    description: 'Установка прогрета, насосы готовы',
    is_preset: true,
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'preset-normal',
    session_id: '',
    name: 'Рабочий режим',
    description: 'Полностью установившийся режим',
    is_preset: true,
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'snap-1',
    session_id: 'sess-001',
    name: 'Начало пуска',
    model_time: 120,
    is_preset: false,
    created_at: new Date(Date.now() - 600000).toISOString(),
  },
  {
    id: 'snap-2',
    session_id: 'sess-001',
    name: 'Выход на режим',
    model_time: 600,
    is_preset: false,
    created_at: new Date(Date.now() - 300000).toISOString(),
  },
]

export const snapshotHandlers = [
  http.get('/api/v1/snapshots', ({ request }) => {
    const url = new URL(request.url)
    const sessionId = url.searchParams.get('session_id')
    const items = sessionId
      ? PRESETS.filter((p) => !p.session_id || p.session_id === sessionId)
      : PRESETS
    return HttpResponse.json(items)
  }),

  http.get('/api/v1/snapshots/:id', ({ params }) => {
    const s = PRESETS.find((p) => p.id === params.id)
    if (!s) return HttpResponse.json({ error: 'Not found' }, { status: 404 })
    return HttpResponse.json(s)
  }),
]
