import type { CanvasNode, CanvasEdge } from '@/store/constructor'
import type { ComponentType } from '@/mocks/fixtures/components'

export interface ValidationError {
  nodeId?: string
  edgeId?: string
  message: string
}

export function validateGraph(
  nodes: CanvasNode[],
  edges: CanvasEdge[],
  componentTypes: ComponentType[],
): ValidationError[] {
  const errors: ValidationError[] = []

  if (nodes.length === 0) {
    errors.push({ message: 'Граф не содержит компонентов' })
    return errors
  }

  // Check for duplicate labels
  const labels = nodes.map((n) => n.label)
  const duplicates = labels.filter((l, i) => labels.indexOf(l) !== i)
  for (const dup of new Set(duplicates)) {
    errors.push({ message: `Дублирующееся обозначение: ${dup}` })
  }

  // Check edge port compatibility
  for (const edge of edges) {
    const srcNode = nodes.find((n) => n.id === edge.sourceNodeId)
    const dstNode = nodes.find((n) => n.id === edge.targetNodeId)

    if (!srcNode || !dstNode) {
      errors.push({ edgeId: edge.id, message: 'Связь ссылается на несуществующий узел' })
      continue
    }

    const srcCt = componentTypes.find((c) => c.id === srcNode.typeId)
    const dstCt = componentTypes.find((c) => c.id === dstNode.typeId)

    if (!srcCt || !dstCt) continue

    const srcPort = srcCt.ports.find((p) => p.id === edge.sourcePortId)
    const dstPort = dstCt.ports.find((p) => p.id === edge.targetPortId)

    if (!srcPort) {
      errors.push({
        edgeId: edge.id,
        message: `Порт ${edge.sourcePortId} не найден на ${srcNode.label}`,
      })
      continue
    }

    if (!dstPort) {
      errors.push({
        edgeId: edge.id,
        message: `Порт ${edge.targetPortId} не найден на ${dstNode.label}`,
      })
      continue
    }

    if (srcPort.direction !== 'out') {
      errors.push({ edgeId: edge.id, message: `Порт ${srcPort.name} не является выходом` })
    }

    if (dstPort.direction !== 'in') {
      errors.push({ edgeId: edge.id, message: `Порт ${dstPort.name} не является входом` })
    }

    if (srcPort.type !== dstPort.type) {
      errors.push({
        edgeId: edge.id,
        message: `Несовместимые типы: ${srcPort.type} → ${dstPort.type} (${srcNode.label} → ${dstNode.label})`,
      })
    }
  }

  // Check for unconnected required ports (nodes with no edges at all)
  const connectedNodeIds = new Set([
    ...edges.map((e) => e.sourceNodeId),
    ...edges.map((e) => e.targetNodeId),
  ])

  if (nodes.length > 1) {
    for (const node of nodes) {
      if (!connectedNodeIds.has(node.id)) {
        errors.push({ nodeId: node.id, message: `${node.label}: нет соединений` })
      }
    }
  }

  return errors
}
