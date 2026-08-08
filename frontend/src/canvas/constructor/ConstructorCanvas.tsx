import { useRef, useCallback, useEffect, useState } from 'react'
import { Stage, Layer, Rect, Group, Text, Circle, Line } from 'react-konva'
import type Konva from 'konva'
import {
  useConstructorStore,
  type CanvasNode,
  type CanvasEdge,
  DEFAULT_NODE_W,
  DEFAULT_NODE_H,
} from '@/store/constructor'
import type { ComponentType } from '@/mocks/fixtures/components'
import { PortConnection } from './PortConnection'
import { ValidationOverlay } from './ValidationOverlay'
import { type CanvasTokens } from '@/theme/tokens'
import { useCanvasTokens } from '@/theme/useCanvasTokens'

const GRID_SIZE = 20
const DOT_SPACING = GRID_SIZE

function makeShapeColors(tk: CanvasTokens): Record<string, string> {
  return {
    pump: tk.accent,
    column: tk.warn,
    vessel: tk.zone.gdm,
    heatexchanger: '#9b8fff',
    valve: tk.accent,
    sensor: tk.warn,
    controller: tk.zone.gdm,
    separator: '#9b8fff',
    compressor: tk.alarm,
    furnace: tk.zone.atm,
  }
}

function makePortColors(tk: CanvasTokens): Record<string, string> {
  return {
    liquid: tk.accent,
    gas: tk.warn,
    signal: tk.zone.gdm,
    electric: tk.alarm,
  }
}

function snapToGrid(v: number): number {
  return Math.round(v / GRID_SIZE) * GRID_SIZE
}

function getPortPositions(node: CanvasNode, ct: ComponentType) {
  const nodeW = node.width ?? DEFAULT_NODE_W
  const nodeH = node.height ?? DEFAULT_NODE_H
  const inputs = ct.ports.filter((p) => p.direction === 'in')
  const outputs = ct.ports.filter((p) => p.direction === 'out')
  const positions: Record<string, { x: number; y: number; type: string; direction: string }> = {}

  inputs.forEach((p, i) => {
    const spacing = nodeH / (inputs.length + 1)
    positions[p.id] = { x: node.x, y: node.y + spacing * (i + 1), type: p.type, direction: 'in' }
  })
  outputs.forEach((p, i) => {
    const spacing = nodeH / (outputs.length + 1)
    positions[p.id] = {
      x: node.x + nodeW,
      y: node.y + spacing * (i + 1),
      type: p.type,
      direction: 'out',
    }
  })

  return positions
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
}

export function ConstructorCanvas({
  componentTypes,
  width,
  height,
  onDropComponent,
}: ConstructorCanvasProps) {
  const stageRef = useRef<Konva.Stage>(null)
  const containerRef = useRef<HTMLDivElement>(null)

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
  const SHAPE_COLORS = makeShapeColors(canvasTokens)
  const PORT_COLORS = makePortColors(canvasTokens)

  const [draftEdge, setDraftEdge] = useState<DraftEdge | null>(null)
  const [hoveredPort, setHoveredPort] = useState<{ nodeId: string; portId: string } | null>(null)
  const [isDraggingStage, setIsDraggingStage] = useState(false)
  const [resizingNode, setResizingNode] = useState<{
    nodeId: string
    startW: number
    startH: number
    startMX: number
    startMY: number
  } | null>(null)
  const lastPos = useRef<{ x: number; y: number } | null>(null)

  // Dot grid background
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

  // Drag-over / drop from palette
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

  // Wheel zoom
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

  // Stage pan (alt+drag / middle button)
  const handleStageMouseDown = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (e.target !== e.target.getStage()) return
      if (e.evt.button === 1 || (e.evt.button === 0 && e.evt.altKey)) {
        setIsDraggingStage(true)
        lastPos.current = { x: e.evt.clientX, y: e.evt.clientY }
        e.evt.preventDefault()
      } else {
        selectNode(null)
        selectEdge(null)
      }
    },
    [selectNode, selectEdge],
  )

  const handleStageMouseMove = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (isDraggingStage && lastPos.current) {
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
      if (resizingNode && stageRef.current) {
        const pos = stageRef.current.getPointerPosition()
        if (pos) {
          const worldX = pos.x / zoom - panX
          const worldY = pos.y / zoom - panY
          const dx = worldX - resizingNode.startMX
          const dy = worldY - resizingNode.startMY
          const newW = snapToGrid(Math.max(GRID_SIZE * 4, resizingNode.startW + dx))
          const newH = snapToGrid(Math.max(GRID_SIZE * 3, resizingNode.startH + dy))
          liveUpdateNodePosition(
            resizingNode.nodeId,
            nodes.find((n) => n.id === resizingNode.nodeId)?.x ?? 0,
            nodes.find((n) => n.id === resizingNode.nodeId)?.y ?? 0,
          )
          // Update width/height live
          useConstructorStore.setState((s) => ({
            nodes: s.nodes.map((n) =>
              n.id === resizingNode.nodeId ? { ...n, width: newW, height: newH } : n,
            ),
          }))
        }
      }
    },
    [
      isDraggingStage,
      zoom,
      panX,
      panY,
      setPan,
      draftEdge,
      resizingNode,
      liveUpdateNodePosition,
      nodes,
    ],
  )

  const handleStageMouseUp = useCallback(() => {
    setIsDraggingStage(false)
    lastPos.current = null
    if (draftEdge && !hoveredPort) {
      setDraftEdge(null)
    }
    if (resizingNode) {
      // Persist final size to undo stack
      const node = nodes.find((n) => n.id === resizingNode.nodeId)
      if (node) {
        updateNode(resizingNode.nodeId, { width: node.width, height: node.height })
      }
      setResizingNode(null)
    }
  }, [draftEdge, hoveredPort, resizingNode, nodes, updateNode])

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
      const newEdge: CanvasEdge = {
        id: `e-${Date.now()}`,
        sourceNodeId: draftEdge.sourceNodeId,
        sourcePortId: draftEdge.sourcePortId,
        targetNodeId: nodeId,
        targetPortId: portId,
      }
      addEdge(newEdge)
    }
    setDraftEdge(null)
  }

  // Delete key
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedEdgeId) removeEdge(selectedEdgeId)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedEdgeId, removeEdge])

  /** Check if a port is compatible with the current draft edge */
  function isCompatiblePort(nodeId: string, portId: string): boolean {
    if (!draftEdge) return true
    if (nodeId === draftEdge.sourceNodeId) return false
    const ct = componentTypes.find((c) => c.id === nodes.find((n) => n.id === nodeId)?.typeId)
    const port = ct?.ports.find((p) => p.id === portId)
    if (!port) return false
    // Compatible: same type, opposite direction
    const srcPort = componentTypes
      .find((c) => c.id === nodes.find((n) => n.id === draftEdge.sourceNodeId)?.typeId)
      ?.ports.find((p) => p.id === draftEdge.sourcePortId)
    if (!srcPort) return true
    return port.type === srcPort.type && port.direction !== srcPort.direction
  }

  return (
    <div
      ref={containerRef}
      style={{
        width,
        height,
        background: canvasTokens.bg.canvas,
        cursor: isDraggingStage ? 'grab' : 'default',
        position: 'relative',
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
        {/* Dot grid */}
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

        {/* Edges */}
        <Layer>
          {edges.map((edge) => (
            <PortConnection
              key={edge.id}
              edge={edge}
              nodes={nodes}
              componentTypes={componentTypes}
              isSelected={selectedEdgeId === edge.id}
              onSelect={() => selectEdge(edge.id)}
              onDelete={() => removeEdge(edge.id)}
            />
          ))}

          {/* Draft edge */}
          {draftEdge && (
            <Line
              points={[draftEdge.x1, draftEdge.y1, draftEdge.x2, draftEdge.y2]}
              stroke={canvasTokens.accent}
              strokeWidth={1.5}
              dash={[5, 3]}
              listening={false}
            />
          )}
        </Layer>

        {/* Nodes */}
        <Layer>
          {nodes.map((node) => {
            const ct = componentTypes.find((c) => c.id === node.typeId)
            if (!ct) return null

            const nodeW = node.width ?? DEFAULT_NODE_W
            const nodeH = node.height ?? DEFAULT_NODE_H
            const portPositions = getPortPositions(node, ct)
            const isSelected = selectedNodeId === node.id
            const shapeColor = SHAPE_COLORS[ct.shape] ?? canvasTokens.text.secondary
            const MONO = canvasTokens.font.mono

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
                  // Reactive: update position live so edges follow
                  liveUpdateNodePosition(node.id, e.target.x(), e.target.y())
                }}
                onDragEnd={(e) => {
                  const x = snapToGrid(e.target.x())
                  const y = snapToGrid(e.target.y())
                  e.target.x(x)
                  e.target.y(y)
                  // Snap and push to undo stack
                  updateNode(node.id, { x, y })
                }}
              >
                {/* Selection ring */}
                {isSelected && (
                  <Rect
                    x={-3}
                    y={-3}
                    width={nodeW + 6}
                    height={nodeH + 6}
                    cornerRadius={3}
                    stroke={canvasTokens.accent}
                    strokeWidth={1.5}
                    shadowColor={canvasTokens.accent}
                    shadowBlur={8}
                    shadowOpacity={0.5}
                    listening={false}
                  />
                )}

                {/* Node body */}
                <Rect
                  x={0}
                  y={0}
                  width={nodeW}
                  height={nodeH}
                  fill={isSelected ? canvasTokens.selTint : canvasTokens.bg.surface}
                  stroke={isSelected ? canvasTokens.accent : canvasTokens.border.subtle}
                  strokeWidth={1}
                  cornerRadius={2}
                />

                {/* Category stripe (left) */}
                <Rect
                  x={0}
                  y={0}
                  width={3}
                  height={nodeH}
                  fill={shapeColor}
                  cornerRadius={[2, 0, 0, 2]}
                />

                {/* Icon letter */}
                <Text
                  x={7}
                  y={7}
                  text={ct.name.charAt(0).toUpperCase()}
                  fontSize={Math.round(nodeH * 0.35)}
                  fill={shapeColor}
                  fontStyle="bold"
                  opacity={0.3}
                  fontFamily={MONO}
                  listening={false}
                />

                {/* Label */}
                <Text
                  x={5}
                  y={nodeH - 22}
                  width={nodeW - 10}
                  text={node.label}
                  fontSize={10}
                  fill={canvasTokens.text.primary}
                  fontFamily={MONO}
                  fontStyle="500"
                  align="center"
                  listening={false}
                />

                {/* Category kicker */}
                <Text
                  x={5}
                  y={nodeH - 10}
                  width={nodeW - 10}
                  text={ct.category.toUpperCase()}
                  fontSize={7}
                  fill={shapeColor}
                  fontFamily={MONO}
                  align="center"
                  opacity={0.65}
                  listening={false}
                />

                {/* Ports */}
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

                {/* Resize handle (bottom-right corner) — only on selected */}
                {isSelected && (
                  <Rect
                    x={nodeW - 8}
                    y={nodeH - 8}
                    width={8}
                    height={8}
                    fill={canvasTokens.accent}
                    cornerRadius={1}
                    opacity={0.85}
                    onMouseDown={(e) => {
                      e.cancelBubble = true
                      const stage = stageRef.current
                      if (!stage) return
                      const pos = stage.getPointerPosition()
                      if (!pos) return
                      const worldX = pos.x / zoom - panX
                      const worldY = pos.y / zoom - panY
                      setResizingNode({
                        nodeId: node.id,
                        startW: nodeW,
                        startH: nodeH,
                        startMX: worldX,
                        startMY: worldY,
                      })
                    }}
                    style={{ cursor: 'nwse-resize' }}
                  />
                )}
              </Group>
            )
          })}

          {/* Validation overlay */}
          <ValidationOverlay nodes={nodes} />
        </Layer>
      </Stage>
    </div>
  )
}
