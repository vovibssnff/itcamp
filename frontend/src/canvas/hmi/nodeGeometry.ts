/**
 * @deprecated Prefer `@/canvas/shared/equipmentGeometry`.
 */
export {
  getDefaultNodeSize as getNodeSize,
  getNodeSize as getNodeSizeFromNode,
  type EquipmentShape,
  type NodeSize,
} from '@/canvas/shared/equipmentGeometry'

import type { NodeSize } from '@/canvas/shared/equipmentGeometry'

/** Right-edge, vertical-center anchor — where outgoing pipes leave a node. */
export function getOutAnchor(x: number, y: number, size: NodeSize) {
  return { x: x + size.w, y: y + size.h / 2 }
}

/** Left-edge, vertical-center anchor — where incoming pipes enter a node. */
export function getInAnchor(x: number, y: number, size: NodeSize) {
  return { x, y: y + size.h / 2 }
}
