import { Line, Circle } from 'react-konva'
import type { CanvasNode, CanvasEdge } from '@/store/constructor'
import type { ComponentType } from '@/mocks/fixtures/components'
import { useCanvasTokens } from '@/theme/useCanvasTokens'
import {
  getPortAnchor,
  bezierEdgePoints,
  mediaStrokeColor,
  mediaDash,
  mediaStrokeWidth,
  resolveEdgeMediaType,
} from '@/canvas/shared/equipmentGeometry'

interface PortConnectionProps {
  edge: CanvasEdge
  nodes: CanvasNode[]
  componentTypes: ComponentType[]
  isSelected: boolean
  flowing?: boolean
  onSelect: () => void
  onDelete?: () => void
}

export function PortConnection({
  edge,
  nodes,
  componentTypes,
  isSelected,
  flowing = false,
  onSelect,
}: PortConnectionProps) {
  const canvasTokens = useCanvasTokens()

  const srcNode = nodes.find((n) => n.id === edge.sourceNodeId)
  const dstNode = nodes.find((n) => n.id === edge.targetNodeId)
  if (!srcNode || !dstNode) return null

  const src = getPortAnchor(srcNode, edge.sourcePortId, componentTypes)
  const dst = getPortAnchor(dstNode, edge.targetPortId, componentTypes)
  const points = bezierEdgePoints(src.x, src.y, dst.x, dst.y)

  const media = resolveEdgeMediaType(edge.type, src.type)
  const hasErrors = (edge.validationErrors ?? []).length > 0
  const strokeColor = hasErrors
    ? canvasTokens.alarm
    : isSelected
      ? canvasTokens.accent
      : mediaStrokeColor(media, canvasTokens)

  const baseDash = hasErrors ? [5, 3] : mediaDash(media)
  const dash = flowing ? (baseDash ?? [8, 6]) : baseDash

  return (
    <>
      <Line
        points={points}
        tension={0}
        bezier
        stroke="transparent"
        strokeWidth={14}
        onClick={onSelect}
        hitStrokeWidth={14}
      />
      <Line
        name={flowing ? 'pipe-flow' : undefined}
        points={points}
        tension={0}
        bezier
        stroke={strokeColor}
        strokeWidth={isSelected ? 2.25 : mediaStrokeWidth(media)}
        listening={false}
        dash={dash}
      />
      <Circle
        x={(src.x + dst.x) / 2}
        y={(src.y + dst.y) / 2}
        radius={isSelected ? 5 : 3.5}
        fill={isSelected ? canvasTokens.accent : mediaStrokeColor(media, canvasTokens)}
        stroke={canvasTokens.bg.base}
        strokeWidth={1}
        onClick={onSelect}
      />
    </>
  )
}
