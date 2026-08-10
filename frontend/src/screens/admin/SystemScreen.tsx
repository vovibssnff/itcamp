import { useEffect, useState } from 'react'
import { Pill } from '@/components/ui'
import { isMockApi } from '@/utils/env'

interface SystemMetric {
  label: string
  value: string | number
  unit?: string
  status?: 'ok' | 'warn' | 'error'
}

const INITIAL_METRICS: SystemMetric[] = [
  { label: 'Версия', value: '1.0.0', status: 'ok' },
  { label: 'Активные сессии', value: 1, status: 'ok' },
  { label: 'Клиентов', value: 2, status: 'ok' },
  { label: 'CPU', value: 12, unit: '%', status: 'ok' },
  { label: 'Память', value: 256, unit: 'МБ', status: 'ok' },
  { label: 'Время работы', value: '2д 14ч', status: 'ok' },
  { label: 'Соединений БД', value: 5, status: 'ok' },
  { label: 'Очередь сообщений', value: 0, status: 'ok' },
  { label: 'Шаблонов', value: 4, status: 'ok' },
]

const STATUS_COLOR: Record<string, string> = {
  ok: 'var(--ok)',
  warn: 'var(--warn)',
  error: 'var(--alarm)',
}

export default function SystemScreen() {
  const [metrics, setMetrics] = useState(INITIAL_METRICS)

  useEffect(() => {
    if (!isMockApi()) return
    const id = setInterval(() => {
      setMetrics((prev) =>
        prev.map((m) =>
          m.label === 'CPU' ? { ...m, value: Math.round(8 + Math.random() * 20) } : m,
        ),
      )
    }, 3000)
    return () => clearInterval(id)
  }, [])

  if (!isMockApi()) {
    return (
      <div className="wrap rise">
        <div className="sec">Администрирование</div>
        <h1 className="h1" style={{ marginTop: 12 }}>
          Системные метрики
        </h1>
        <p className="note" style={{ marginTop: 12 }}>
          API метрик платформы пока не подключён. Смотрите Grafana / Prometheus в
          compose/monitoring.
        </p>
      </div>
    )
  }

  return (
    <div className="wrap">
      <div className="rise" style={{ marginBottom: 24 }}>
        <div className="sec">Администрирование</div>
        <h1 className="h1" style={{ marginTop: 12 }}>
          Система
        </h1>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: 12,
        }}
      >
        {metrics.map((m) => (
          <div key={m.label} className="box rise" style={{ padding: 16 }}>
            <div style={{ fontSize: 12, color: 'var(--tx3)', marginBottom: 8 }}>{m.label}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ fontSize: 22, fontWeight: 600, color: 'var(--tx)' }}>
                {m.value}
                {m.unit ? (
                  <span style={{ fontSize: 12, color: 'var(--tx3)', marginLeft: 4 }}>{m.unit}</span>
                ) : null}
              </span>
              {m.status ? (
                <Pill variant={m.status === 'ok' ? 'ok' : m.status === 'warn' ? 'warn' : 'alarm'}>
                  <span style={{ color: STATUS_COLOR[m.status] }}>●</span>
                </Pill>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
