import React, { useRef, useState, useCallback, useMemo, useEffect } from 'react'
import { Stage, Layer, Rect, Text, Line, Circle, Arrow } from 'react-konva'
import Konva from 'konva'
import type { CanvasNode, CanvasEdge } from '@/store/constructor'
import type { TagValue } from '@/store/session'
import { NodeWidget, ValveWidget } from './NodeWidget'
import { getNodeSize, getInAnchor, getOutAnchor } from './nodeGeometry'
import { useCanvasTokens } from '@/theme/useCanvasTokens'
import type { ComponentType } from '@/mocks/fixtures/components'

interface HmiCanvasProps {
  nodes: CanvasNode[]
  edges: CanvasEdge[]
  componentTypes: ComponentType[]
  telemetry: Record<string, TagValue>
  width: number
  height: number
  interactive?: boolean
  /** Animate a marching-dash flow indicator along pipe runs (session running). */
  flowing?: boolean
  onNodeClick?: (node: CanvasNode) => void
}

const DOT_SPACING = 26

export function HmiCanvas({
  nodes,
  edges,
  componentTypes,
  telemetry,
  width,
  height,
  interactive = true,
  flowing = false,
  onNodeClick,
}: HmiCanvasProps) {
  const canvasTokens = useCanvasTokens()
  const edgesLayerRef = useRef<Konva.Layer>(null)

  const ZONE_AREAS = [
    {
      id: 'elou',
      label: 'ПАРК И ПОДГОТОВКА СЫРЬЯ / ЭЛОУ',
      color: canvasTokens.zone.elou,
      x1: 0,
      x2: 0.3,
    },
    { id: 'atm', label: 'АТМОСФЕРНЫЙ БЛОК', color: canvasTokens.zone.atm, x1: 0.3, x2: 0.65 },
    { id: 'gdm', label: 'БЛОК ГДМ', color: canvasTokens.zone.gdm, x1: 0.65, x2: 1.0 },
  ]

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
    // Left button, middle button, or Alt+drag all pan the canvas
    if (e.evt.button === 0 || e.evt.button === 1 || e.evt.altKey) {
      isDragging.current = true
      lastPos.current = { x: e.evt.clientX, y: e.evt.clientY }
      e.evt.preventDefault()
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

  function shapeOf(node: CanvasNode) {
    return componentTypes.find((c) => c.id === node.typeId)?.shape
  }

  // Marching-dash flow indicator on active pipe runs (reference idea: animated
  // flow direction on live pipes, reimplemented here as a Konva.Animation
  // ticking each pipe's dashOffset rather than mutating React state per frame).
  useEffect(() => {
    if (!flowing) return
    const layer = edgesLayerRef.current
    if (!layer) return
    const anim = new Konva.Animation((frame) => {
      if (!frame) return
      const shapes = layer.find('.pipe-flow')
      shapes.forEach((shape) => {
        const arrow = shape as Konva.Arrow
        arrow.dashOffset(arrow.dashOffset() - frame.timeDiff * 0.03)
      })
    }, layer)
    anim.start()
    return () => {
      anim.stop()
    }
  }, [flowing])

  // Dot grid background (reference: ktk.html `.bg-grid` / `hmiGrid` pattern)
  const dots = useMemo(() => {
    const pts: { x: number; y: number }[] = []
    const cols = Math.ceil(width / zoom / DOT_SPACING) + 2
    const rows = Math.ceil(height / zoom / DOT_SPACING) + 2
    const startX = Math.floor(-pan.x / DOT_SPACING) * DOT_SPACING
    const startY = Math.floor(-pan.y / DOT_SPACING) * DOT_SPACING
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        pts.push({ x: startX + c * DOT_SPACING, y: startY + r * DOT_SPACING })
      }
    }
    return pts
  }, [width, height, zoom, pan.x, pan.y])

  return (
    <Stage
      ref={stageRef}
      width={width}
      height={height}
      scaleX={zoom}
      scaleY={zoom}
      x={pan.x * zoom}
      y={pan.y * zoom}
      style={{ cursor: isDragging.current ? 'grabbing' : 'grab' }}
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
          fill={canvasTokens.bg.canvas}
        />

        {dots.map((d, i) => (
          <Circle key={i} x={d.x} y={d.y} radius={1} fill={canvasTokens.gridDot} />
        ))}

        {/* Zone panels — full-height tinted area with a border box and eyebrow label */}
        {ZONE_AREAS.map((zone, i) => {
          const x = zone.x1 * (width / zoom) - pan.x
          const zoneWidth = (zone.x2 - zone.x1) * (width / zoom)
          const y = -pan.y
          const h = height / zoom
          return (
            <React.Fragment key={zone.id}>
              <Rect x={x} y={y} width={zoneWidth} height={h} fill={zone.color + '0d'} />
              <Rect
                x={x}
                y={y}
                width={zoneWidth}
                height={h}
                stroke={zone.color + '59'}
                strokeWidth={1}
                listening={false}
              />
              <Rect x={x + 10} y={y + 10} width={6} height={6} fill={zone.color} />
              <Text
                x={x + 22}
                y={y + 8}
                text={zone.label}
                fontSize={9}
                fill={zone.color}
                fontFamily={canvasTokens.font.mono}
                letterSpacing={1}
              />
              <Line
                points={[x + 10, y + 22, x + zoneWidth - 10, y + 22]}
                stroke={zone.color + '4d'}
                strokeWidth={1}
              />
              {i > 0 && (
                <Line
                  points={[x, y, x, y + h]}
                  stroke={zone.color + '40'}
                  strokeWidth={1}
                  dash={[4, 4]}
                />
              )}
            </React.Fragment>
          )
        })}
      </Layer>

      {/* Edges — orthogonal pipe runs with a flow-direction arrowhead */}
      <Layer listening={false} ref={edgesLayerRef}>
        {edges.map((edge) => {
          const src = nodes.find((n) => n.id === edge.sourceNodeId)
          const dst = nodes.find((n) => n.id === edge.targetNodeId)
          if (!src || !dst) return null
          const srcSize = getNodeSize(shapeOf(src))
          const dstSize = getNodeSize(shapeOf(dst))
          const { x: x1, y: y1 } = getOutAnchor(src.x, src.y, srcSize)
          const { x: x2, y: y2 } = getInAnchor(dst.x, dst.y, dstSize)
          const cpx = (x1 + x2) / 2
          return (
            <Arrow
              key={edge.id}
              name={flowing ? 'pipe-flow' : undefined}
              points={[x1, y1, cpx, y1, cpx, y2, x2, y2]}
              stroke={canvasTokens.line}
              fill={canvasTokens.line}
              strokeWidth={1.5}
              pointerLength={7}
              pointerWidth={6}
              tension={0}
              dash={flowing ? [8, 6] : undefined}
            />
          )
        })}
      </Layer>

      {/* Nodes */}
      <Layer>
        {nodes.map((node) => {
          const shape = shapeOf(node)
          return shape === 'valve' ? (
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
              shape={shape}
              telemetry={telemetry}
              isSelected={selectedNodeId === node.id}
              onClick={() => handleNodeClick(node)}
              interactive={interactive}
            />
          )
        })}
      </Layer>
    </Stage>
  )
}
