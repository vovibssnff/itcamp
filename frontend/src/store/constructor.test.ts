import { describe, it, expect, beforeEach } from 'vitest'
import { useConstructorStore, type CanvasNode, type CanvasEdge } from './constructor'

function reset() {
  useConstructorStore.setState({
    templateId: null,
    nodes: [],
    edges: [],
    selectedNodeId: null,
    selectedEdgeId: null,
    undoStack: [],
    redoStack: [],
    isDirty: false,
    validationErrors: [],
    zoom: 1,
    panX: 0,
    panY: 0,
  })
}

const n1: CanvasNode = { id: 'n1', typeId: 't', x: 0, y: 0, label: 'A', parameters: {} }
const n2: CanvasNode = { id: 'n2', typeId: 't', x: 10, y: 10, label: 'B', parameters: {} }
const e1: CanvasEdge = {
  id: 'e1',
  sourceNodeId: 'n1',
  sourcePortId: 'o',
  targetNodeId: 'n2',
  targetPortId: 'i',
}

describe('constructorStore', () => {
  beforeEach(reset)

  it('adds and updates a node', () => {
    const s = useConstructorStore.getState()
    s.addNode(n1)
    expect(useConstructorStore.getState().nodes).toHaveLength(1)
    expect(useConstructorStore.getState().isDirty).toBe(true)
    s.updateNode('n1', { label: 'Renamed' })
    expect(useConstructorStore.getState().nodes[0]?.label).toBe('Renamed')
  })

  it('removes a node and its connected edges', () => {
    const s = useConstructorStore.getState()
    s.addNode(n1)
    s.addNode(n2)
    s.addEdge(e1)
    s.removeNode('n1')
    const state = useConstructorStore.getState()
    expect(state.nodes).toHaveLength(1)
    expect(state.edges).toHaveLength(0)
  })

  it('selects node and edge exclusively', () => {
    const s = useConstructorStore.getState()
    s.selectNode('n1')
    expect(useConstructorStore.getState().selectedNodeId).toBe('n1')
    s.selectEdge('e1')
    const state = useConstructorStore.getState()
    expect(state.selectedEdgeId).toBe('e1')
    expect(state.selectedNodeId).toBeNull()
  })

  it('clamps zoom between 0.1 and 4', () => {
    const s = useConstructorStore.getState()
    s.setZoom(100)
    expect(useConstructorStore.getState().zoom).toBe(4)
    s.setZoom(0.001)
    expect(useConstructorStore.getState().zoom).toBe(0.1)
  })

  it('markClean resets dirty flag', () => {
    const s = useConstructorStore.getState()
    s.addNode(n1)
    s.markClean()
    expect(useConstructorStore.getState().isDirty).toBe(false)
  })

  it('sets validation errors and pan', () => {
    const s = useConstructorStore.getState()
    s.setValidationErrors(['err'])
    expect(useConstructorStore.getState().validationErrors).toEqual(['err'])
    s.setPan(5, 6)
    expect(useConstructorStore.getState().panX).toBe(5)
    expect(useConstructorStore.getState().panY).toBe(6)
  })

  it('removes an edge directly', () => {
    const s = useConstructorStore.getState()
    s.addNode(n1)
    s.addNode(n2)
    s.addEdge(e1)
    s.removeEdge('e1')
    expect(useConstructorStore.getState().edges).toHaveLength(0)
  })
})
