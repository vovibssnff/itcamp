import { create } from 'zustand'

export interface CanvasNode {
  id: string
  typeId: string
  x: number
  y: number
  label: string
  parameters: Record<string, unknown>
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
  type: 'add_node' | 'remove_node' | 'move_node' | 'add_edge' | 'remove_edge' | 'update_params'
  before: Partial<ConstructorState>
  after: Partial<ConstructorState>
}

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
    set((s) => ({
      nodes: [...s.nodes, node],
      isDirty: true,
      undoStack: [...s.undoStack.slice(-49)],
    })),

  updateNode: (id, patch) =>
    set((s) => ({
      nodes: s.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)),
      isDirty: true,
    })),

  removeNode: (id) =>
    set((s) => ({
      nodes: s.nodes.filter((n) => n.id !== id),
      edges: s.edges.filter((e) => e.sourceNodeId !== id && e.targetNodeId !== id),
      selectedNodeId: s.selectedNodeId === id ? null : s.selectedNodeId,
      isDirty: true,
    })),

  addEdge: (edge) =>
    set((s) => ({
      edges: [...s.edges, edge],
      isDirty: true,
    })),

  removeEdge: (id) =>
    set((s) => ({
      edges: s.edges.filter((e) => e.id !== id),
      selectedEdgeId: s.selectedEdgeId === id ? null : s.selectedEdgeId,
      isDirty: true,
    })),

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
