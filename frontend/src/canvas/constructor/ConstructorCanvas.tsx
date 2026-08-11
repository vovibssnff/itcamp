import { useRef, useCallback, useEffect, useState } from 'react'
import { Stage, Layer, Rect, Group, Circle, Line } from 'react-konva'
import type Konva from 'konva'
import KonvaLib from 'konva'
import { useConstructorStore, type CanvasEdge } from '@/store/constructor'
import type { ComponentType } from '@/mocks/fixtures/components'
import { PortConnection } from './PortConnection'
import { ValidationOverlay } from './ValidationOverlay'
import { EquipmentWidget } from '@/canvas/shared/EquipmentWidget'
import {
  getNodeSize,
  getAllPortAnchors,
  mediaStrokeColor,
  resolveEdgeMediaType,
  type EdgeMediaType,
} from '@/canvas/shared/equipmentGeometry'
import { type CanvasTokens } from '@/theme/tokens'
import { useCanvasTokens } from '@/theme/useCanvasTokens'
import { categoryLabel } from '@/utils/component-display'

const GRID_SIZE = 20
const DOT_SPACING = GRID_SIZE

function makePortColors(tk: CanvasTokens): Record<string, string> {
  return {
    liquid: tk.accent,
    gas: tk.warn,
    steam: '#c4b5a0',
    signal: tk.zone.gdm,
    electric: tk.alarm,
  }
}

function snapToGrid(v: number): number {
  return Math.round(v / GRID_SIZE) * GRID_SIZE
}

interface DraftEdge {
  sourceNodeId: string
  sourcePortId: string
  sourceType: string
  x1: number
  y1: number
  x2: number
  y2: number
}

interface ConstructorCanvasProps {
  componentTypes: ComponentType[]
  width: number
  height: number
  onDropComponent: (typeId: string, x: number, y: number) => void
  /** Preview marching-dash flow on edges (toolbar toggle). */
  previewFlow?: boolean
}

export function ConstructorCanvas({
  componentTypes,
  width,
  height,
  onDropComponent,
  previewFlow = false,
}: ConstructorCanvasProps) {
  const stageRef = useRef<Konva.Stage>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const edgesLayerRef = useRef<Konva.Layer>(null)

  const {
    nodes,
    edges,
    selectedNodeId,
    selectedEdgeId,
    zoom,
    panX,
    panY,
    selectNode,
    selectEdge,
    updateNode,
    liveUpdateNodePosition,
    removeEdge,
    addEdge,
    setZoom,
    setPan,
  } = useConstructorStore()

  const canvasTokens = useCanvasTokens()
  const PORT_COLORS = makePortColors(canvasTokens)

  const [draftEdge, setDraftEdge] = useState<DraftEdge | null>(null)
  const [hoveredPort, setHoveredPort] = useState<{ nodeId: string; portId: string } | null>(null)
  const [isDraggingStage, setIsDraggingStage] = useState(false)
  const [_resizingNode, setResizingNode] = useState<{
    nodeId: string
    startW: number
    startH: number
    startMX: number
    startMY: number
  } | null>(null)
  const lastPos = useRef<{ x: number; y: number } | null>(null)
  const resizingNodeRef = useRef<typeof _resizingNode>(null)
  const stageWasClicked = useRef(false)
  const hasMoved = useRef(false)

  const dotGrid = useCallback(() => {
    const dots: { x: number; y: number }[] = []
    const cols = Math.ceil(width / DOT_SPACING) + 2
    const rows = Math.ceil(height / DOT_SPACING) + 2
    const startX = Math.floor(-panX / DOT_SPACING) * DOT_SPACING
    const startY = Math.floor(-panY / DOT_SPACING) * DOT_SPACING
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        dots.push({
          x: (startX + c * DOT_SPACING) * zoom + panX * zoom,
          y: (startY + r * DOT_SPACING) * zoom + panY * zoom,
        })
      }
    }
    return dots
  }, [width, height, panX, panY, zoom])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const typeId = e.dataTransfer.getData('component-type-id')
      if (!typeId || !stageRef.current) return
      const stage = stageRef.current
      const container = stage.container()
      const rect = container.getBoundingClientRect()
      const rawX = (e.clientX - rect.left - panX * zoom) / zoom
      const rawY = (e.clientY - rect.top - panY * zoom) / zoom
      onDropComponent(typeId, snapToGrid(rawX), snapToGrid(rawY))
    },
    [panX, panY, zoom, onDropComponent],
  )

  const handleWheel = useCallback(
    (e: Konva.KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault()
      const scaleBy = 1.08
      const stage = e.target.getStage()
      if (!stage) return
      const oldScale = zoom
      const pointer = stage.getPointerPosition()
      if (!pointer) return
      const newScale = e.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy
      const clamped = Math.max(0.15, Math.min(4, newScale))
      const newPanX = pointer.x / clamped - pointer.x / oldScale + panX
      const newPanY = pointer.y / clamped - pointer.y / oldScale + panY
      setZoom(clamped)
      setPan(newPanX, newPanY)
    },
    [zoom, panX, panY, setZoom, setPan],
  )

  const handleStageMouseDown = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    if (e.target !== e.target.getStage()) return
    if (e.evt.button === 0 || e.evt.button === 1) {
      stageWasClicked.current = true
      hasMoved.current = false
      setIsDraggingStage(true)
      lastPos.current = { x: e.evt.clientX, y: e.evt.clientY }
      e.evt.preventDefault()
    }
  }, [])

  const handleStageMouseMove = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (isDraggingStage && lastPos.current) {
        hasMoved.current = true
        const dx = (e.evt.clientX - lastPos.current.x) / zoom
        const dy = (e.evt.clientY - lastPos.current.y) / zoom
        setPan(panX + dx, panY + dy)
        lastPos.current = { x: e.evt.clientX, y: e.evt.clientY }
      }
      if (draftEdge && stageRef.current) {
        const pos = stageRef.current.getPointerPosition()
        if (pos) {
          const worldX = pos.x / zoom - panX
          const worldY = pos.y / zoom - panY
          setDraftEdge((d) => (d ? { ...d, x2: worldX, y2: worldY } : null))
        }
      }
      const rn = resizingNodeRef.current
      if (rn && stageRef.current) {
        const pos = stageRef.current.getPointerPosition()
        if (pos) {
          const worldX = pos.x / zoom - panX
          const worldY = pos.y / zoom - panY
          const dx = worldX - rn.startMX
          const dy = worldY - rn.startMY
          const newW = snapToGrid(Math.max(GRID_SIZE * 2, rn.startW + dx))
          const newH = snapToGrid(Math.max(GRID_SIZE * 2, rn.startH + dy))
          useConstructorStore.setState((s) => ({
            nodes: s.nodes.map((n) =>
              n.id === rn.nodeId ? { ...n, width: newW, height: newH } : n,
            ),
          }))
        }
      }
    },
    [isDraggingStage, zoom, panX, panY, setPan, draftEdge],
  )

  const handleStageMouseUp = useCallback(() => {
    const wasStage = stageWasClicked.current
    const moved = hasMoved.current
    stageWasClicked.current = false
    hasMoved.current = false
    setIsDraggingStage(false)
    lastPos.current = null

    if (wasStage && !moved) {
      selectNode(null)
      selectEdge(null)
    }

    if (draftEdge && !hoveredPort) {
      setDraftEdge(null)
    }

    const rn = resizingNodeRef.current
    if (rn) {
      const node = nodes.find((n) => n.id === rn.nodeId)
      if (node) {
        updateNode(rn.nodeId, { width: node.width, height: node.height })
      }
      resizingNodeRef.current = null
      setResizingNode(null)
      if (containerRef.current) containerRef.current.style.cursor = 'default'
    }
  }, [draftEdge, hoveredPort, nodes, updateNode, selectNode, selectEdge])

  function handlePortMouseDown(
    e: Konva.KonvaEventObject<MouseEvent>,
    nodeId: string,
    portId: string,
    x: number,
    y: number,
    portType: string,
  ) {
    e.cancelBubble = true
    setDraftEdge({
      sourceNodeId: nodeId,
      sourcePortId: portId,
      sourceType: portType,
      x1: x,
      y1: y,
      x2: x,
      y2: y,
    })
  }

  function handlePortMouseUp(
    e: Konva.KonvaEventObject<MouseEvent>,
    nodeId: string,
    portId: string,
  ) {
    e.cancelBubble = true
    if (draftEdge && draftEdge.sourceNodeId !== nodeId) {
      const media = resolveEdgeMediaType(undefined, draftEdge.sourceType) as EdgeMediaType
      const newEdge: CanvasEdge = {
        id: `e-${Date.now()}`,
        sourceNodeId: draftEdge.sourceNodeId,
        sourcePortId: draftEdge.sourcePortId,
        targetNodeId: nodeId,
        targetPortId: portId,
        type: media,
      }
      addEdge(newEdge)
    }
    setDraftEdge(null)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedEdgeId) removeEdge(selectedEdgeId)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedEdgeId, removeEdge])

  // Layer-level flow animation when preview is on (in addition to per-edge anim)
  useEffect(() => {
    if (!previewFlow) return
    const layer = edgesLayerRef.current
    if (!layer) return
    const anim = new KonvaLib.Animation((frame) => {
      if (!frame) return
      layer.find('.pipe-flow').forEach((shape) => {
        const line = shape as KonvaLib.Line
        line.dashOffset(line.dashOffset() - frame.timeDiff * 0.03)
      })
    }, layer)
    anim.start()
    return () => {
      anim.stop()
    }
  }, [previewFlow, edges.length])

  function isCompatiblePort(nodeId: string, portId: string): boolean {
    if (!draftEdge) return true
    if (nodeId === draftEdge.sourceNodeId) return false
    const ct = componentTypes.find((c) => c.id === nodes.find((n) => n.id === nodeId)?.typeId)
    const port = ct?.ports.find((p) => p.id === portId)
    if (!port) return false
    const srcPort = componentTypes
      .find((c) => c.id === nodes.find((n) => n.id === draftEdge.sourceNodeId)?.typeId)
      ?.ports.find((p) => p.id === draftEdge.sourcePortId)
    if (!srcPort) return true
    // steam and gas are compatible with each other for wiring
    const sameMedia =
      port.type === srcPort.type ||
      (['gas', 'steam'].includes(port.type) && ['gas', 'steam'].includes(srcPort.type))
    return sameMedia && port.direction !== srcPort.direction
  }

  return (
    <div
      ref={containerRef}
      style={{
        width,
        height,
        background: canvasTokens.bg.canvas,
        cursor: isDraggingStage ? 'grabbing' : 'default',
        position: 'absolute',
        top: 0,
        left: 0,
      }}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <Stage
        ref={stageRef}
        width={width}
        height={height}
        scaleX={zoom}
        scaleY={zoom}
        x={panX * zoom}
        y={panY * zoom}
        onWheel={handleWheel}
        onMouseDown={handleStageMouseDown}
        onMouseMove={handleStageMouseMove}
        onMouseUp={handleStageMouseUp}
      >
        <Layer listening={false}>
          {dotGrid().map((d, i) => (
            <Circle
              key={i}
              x={d.x / zoom - panX}
              y={d.y / zoom - panY}
              radius={1}
              fill={canvasTokens.gridDot}
            />
          ))}
        </Layer>

        <Layer ref={edgesLayerRef}>
          {edges.map((edge) => (
            <PortConnection
              key={edge.id}
              edge={edge}
              nodes={nodes}
              componentTypes={componentTypes}
              isSelected={selectedEdgeId === edge.id}
              flowing={previewFlow}
              onSelect={() => selectEdge(edge.id)}
              onDelete={() => removeEdge(edge.id)}
            />
          ))}

          {draftEdge && (
            <Line
              points={[draftEdge.x1, draftEdge.y1, draftEdge.x2, draftEdge.y2]}
              stroke={mediaStrokeColor(draftEdge.sourceType, canvasTokens)}
              strokeWidth={1.5}
              dash={[5, 3]}
              listening={false}
            />
          )}
        </Layer>

        <Layer>
          {nodes.map((node) => {
            const ct = componentTypes.find((c) => c.id === node.typeId)
            if (!ct) return null

            const size = getNodeSize(node, ct.shape)
            const portPositions = getAllPortAnchors(node, ct)
            const isSelected = selectedNodeId === node.id

            return (
              <Group
                key={node.id}
                x={node.x}
                y={node.y}
                draggable
                onClick={(e) => {
                  e.cancelBubble = true
                  selectNode(node.id)
                }}
                onDragMove={(e) => {
                  liveUpdateNodePosition(node.id, e.target.x(), e.target.y())
                }}
                onDragEnd={(e) => {
                  const x = snapToGrid(e.target.x())
                  const y = snapToGrid(e.target.y())
                  e.target.x(x)
                  e.target.y(y)
                  updateNode(node.id, { x, y })
                }}
              >
                <Rect
                  x={0}
                  y={0}
                  width={size.w}
                  height={size.h}
                  fill="transparent"
                  onMouseEnter={() => {
                    if (!resizingNodeRef.current && containerRef.current)
                      containerRef.current.style.cursor = 'move'
                  }}
                  onMouseLeave={() => {
                    if (!resizingNodeRef.current && containerRef.current)
                      containerRef.current.style.cursor = 'default'
                  }}
                />

                <EquipmentWidget
                  node={{ ...node, x: 0, y: 0 }}
                  shape={ct.shape}
                  mode="edit"
                  isSelected={isSelected}
                  interactive={false}
                  categoryLabel={categoryLabel(ct.category).toUpperCase()}
                />

                {Object.entries(portPositions).map(([portId, pos]) => {
                  const localX = pos.x - node.x
                  const localY = pos.y - node.y
                  const isHovered =
                    hoveredPort?.nodeId === node.id && hoveredPort?.portId === portId
                  const portColor = PORT_COLORS[pos.type] ?? canvasTokens.text.secondary

                  let portFill = portColor
                  let portRadius = isHovered ? 5 : 4
                  let portOpacity = 1

                  if (draftEdge && draftEdge.sourceNodeId !== node.id) {
                    const compatible = isCompatiblePort(node.id, portId)
                    portOpacity = compatible ? 1 : 0.25
                    portFill = compatible ? canvasTokens.accent : portColor
                    portRadius = compatible ? 6 : 3
                  }

                  return (
                    <Circle
                      key={portId}
                      x={localX}
                      y={localY}
                      radius={portRadius}
                      fill={portFill}
                      stroke={canvasTokens.bg.canvas}
                      strokeWidth={1.5}
                      opacity={portOpacity}
                      onMouseEnter={() => setHoveredPort({ nodeId: node.id, portId })}
                      onMouseLeave={() => setHoveredPort(null)}
                      onMouseDown={(e) =>
                        handlePortMouseDown(e, node.id, portId, pos.x, pos.y, pos.type)
                      }
                      onMouseUp={(e) => handlePortMouseUp(e, node.id, portId)}
                    />
                  )
                })}

                {isSelected && (
                  <Rect
                    x={size.w - 10}
                    y={size.h - 10}
                    width={10}
                    height={10}
                    fill={canvasTokens.accent}
                    cornerRadius={1}
                    opacity={0.9}
                    onMouseEnter={() => {
                      if (containerRef.current) containerRef.current.style.cursor = 'nwse-resize'
                    }}
                    onMouseLeave={() => {
                      if (containerRef.current) containerRef.current.style.cursor = 'default'
                    }}
                    onMouseDown={(e) => {
                      e.cancelBubble = true
                      const stage = stageRef.current
                      if (!stage) return
                      const pos = stage.getPointerPosition()
                      if (!pos) return
                      const worldX = pos.x / zoom - panX
                      const worldY = pos.y / zoom - panY
                      const rn = {
                        nodeId: node.id,
                        startW: size.w,
                        startH: size.h,
                        startMX: worldX,
                        startMY: worldY,
                      }
                      resizingNodeRef.current = rn
                      setResizingNode(rn)
                      if (containerRef.current) containerRef.current.style.cursor = 'nwse-resize'
                    }}
                  />
                )}
              </Group>
            )
          })}

          <ValidationOverlay nodes={nodes} />
        </Layer>
      </Stage>

      {/* Media legend */}
      <div
        style={{
          position: 'absolute',
          left: 10,
          bottom: 10,
          display: 'flex',
          gap: 10,
          padding: '4px 8px',
          background: canvasTokens.bg.elevated,
          border: `1px solid ${canvasTokens.border.subtle}`,
          borderRadius: 4,
          fontSize: 10,
          fontFamily: canvasTokens.font.mono,
          color: canvasTokens.text.secondary,
          pointerEvents: 'none',
        }}
      >
        {(['liquid', 'gas', 'steam', 'signal', 'electric'] as const).map((m) => (
          <span key={m} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span
              style={{
                width: 10,
                height: 3,
                background: mediaStrokeColor(m, canvasTokens),
                display: 'inline-block',
              }}
            />
            {m}
          </span>
        ))}
      </div>
    </div>
  )
}
