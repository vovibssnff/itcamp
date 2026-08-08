import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router'
import { Button, Modal, Progress, message } from 'antd'
import { StopOutlined } from '@ant-design/icons'
import { HmiCanvas } from '@/canvas/hmi/HmiCanvas'
import { Faceplate } from '@/canvas/hmi/Faceplate'
import { AlarmBanner } from '@/components/alarms/AlarmBanner'
import { useWebSocket } from '@/hooks/useWebSocket'
import { useSessionStore } from '@/store/session'
import type { CanvasNode } from '@/store/constructor'
import { COMPONENT_TYPES } from '@/mocks/fixtures/components'
import { TEMPLATES } from '@/mocks/fixtures/templates'
import { tokens } from '@/theme/tokens'

const EXAM_DURATION_S = 3600

export default function ExamScreen() {
  const { id: sessionId } = useParams<{ id: string }>()
  const containerRef = useRef<HTMLDivElement>(null)
  const [canvasSize, setCanvasSize] = useState({ w: 800, h: 500 })
  const [elapsed, setElapsed] = useState(0)
  const [selectedNode, setSelectedNode] = useState<CanvasNode | null>(null)
  const [faceplateOpen, setFaceplateOpen] = useState(false)
  const navigate = useNavigate()

  const { connected, send } = useWebSocket({
    sessionId: sessionId ?? null,
    channel: 'operator',
    enabled: !!sessionId,
  })
  const telemetry = useSessionStore((s) => s.telemetry)
  const regulators = useSessionStore((s) => s.regulators)
  const status = useSessionStore((s) => s.status)

  const template = TEMPLATES[0]!

  useEffect(() => {
    const id = setInterval(() => setElapsed((e) => e + 1), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (elapsed >= EXAM_DURATION_S) {
      void message.info('Время экзамена истекло')
      void navigate(`/reports/exam-${sessionId ?? 'test'}`)
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
  const percentDone = (elapsed / EXAM_DURATION_S) * 100
  const isWarning = remaining < 300

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <AlarmBanner />

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '4px 12px',
          background: tokens.bg.elevated,
          borderBottom: `1px solid ${tokens.border.subtle}`,
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontFamily: tokens.font.mono,
            fontSize: 12,
            color: tokens.accent.amber,
            fontWeight: 600,
            letterSpacing: '0.06em',
          }}
        >
          ЭКЗАМЕН
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
          <Progress
            percent={percentDone}
            showInfo={false}
            strokeColor={isWarning ? tokens.accent.red : tokens.accent.amber}
            trailColor={tokens.border.subtle}
            style={{ flex: 1 }}
          />
          <span
            style={{
              fontFamily: tokens.font.mono,
              fontSize: 14,
              color: isWarning ? tokens.accent.red : tokens.accent.amber,
              fontWeight: 600,
              minWidth: 50,
            }}
            className={isWarning ? 'alarm-pulse' : undefined}
          >
            {remainingStr}
          </span>
        </div>
        <Button
          size="small"
          type="text"
          style={{ color: tokens.text.muted, fontSize: 11 }}
          onClick={() => {
            Modal.confirm({
              title: 'Завершить экзамен досрочно?',
              content: 'Текущий результат будет зафиксирован.',
              okText: 'Завершить',
              cancelText: 'Продолжить',
              onOk: () => void navigate(`/reports/exam-${sessionId ?? 'test'}`),
            })
          }}
        >
          Завершить
        </Button>
        <Button
          size="small"
          danger
          icon={<StopOutlined />}
          onClick={() => send({ type: 'actuator', tag: 'ESD', value: 1 })}
        >
          ESD
        </Button>
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
    </div>
  )
}
