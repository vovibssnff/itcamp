import { Group, Rect, Text, Circle, Line } from 'react-konva'
import type { CanvasNode } from '@/store/constructor'
import type { TagValue } from '@/store/session'
import { tokens } from '@/theme/tokens'

interface NodeWidgetProps {
  node: CanvasNode
  telemetry: Record<string, TagValue>
  isSelected: boolean
  onClick: () => void
  interactive: boolean
}

const ALARM_COLORS = {
  normal: undefined,
  L: tokens.accent.blue,
  LL: '#7c5cff',
  H: tokens.accent.amber,
  HH: tokens.accent.red,
}

const NODE_W = 80
const NODE_H = 60

export function NodeWidget({ node, telemetry, isSelected, onClick, interactive }: NodeWidgetProps) {
  // Find the primary tag for this node (first sensor-like tag matching node label)
  const primaryTag = Object.values(telemetry).find(
    (t) =>
      t.tag.includes(node.label.toUpperCase()) ||
      t.tag.replace(/[^A-Z0-9]/g, '').includes(node.label.replace(/[^A-Z0-9]/g, '')),
  )

  const alarmState = primaryTag?.alarmState ?? 'normal'
  const alarmColor = ALARM_COLORS[alarmState]
  const isAlarm = alarmState !== 'normal'

  return (
    <Group
      x={node.x}
      y={node.y}
      onClick={interactive ? onClick : undefined}
      style={{ cursor: interactive ? 'pointer' : 'default' }}
    >
      {/* Selection / alarm glow */}
      {(isSelected || isAlarm) && (
        <Rect
          x={-4}
          y={-4}
          width={NODE_W + 8}
          height={NODE_H + 8}
          cornerRadius={6}
          stroke={isAlarm ? alarmColor : tokens.accent.cyan}
          strokeWidth={1.5}
          shadowColor={isAlarm ? alarmColor : tokens.accent.cyan}
          shadowBlur={isAlarm && alarmState === 'HH' ? 12 : 6}
          shadowOpacity={0.7}
          listening={false}
          opacity={isAlarm && alarmState === 'HH' ? undefined : 1}
        />
      )}

      {/* Node body */}
      <Rect
        x={0}
        y={0}
        width={NODE_W}
        height={NODE_H}
        fill={tokens.bg.surface}
        stroke={alarmColor ?? tokens.border.medium}
        strokeWidth={1}
        cornerRadius={4}
      />

      {/* Zone color stripe */}
      <Rect
        x={0}
        y={0}
        width={3}
        height={NODE_H}
        fill={alarmColor ?? tokens.border.medium}
        cornerRadius={[4, 0, 0, 4]}
      />

      {/* Label */}
      <Text
        x={6}
        y={8}
        text={node.label}
        fontSize={11}
        fill={tokens.text.primary}
        fontFamily="'IBM Plex Mono', monospace"
        fontStyle="bold"
        listening={false}
      />

      {/* Primary value */}
      {primaryTag && (
        <Text
          x={6}
          y={28}
          text={`${primaryTag.value.toFixed(1)}`}
          fontSize={16}
          fill={alarmColor ?? tokens.text.primary}
          fontFamily="'IBM Plex Mono', monospace"
          listening={false}
        />
      )}

      {/* Unit */}
      {primaryTag && (
        <Text
          x={6}
          y={NODE_H - 14}
          text={primaryTag.unit}
          fontSize={9}
          fill={tokens.text.dim}
          fontFamily="'IBM Plex Mono', monospace"
          listening={false}
        />
      )}

      {/* Alarm level indicator */}
      {isAlarm && <Circle x={NODE_W - 8} y={8} radius={4} fill={alarmColor} listening={false} />}
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
  const tag = Object.values(telemetry).find((t) => t.tag.includes(node.label))
  const isOpen = tag ? tag.value > 50 : true

  const VALVE_SIZE = 28

  return (
    <Group x={node.x} y={node.y} onClick={interactive ? onClick : undefined}>
      {isSelected && (
        <Circle
          x={VALVE_SIZE / 2}
          y={VALVE_SIZE / 2}
          radius={20}
          stroke={tokens.accent.cyan}
          strokeWidth={1.5}
          listening={false}
        />
      )}
      {/* Bowtie valve shape */}
      <Line
        points={[0, 0, VALVE_SIZE, VALVE_SIZE, VALVE_SIZE, 0, 0, VALVE_SIZE]}
        closed
        fill={isOpen ? 'rgba(0,229,199,0.15)' : 'rgba(255,77,77,0.15)'}
        stroke={isOpen ? tokens.accent.cyan : tokens.accent.red}
        strokeWidth={1.5}
      />
      <Text
        x={0}
        y={VALVE_SIZE + 2}
        width={VALVE_SIZE + 10}
        text={node.label}
        fontSize={9}
        fill={tokens.text.dim}
        fontFamily="'IBM Plex Mono', monospace"
        align="center"
        listening={false}
      />
    </Group>
  )
}
