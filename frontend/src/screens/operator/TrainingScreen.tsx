import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router'
import { HmiCanvas } from '@/canvas/hmi/HmiCanvas'
import { EloudAvtScheme } from '@/canvas/hmi/EloudAvtScheme'
import { Faceplate } from '@/canvas/hmi/Faceplate'
import { AlarmBanner } from '@/components/alarms/AlarmBanner'
import { TrendPanel } from '@/components/trends/TrendPanel'
import { AiAlarmChat } from '@/components/ai/AiAlarmChat'
import { useWebSocket } from '@/hooks/useWebSocket'
import { useSessionStore } from '@/store/session'
import { useUIStore } from '@/store/ui'
import type { CanvasNode } from '@/store/constructor'
import { COMPONENT_TYPES, type ComponentType } from '@/mocks/fixtures/components'
import { TEMPLATES, type Template } from '@/mocks/fixtures/templates'
import { message } from 'antd'
import { sessionsApi } from '@/api/sessions'
import { templatesApi } from '@/api/templates'
import { componentsApi } from '@/api/components'
import { reportsApi } from '@/api/reports'
import { toErrorMessage } from '@/api/errors'
import { isMockApi } from '@/utils/env'

const STATUS_LABELS: Record<string, string> = {
  idle: 'Ожидание',
  running: 'Идёт',
  paused: 'Пауза',
  stopped: 'Остановлена',
  finished: 'Завершена',
}

export default function TrainingScreen() {
  const { id: sessionId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const containerRef = useRef<HTMLDivElement>(null)
  const [canvasSize, setCanvasSize] = useState({ w: 800, h: 500 })
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [selectedNode, setSelectedNode] = useState<CanvasNode | null>(null)
  const [faceplateOpen, setFaceplateOpen] = useState(false)
  const [started, setStarted] = useState(false)

  const { connected, send } = useWebSocket({
    sessionId: sessionId ?? null,
    channel: 'operator',
    // Alarms/telemetry only start flowing once the operator explicitly
    // starts the lesson — before that it's a view-only mnemonic (reference:
    // ktk.html "Режим просмотра — тревоги не поступают").
    enabled: started && !!sessionId,
  })

  const telemetry = useSessionStore((s) => s.telemetry)
  const regulators = useSessionStore((s) => s.regulators)
  const status = useSessionStore((s) => s.status)
  const clearSession = useSessionStore((s) => s.clearSession)
  const theme = useUIStore((s) => s.theme)
  const setTheme = useUIStore((s) => s.setTheme)

  const [template, setTemplate] = useState<Template>(TEMPLATES[0]!)
  const [componentTypes, setComponentTypes] = useState<ComponentType[]>(COMPONENT_TYPES)

  useEffect(() => {
    clearSession()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!sessionId) return
    void (async () => {
      try {
        const session = await sessionsApi.get(sessionId)
        try {
          const components = await componentsApi.list()
          if (components.length) setComponentTypes(components)
        } catch {
          /* operators may lack components role — keep demo types */
        }
        if (session.templateId) {
          try {
            setTemplate(await templatesApi.get(session.templateId))
          } catch {
            if (!isMockApi()) {
              void message.warning('Не удалось загрузить шаблон установки — показан демо-вид')
            }
          }
        }
      } catch (err) {
        if (!isMockApi()) {
          void message.error(toErrorMessage(err, 'Не удалось загрузить сессию'))
        }
      }
    })()
  }, [sessionId])

  const nodes = template.nodes
  const edges = template.edges

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const obs = new ResizeObserver(() => {
      setCanvasSize({ w: el.clientWidth, h: el.clientHeight })
    })
    obs.observe(el)
    setCanvasSize({ w: el.clientWidth, h: el.clientHeight })
    return () => obs.disconnect()
  }, [])

  function handleNodeClick(node: CanvasNode) {
    setSelectedNode(node)
    setFaceplateOpen(true)
  }

  function handleSendCommand(_type: string, tag: string, value: number) {
    send({ type: 'actuator', tag, value })
  }

  async function handleStart() {
    if (!sessionId) return
    try {
      // Instructor may already have started the session — join without re-start.
      const session = await sessionsApi.get(sessionId)
      if (session.status === 'idle') {
        await sessionsApi.action(sessionId, 'start')
      }
      setStarted(true)
    } catch (err) {
      void message.error(toErrorMessage(err, 'Не удалось начать тренировку'))
    }
  }

  async function handleFinish() {
    if (!sessionId) return
    try {
      await sessionsApi.action(sessionId, 'stop')
      try {
        await reportsApi.create(sessionId, 'session')
      } catch {
        /* report may already exist or queue later */
      }
      void navigate(`/reports/${sessionId}`)
    } catch (err) {
      void message.error(toErrorMessage(err, 'Не удалось завершить сессию'))
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Alarm banner */}
      <AlarmBanner />

      {/* Top bar (matches ktk.html reference `.topbar`) */}
      <div className="topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, minWidth: 0 }}>
          <div className="mark">
            <i />
          </div>
          <div
            className="h3"
            style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
          >
            Самостоятельная тренировка
          </div>
          <span
            className="chip"
            style={{
              borderColor: 'transparent',
              paddingLeft: 0,
              color: connected ? 'var(--acc-txt)' : 'var(--tx3)',
            }}
          >
            {connected ? 'ПОДКЛЮЧЕНО' : 'ОЖИДАНИЕ'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
          {!started && (
            <span className="note" style={{ fontSize: 11.5 }}>
              Режим просмотра — тревоги не поступают
            </span>
          )}
          {started && (
            <span
              className="chip"
              style={{ color: status === 'running' ? 'var(--acc-txt)' : 'var(--warn)' }}
            >
              {STATUS_LABELS[status] ?? status}
            </span>
          )}
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
          {!started && (
            <button
              className="btn btn-acc btn-sm"
              data-testid="training-start"
              onClick={() => void handleStart()}
            >
              Начать тренировку
            </button>
          )}
        </div>
      </div>

      {/* Main split */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* HMI canvas */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div ref={containerRef} style={{ flex: 1, overflow: 'hidden' }}>
            {template.scheme === 'elou-avt' ? (
              <EloudAvtScheme
                telemetry={telemetry}
                interactive={started}
                flowing={started && status === 'running'}
                onNodeClick={handleNodeClick}
              />
            ) : (
              <HmiCanvas
                nodes={nodes}
                edges={edges}
                componentTypes={componentTypes}
                telemetry={telemetry}
                width={canvasSize.w}
                height={canvasSize.h}
                interactive={started}
                flowing={started && status === 'running'}
                onNodeClick={handleNodeClick}
              />
            )}
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 16,
              padding: '11px 18px',
              borderTop: '1px solid var(--ln)',
              flexShrink: 0,
              background: 'var(--srf)',
            }}
          >
            <button
              className="btn btn-acc btn-sm"
              onClick={() => void handleFinish()}
              disabled={!started}
            >
              Завершить тренировку
            </button>
          </div>
        </div>

        {/* Collapsed rail */}
        {sidebarCollapsed && (
          <div className="rail" onClick={() => setSidebarCollapsed(false)}>
            <span>◂ Панель</span>
          </div>
        )}

        {/* Right sidebar — matches reference `.side` layout */}
        {!sidebarCollapsed && (
          <div className="side" style={{ width: 340 }}>
            {/* Sidebar header */}
            <div
              className="side-hd"
              onClick={() => setSidebarCollapsed(true)}
              style={{ borderBottom: '1px solid var(--ln)' }}
            >
              <span className="sec">Панель оператора</span>
              <span className="sec">Свернуть ▸</span>
            </div>

            {/* 01 · Trends with sparklines */}
            <TrendPanel />

            {/* 02 · Merged AI assistant — proactive alarm hints + free-form Q&A */}
            <div
              style={{
                flex: 1,
                minHeight: 0,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div
                className="side-hd"
                style={{ borderBottom: '1px solid var(--ln)', cursor: 'default' }}
              >
                <span className="sec">
                  <span style={{ color: 'var(--tx4)' }}>02</span>&nbsp;&nbsp;ИИ-ассистент
                </span>
              </div>
              <div style={{ flex: 1, minHeight: 0 }}>
                <AiAlarmChat />
              </div>
            </div>
          </div>
        )}
      </div>

      <Faceplate
        node={selectedNode}
        componentTypes={componentTypes}
        open={faceplateOpen}
        onClose={() => setFaceplateOpen(false)}
        telemetry={telemetry}
        regulators={regulators}
        onSendCommand={handleSendCommand}
      />
    </div>
  )
}
