import { http, HttpResponse } from 'msw'

const PRESETS = [
  {
    id: 'preset-cold',
    label: 'Холодный пуск',
    description: 'Исходное состояние перед пуском',
    type: 'preset',
  },
  {
    id: 'preset-warm',
    label: 'Тёплый пуск',
    description: 'Установка прогрета, насосы готовы',
    type: 'preset',
  },
  {
    id: 'preset-normal',
    label: 'Рабочий режим',
    description: 'Полностью установившийся режим',
    type: 'preset',
  },
]

export const snapshotHandlers = [
  http.get('/api/snapshots', () => {
    return HttpResponse.json(PRESETS)
  }),

  http.get('/api/snapshots/:id', ({ params }) => {
    const s = PRESETS.find((p) => p.id === params.id)
    if (!s) return HttpResponse.json({ error: 'Not found' }, { status: 404 })
    return HttpResponse.json(s)
  }),
]
