import { useState } from 'react'
import { useParams } from 'react-router'
import { Slider, Button, Typography } from 'antd'
import { PlayCircleOutlined, PauseCircleOutlined, StepBackwardOutlined } from '@ant-design/icons'
import { tokens } from '@/theme/tokens'

const { Text } = Typography

const REPLAY_EVENTS = [
  { time: 120, type: 'alarm', description: 'HH по TI-201', severity: 'critical' },
  { time: 180, type: 'action', description: 'Переключение на ручной режим TRC-201' },
  { time: 240, type: 'penalty', description: 'Задержка реакции > 60с' },
  { time: 360, type: 'action', description: 'Стабилизация температуры' },
]

export default function ReplayScreen() {
  const { id } = useParams<{ id: string }>()
  const [position, setPosition] = useState(0)
  const [playing, setPlaying] = useState(false)
  const duration = 900

  const timeStr = `${Math.floor(position / 60)
    .toString()
    .padStart(2, '0')}:${(position % 60).toString().padStart(2, '0')}`

  const currentEvents = REPLAY_EVENTS.filter((e) => e.time <= position)

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 24px' }}>
      <Typography.Title level={4} style={{ color: tokens.text.primary }}>
        Воспроизведение · Отчёт {id}
      </Typography.Title>

      {/* Timeline */}
      <div
        style={{
          background: tokens.bg.surface,
          border: `1px solid ${tokens.border.subtle}`,
          borderRadius: tokens.radius.lg,
          padding: '24px 24px 16px',
          marginBottom: 24,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <Button icon={<StepBackwardOutlined />} size="small" onClick={() => setPosition(0)} />
          <Button
            icon={playing ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
            size="small"
            type="primary"
            onClick={() => setPlaying((p) => !p)}
          />
          <Text style={{ fontFamily: tokens.font.mono, color: tokens.accent.cyan, fontSize: 16 }}>
            {timeStr}
          </Text>
          <Text style={{ color: tokens.text.dim, fontSize: 12 }}>
            / {Math.floor(duration / 60)}:{String(duration % 60).padStart(2, '0')}
          </Text>
        </div>

        <Slider
          min={0}
          max={duration}
          value={position}
          onChange={setPosition}
          tooltip={{
            formatter: (v) =>
              `${Math.floor((v ?? 0) / 60)}:${String((v ?? 0) % 60).padStart(2, '0')}`,
          }}
          marks={REPLAY_EVENTS.reduce<
            Record<number, { style: React.CSSProperties; label: string }>
          >((acc, e) => {
            acc[e.time] = {
              style: {
                color:
                  e.type === 'alarm'
                    ? tokens.accent.red
                    : e.type === 'penalty'
                      ? tokens.accent.amber
                      : tokens.accent.cyan,
              },
              label: '|',
            }
            return acc
          }, {})}
        />
      </div>

      {/* Event log */}
      <div
        style={{
          background: tokens.bg.surface,
          border: `1px solid ${tokens.border.subtle}`,
          borderRadius: tokens.radius.lg,
          padding: 20,
        }}
      >
        <Typography.Title level={5} style={{ color: tokens.text.primary, margin: '0 0 12px' }}>
          Журнал событий
        </Typography.Title>
        {currentEvents.length === 0 && (
          <Text style={{ color: tokens.text.inactive, fontSize: 12 }}>Нет событий</Text>
        )}
        {currentEvents.map((e, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              gap: 12,
              padding: '6px 0',
              borderBottom: `1px solid ${tokens.border.subtle}`,
              alignItems: 'center',
            }}
          >
            <Text
              style={{
                fontFamily: tokens.font.mono,
                fontSize: 11,
                color: tokens.text.dim,
                minWidth: 40,
              }}
            >
              {Math.floor(e.time / 60)
                .toString()
                .padStart(2, '0')}
              :{String(e.time % 60).padStart(2, '0')}
            </Text>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background:
                  e.type === 'alarm'
                    ? tokens.accent.red
                    : e.type === 'penalty'
                      ? tokens.accent.amber
                      : tokens.accent.cyan,
                flexShrink: 0,
              }}
            />
            <Text style={{ fontSize: 12, color: tokens.text.secondary }}>{e.description}</Text>
          </div>
        ))}
      </div>
    </div>
  )
}
