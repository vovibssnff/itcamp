import { Line, Circle } from 'react-konva'
import type { CanvasNode, CanvasEdge } from '@/store/constructor'
import { DEFAULT_NODE_W, DEFAULT_NODE_H } from '@/store/constructor'
import type { ComponentType } from '@/mocks/fixtures/components'
import { useCanvasTokens } from '@/theme/useCanvasTokens'

interface PortConnectionProps {
  edge: CanvasEdge
  nodes: CanvasNode[]
  componentTypes: ComponentType[]
  isSelected: boolean
  onSelect: () => void
  onDelete: () => void
}

/** Get absolute port position using per-node dimensions */
function getPortPosition(
  node: CanvasNode,
  portId: string,
  componentTypes: ComponentType[],
): { x: number; y: number; type: string; direction: string } {
  const ct = componentTypes.find((c) => c.id === node.typeId)
  const fallback = { x: node.x, y: node.y, type: 'liquid', direction: 'in' }
  if (!ct) return fallback

  const nodeW = node.width ?? DEFAULT_NODE_W
  const nodeH = node.height ?? DEFAULT_NODE_H

  const ports = ct.ports
  const port = ports.find((p) => p.id === portId)
  if (!port) return fallback

  const inputPorts = ports.filter((p) => p.direction === 'in')
  const outputPorts = ports.filter((p) => p.direction === 'out')

  if (port.direction === 'in') {
    const portIdx = inputPorts.findIndex((p) => p.id === portId)
    const spacing = nodeH / (inputPorts.length + 1)
    return {
      x: node.x,
      y: node.y + spacing * (portIdx + 1),
      type: port.type,
      direction: 'in',
    }
  } else {
    const portIdx = outputPorts.findIndex((p) => p.id === portId)
    const spacing = nodeH / (outputPorts.length + 1)
    return {
      x: node.x + nodeW,
      y: node.y + spacing * (portIdx + 1),
      type: port.type,
      direction: 'out',
    }
  }
}

export function PortConnection({
  edge,
  nodes,
  componentTypes,
  isSelected,
  onSelect,
}: PortConnectionProps) {
  const canvasTokens = useCanvasTokens()
  const srcNode = nodes.find((n) => n.id === edge.sourceNodeId)
  const dstNode = nodes.find((n) => n.id === edge.targetNodeId)
  if (!srcNode || !dstNode) return null

  const src = getPortPosition(srcNode, edge.sourcePortId, componentTypes)
  const dst = getPortPosition(dstNode, edge.targetPortId, componentTypes)

  const cpOffset = Math.abs(dst.x - src.x) * 0.5
  const points = [src.x, src.y, src.x + cpOffset, src.y, dst.x - cpOffset, dst.y, dst.x, dst.y]

  const hasErrors = (edge.validationErrors ?? []).length > 0
  const strokeColor = hasErrors
    ? canvasTokens.alarm
    : isSelected
      ? canvasTokens.accent
      : canvasTokens.border.medium

  return (
    <>
      {/* Hit area (invisible, wide) */}
      <Line
        points={points}
        tension={0}
        bezier
        stroke="transparent"
        strokeWidth={14}
        onClick={onSelect}
        hitStrokeWidth={14}
      />
      {/* Visible edge */}
      <Line
        points={points}
        tension={0}
        bezier
        stroke={strokeColor}
        strokeWidth={isSelected ? 2 : 1.5}
        listening={false}
        dash={hasErrors ? [5, 3] : undefined}
      />
      {/* Midpoint handle */}
      <Circle
        x={(src.x + dst.x) / 2}
        y={(src.y + dst.y) / 2}
        radius={isSelected ? 5 : 3.5}
        fill={isSelected ? canvasTokens.accent : canvasTokens.text.muted}
        stroke={canvasTokens.bg.base}
        strokeWidth={1}
        onClick={onSelect}
      />
    </>
  )
}
