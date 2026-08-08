import { useRef, useState, useCallback, useEffect } from 'react'
import { Stage, Layer, Rect, Text, Line, Circle } from 'react-konva'
import type Konva from 'konva'
import type { CanvasNode, CanvasEdge } from '@/store/constructor'
import type { TagValue } from '@/store/session'
import { NodeWidget, ValveWidget } from './NodeWidget'
import { tokens } from '@/theme/tokens'
import type { ComponentType } from '@/mocks/fixtures/components'

interface HmiCanvasProps {
  nodes: CanvasNode[]
  edges: CanvasEdge[]
  componentTypes: ComponentType[]
  telemetry: Record<string, TagValue>
  width: number
  height: number
  interactive?: boolean
  onNodeClick?: (node: CanvasNode) => void
}

const ZONE_AREAS = [
  { id: 'elou', label: 'ПАРК И ПОДГОТОВКА СЫРЬЯ / ЭЛОУ', color: tokens.zone.elou, x1: 0, x2: 0.3 },
  { id: 'atm', label: 'АТМОСФЕРНЫЙ БЛОК', color: tokens.zone.atm, x1: 0.3, x2: 0.65 },
  { id: 'gdm', label: 'БЛОК ГДМ', color: tokens.zone.gdm, x1: 0.65, x2: 1.0 },
]

export function HmiCanvas({
  nodes,
  edges,
  componentTypes,
  telemetry,
  width,
  height,
  interactive = true,
  onNodeClick,
}: HmiCanvasProps) {
  const stageRef = useRef<Konva.Stage>(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const isDragging = useRef(false)
  const lastPos = useRef<{ x: number; y: number } | null>(null)

  const handleWheel = useCallback(
    (e: Konva.KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault()
      const scaleBy = 1.08
      const stage = e.target.getStage()
      if (!stage) return
      const pointer = stage.getPointerPosition()
      if (!pointer) return
      const newZoom = Math.max(0.2, Math.min(4, e.evt.deltaY > 0 ? zoom / scaleBy : zoom * scaleBy))
      setPan({
        x: pointer.x / newZoom - pointer.x / zoom + pan.x,
        y: pointer.y / newZoom - pointer.y / zoom + pan.y,
      })
      setZoom(newZoom)
    },
    [zoom, pan],
  )

  const handleMouseDown = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    if (e.target !== e.target.getStage()) return
    if (e.evt.button === 1 || e.evt.altKey) {
      isDragging.current = true
      lastPos.current = { x: e.evt.clientX, y: e.evt.clientY }
    }
  }, [])

  const handleMouseMove = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (!isDragging.current || !lastPos.current) return
      const dx = (e.evt.clientX - lastPos.current.x) / zoom
      const dy = (e.evt.clientY - lastPos.current.y) / zoom
      setPan((p) => ({ x: p.x + dx, y: p.y + dy }))
      lastPos.current = { x: e.evt.clientX, y: e.evt.clientY }
    },
    [zoom],
  )

  const handleMouseUp = useCallback(() => {
    isDragging.current = false
    lastPos.current = null
  }, [])

  function handleNodeClick(node: CanvasNode) {
    setSelectedNodeId(node.id)
    onNodeClick?.(node)
  }

  // Determine if a node is a valve (has valve shape in component type)
  function isValve(node: CanvasNode) {
    const ct = componentTypes.find((c) => c.id === node.typeId)
    return ct?.shape === 'valve'
  }

  return (
    <Stage
      ref={stageRef}
      width={width}
      height={height}
      scaleX={zoom}
      scaleY={zoom}
      x={pan.x * zoom}
      y={pan.y * zoom}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* Background */}
      <Layer listening={false}>
        <Rect
          x={-pan.x}
          y={-pan.y}
          width={width / zoom}
          height={height / zoom}
          fill={tokens.bg.base}
        />

        {/* Zone separators */}
        {ZONE_AREAS.map((zone, i) => {
          const x = zone.x1 * (width / zoom) - pan.x
          const zoneWidth = (zone.x2 - zone.x1) * (width / zoom)
          return (
            <React.Fragment key={zone.id}>
              <Rect x={x} y={-pan.y} width={zoneWidth} height={24} fill={`${zone.color}18`} />
              <Text
                x={x + 8}
                y={-pan.y + 6}
                text={zone.label}
                fontSize={9}
                fill={zone.color}
                fontFamily="'IBM Plex Mono', monospace"
                letterSpacing={1}
              />
              {i > 0 && (
                <Line
                  points={[x, -pan.y, x, height / zoom - pan.y]}
                  stroke={`${zone.color}30`}
                  strokeWidth={1}
                  dash={[4, 4]}
                />
              )}
            </React.Fragment>
          )
        })}
      </Layer>

      {/* Edges */}
      <Layer listening={false}>
        {edges.map((edge) => {
          const src = nodes.find((n) => n.id === edge.sourceNodeId)
          const dst = nodes.find((n) => n.id === edge.targetNodeId)
          if (!src || !dst) return null
          const x1 = src.x + 80
          const y1 = src.y + 30
          const x2 = dst.x
          const y2 = dst.y + 30
          const cpx = (x1 + x2) / 2
          return (
            <Line
              key={edge.id}
              points={[x1, y1, cpx, y1, cpx, y2, x2, y2]}
              stroke="rgba(255,255,255,0.15)"
              strokeWidth={2}
              tension={0}
            />
          )
        })}
      </Layer>

      {/* Nodes */}
      <Layer>
        {nodes.map((node) =>
          isValve(node) ? (
            <ValveWidget
              key={node.id}
              node={node}
              telemetry={telemetry}
              isSelected={selectedNodeId === node.id}
              onClick={() => handleNodeClick(node)}
              interactive={interactive}
            />
          ) : (
            <NodeWidget
              key={node.id}
              node={node}
              telemetry={telemetry}
              isSelected={selectedNodeId === node.id}
              onClick={() => handleNodeClick(node)}
              interactive={interactive}
            />
          ),
        )}
      </Layer>
    </Stage>
  )
}

// Need React for Fragment
import React from 'react'
