/**
 * Process engineering shape renderers for the KTK constructor canvas.
 * Each shape matches the visual vocabulary from the ktk.html reference HMI.
 */
import React from 'react'
import { Group, Rect, Circle, Line, Text } from 'react-konva'
import type { CanvasTokens } from '@/theme/tokens'

interface ShapeProps {
  w: number
  h: number
  color: string
  tk: CanvasTokens
  label?: string
}

/** Pump — circle body with a triangle (flow arrow) */
export function PumpShape({ w, h, color, tk }: ShapeProps) {
  const cx = w / 2
  const cy = h / 2
  const r = Math.min(cx, cy) - 2
  const tri = r * 0.45
  return (
    <Group>
      <Circle x={cx} y={cy} radius={r} fill={tk.bg.elevated} stroke={color} strokeWidth={1.5} />
      {/* Triangle pointing right */}
      <Line
        points={[cx - tri, cy - tri, cx - tri, cy + tri, cx + tri, cy]}
        closed
        fill={color}
        stroke={color}
        strokeWidth={1}
        opacity={0.8}
      />
    </Group>
  )
}

/** Distillation column — tall rounded rect with tray lines */
export function ColumnShape({ w, h, color, tk }: ShapeProps) {
  const numTrays = 5
  const traySpacing = h / (numTrays + 1)
  return (
    <Group>
      <Rect
        x={0}
        y={0}
        width={w}
        height={h}
        cornerRadius={Math.min(w, 12)}
        fill={tk.bg.elevated}
        stroke={color}
        strokeWidth={1.5}
      />
      {/* Tray lines */}
      {Array.from({ length: numTrays }, (_, i) => (
        <Line
          key={i}
          points={[3, traySpacing * (i + 1), w - 3, traySpacing * (i + 1)]}
          stroke={color}
          strokeWidth={0.5}
          opacity={0.35}
        />
      ))}
    </Group>
  )
}

/** Separator / vessel — rounded rect with an elliptical cap */
export function VesselShape({ w, h, color, tk }: ShapeProps) {
  return (
    <Group>
      <Rect
        x={0}
        y={0}
        width={w}
        height={h}
        cornerRadius={[Math.min(w / 2, 8), Math.min(w / 2, 8), 2, 2]}
        fill={tk.bg.elevated}
        stroke={color}
        strokeWidth={1.5}
      />
      {/* Level divider line */}
      <Line
        points={[3, h * 0.62, w - 3, h * 0.62]}
        stroke={color}
        strokeWidth={0.75}
        opacity={0.3}
        dash={[4, 3]}
      />
    </Group>
  )
}

/** Heat exchanger — diamond (rhombus) polygon */
export function HeatExchangerShape({ w, h, color, tk }: ShapeProps) {
  const cx = w / 2
  const cy = h / 2
  return (
    <Group>
      <Line
        points={[cx, 2, w - 2, cy, cx, h - 2, 2, cy]}
        closed
        fill={tk.bg.elevated}
        stroke={color}
        strokeWidth={1.5}
      />
      {/* Exchanger cross lines */}
      <Line points={[cx, 2, cx, h - 2]} stroke={color} strokeWidth={0.75} opacity={0.35} />
      <Line points={[2, cy, w - 2, cy]} stroke={color} strokeWidth={0.75} opacity={0.35} />
    </Group>
  )
}

/** Valve — two opposing triangles (butterfly valve symbol) */
export function ValveShapeIcon({ w, h, color, tk }: ShapeProps) {
  const cx = w / 2
  const cy = h / 2
  const s = Math.min(cx, cy)
  return (
    <Group>
      {/* Left triangle */}
      <Line
        points={[cx - s, cy - s, cx - s, cy + s, cx, cy]}
        closed
        fill={color}
        stroke={color}
        strokeWidth={1}
        opacity={0.7}
      />
      {/* Right triangle */}
      <Line
        points={[cx + s, cy - s, cx + s, cy + s, cx, cy]}
        closed
        fill={tk.bg.elevated}
        stroke={color}
        strokeWidth={1}
        opacity={0.7}
      />
    </Group>
  )
}

/** Furnace / heater — solid filled rectangle with dashed border */
export function FurnaceShape({ w, h, color, tk }: ShapeProps) {
  return (
    <Group>
      <Rect
        x={0}
        y={0}
        width={w}
        height={h}
        fill={tk.bg.elevated}
        stroke={color}
        strokeWidth={1.5}
        dash={[5, 3]}
      />
      {/* Flame triangle */}
      <Line
        points={[w * 0.3, h - 4, w / 2, 6, w * 0.7, h - 4]}
        closed
        fill={color}
        opacity={0.5}
        strokeWidth={0}
      />
    </Group>
  )
}

/** Sensor — circle with crosshair */
export function SensorShape({ w, h, color, tk }: ShapeProps) {
  const cx = w / 2
  const cy = h / 2
  const r = Math.min(cx, cy) - 2
  return (
    <Group>
      <Circle x={cx} y={cy} radius={r} fill={tk.bg.elevated} stroke={color} strokeWidth={1.5} />
      <Line
        points={[cx - r * 0.6, cy, cx + r * 0.6, cy]}
        stroke={color}
        strokeWidth={0.75}
        opacity={0.6}
      />
      <Line
        points={[cx, cy - r * 0.6, cx, cy + r * 0.6]}
        stroke={color}
        strokeWidth={0.75}
        opacity={0.6}
      />
    </Group>
  )
}

/** Controller — square with inner bracket symbol */
export function ControllerShape({ w, h, color, tk }: ShapeProps) {
  const pad = 4
  return (
    <Group>
      <Rect
        x={0}
        y={0}
        width={w}
        height={h}
        fill={tk.bg.elevated}
        stroke={color}
        strokeWidth={1.5}
        cornerRadius={2}
      />
      {/* C-bracket */}
      <Text
        x={0}
        y={h * 0.25}
        width={w}
        text="C"
        fontSize={h * 0.45}
        fontFamily={tk.font.mono}
        fill={color}
        opacity={0.5}
        align="center"
      />
      <Rect
        x={pad}
        y={pad}
        width={8}
        height={h - pad * 2}
        fill={color}
        opacity={0.18}
        cornerRadius={1}
      />
    </Group>
  )
}

/** Compressor — circle with internal arrow */
export function CompressorShape({ w, h, color, tk }: ShapeProps) {
  const cx = w / 2
  const cy = h / 2
  const r = Math.min(cx, cy) - 2
  const s = r * 0.4
  return (
    <Group>
      <Circle x={cx} y={cy} radius={r} fill={tk.bg.elevated} stroke={color} strokeWidth={1.5} />
      {/* Opposing arrows */}
      <Line points={[cx - s, cy, cx + s, cy]} stroke={color} strokeWidth={1.5} opacity={0.7} />
      <Line
        points={[cx + s - 4, cy - 4, cx + s, cy, cx + s - 4, cy + 4]}
        stroke={color}
        strokeWidth={1.5}
        opacity={0.7}
      />
    </Group>
  )
}

/** Default generic shape for unknown types */
export function GenericShape({ w, h, color, tk }: ShapeProps) {
  return (
    <Rect
      x={0}
      y={0}
      width={w}
      height={h}
      fill={tk.bg.elevated}
      stroke={color}
      strokeWidth={1}
      cornerRadius={2}
    />
  )
}

/** Map from component shape type to a renderer component */
export function renderNodeShape(shape: string, props: ShapeProps): React.ReactElement {
  switch (shape) {
    case 'pump':
      return <PumpShape {...props} />
    case 'column':
      return <ColumnShape {...props} />
    case 'vessel':
    case 'separator':
      return <VesselShape {...props} />
    case 'heatexchanger':
      return <HeatExchangerShape {...props} />
    case 'valve':
      return <ValveShapeIcon {...props} />
    case 'furnace':
      return <FurnaceShape {...props} />
    case 'sensor':
      return <SensorShape {...props} />
    case 'controller':
      return <ControllerShape {...props} />
    case 'compressor':
      return <CompressorShape {...props} />
    default:
      return <GenericShape {...props} />
  }
}
