import { useRef, useState, useCallback, useMemo, useEffect } from 'react'
import { Stage, Layer, Rect, Circle, Arrow, Line, Group } from 'react-konva'
import Konva from 'konva'
import type { CanvasNode, CanvasEdge } from '@/store/constructor'
import type { TagValue } from '@/store/session'
import { EquipmentWidget } from '@/canvas/shared/EquipmentWidget'
import {
  getPortAnchor,
  orthogonalEdgePoints,
  mediaStrokeColor,
  mediaDash,
  mediaStrokeWidth,
  resolveEdgeMediaType,
} from '@/canvas/shared/equipmentGeometry'
import { edgeFlowKey, isEdgeFlowing } from '@/canvas/shared/edgeFlow'
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
  /**
   * Session-level gate: when false, no wires animate.
   * When true, each wire animates only if its endpoint pumps/flows are active.
   */
  flowing?: boolean
  onNodeClick?: (node: CanvasNode) => void
}

const DOT_SPACING = 32
const FLOW_DASH: number[] = [10, 8]

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

  const mediaOf = useCallback(
    (edge: CanvasEdge) => {
      const src = nodes.find((n) => n.id === edge.sourceNodeId)
      if (!src) return resolveEdgeMediaType(edge.type, undefined)
      const srcPort = getPortAnchor(src, edge.sourcePortId, componentTypes)
      return resolveEdgeMediaType(edge.type, srcPort.type)
    },
    [nodes, componentTypes],
  )

  // Bitmask of which edges are actively flowing — only changes when pumps/rates change,
  // so 1 Hz telemetry does not remount arrows and kill dashOffset.
  const flowKey = useMemo(
    () => edgeFlowKey(edges, nodes, componentTypes, telemetry, flowing, mediaOf),
    [edges, nodes, componentTypes, telemetry, flowing, mediaOf],
  )

  const anyEdgeFlowing = flowing && flowKey.includes('1')

  useEffect(() => {
    if (!anyEdgeFlowing) return
    const layer = edgesLayerRef.current
    if (!layer) return
    const anim = new Konva.Animation((frame) => {
      if (!frame) return
      const shapes = layer.find('.pipe-flow')
      shapes.forEach((shape) => {
        const arrow = shape as Konva.Arrow
        arrow.dashOffset(arrow.dashOffset() - frame.timeDiff * 0.12)
      })
    }, layer)
    anim.start()
    return () => {
      anim.stop()
    }
  }, [anyEdgeFlowing, flowKey])

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

  const edgeElements = useMemo(
    () =>
      edges.map((edge) => {
        const src = nodes.find((n) => n.id === edge.sourceNodeId)
        const dst = nodes.find((n) => n.id === edge.targetNodeId)
        if (!src || !dst) return null
        const srcPort = getPortAnchor(src, edge.sourcePortId, componentTypes)
        const dstPort = getPortAnchor(dst, edge.targetPortId, componentTypes)
        const media = resolveEdgeMediaType(edge.type, srcPort.type)
        const stroke = mediaStrokeColor(media, canvasTokens)
        const baseDash = mediaDash(media)
        const edgeActive = isEdgeFlowing(edge, nodes, componentTypes, telemetry, flowing, media)
        const dash = edgeActive ? (baseDash ?? FLOW_DASH) : baseDash
        const points = orthogonalEdgePoints(srcPort.x, srcPort.y, dstPort.x, dstPort.y)
        const widthPx = mediaStrokeWidth(media)
        return (
          <Group key={edge.id}>
            <Line
              points={points}
              stroke={canvasTokens.bg.canvas}
              strokeWidth={widthPx + 3}
              lineCap="round"
              lineJoin="round"
              listening={false}
            />
            <Arrow
              name={edgeActive ? 'pipe-flow' : undefined}
              points={points}
              stroke={stroke}
              fill={stroke}
              strokeWidth={widthPx}
              pointerLength={7}
              pointerWidth={6}
              tension={0}
              dash={dash}
              lineCap="round"
              lineJoin="round"
              opacity={edgeActive ? 0.95 : 0.35}
            />
          </Group>
        )
      }),
    // telemetry is represented by flowKey so idle ticks don't remount
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nodes, edges, componentTypes, flowing, canvasTokens, flowKey],
  )

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
      <Layer listening={false}>
        <Rect
          x={-pan.x}
          y={-pan.y}
          width={width / zoom}
          height={height / zoom}
          fill={canvasTokens.bg.canvas}
        />

        {dots.map((d, i) => (
          <Circle
            key={i}
            x={d.x}
            y={d.y}
            radius={0.85}
            fill={canvasTokens.gridDot}
            opacity={0.55}
          />
        ))}
      </Layer>

      <Layer listening={false} ref={edgesLayerRef}>
        {edgeElements}
      </Layer>

      <Layer>
        {nodes.map((node) => (
          <EquipmentWidget
            key={node.id}
            node={node}
            shape={shapeOf(node)}
            mode="runtime"
            telemetry={telemetry}
            isSelected={selectedNodeId === node.id}
            onClick={() => handleNodeClick(node)}
            interactive={interactive}
          />
        ))}
      </Layer>
    </Stage>
  )
}
