import { Group, Rect, Text, Circle, Line } from 'react-konva'
import type { CanvasNode } from '@/store/constructor'
import type { TagValue } from '@/store/session'
import { type CanvasTokens } from '@/theme/tokens'
import { useCanvasTokens } from '@/theme/useCanvasTokens'

interface NodeWidgetProps {
  node: CanvasNode
  telemetry: Record<string, TagValue>
  isSelected: boolean
  onClick: () => void
  interactive: boolean
}

function makeAlarmColors(tk: CanvasTokens): Record<string, string> {
  return {
    normal: tk.text.muted,
    L: tk.zone.gdm,
    LL: tk.zone.k1,
    H: tk.warn,
    HH: tk.alarm,
  }
}

const NODE_W = 88
const NODE_H = 66

export function NodeWidget({ node, telemetry, isSelected, onClick, interactive }: NodeWidgetProps) {
  const canvasTokens = useCanvasTokens()
  const ALARM_COLORS = makeAlarmColors(canvasTokens)
  const READOUT_BG = canvasTokens.readout
  const MONO = canvasTokens.font.mono

  const primaryTag = Object.values(telemetry).find(
    (t) =>
      t.tag.includes(node.label.toUpperCase()) ||
      t.tag.replace(/[^A-Z0-9]/g, '').includes(node.label.replace(/[^A-Z0-9]/g, '')),
  )

  const alarmState = primaryTag?.alarmState ?? 'normal'
  const alarmColor = ALARM_COLORS[alarmState] ?? canvasTokens.text.muted
  const isAlarm = alarmState !== 'normal'
  const isCrit = alarmState === 'HH'

  // Derive zone color from node data or use accent
  const zoneColor = node.data?.zoneColor as string | undefined
  const stripeColor = isAlarm ? alarmColor : (zoneColor ?? canvasTokens.accent)

  return (
    <Group
      x={node.x}
      y={node.y}
      onClick={interactive ? onClick : undefined}
      style={{ cursor: interactive ? 'pointer' : 'default' }}
    >
      {/* Alarm glow */}
      {(isSelected || isCrit) && (
        <Rect
          x={-4}
          y={-4}
          width={NODE_W + 8}
          height={NODE_H + 8}
          cornerRadius={3}
          stroke={isCrit ? canvasTokens.alarm : canvasTokens.accent}
          strokeWidth={1.5}
          shadowColor={isCrit ? canvasTokens.alarm : canvasTokens.accent}
          shadowBlur={isCrit ? 14 : 7}
          shadowOpacity={0.75}
          listening={false}
        />
      )}

      {/* Node body */}
      <Rect
        x={0}
        y={0}
        width={NODE_W}
        height={NODE_H}
        fill={canvasTokens.bg.surface}
        stroke={isAlarm ? alarmColor : canvasTokens.border.subtle}
        strokeWidth={1}
        cornerRadius={2}
      />

      {/* Category / zone stripe (left edge) */}
      <Rect x={0} y={0} width={3} height={NODE_H} fill={stripeColor} cornerRadius={[2, 0, 0, 2]} />

      {/* Label */}
      <Text
        x={8}
        y={8}
        text={node.label}
        fontSize={10}
        fill={canvasTokens.text.secondary}
        fontFamily={MONO}
        fontStyle="500"
        listening={false}
      />

      {/* Readout box (near-black bg, bright mono value) */}
      <Rect
        x={8}
        y={24}
        width={NODE_W - 16}
        height={22}
        fill={READOUT_BG}
        cornerRadius={2}
        listening={false}
      />
      <Text
        x={10}
        y={29}
        text={primaryTag ? primaryTag.value.toFixed(1) : '—'}
        fontSize={13}
        fontStyle="700"
        fill={isAlarm ? alarmColor : canvasTokens.text.primary}
        fontFamily={MONO}
        listening={false}
      />

      {/* Unit */}
      <Text
        x={8}
        y={NODE_H - 13}
        text={primaryTag?.unit ?? ''}
        fontSize={8}
        fill={canvasTokens.text.dim}
        fontFamily={MONO}
        listening={false}
      />

      {/* Alarm dot */}
      {isAlarm && <Circle x={NODE_W - 8} y={9} radius={4} fill={alarmColor} listening={false} />}

      {/* Selected ring */}
      {isSelected && !isCrit && (
        <Rect
          x={-2}
          y={-2}
          width={NODE_W + 4}
          height={NODE_H + 4}
          cornerRadius={3}
          stroke={canvasTokens.accent}
          strokeWidth={1}
          listening={false}
        />
      )}
    </Group>
  )
}

export function ValveWidget({
  node,
  telemetry,
  isSelected,
  onClick,
  interactive,
}: NodeWidgetProps) {
  const canvasTokens = useCanvasTokens()
  const MONO = canvasTokens.font.mono
  const tag = Object.values(telemetry).find((t) => t.tag.includes(node.label))
  const isOpen = tag ? tag.value > 50 : true

  const S = 32

  return (
    <Group x={node.x} y={node.y} onClick={interactive ? onClick : undefined}>
      {isSelected && (
        <Rect
          x={-4}
          y={-4}
          width={S + 8}
          height={S + 8}
          stroke={canvasTokens.accent}
          strokeWidth={1}
          cornerRadius={2}
          listening={false}
        />
      )}

      {/* Bowtie valve chevrons */}
      <Line
        points={[0, 0, S, S, S, 0, 0, S]}
        closed
        fill={isOpen ? 'rgba(127,209,143,0.18)' : 'rgba(255,74,74,0.18)'}
        stroke={isOpen ? canvasTokens.valveOpen : canvasTokens.valveClosed}
        strokeWidth={1.5}
      />

      {/* State label */}
      <Text
        x={-4}
        y={S + 4}
        width={S + 8}
        text={node.label}
        fontSize={8}
        fill={canvasTokens.text.dim}
        fontFamily={MONO}
        align="center"
        listening={false}
      />
      <Text
        x={-4}
        y={S + 14}
        width={S + 8}
        text={isOpen ? 'ОТК' : 'ЗКР'}
        fontSize={8}
        fill={isOpen ? canvasTokens.valveOpen : canvasTokens.valveClosed}
        fontFamily={MONO}
        fontStyle="700"
        align="center"
        listening={false}
      />
    </Group>
  )
}
