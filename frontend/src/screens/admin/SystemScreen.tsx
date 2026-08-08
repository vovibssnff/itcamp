import { useEffect, useState } from 'react'
import { Card, Col, Row, Typography, Tag } from 'antd'
import { tokens } from '@/theme/tokens'

const { Title, Text } = Typography

interface SystemMetric {
  label: string
  value: string | number
  unit?: string
  status?: 'ok' | 'warn' | 'error'
}

const MOCK_METRICS: SystemMetric[] = [
  { label: 'Версия приложения', value: '1.0.0', status: 'ok' },
  { label: 'Активные сессии', value: 1, status: 'ok' },
  { label: 'Подключённых клиентов', value: 2, status: 'ok' },
  { label: 'Загрузка CPU', value: 12, unit: '%', status: 'ok' },
  { label: 'Использование памяти', value: 256, unit: 'MB', status: 'ok' },
  { label: 'Время работы', value: '2д 14ч 32м', status: 'ok' },
  { label: 'БД соединений', value: 5, status: 'ok' },
  { label: 'Очередь сообщений', value: 0, status: 'ok' },
]

const STATUS_COLORS = {
  ok: tokens.accent.cyan,
  warn: tokens.accent.amber,
  error: tokens.accent.red,
}

export default function SystemScreen() {
  const [metrics, setMetrics] = useState(MOCK_METRICS)

  useEffect(() => {
    const id = setInterval(() => {
      setMetrics((prev) =>
        prev.map((m) =>
          m.label === 'Загрузка CPU' ? { ...m, value: Math.round(8 + Math.random() * 20) } : m,
        ),
      )
    }, 3000)
    return () => clearInterval(id)
  }, [])

  return (
    <div style={{ padding: 24 }}>
      <Title level={4} style={{ color: tokens.text.primary }}>
        Система
      </Title>
      <Text style={{ color: tokens.text.muted, fontSize: 12 }}>
        Метрики сервера и инфраструктуры
      </Text>

      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        {metrics.map((m) => (
          <Col key={m.label} xs={24} sm={12} md={6}>
            <Card
              style={{
                background: tokens.bg.surface,
                border: `1px solid ${tokens.border.subtle}`,
              }}
              bodyStyle={{ padding: 16 }}
            >
              <Text
                style={{
                  fontSize: 11,
                  color: tokens.text.muted,
                  display: 'block',
                  marginBottom: 6,
                }}
              >
                {m.label}
              </Text>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span
                  style={{
                    fontFamily: tokens.font.mono,
                    fontSize: 22,
                    color: m.status ? STATUS_COLORS[m.status] : tokens.text.primary,
                    fontWeight: 600,
                  }}
                >
                  {m.value}
                </span>
                {m.unit && <span style={{ fontSize: 11, color: tokens.text.dim }}>{m.unit}</span>}
              </div>
              {m.status && (
                <Tag
                  color={m.status === 'ok' ? 'success' : m.status === 'warn' ? 'warning' : 'error'}
                  style={{ marginTop: 8, fontSize: 10 }}
                >
                  {m.status === 'ok' ? 'ОК' : m.status === 'warn' ? 'ПРЕДУПРЕЖДЕНИЕ' : 'ОШИБКА'}
                </Tag>
              )}
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  )
}
