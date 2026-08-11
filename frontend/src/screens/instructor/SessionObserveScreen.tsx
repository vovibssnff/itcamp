import { useParams } from 'react-router'
import { useRef, useEffect, useState } from 'react'
import { message } from 'antd'
import { HmiCanvas } from '@/canvas/hmi/HmiCanvas'
import { EloudAvtScheme } from '@/canvas/hmi/EloudAvtScheme'
import { AlarmBanner } from '@/components/alarms/AlarmBanner'
import { TrendPanel } from '@/components/trends/TrendPanel'
import { useWebSocket } from '@/hooks/useWebSocket'
import { useSessionStore, type ActiveAlarm } from '@/store/session'
import type { ComponentType, Template } from '@/types'
import { sessionsApi } from '@/api/sessions'
import { templatesApi } from '@/api/templates'
import { componentsApi } from '@/api/components'
import { isMockApi } from '@/utils/env'

export default function SessionObserveScreen() {
  const { id: sessionId } = useParams<{ id: string }>()
  const containerRef = useRef<HTMLDivElement>(null)
  const [canvasSize, setCanvasSize] = useState({ w: 800, h: 500 })
  const [template, setTemplate] = useState<Template | null>(null)
  const [componentTypes, setComponentTypes] = useState<ComponentType[]>([])
  const [loadError, setLoadError] = useState(false)

  useWebSocket({ sessionId: sessionId ?? null, channel: 'observe', enabled: !!sessionId })

  const telemetry = useSessionStore((s) => s.telemetry)
  const alarms = useSessionStore((s) => s.alarms)
  const status = useSessionStore((s) => s.status)
  const modelTime = useSessionStore((s) => s.modelTime)
  const speed = useSessionStore((s) => s.speed)

  useEffect(() => {
    if (!sessionId) return
    void (async () => {
      try {
        const [session, components] = await Promise.all([
          sessionsApi.get(sessionId),
          componentsApi.list(),
        ])
        if (components.length) setComponentTypes(components)
        if (session.templateId) {
          const tmpl = await templatesApi.get(session.templateId)
          setTemplate(tmpl)
        }
      } catch {
        if (isMockApi()) {
          // In mock mode fall back to fixture imports dynamically so the
          // real bundle doesn't include them.
          const [{ TEMPLATES }, { COMPONENT_TYPES }] = await Promise.all([
            import('@/mocks/fixtures/templates'),
            import('@/mocks/fixtures/components'),
          ])
          setTemplate(TEMPLATES[0] ?? null)
          setComponentTypes(COMPONENT_TYPES)
        } else {
          setLoadError(true)
        }
      }
    })()
  }, [sessionId])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const obs = new ResizeObserver(() => setCanvasSize({ w: el.clientWidth, h: el.clientHeight }))
    obs.observe(el)
    setCanvasSize({ w: el.clientWidth, h: el.clientHeight })
    return () => obs.disconnect()
  }, [])

  async function ackAlarm(alarmId: string) {
    if (!sessionId) return
    try {
      await sessionsApi.ackAlarm(sessionId, alarmId)
      void message.success('Аварийный сигнал квитирован')
    } catch {
      void message.error('Не удалось квитировать аларм')
    }
  }

  const modelTimeStr = new Date(modelTime * 1000).toISOString().substr(11, 8)

  if (loadError) {
    return (
      <div className="wrap rise" style={{ padding: 40 }}>
        <h2 className="h2">Не удалось загрузить данные сессии</h2>
        <p className="note" style={{ marginTop: 12 }}>
          Проверьте подключение к серверу и попробуйте обновить страницу.
        </p>
      </div>
    )
  }

  return (
    <div
      data-testid="session-observe"
      style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}
    >
      <AlarmBanner />
      <div className="topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div className="mark">
            <i />
            Наблюдение
          </div>
          <span className="chip">Сессия {sessionId}</span>
          <span
            className="chip"
            style={{ color: status === 'running' ? 'var(--acc-txt)' : 'var(--warn)' }}
          >
            {status.toUpperCase()}
          </span>
        </div>
        <span className="mono" style={{ fontSize: 13, color: 'var(--tx2)' }}>
          Время: {modelTimeStr} · {speed}×
        </span>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <div ref={containerRef} style={{ flex: 1, overflow: 'hidden' }}>
          {template?.scheme === 'elou-avt' ? (
            <EloudAvtScheme
              telemetry={telemetry}
              interactive={false}
              flowing={status === 'running'}
            />
          ) : template ? (
            <HmiCanvas
              nodes={template.nodes}
              edges={template.edges}
              componentTypes={componentTypes}
              telemetry={telemetry}
              width={canvasSize.w}
              height={canvasSize.h}
              interactive={false}
              flowing={status === 'running'}
            />
          ) : (
            <div className="loading-spinner" style={{ margin: 'auto', marginTop: 80 }} />
          )}
        </div>

        <div className="side" style={{ width: 320, overflowY: 'auto' }}>
          <TrendPanel width={300} height={160} />

          {/* Instructor alarm panel with REST ack */}
          {alarms.length > 0 && (
            <div style={{ padding: '12px 14px' }}>
              <div className="sec" style={{ marginBottom: 8, fontSize: 11, color: 'var(--alarm)' }}>
                АЛАРМ-ПАНЕЛЬ
              </div>
              {alarms.map((alarm: ActiveAlarm) => (
                <div
                  key={alarm.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 0',
                    borderBottom: '1px solid var(--ln)',
                    gap: 8,
                    opacity: alarm.acknowledged ? 0.5 : 1,
                  }}
                >
                  <div style={{ flex: 1, fontSize: 12 }}>
                    <span style={{ fontFamily: 'var(--mono)', color: 'var(--tx1)' }}>
                      {alarm.tag}
                    </span>
                    <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--tx3)' }}>
                      [{alarm.level}]
                    </span>
                    {alarm.message && (
                      <div style={{ fontSize: 11, color: 'var(--tx3)', marginTop: 2 }}>
                        {alarm.message}
                      </div>
                    )}
                  </div>
                  {!alarm.acknowledged && (
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ fontSize: 10, padding: '2px 8px' }}
                      onClick={() => void ackAlarm(alarm.id)}
                    >
                      Квит.
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
