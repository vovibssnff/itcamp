import { describe, expect, it } from 'vitest'
import { isEdgeFlowing, edgeFlowKey } from '@/canvas/shared/edgeFlow'
import type { CanvasEdge, CanvasNode } from '@/store/constructor'
import type { TagValue } from '@/store/session'

function tv(tag: string, value: number): TagValue {
  return { tag, value, unit: '', alarmState: 'normal', timestamp: 0 }
}

const nodes: CanvasNode[] = [
  {
    id: 'pump-n1',
    typeId: 'centrifugal_pump',
    x: 0,
    y: 0,
    label: 'Н-1',
    parameters: {},
    tags: ['PUMP-N1', 'FRC 404'],
  },
  {
    id: 'vessel',
    typeId: 'vessel',
    x: 100,
    y: 0,
    label: 'Е-15',
    parameters: {},
    tags: ['PRA 312'],
  },
]

const edge: CanvasEdge = {
  id: 'e1',
  sourceNodeId: 'pump-n1',
  sourcePortId: 'outlet',
  targetNodeId: 'vessel',
  targetPortId: 'inlet',
  type: 'liquid',
}

describe('isEdgeFlowing', () => {
  it('is false when session inactive', () => {
    expect(isEdgeFlowing(edge, nodes, [], { 'PUMP-N1': tv('PUMP-N1', 1) }, false, 'liquid')).toBe(
      false,
    )
  })

  it('follows pump running state', () => {
    expect(isEdgeFlowing(edge, nodes, [], { 'PUMP-N1': tv('PUMP-N1', 1) }, true, 'liquid')).toBe(
      true,
    )
    expect(isEdgeFlowing(edge, nodes, [], { 'PUMP-N1': tv('PUMP-N1', 0) }, true, 'liquid')).toBe(
      false,
    )
  })

  it('does not animate signal wires', () => {
    expect(isEdgeFlowing(edge, nodes, [], { 'PUMP-N1': tv('PUMP-N1', 1) }, true, 'signal')).toBe(
      false,
    )
  })

  it('uses flow-rate tags when no pump on endpoints', () => {
    const rateNodes: CanvasNode[] = [
      { id: 'a', typeId: 'x', x: 0, y: 0, label: 'A', parameters: {}, tags: ['FRC 408'] },
      { id: 'b', typeId: 'x', x: 1, y: 0, label: 'B', parameters: {}, tags: [] },
    ]
    const e: CanvasEdge = {
      id: 'e2',
      sourceNodeId: 'a',
      sourcePortId: 'o',
      targetNodeId: 'b',
      targetPortId: 'i',
      type: 'liquid',
    }
    expect(isEdgeFlowing(e, rateNodes, [], { 'FRC 408': tv('FRC 408', 80) }, true, 'liquid')).toBe(
      true,
    )
    expect(isEdgeFlowing(e, rateNodes, [], { 'FRC 408': tv('FRC 408', 2) }, true, 'liquid')).toBe(
      false,
    )
  })
})

describe('edgeFlowKey', () => {
  it('changes when pump stops', () => {
    const mediaOf = () => 'liquid' as const
    const on = edgeFlowKey([edge], nodes, [], { 'PUMP-N1': tv('PUMP-N1', 1) }, true, mediaOf)
    const off = edgeFlowKey([edge], nodes, [], { 'PUMP-N1': tv('PUMP-N1', 0) }, true, mediaOf)
    expect(on).toBe('1')
    expect(off).toBe('0')
  })
})
