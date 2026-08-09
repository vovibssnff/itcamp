import { describe, it, expect } from 'vitest'
import { validateGraph } from './graph-validator'
import type { CanvasNode, CanvasEdge } from '@/store/constructor'
import type { ComponentType } from '@/mocks/fixtures/components'

const componentTypes: ComponentType[] = [
  {
    id: 'pump',
    name: 'Pump',
    category: 'common',
    description: '',
    shape: 'pump',
    ports: [
      { id: 'in', name: 'In', type: 'liquid', direction: 'in' },
      { id: 'out', name: 'Out', type: 'liquid', direction: 'out' },
      { id: 'sig', name: 'Sig', type: 'signal', direction: 'out' },
    ],
    parameters: [],
  },
  {
    id: 'tank',
    name: 'Tank',
    category: 'common',
    description: '',
    shape: 'vessel',
    ports: [
      { id: 'in', name: 'In', type: 'liquid', direction: 'in' },
      { id: 'gasin', name: 'GasIn', type: 'gas', direction: 'in' },
    ],
    parameters: [],
  },
]

function node(id: string, typeId: string, label: string): CanvasNode {
  return { id, typeId, x: 0, y: 0, label, parameters: {} }
}

describe('validateGraph', () => {
  it('flags empty graph', () => {
    const errors = validateGraph([], [], componentTypes)
    expect(errors).toHaveLength(1)
    expect(errors[0]?.message).toContain('не содержит')
  })

  it('accepts a valid liquid connection', () => {
    const nodes = [node('n1', 'pump', 'P1'), node('n2', 'tank', 'T1')]
    const edges: CanvasEdge[] = [
      { id: 'e1', sourceNodeId: 'n1', sourcePortId: 'out', targetNodeId: 'n2', targetPortId: 'in' },
    ]
    const errors = validateGraph(nodes, edges, componentTypes)
    expect(errors).toHaveLength(0)
  })

  it('flags incompatible port types (liquid → gas)', () => {
    const nodes = [node('n1', 'pump', 'P1'), node('n2', 'tank', 'T1')]
    const edges: CanvasEdge[] = [
      {
        id: 'e1',
        sourceNodeId: 'n1',
        sourcePortId: 'out',
        targetNodeId: 'n2',
        targetPortId: 'gasin',
      },
    ]
    const errors = validateGraph(nodes, edges, componentTypes)
    expect(errors.some((e) => e.message.includes('Несовместимые типы'))).toBe(true)
  })

  it('flags duplicate labels', () => {
    const nodes = [node('n1', 'pump', 'DUP'), node('n2', 'tank', 'DUP')]
    const edges: CanvasEdge[] = [
      { id: 'e1', sourceNodeId: 'n1', sourcePortId: 'out', targetNodeId: 'n2', targetPortId: 'in' },
    ]
    const errors = validateGraph(nodes, edges, componentTypes)
    expect(errors.some((e) => e.message.includes('Дублирующееся'))).toBe(true)
  })

  it('flags using an input port as source', () => {
    const nodes = [node('n1', 'pump', 'P1'), node('n2', 'tank', 'T1')]
    const edges: CanvasEdge[] = [
      { id: 'e1', sourceNodeId: 'n1', sourcePortId: 'in', targetNodeId: 'n2', targetPortId: 'in' },
    ]
    const errors = validateGraph(nodes, edges, componentTypes)
    expect(errors.some((e) => e.message.includes('не является выходом'))).toBe(true)
  })

  it('flags unconnected nodes', () => {
    const nodes = [node('n1', 'pump', 'P1'), node('n2', 'tank', 'T1')]
    const errors = validateGraph(nodes, [], componentTypes)
    expect(errors.some((e) => e.message.includes('нет соединений'))).toBe(true)
  })

  it('flags edge referencing missing node', () => {
    const nodes = [node('n1', 'pump', 'P1')]
    const edges: CanvasEdge[] = [
      {
        id: 'e1',
        sourceNodeId: 'n1',
        sourcePortId: 'out',
        targetNodeId: 'ghost',
        targetPortId: 'in',
      },
    ]
    const errors = validateGraph(nodes, edges, componentTypes)
    expect(errors.some((e) => e.message.includes('несуществующий'))).toBe(true)
  })

  it('flags missing source port', () => {
    const nodes = [node('n1', 'pump', 'P1'), node('n2', 'tank', 'T1')]
    const edges: CanvasEdge[] = [
      {
        id: 'e1',
        sourceNodeId: 'n1',
        sourcePortId: 'nope',
        targetNodeId: 'n2',
        targetPortId: 'in',
      },
    ]
    const errors = validateGraph(nodes, edges, componentTypes)
    expect(errors.some((e) => e.message.includes('не найден'))).toBe(true)
  })
})
