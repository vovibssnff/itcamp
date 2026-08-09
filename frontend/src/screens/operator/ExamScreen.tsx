import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router'
import { Modal } from 'antd'
import { HmiCanvas } from '@/canvas/hmi/HmiCanvas'
import { Faceplate } from '@/canvas/hmi/Faceplate'
import { AlarmBanner } from '@/components/alarms/AlarmBanner'
import { FloatingAiChat } from '@/components/ai/FloatingAiChat'
import { useWebSocket } from '@/hooks/useWebSocket'
import { useSessionStore } from '@/store/session'
import { useUIStore } from '@/store/ui'
import type { CanvasNode } from '@/store/constructor'
import { COMPONENT_TYPES } from '@/mocks/fixtures/components'
import { TEMPLATES } from '@/mocks/fixtures/templates'

const EXAM_DURATION_S = 3600

export default function ExamScreen() {
  const { id: sessionId } = useParams<{ id: string }>()
  const containerRef = useRef<HTMLDivElement>(null)
  const [canvasSize, setCanvasSize] = useState({ w: 800, h: 500 })
  const [elapsed, setElapsed] = useState(0)
  const [selectedNode, setSelectedNode] = useState<CanvasNode | null>(null)
  const [faceplateOpen, setFaceplateOpen] = useState(false)
  const navigate = useNavigate()
  const theme = useUIStore((s) => s.theme)
  const setTheme = useUIStore((s) => s.setTheme)

  const { send } = useWebSocket({
    sessionId: sessionId ?? null,
    channel: 'operator',
    enabled: !!sessionId,
  })
  const telemetry = useSessionStore((s) => s.telemetry)
  const regulators = useSessionStore((s) => s.regulators)

  const template = TEMPLATES[0]!

  useEffect(() => {
    const id = setInterval(() => setElapsed((e) => e + 1), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (elapsed >= EXAM_DURATION_S) {
      void navigate(`/reports/${sessionId ?? 'sess-001'}`)
    }
  }, [elapsed, sessionId, navigate])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const obs = new ResizeObserver(() => setCanvasSize({ w: el.clientWidth, h: el.clientHeight }))
    obs.observe(el)
    setCanvasSize({ w: el.clientWidth, h: el.clientHeight })
    return () => obs.disconnect()
  }, [])

  const remaining = EXAM_DURATION_S - elapsed
  const remainingStr = `${Math.floor(remaining / 60)
    .toString()
    .padStart(2, '0')}:${(remaining % 60).toString().padStart(2, '0')}`
  const isWarning = remaining < 300

  function handleFinish() {
    Modal.confirm({
      title: 'Завершить экзамен досрочно?',
      content: 'Текущий результат будет зафиксирован.',
      okText: 'Завершить',
      cancelText: 'Продолжить',
      onOk: () => void navigate(`/reports/${sessionId ?? 'sess-001'}`),
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <AlarmBanner />

      <div className="topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, minWidth: 0 }}>
          <div className="mark">
            <i />
          </div>
          <div className="h3">Квалификационный экзамен</div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 1, maxWidth: 420 }}>
          <div
            style={{
              flex: 1,
              height: 4,
              background: 'var(--srf3)',
              borderRadius: 'var(--r)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${(elapsed / EXAM_DURATION_S) * 100}%`,
                background: isWarning ? 'var(--alarm)' : 'var(--warn)',
                transition: 'width 1s linear',
              }}
            />
          </div>
          <span
            className={`mono${isWarning ? ' alarm-pulse' : ''}`}
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: isWarning ? 'var(--alarm)' : 'var(--warn)',
              minWidth: 50,
            }}
          >
            {remainingStr}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
          <div className="seg seg-mono">
            <div
              onClick={() => setTheme('dark')}
              style={{
                background: theme === 'dark' ? 'var(--acc)' : undefined,
                color: theme === 'dark' ? 'var(--acc-ink)' : undefined,
              }}
            >
              Тёмная
            </div>
            <div
              onClick={() => setTheme('light')}
              style={{
                background: theme === 'light' ? 'var(--acc)' : undefined,
                color: theme === 'light' ? 'var(--acc-ink)' : undefined,
              }}
            >
              Светлая
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={handleFinish}>
            Завершить
          </button>
        </div>
      </div>

      <div ref={containerRef} style={{ flex: 1, overflow: 'hidden' }}>
        <HmiCanvas
          nodes={template.nodes}
          edges={template.edges}
          componentTypes={COMPONENT_TYPES}
          telemetry={telemetry}
          width={canvasSize.w}
          height={canvasSize.h}
          interactive={true}
          onNodeClick={(node) => {
            setSelectedNode(node)
            setFaceplateOpen(true)
          }}
        />
      </div>

      <Faceplate
        node={selectedNode}
        open={faceplateOpen}
        onClose={() => setFaceplateOpen(false)}
        telemetry={telemetry}
        regulators={regulators}
        onSendCommand={(type, tag, value) => send({ type: 'actuator', tag, value })}
      />

      {/* AI hints are disabled during the qualification exam (reference behaviour) */}
      <FloatingAiChat
        disabled
        disabledLabel="Подсказки ИИ отключены — режим квалификационного экзамена"
      />
    </div>
  )
}
