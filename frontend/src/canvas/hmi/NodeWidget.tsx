import { Group, Rect, Text, Circle, Line } from 'react-konva'
import type { CanvasNode } from '@/store/constructor'
import type { TagValue } from '@/store/session'
import { type CanvasTokens } from '@/theme/tokens'
import { useCanvasTokens } from '@/theme/useCanvasTokens'
import { getNodeSize, type EquipmentShape } from './nodeGeometry'

interface NodeWidgetProps {
  node: CanvasNode
  shape: EquipmentShape | undefined
  telemetry: Record<string, TagValue>
  isSelected: boolean
  onClick: () => void
  interactive: boolean
}

const SEVERITY: Record<TagValue['alarmState'], number> = { normal: 0, L: 1, H: 1, LL: 2, HH: 3 }

function makeAlarmColors(tk: CanvasTokens): Record<string, string> {
  return {
    normal: tk.text.muted,
    L: tk.zone.gdm,
    LL: tk.zone.k1,
    H: tk.warn,
    HH: tk.alarm,
  }
}

/** Vessel-style body shared by columns, vessels, separators and furnaces —
 * a dark gradient fill with a P&ID-grey outline (reference: ktk.html `vesselGrad`). */
function VesselBody({
  w,
  h,
  tk,
  cornerRadius,
  stroke,
}: {
  w: number
  h: number
  tk: CanvasTokens
  cornerRadius: number | number[]
  stroke: string
}) {
  return (
    <Rect
      x={0}
      y={0}
      width={w}
      height={h}
      cornerRadius={cornerRadius}
      fillLinearGradientStartPoint={{ x: 0, y: 0 }}
      fillLinearGradientEndPoint={{ x: 0, y: h }}
      fillLinearGradientColorStops={[0, tk.vesselFrom, 1, tk.vesselTo]}
      stroke={stroke}
      strokeWidth={1.25}
    />
  )
}

/** Proportional liquid fill drawn inside a vessel/column body from a level reading. */
function LevelFill({ w, h, frac, color }: { w: number; h: number; frac: number; color: string }) {
  const clamped = Math.max(0, Math.min(1, frac))
  const fillH = clamped * (h - 4)
  if (fillH <= 0) return null
  return (
    <Rect
      x={2}
      y={h - 2 - fillH}
      width={w - 4}
      height={fillH}
      fill={color}
      opacity={0.32}
      listening={false}
    />
  )
}

function EquipmentIcon({
  shape,
  w,
  h,
  tk,
  stroke,
  levelFrac,
  levelColor,
}: {
  shape: EquipmentShape | undefined
  w: number
  h: number
  tk: CanvasTokens
  stroke: string
  levelFrac?: number
  levelColor: string
}) {
  switch (shape) {
    case 'column': {
      const trayCount = Math.floor((h - 20) / 16)
      return (
        <>
          <VesselBody w={w} h={h} tk={tk} cornerRadius={8} stroke={stroke} />
          {levelFrac !== undefined && <LevelFill w={w} h={h} frac={levelFrac} color={levelColor} />}
          {Array.from({ length: trayCount }).map((_, i) => {
            const y = 12 + i * 16
            return (
              <Line
                key={i}
                points={[3, y, w - 3, y]}
                stroke={tk.lineDim}
                strokeWidth={1}
                listening={false}
              />
            )
          })}
        </>
      )
    }

    case 'vessel':
      return (
        <>
          <VesselBody
            w={w}
            h={h}
            tk={tk}
            cornerRadius={[h * 0.28, h * 0.28, 4, 4]}
            stroke={stroke}
          />
          {levelFrac !== undefined && <LevelFill w={w} h={h} frac={levelFrac} color={levelColor} />}
        </>
      )

    case 'separator':
      return (
        <>
          <VesselBody w={w} h={h} tk={tk} cornerRadius={h / 2} stroke={stroke} />
          {levelFrac !== undefined && <LevelFill w={w} h={h} frac={levelFrac} color={levelColor} />}
        </>
      )

    case 'furnace':
      return <VesselBody w={w} h={h} tk={tk} cornerRadius={3} stroke={stroke} />

    case 'heatexchanger': {
      const d = h * 0.72
      const cy = h / 2
      const c1 = w * 0.32
      const c2 = w * 0.68
      const diamond = (cx: number) => [
        cx,
        cy - d / 2,
        cx + d / 2,
        cy,
        cx,
        cy + d / 2,
        cx - d / 2,
        cy,
      ]
      return (
        <>
          <Rect x={0} y={0} width={w} height={h} fill="transparent" />
          <Line
            points={diamond(c1)}
            closed
            fillLinearGradientStartPoint={{ x: 0, y: 0 }}
            fillLinearGradientEndPoint={{ x: 0, y: h }}
            fillLinearGradientColorStops={[0, tk.vesselFrom, 1, tk.vesselTo]}
            stroke={stroke}
            strokeWidth={1.25}
          />
          <Line
            points={diamond(c2)}
            closed
            fillLinearGradientStartPoint={{ x: 0, y: 0 }}
            fillLinearGradientEndPoint={{ x: 0, y: h }}
            fillLinearGradientColorStops={[0, tk.vesselFrom, 1, tk.vesselTo]}
            stroke={stroke}
            strokeWidth={1.25}
          />
        </>
      )
    }

    case 'pump':
    case 'compressor': {
      const r = Math.min(w, h) / 2
      return (
        <>
          <Circle
            x={r}
            y={r}
            radius={r}
            fillLinearGradientStartPoint={{ x: 0, y: -r }}
            fillLinearGradientEndPoint={{ x: 0, y: r }}
            fillLinearGradientColorStops={[0, tk.vesselFrom, 1, tk.vesselTo]}
            stroke={stroke}
            strokeWidth={1.25}
          />
          {shape === 'compressor' && (
            <Circle x={r} y={r} radius={r * 0.55} stroke={stroke} strokeWidth={1} />
          )}
          <Line
            points={[r - r * 0.35, r - r * 0.4, r - r * 0.35, r + r * 0.4, r + r * 0.55, r]}
            closed
            fill={stroke}
            listening={false}
          />
        </>
      )
    }

    case 'controller':
      return (
        <>
          <Circle
            x={w / 2}
            y={h / 2}
            radius={Math.min(w, h) / 2}
            fill={tk.bg.elevated}
            stroke={stroke}
            strokeWidth={1.25}
          />
          <Line
            points={[3, h / 2, w - 3, h / 2]}
            stroke={stroke}
            strokeWidth={1}
            listening={false}
          />
        </>
      )

    case 'sensor':
      return (
        <Circle
          x={w / 2}
          y={h / 2}
          radius={Math.min(w, h) / 2}
          fill={tk.bg.elevated}
          stroke={stroke}
          strokeWidth={1.25}
        />
      )

    default:
      return <VesselBody w={w} h={h} tk={tk} cornerRadius={4} stroke={stroke} />
  }
}

export function NodeWidget({
  node,
  shape,
  telemetry,
  isSelected,
  onClick,
  interactive,
}: NodeWidgetProps) {
  const canvasTokens = useCanvasTokens()
  const ALARM_COLORS = makeAlarmColors(canvasTokens)
  const READOUT_BG = canvasTokens.readout
  const MONO = canvasTokens.font.mono
  const { w, h } = getNodeSize(shape)

  // Readouts come from the explicit tag list authored on the node — exact
  // key lookups, not fuzzy label matching, so a node only ever shows the
  // instrument readings actually installed on it.
  const readouts = (node.tags ?? [])
    .map((tag) => telemetry[tag])
    .filter((t): t is TagValue => Boolean(t))

  const worst = readouts.reduce<TagValue['alarmState']>(
    (acc, t) => (SEVERITY[t.alarmState] > SEVERITY[acc] ? t.alarmState : acc),
    'normal',
  )
  const alarmColor = ALARM_COLORS[worst] ?? canvasTokens.text.muted
  const isAlarm = worst !== 'normal'
  const isCrit = worst === 'HH'
  const stroke = isAlarm ? alarmColor : canvasTokens.line

  const levelTag = readouts.find((t) => t.tag.startsWith('LI'))
  const levelFrac = levelTag ? levelTag.value / 100 : undefined
  const levelColor =
    levelTag && levelTag.alarmState !== 'normal'
      ? (ALARM_COLORS[levelTag.alarmState] ?? canvasTokens.zone.gdm)
      : canvasTokens.zone.gdm

  const rows = readouts.length > 0 ? readouts : [null]
  const rowH = 17

  return (
    <Group
      x={node.x}
      y={node.y}
      onClick={interactive ? onClick : undefined}
      style={{ cursor: interactive ? 'pointer' : 'default' }}
    >
      {/* Alarm glow / selection ring */}
      {(isSelected || isCrit) && (
        <Rect
          x={-4}
          y={-4}
          width={w + 8}
          height={h + 8}
          cornerRadius={4}
          stroke={isCrit ? canvasTokens.alarm : canvasTokens.accent}
          strokeWidth={1.5}
          shadowColor={isCrit ? canvasTokens.alarm : canvasTokens.accent}
          shadowBlur={isCrit ? 14 : 7}
          shadowOpacity={0.75}
          listening={false}
        />
      )}

      {/* Tag label above the equipment icon */}
      <Text
        x={0}
        y={-16}
        width={w}
        align="center"
        text={node.label}
        fontSize={10}
        fill={canvasTokens.text.secondary}
        fontFamily={MONO}
        fontStyle="500"
        listening={false}
      />

      <EquipmentIcon
        shape={shape}
        w={w}
        h={h}
        tk={canvasTokens}
        stroke={stroke}
        levelFrac={levelFrac}
        levelColor={levelColor}
      />

      {/* Readout chips below the icon — one row per installed instrument tag */}
      {rows.map((tv, i) => {
        const y = h + 6 + i * (rowH + 2)
        const color =
          tv && tv.alarmState !== 'normal'
            ? (ALARM_COLORS[tv.alarmState] ?? alarmColor)
            : canvasTokens.text.primary
        return (
          <Group key={tv?.tag ?? 'empty'} y={y}>
            <Rect
              x={0}
              y={0}
              width={w}
              height={rowH}
              fill={READOUT_BG}
              cornerRadius={2}
              listening={false}
            />
            <Text
              x={0}
              y={4}
              width={w}
              align="center"
              text={tv ? `${tv.value.toFixed(1)}${tv.unit ? ' ' + tv.unit : ''}` : '—'}
              fontSize={10.5}
              fontStyle="700"
              fill={color}
              fontFamily={MONO}
              listening={false}
            />
          </Group>
        )
      })}

      {/* Alarm dot */}
      {isAlarm && <Circle x={w - 4} y={0} radius={4} fill={alarmColor} listening={false} />}
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
