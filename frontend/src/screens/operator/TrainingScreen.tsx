import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router'
import { Button, Tabs, Tooltip, message } from 'antd'
import { AlertOutlined, LineChartOutlined, StopOutlined } from '@ant-design/icons'
import { HmiCanvas } from '@/canvas/hmi/HmiCanvas'
import { Faceplate } from '@/canvas/hmi/Faceplate'
import { AlarmBanner } from '@/components/alarms/AlarmBanner'
import { AlarmList } from '@/components/alarms/AlarmList'
import { TrendPanel } from '@/components/trends/TrendPanel'
import { useWebSocket } from '@/hooks/useWebSocket'
import { useSessionStore } from '@/store/session'
import type { CanvasNode } from '@/store/constructor'
import { COMPONENT_TYPES } from '@/mocks/fixtures/components'
import { TEMPLATES } from '@/mocks/fixtures/templates'
import { tokens } from '@/theme/tokens'

export default function TrainingScreen() {
  const { id: sessionId } = useParams<{ id: string }>()
  const containerRef = useRef<HTMLDivElement>(null)
  const [canvasSize, setCanvasSize] = useState({ w: 800, h: 500 })
  const [rightPanelTab, setRightPanelTab] = useState('alarms')
  const [selectedNode, setSelectedNode] = useState<CanvasNode | null>(null)
  const [faceplateOpen, setFaceplateOpen] = useState(false)

  const { connected, send } = useWebSocket({
    sessionId: sessionId ?? null,
    channel: 'operator',
    enabled: !!sessionId,
  })

  const telemetry = useSessionStore((s) => s.telemetry)
  const regulators = useSessionStore((s) => s.regulators)
  const status = useSessionStore((s) => s.status)

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

  function handleSendCommand(type: string, tag: string, value: number) {
    send({ type: 'actuator', tag, value })
  }

  async function handleESD() {
    if (!confirm('Выполнить аварийный останов (ESD)?')) return
    send({ type: 'actuator', tag: 'ESD', value: 1 })
    void message.warning('Команда аварийного останова отправлена', 5)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Alarm banner */}
      <AlarmBanner />

      {/* Top bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '4px 12px',
          borderBottom: `1px solid ${tokens.border.subtle}`,
          background: tokens.bg.elevated,
          flexShrink: 0,
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: connected ? tokens.accent.cyan : tokens.text.inactive,
            }}
          />
          <span
            style={{
              fontFamily: tokens.font.mono,
              fontSize: 11,
              color: connected ? tokens.accent.cyan : tokens.text.muted,
            }}
          >
            {connected ? 'ПОДКЛЮЧЕНО' : 'ОЖИДАНИЕ'}
          </span>
        </div>
        <span style={{ fontFamily: tokens.font.mono, fontSize: 11, color: tokens.text.dim }}>
          Сессия: {sessionId}
        </span>
        <span
          style={{
            fontFamily: tokens.font.mono,
            fontSize: 11,
            color: status === 'running' ? tokens.accent.cyan : tokens.accent.amber,
          }}
        >
          {status.toUpperCase()}
        </span>
        <div style={{ flex: 1 }} />
        <Tooltip title="Аварийный останов (ESD)">
          <Button danger size="small" icon={<StopOutlined />} onClick={() => void handleESD()}>
            ESD
          </Button>
        </Tooltip>
      </div>

      {/* Main split */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* HMI canvas */}
        <div ref={containerRef} style={{ flex: 1, overflow: 'hidden' }}>
          <HmiCanvas
            nodes={nodes}
            edges={edges}
            componentTypes={COMPONENT_TYPES}
            telemetry={telemetry}
            width={canvasSize.w}
            height={canvasSize.h}
            interactive={true}
            onNodeClick={handleNodeClick}
          />
        </div>

        {/* Right panel */}
        <div
          style={{
            width: 320,
            borderLeft: `1px solid ${tokens.border.subtle}`,
            background: tokens.bg.surface,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <Tabs
            activeKey={rightPanelTab}
            onChange={setRightPanelTab}
            size="small"
            tabBarStyle={{ padding: '0 8px', marginBottom: 0 }}
            items={[
              {
                key: 'alarms',
                label: (
                  <span>
                    <AlertOutlined /> Аварии
                  </span>
                ),
                children: <AlarmList maxHeight={500} />,
              },
              {
                key: 'trends',
                label: (
                  <span>
                    <LineChartOutlined /> Тренды
                  </span>
                ),
                children: (
                  <div style={{ padding: 8 }}>
                    <TrendPanel width={300} height={160} />
                  </div>
                ),
              },
            ]}
          />
        </div>
      </div>

      <Faceplate
        node={selectedNode}
        open={faceplateOpen}
        onClose={() => setFaceplateOpen(false)}
        telemetry={telemetry}
        regulators={regulators}
        onSendCommand={handleSendCommand}
      />
    </div>
  )
}
