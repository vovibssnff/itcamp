import type { ComponentType } from '@/mocks/fixtures/components'
import type { CanvasNode } from '@/store/constructor'
import type { CanvasTokens } from '@/theme/tokens'

export type EquipmentShape = ComponentType['shape']

export type EdgeMediaType = 'liquid' | 'gas' | 'steam' | 'electric' | 'signal'

export interface NodeSize {
  w: number
  h: number
}

/**
 * Per-shape footprint on the mnemonic — proportioned like real P&ID symbols
 * (tall narrow columns, compact round pumps, wide short exchangers).
 */
const SIZES: Record<EquipmentShape, NodeSize> = {
  column: { w: 64, h: 190 },
  vessel: { w: 74, h: 92 },
  separator: { w: 68, h: 60 },
  heatexchanger: { w: 72, h: 48 },
  furnace: { w: 84, h: 74 },
  pump: { w: 44, h: 44 },
  compressor: { w: 52, h: 52 },
  controller: { w: 40, h: 40 },
  sensor: { w: 26, h: 26 },
  valve: { w: 32, h: 32 },
}

export function getDefaultNodeSize(shape: EquipmentShape | undefined): NodeSize {
  return shape ? (SIZES[shape] ?? SIZES.vessel) : SIZES.vessel
}

/** Prefer authored width/height; fall back to shape defaults. */
export function getNodeSize(node: CanvasNode, shape: EquipmentShape | undefined): NodeSize {
  const def = getDefaultNodeSize(shape)
  return {
    w: node.width ?? def.w,
    h: node.height ?? def.h,
  }
}

export function mediaStrokeColor(
  type: EdgeMediaType | string | undefined,
  tk: CanvasTokens,
): string {
  switch (type) {
    case 'liquid':
      return tk.accent
    case 'gas':
      return tk.warn
    case 'steam':
      return '#c4b5a0'
    case 'signal':
      return tk.zone.gdm
    case 'electric':
      return tk.alarm
    default:
      return tk.line
  }
}

export function mediaDash(type: EdgeMediaType | string | undefined): number[] | undefined {
  switch (type) {
    case 'gas':
      return [6, 4]
    case 'steam':
      return [10, 4, 2, 4]
    case 'signal':
      return [3, 3]
    case 'electric':
      return [8, 3]
    default:
      return undefined
  }
}

export function mediaStrokeWidth(type: EdgeMediaType | string | undefined): number {
  switch (type) {
    case 'signal':
      return 1
    case 'electric':
      return 1.75
    default:
      return 1.5
  }
}

export interface PortAnchor {
  x: number
  y: number
  type: string
  direction: 'in' | 'out'
}

/** Absolute port position from component type slots (left = in, right = out). */
export function getPortAnchor(
  node: CanvasNode,
  portId: string,
  componentTypes: ComponentType[],
): PortAnchor {
  const ct = componentTypes.find((c) => c.id === node.typeId)
  const size = getNodeSize(node, ct?.shape)
  const fallback: PortAnchor = {
    x: node.x,
    y: node.y + size.h / 2,
    type: 'liquid',
    direction: 'in',
  }
  if (!ct) return fallback

  const port = ct.ports.find((p) => p.id === portId)
  if (!port) return fallback

  const inputs = ct.ports.filter((p) => p.direction === 'in')
  const outputs = ct.ports.filter((p) => p.direction === 'out')

  if (port.direction === 'in') {
    const idx = inputs.findIndex((p) => p.id === portId)
    const spacing = size.h / (inputs.length + 1)
    return {
      x: node.x,
      y: node.y + spacing * (idx + 1),
      type: port.type,
      direction: 'in',
    }
  }

  const idx = outputs.findIndex((p) => p.id === portId)
  const spacing = size.h / (outputs.length + 1)
  return {
    x: node.x + size.w,
    y: node.y + spacing * (idx + 1),
    type: port.type,
    direction: 'out',
  }
}

/** All port anchors for a node (keyed by port id). */
export function getAllPortAnchors(node: CanvasNode, ct: ComponentType): Record<string, PortAnchor> {
  const positions: Record<string, PortAnchor> = {}
  for (const p of ct.ports) {
    positions[p.id] = getPortAnchor(node, p.id, [ct])
  }
  return positions
}

/** Orthogonal pipe polyline between two port anchors. */
export function orthogonalEdgePoints(x1: number, y1: number, x2: number, y2: number): number[] {
  const cpx = (x1 + x2) / 2
  return [x1, y1, cpx, y1, cpx, y2, x2, y2]
}

/** Bezier control points for constructor-style edges. */
export function bezierEdgePoints(x1: number, y1: number, x2: number, y2: number): number[] {
  const cpOffset = Math.abs(x2 - x1) * 0.5
  return [x1, y1, x1 + cpOffset, y1, x2 - cpOffset, y2, x2, y2]
}

/** Resolve edge media type from edge.type or source port. */
export function resolveEdgeMediaType(
  edgeType: string | undefined,
  sourcePortType: string | undefined,
): EdgeMediaType {
  const raw = (edgeType || sourcePortType || 'liquid').toLowerCase()
  if (
    raw === 'steam' ||
    raw === 'gas' ||
    raw === 'signal' ||
    raw === 'electric' ||
    raw === 'liquid'
  ) {
    return raw
  }
  return 'liquid'
}
