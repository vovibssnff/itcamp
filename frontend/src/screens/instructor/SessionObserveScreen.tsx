import { useParams } from 'react-router'
import { useRef, useEffect, useState } from 'react'
import { HmiCanvas } from '@/canvas/hmi/HmiCanvas'
import { EloudAvtScheme } from '@/canvas/hmi/EloudAvtScheme'
import { AlarmBanner } from '@/components/alarms/AlarmBanner'
import { TrendPanel } from '@/components/trends/TrendPanel'
import { useWebSocket } from '@/hooks/useWebSocket'
import { useSessionStore } from '@/store/session'
import { COMPONENT_TYPES } from '@/mocks/fixtures/components'
import { TEMPLATES } from '@/mocks/fixtures/templates'

export default function SessionObserveScreen() {
  const { id: sessionId } = useParams<{ id: string }>()
  const containerRef = useRef<HTMLDivElement>(null)
  const [canvasSize, setCanvasSize] = useState({ w: 800, h: 500 })

  useWebSocket({ sessionId: sessionId ?? null, channel: 'observe', enabled: !!sessionId })

  const telemetry = useSessionStore((s) => s.telemetry)
  const status = useSessionStore((s) => s.status)
  const modelTime = useSessionStore((s) => s.modelTime)
  const speed = useSessionStore((s) => s.speed)

  const template = TEMPLATES[0]!

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const obs = new ResizeObserver(() => setCanvasSize({ w: el.clientWidth, h: el.clientHeight }))
    obs.observe(el)
    setCanvasSize({ w: el.clientWidth, h: el.clientHeight })
    return () => obs.disconnect()
  }, [])

  const modelTimeStr = new Date(modelTime * 1000).toISOString().substr(11, 8)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
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
          {template.scheme === 'elou-avt' ? (
            <EloudAvtScheme
              telemetry={telemetry}
              interactive={false}
              flowing={status === 'running'}
            />
          ) : (
            <HmiCanvas
              nodes={template.nodes}
              edges={template.edges}
              componentTypes={COMPONENT_TYPES}
              telemetry={telemetry}
              width={canvasSize.w}
              height={canvasSize.h}
              interactive={false}
              flowing={status === 'running'}
            />
          )}
        </div>

        <div className="side" style={{ width: 320 }}>
          <TrendPanel width={300} height={160} />
        </div>
      </div>
    </div>
  )
}
