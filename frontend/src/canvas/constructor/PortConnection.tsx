import { Line, Circle } from 'react-konva'
import type { CanvasNode, CanvasEdge } from '@/store/constructor'
import type { ComponentType } from '@/mocks/fixtures/components'

interface PortConnectionProps {
  edge: CanvasEdge
  nodes: CanvasNode[]
  componentTypes: ComponentType[]
  isSelected: boolean
  onSelect: () => void
  onDelete: () => void
}

function getPortPosition(node: CanvasNode, portId: string, componentTypes: ComponentType[]) {
  const ct = componentTypes.find((c) => c.id === node.typeId)
  if (!ct) return { x: node.x, y: node.y }

  const ports = ct.ports
  const idx = ports.findIndex((p) => p.id === portId)
  const total = ports.length

  const NODE_W = 80
  const NODE_H = 60

  // Distribute ports: inputs on left, outputs on right
  const inputPorts = ports.filter((p) => p.direction === 'in')
  const outputPorts = ports.filter((p) => p.direction === 'out')

  const port = ports[idx]
  if (!port) return { x: node.x, y: node.y }

  if (port.direction === 'in') {
    const portIdx = inputPorts.findIndex((p) => p.id === portId)
    const spacing = NODE_H / (inputPorts.length + 1)
    return {
      x: node.x,
      y: node.y + spacing * (portIdx + 1),
    }
  } else {
    const portIdx = outputPorts.findIndex((p) => p.id === portId)
    const spacing = NODE_H / (outputPorts.length + 1)
    return {
      x: node.x + NODE_W,
      y: node.y + spacing * (portIdx + 1),
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
  const srcNode = nodes.find((n) => n.id === edge.sourceNodeId)
  const dstNode = nodes.find((n) => n.id === edge.targetNodeId)
  if (!srcNode || !dstNode) return null

  const src = getPortPosition(srcNode, edge.sourcePortId, componentTypes)
  const dst = getPortPosition(dstNode, edge.targetPortId, componentTypes)

  const cpOffset = Math.abs(dst.x - src.x) * 0.5
  const points = [src.x, src.y, src.x + cpOffset, src.y, dst.x - cpOffset, dst.y, dst.x, dst.y]

  const hasErrors = (edge.validationErrors ?? []).length > 0

  return (
    <>
      <Line
        points={points}
        tension={0}
        bezier={true}
        stroke={hasErrors ? '#ff4d4d' : isSelected ? '#00e5c7' : 'rgba(255,255,255,0.25)'}
        strokeWidth={isSelected ? 2 : 1.5}
        onClick={onSelect}
        hitStrokeWidth={10}
      />
      {/* midpoint handle */}
      <Circle
        x={(src.x + dst.x) / 2}
        y={(src.y + dst.y) / 2}
        radius={4}
        fill={isSelected ? '#00e5c7' : 'rgba(255,255,255,0.2)'}
        onClick={onSelect}
      />
    </>
  )
}
