import type { ComponentType } from '@/mocks/fixtures/components'

export type EquipmentShape = ComponentType['shape']

export interface NodeSize {
  w: number
  h: number
}

/**
 * Per-shape footprint on the mnemonic — proportioned like real P&ID symbols
 * (tall narrow columns, compact round pumps, wide short exchangers) rather
 * than one uniform box for every piece of equipment.
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

export function getNodeSize(shape: EquipmentShape | undefined): NodeSize {
  return shape ? (SIZES[shape] ?? SIZES.vessel) : SIZES.vessel
}

/** Right-edge, vertical-center anchor — where outgoing pipes leave a node. */
export function getOutAnchor(x: number, y: number, size: NodeSize) {
  return { x: x + size.w, y: y + size.h / 2 }
}

/** Left-edge, vertical-center anchor — where incoming pipes enter a node. */
export function getInAnchor(x: number, y: number, size: NodeSize) {
  return { x, y: y + size.h / 2 }
}
