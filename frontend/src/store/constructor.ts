import { create } from 'zustand'

export interface CanvasNode {
  id: string
  typeId: string
  x: number
  y: number
  /** Per-node size — defaults to DEFAULT_NODE_W × DEFAULT_NODE_H when omitted */
  width?: number
  height?: number
  label: string
  parameters: Record<string, unknown>
  data?: Record<string, unknown>
  validationErrors?: string[]
}

export interface CanvasEdge {
  id: string
  sourceNodeId: string
  sourcePortId: string
  targetNodeId: string
  targetPortId: string
  validationErrors?: string[]
}

export interface ConstructorCommand {
  type:
    | 'add_node'
    | 'remove_node'
    | 'move_node'
    | 'add_edge'
    | 'remove_edge'
    | 'update_params'
    | 'resize_node'
  description?: string
  before: Partial<ConstructorState>
  after: Partial<ConstructorState>
}

export const DEFAULT_NODE_W = 88
export const DEFAULT_NODE_H = 66

interface ConstructorState {
  templateId: string | null
  nodes: CanvasNode[]
  edges: CanvasEdge[]
  selectedNodeId: string | null
  selectedEdgeId: string | null
  undoStack: ConstructorCommand[]
  redoStack: ConstructorCommand[]
  isDirty: boolean
  validationErrors: string[]
  zoom: number
  panX: number
  panY: number

  setTemplate: (id: string) => void
  setNodes: (nodes: CanvasNode[]) => void
  setEdges: (edges: CanvasEdge[]) => void
  addNode: (node: CanvasNode) => void
  updateNode: (id: string, patch: Partial<CanvasNode>) => void
  /** Live position update during drag — does NOT push to undo stack */
  liveUpdateNodePosition: (id: string, x: number, y: number) => void
  removeNode: (id: string) => void
  addEdge: (edge: CanvasEdge) => void
  removeEdge: (id: string) => void
  selectNode: (id: string | null) => void
  selectEdge: (id: string | null) => void
  setZoom: (zoom: number) => void
  setPan: (x: number, y: number) => void
  markClean: () => void
  setValidationErrors: (errors: string[]) => void
  undo: () => void
  redo: () => void
}

const MAX_UNDO = 50

function pushCommand(
  state: Pick<ConstructorState, 'undoStack'>,
  cmd: ConstructorCommand,
): ConstructorCommand[] {
  return [...state.undoStack.slice(-(MAX_UNDO - 1)), cmd]
}

export const useConstructorStore = create<ConstructorState>()((set, get) => ({
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

  setTemplate: (id) => set({ templateId: id }),
  setNodes: (nodes) => set({ nodes, isDirty: true }),
  setEdges: (edges) => set({ edges, isDirty: true }),

  addNode: (node) =>
    set((s) => {
      const nodeWithSize: CanvasNode = {
        ...node,
        width: node.width ?? DEFAULT_NODE_W,
        height: node.height ?? DEFAULT_NODE_H,
      }
      const before = { nodes: s.nodes }
      const after = { nodes: [...s.nodes, nodeWithSize] }
      const cmd: ConstructorCommand = {
        type: 'add_node',
        description: `Add ${node.label}`,
        before,
        after,
      }
      return {
        nodes: [...s.nodes, nodeWithSize],
        isDirty: true,
        undoStack: pushCommand(s, cmd),
        redoStack: [],
      }
    }),

  updateNode: (id, patch) =>
    set((s) => {
      const before = { nodes: s.nodes }
      const updatedNodes = s.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n))
      const after = { nodes: updatedNodes }
      const isMove = 'x' in patch || 'y' in patch
      const isResize = 'width' in patch || 'height' in patch
      const cmd: ConstructorCommand = {
        type: isResize ? 'resize_node' : isMove ? 'move_node' : 'update_params',
        before,
        after,
      }
      return {
        nodes: updatedNodes,
        isDirty: true,
        undoStack: pushCommand(s, cmd),
        redoStack: [],
      }
    }),

  /** Real-time position update during drag — no undo entry to avoid stack flood */
  liveUpdateNodePosition: (id, x, y) =>
    set((s) => ({
      nodes: s.nodes.map((n) => (n.id === id ? { ...n, x, y } : n)),
    })),

  removeNode: (id) =>
    set((s) => {
      const before = { nodes: s.nodes, edges: s.edges }
      const nodes = s.nodes.filter((n) => n.id !== id)
      const edges = s.edges.filter((e) => e.sourceNodeId !== id && e.targetNodeId !== id)
      const after = { nodes, edges }
      const cmd: ConstructorCommand = { type: 'remove_node', before, after }
      return {
        nodes,
        edges,
        selectedNodeId: s.selectedNodeId === id ? null : s.selectedNodeId,
        isDirty: true,
        undoStack: pushCommand(s, cmd),
        redoStack: [],
      }
    }),

  addEdge: (edge) =>
    set((s) => {
      const before = { edges: s.edges }
      const after = { edges: [...s.edges, edge] }
      const cmd: ConstructorCommand = { type: 'add_edge', before, after }
      return {
        edges: [...s.edges, edge],
        isDirty: true,
        undoStack: pushCommand(s, cmd),
        redoStack: [],
      }
    }),

  removeEdge: (id) =>
    set((s) => {
      const before = { edges: s.edges }
      const edges = s.edges.filter((e) => e.id !== id)
      const after = { edges }
      const cmd: ConstructorCommand = { type: 'remove_edge', before, after }
      return {
        edges,
        selectedEdgeId: s.selectedEdgeId === id ? null : s.selectedEdgeId,
        isDirty: true,
        undoStack: pushCommand(s, cmd),
        redoStack: [],
      }
    }),

  selectNode: (id) => set({ selectedNodeId: id, selectedEdgeId: null }),
  selectEdge: (id) => set({ selectedEdgeId: id, selectedNodeId: null }),
  setZoom: (zoom) => set({ zoom: Math.max(0.1, Math.min(4, zoom)) }),
  setPan: (panX, panY) => set({ panX, panY }),
  markClean: () => set({ isDirty: false }),
  setValidationErrors: (errors) => set({ validationErrors: errors }),

  undo: () => {
    const { undoStack, redoStack } = get()
    if (undoStack.length === 0) return
    const last = undoStack[undoStack.length - 1]
    if (!last) return
    set({
      ...last.before,
      undoStack: undoStack.slice(0, -1),
      redoStack: [...redoStack, last],
      isDirty: true,
    })
  },

  redo: () => {
    const { undoStack, redoStack } = get()
    if (redoStack.length === 0) return
    const last = redoStack[redoStack.length - 1]
    if (!last) return
    set({
      ...last.after,
      undoStack: [...undoStack, last],
      redoStack: redoStack.slice(0, -1),
      isDirty: true,
    })
  },
}))
