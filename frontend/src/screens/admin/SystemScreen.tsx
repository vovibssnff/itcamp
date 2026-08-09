import { useEffect, useState } from 'react'
import { Pill } from '@/components/ui'

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
    const id = setInterval(() => {
      setMetrics((prev) =>
        prev.map((m) =>
          m.label === 'CPU' ? { ...m, value: Math.round(8 + Math.random() * 20) } : m,
        ),
      )
    }, 3000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="wrap">
      <div style={{ marginBottom: 28 }} className="rise">
        <div className="kick" style={{ marginBottom: 6 }}>
          Администрирование
        </div>
        <h1 className="h1">Система</h1>
        <p className="note" style={{ marginTop: 6 }}>
          Метрики сервера и инфраструктуры
        </p>
      </div>

      <div className="cell rise d2" style={{ padding: 0, overflow: 'hidden', marginBottom: 20 }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
          }}
        >
          {metrics.map((m, i) => (
            <div
              key={m.label}
              style={{
                padding: '18px 20px',
                borderRight: (i + 1) % 4 !== 0 ? '1px solid var(--ln)' : undefined,
                borderBottom: i < metrics.length - 4 ? '1px solid var(--ln)' : undefined,
              }}
            >
              <div className="mlbl">{m.label}</div>
              <div
                style={{
                  fontFamily: 'var(--mono)',
                  fontSize: 24,
                  fontWeight: 700,
                  color: m.status ? STATUS_COLOR[m.status] : 'var(--tx)',
                  letterSpacing: '-0.02em',
                  marginTop: 6,
                }}
              >
                {m.value}
                {m.unit && (
                  <span
                    style={{ fontSize: 12, fontWeight: 400, color: 'var(--tx3)', marginLeft: 4 }}
                  >
                    {m.unit}
                  </span>
                )}
              </div>
              <Pill
                variant={m.status === 'ok' ? 'ok' : m.status === 'warn' ? 'warn' : 'alarm'}
                style={{ marginTop: 8 }}
              >
                {m.status === 'ok' ? 'ОК' : m.status === 'warn' ? 'ВНИМАНИЕ' : 'ОШИБКА'}
              </Pill>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
