import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router'
import { Modal, message } from 'antd'
import { HmiCanvas } from '@/canvas/hmi/HmiCanvas'
import { Faceplate } from '@/canvas/hmi/Faceplate'
import { AlarmBanner } from '@/components/alarms/AlarmBanner'
import { FloatingAiChat } from '@/components/ai/FloatingAiChat'
import { useWebSocket } from '@/hooks/useWebSocket'
import { useSessionStore } from '@/store/session'
import { useUIStore } from '@/store/ui'
import type { CanvasNode } from '@/store/constructor'
import { COMPONENT_TYPES, type ComponentType } from '@/mocks/fixtures/components'
import { TEMPLATES, type Template } from '@/mocks/fixtures/templates'
import { sessionsApi } from '@/api/sessions'
import { templatesApi } from '@/api/templates'
import { componentsApi } from '@/api/components'
import { reportsApi } from '@/api/reports'
import { toErrorMessage } from '@/api/errors'
import { isMockApi } from '@/utils/env'

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

  const [sessionReady, setSessionReady] = useState(false)
  const { send } = useWebSocket({
    sessionId: sessionId ?? null,
    channel: 'operator',
    enabled: sessionReady && !!sessionId,
  })
  const telemetry = useSessionStore((s) => s.telemetry)
  const regulators = useSessionStore((s) => s.regulators)

  const [template, setTemplate] = useState<Template>(TEMPLATES[0]!)
  const [componentTypes, setComponentTypes] = useState<ComponentType[]>(COMPONENT_TYPES)

  useEffect(() => {
    if (!sessionId) return
    void (async () => {
      try {
        const session = await sessionsApi.get(sessionId)
        try {
          const components = await componentsApi.list()
          if (components.length) setComponentTypes(components)
        } catch {
          /* optional for operators */
        }
        if (session.templateId) {
          try {
            setTemplate(await templatesApi.get(session.templateId))
          } catch {
            if (!isMockApi()) {
              void message.warning('Не удалось загрузить шаблон — показан демо-вид')
            }
          }
        }
        // Backend "created" is mapped to "idle" for the SPA.
        let startedAt = session.startedAt
        if (session.status === 'idle') {
          const started = await sessionsApi.action(sessionId, 'start')
          startedAt = started.startedAt ?? startedAt
        }
        // Seed wall-clock from server started_at so remount/refresh cannot
        // reset the exam duration budget.
        if (startedAt) {
          const elapsedSec = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)
          setElapsed(Math.min(EXAM_DURATION_S, Math.max(0, elapsedSec)))
        }
        setSessionReady(true)
      } catch (err) {
        if (!isMockApi()) {
          void message.error(toErrorMessage(err, 'Не удалось запустить экзамен'))
        } else {
          setSessionReady(true)
        }
      }
    })()
  }, [sessionId])

  useEffect(() => {
    if (!sessionReady) return
    const id = setInterval(() => setElapsed((e) => e + 1), 1000)
    return () => clearInterval(id)
  }, [sessionReady])

  async function finishExam() {
    if (!sessionId) return
    try {
      await sessionsApi.action(sessionId, 'stop')
      try {
        await reportsApi.create(sessionId, 'exam')
      } catch {
        /* ignore duplicate / queue errors */
      }
      void navigate(`/reports/${sessionId}`)
    } catch (err) {
      void message.error(toErrorMessage(err, 'Не удалось завершить экзамен'))
    }
  }

  useEffect(() => {
    if (elapsed >= EXAM_DURATION_S) {
      void finishExam()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsed, sessionId])

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
      onOk: () => finishExam(),
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <AlarmBanner />

      <div className="topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, minWidth: 0 }}>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => void navigate(`/sessions/${sessionId}/mode`)}
          >
            ← Назад
          </button>
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
          <button className="btn btn-ghost btn-sm" data-testid="exam-finish" onClick={handleFinish}>
            Завершить
          </button>
        </div>
      </div>

      <div ref={containerRef} style={{ flex: 1, overflow: 'hidden' }}>
        <HmiCanvas
          nodes={template.nodes}
          edges={template.edges}
          componentTypes={componentTypes}
          telemetry={telemetry}
          width={canvasSize.w}
          height={canvasSize.h}
          interactive={true}
          flowing
          onNodeClick={(node) => {
            setSelectedNode(node)
            setFaceplateOpen(true)
          }}
        />
      </div>

      <Faceplate
        node={selectedNode}
        componentTypes={componentTypes}
        open={faceplateOpen}
        onClose={() => setFaceplateOpen(false)}
        telemetry={telemetry}
        regulators={regulators}
        onSendCommand={(type, tag, value) => {
          if (type === 'regulator_sp') {
            send({ type: 'regulator_sp', tag, sp: value })
          } else if (type === 'regulator_out') {
            send({ type: 'regulator_out', tag, out: value })
          } else if (type === 'regulator_mode') {
            send({ type: 'regulator_mode', tag, mode: value === 1 ? 'auto' : 'manual' })
          } else {
            send({ type: 'actuator', tag, value })
          }
          if (sessionId) {
            void sessionsApi.actuator(sessionId, tag, value).catch(() => {})
          }
        }}
      />

      {/* AI hints are disabled during the qualification exam (reference behaviour) */}
      <FloatingAiChat
        disabled
        disabledLabel="Подсказки ИИ отключены — режим квалификационного экзамена"
      />
    </div>
  )
}
