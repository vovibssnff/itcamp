import { useRef, useCallback, useEffect, useState } from 'react'
import { Stage, Layer, Rect, Group, Text, Circle, Line } from 'react-konva'
import type Konva from 'konva'
import { useConstructorStore, type CanvasNode, type CanvasEdge } from '@/store/constructor'
import type { ComponentType } from '@/mocks/fixtures/components'
import { PortConnection } from './PortConnection'
import { ValidationOverlay } from './ValidationOverlay'
import { tokens } from '@/theme/tokens'

const NODE_W = 80
const NODE_H = 60
const GRID_SIZE = 20
const DOT_SPACING = GRID_SIZE

interface ConstructorCanvasProps {
  componentTypes: ComponentType[]
  width: number
  height: number
  onDropComponent: (typeId: string, x: number, y: number) => void
}

const SHAPE_COLORS: Record<string, string> = {
  pump: tokens.accent.cyan,
  column: tokens.accent.amber,
  vessel: tokens.accent.blue,
  heatexchanger: '#9b8fff',
  valve: tokens.accent.cyan,
  sensor: tokens.accent.amber,
  controller: tokens.accent.blue,
  separator: '#9b8fff',
  compressor: tokens.accent.red,
  furnace: '#ff8c00',
}

function snapToGrid(v: number): number {
  return Math.round(v / GRID_SIZE) * GRID_SIZE
}

function getPortPositions(node: CanvasNode, ct: ComponentType) {
  const inputs = ct.ports.filter((p) => p.direction === 'in')
  const outputs = ct.ports.filter((p) => p.direction === 'out')

  const positions: Record<string, { x: number; y: number; type: string }> = {}

  inputs.forEach((p, i) => {
    const spacing = NODE_H / (inputs.length + 1)
    positions[p.id] = {
      x: node.x,
      y: node.y + spacing * (i + 1),
      type: p.type,
    }
  })

  outputs.forEach((p, i) => {
    const spacing = NODE_H / (outputs.length + 1)
    positions[p.id] = {
      x: node.x + NODE_W,
      y: node.y + spacing * (i + 1),
      type: p.type,
    }
  })

  return positions
}

const PORT_COLORS: Record<string, string> = {
  liquid: tokens.accent.cyan,
  gas: tokens.accent.amber,
  signal: tokens.accent.blue,
  electric: tokens.accent.red,
}

interface DraftEdge {
  sourceNodeId: string
  sourcePortId: string
  x1: number
  y1: number
  x2: number
  y2: number
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
    removeEdge,
    addEdge,
    setZoom,
    setPan,
  } = useConstructorStore()

  const [draftEdge, setDraftEdge] = useState<DraftEdge | null>(null)
  const [hoveredPort, setHoveredPort] = useState<{ nodeId: string; portId: string } | null>(null)
  const [isDraggingStage, setIsDraggingStage] = useState(false)
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

  // Handle drag-over and drop from palette
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
      const x = snapToGrid(rawX)
      const y = snapToGrid(rawY)
      onDropComponent(typeId, x, y)
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
      const clampedScale = Math.max(0.15, Math.min(4, newScale))

      const mouseX = pointer.x
      const mouseY = pointer.y
      const newPanX = mouseX / clampedScale - mouseX / oldScale + panX
      const newPanY = mouseY / clampedScale - mouseY / oldScale + panY

      setZoom(clampedScale)
      setPan(newPanX, newPanY)
    },
    [zoom, panX, panY, setZoom, setPan],
  )

  // Stage drag (pan)
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
        const stage = stageRef.current
        const pos = stage.getPointerPosition()
        if (pos) {
          const worldX = pos.x / zoom - panX
          const worldY = pos.y / zoom - panY
          setDraftEdge((d) => (d ? { ...d, x2: worldX, y2: worldY } : null))
        }
      }
    },
    [isDraggingStage, zoom, panX, panY, setPan, draftEdge],
  )

  const handleStageMouseUp = useCallback(() => {
    setIsDraggingStage(false)
    lastPos.current = null
    if (draftEdge && !hoveredPort) {
      setDraftEdge(null)
    }
  }, [draftEdge, hoveredPort])

  function handlePortMouseDown(
    e: Konva.KonvaEventObject<MouseEvent>,
    nodeId: string,
    portId: string,
    x: number,
    y: number,
  ) {
    e.cancelBubble = true
    setDraftEdge({ sourceNodeId: nodeId, sourcePortId: portId, x1: x, y1: y, x2: x, y2: y })
  }

  function handlePortMouseUp(
    e: Konva.KonvaEventObject<MouseEvent>,
    nodeId: string,
    portId: string,
  ) {
    e.cancelBubble = true
    if (draftEdge && draftEdge.sourceNodeId !== nodeId) {
      const edgeId = `e-${Date.now()}`
      const newEdge: CanvasEdge = {
        id: edgeId,
        sourceNodeId: draftEdge.sourceNodeId,
        sourcePortId: draftEdge.sourcePortId,
        targetNodeId: nodeId,
        targetPortId: portId,
      }
      addEdge(newEdge)
    }
    setDraftEdge(null)
  }

  // Delete key for selected node/edge
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedEdgeId) removeEdge(selectedEdgeId)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedEdgeId, removeEdge])

  return (
    <div
      ref={containerRef}
      style={{
        width,
        height,
        background: tokens.bg.base,
        cursor: isDraggingStage ? 'grab' : 'default',
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
        {/* Background grid */}
        <Layer listening={false}>
          {dotGrid().map((d, i) => (
            <Circle
              key={i}
              x={d.x / zoom - panX}
              y={d.y / zoom - panY}
              radius={1}
              fill="rgba(255,255,255,0.08)"
            />
          ))}
        </Layer>

        {/* Edges layer */}
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
              stroke={tokens.accent.cyan}
              strokeWidth={1.5}
              dash={[4, 4]}
              listening={false}
            />
          )}
        </Layer>

        {/* Nodes layer */}
        <Layer>
          {nodes.map((node) => {
            const ct = componentTypes.find((c) => c.id === node.typeId)
            if (!ct) return null
            const portPositions = getPortPositions(node, ct)
            const isSelected = selectedNodeId === node.id
            const shapeColor = SHAPE_COLORS[ct.shape] ?? tokens.text.secondary

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
                onDragEnd={(e) => {
                  const x = snapToGrid(e.target.x())
                  const y = snapToGrid(e.target.y())
                  e.target.x(x)
                  e.target.y(y)
                  updateNode(node.id, { x, y })
                }}
              >
                {/* Node body */}
                <Rect
                  x={0}
                  y={0}
                  width={NODE_W}
                  height={NODE_H}
                  fill={isSelected ? 'rgba(0,229,199,0.06)' : tokens.bg.surface}
                  stroke={isSelected ? tokens.accent.cyan : tokens.border.medium}
                  strokeWidth={isSelected ? 1.5 : 1}
                  cornerRadius={4}
                  shadowColor={isSelected ? tokens.accent.cyan : undefined}
                  shadowBlur={isSelected ? 6 : 0}
                  shadowOpacity={0.4}
                />

                {/* Category color stripe */}
                <Rect
                  x={0}
                  y={0}
                  width={3}
                  height={NODE_H}
                  fill={shapeColor}
                  cornerRadius={[4, 0, 0, 4]}
                />

                {/* Shape icon placeholder */}
                <Text
                  x={6}
                  y={8}
                  text={ct.name.charAt(0)}
                  fontSize={20}
                  fill={shapeColor}
                  fontStyle="bold"
                  opacity={0.4}
                  fontFamily="Inter, sans-serif"
                  listening={false}
                />

                {/* Label */}
                <Text
                  x={4}
                  y={NODE_H - 20}
                  width={NODE_W - 8}
                  text={node.label}
                  fontSize={10}
                  fill={tokens.text.primary}
                  fontFamily="'IBM Plex Mono', monospace"
                  align="center"
                  listening={false}
                />

                {/* Type name */}
                <Text
                  x={4}
                  y={NODE_H - 10}
                  width={NODE_W - 8}
                  text={ct.category.toUpperCase()}
                  fontSize={8}
                  fill={shapeColor}
                  fontFamily="Inter, sans-serif"
                  align="center"
                  opacity={0.6}
                  listening={false}
                />

                {/* Ports */}
                {Object.entries(portPositions).map(([portId, pos]) => {
                  const localX = pos.x - node.x
                  const localY = pos.y - node.y
                  const isHovered =
                    hoveredPort?.nodeId === node.id && hoveredPort?.portId === portId
                  const portColor = PORT_COLORS[pos.type] ?? tokens.text.secondary

                  return (
                    <Circle
                      key={portId}
                      x={localX}
                      y={localY}
                      radius={isHovered ? 5 : 4}
                      fill={portColor}
                      stroke={tokens.bg.base}
                      strokeWidth={1}
                      onMouseEnter={() => setHoveredPort({ nodeId: node.id, portId })}
                      onMouseLeave={() => setHoveredPort(null)}
                      onMouseDown={(e) => handlePortMouseDown(e, node.id, portId, pos.x, pos.y)}
                      onMouseUp={(e) => handlePortMouseUp(e, node.id, portId)}
                    />
                  )
                })}
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
