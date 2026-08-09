import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router'
import { HmiCanvas } from '@/canvas/hmi/HmiCanvas'
import { Faceplate } from '@/canvas/hmi/Faceplate'
import { AlarmBanner } from '@/components/alarms/AlarmBanner'
import { AlarmList } from '@/components/alarms/AlarmList'
import { TrendPanel } from '@/components/trends/TrendPanel'
import { FloatingAiChat } from '@/components/ai/FloatingAiChat'
import { useWebSocket } from '@/hooks/useWebSocket'
import { useSessionStore } from '@/store/session'
import { useUIStore } from '@/store/ui'
import type { CanvasNode } from '@/store/constructor'
import { COMPONENT_TYPES } from '@/mocks/fixtures/components'
import { TEMPLATES } from '@/mocks/fixtures/templates'

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
  const [showLog, setShowLog] = useState(true)
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

  useEffect(() => {
    clearSession()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Use demo template layout
  const template = TEMPLATES[0]!
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

  function handleFinish() {
    void navigate(`/reports/${sessionId ?? 'sess-001'}`)
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
            <button className="btn btn-acc btn-sm" onClick={() => setStarted(true)}>
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
            <HmiCanvas
              nodes={nodes}
              edges={edges}
              componentTypes={COMPONENT_TYPES}
              telemetry={telemetry}
              width={canvasSize.w}
              height={canvasSize.h}
              interactive={started}
              onNodeClick={handleNodeClick}
            />
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
              padding: '11px 18px',
              borderTop: '1px solid var(--ln)',
              flexShrink: 0,
              background: 'var(--srf)',
            }}
          >
            <label
              style={{
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 12.5,
                color: 'var(--tx2)',
              }}
            >
              <input
                type="checkbox"
                checked={showLog}
                onChange={(e) => setShowLog(e.target.checked)}
              />
              Журнал аварий
            </label>
            <button className="btn btn-acc btn-sm" onClick={handleFinish} disabled={!started}>
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

            {/* 02 · Alarms journal */}
            {showLog && (
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
                    <span style={{ color: 'var(--tx4)' }}>02</span>&nbsp;&nbsp;Журнал аварий
                  </span>
                </div>
                <div style={{ flex: 1, overflow: 'auto' }}>
                  <AlarmList maxHeight={999} />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <Faceplate
        node={selectedNode}
        open={faceplateOpen}
        onClose={() => setFaceplateOpen(false)}
        telemetry={telemetry}
        regulators={regulators}
        onSendCommand={handleSendCommand}
      />

      {/* Floating ИИ-ассистент (reference: плавающий чат ИИ-ассистента) */}
      <FloatingAiChat />
    </div>
  )
}
