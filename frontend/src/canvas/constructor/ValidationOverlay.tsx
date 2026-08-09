import { Rect, Text } from 'react-konva'
import type { CanvasNode } from '@/store/constructor'

interface ValidationOverlayProps {
  nodes: CanvasNode[]
}

export function ValidationOverlay({ nodes }: ValidationOverlayProps) {
  const invalidNodes = nodes.filter((n) => (n.validationErrors ?? []).length > 0)

  return (
    <>
      {invalidNodes.map((node) => (
        <Rect
          key={`overlay-${node.id}`}
          x={node.x - 4}
          y={node.y - 4}
          width={88}
          height={68}
          cornerRadius={6}
          stroke="#ff4d4d"
          strokeWidth={2}
          shadowColor="#ff4d4d"
          shadowBlur={8}
          shadowOpacity={0.6}
          listening={false}
        />
      ))}
      {invalidNodes.map((node) => {
        const errors = node.validationErrors ?? []
        if (errors.length === 0 || !errors[0]) return null
        return (
          <Text
            key={`err-${node.id}`}
            x={node.x}
            y={node.y - 18}
            text={errors[0]}
            fontSize={9}
            fill="#ff8080"
            fontFamily="'IBM Plex Mono', monospace"
            listening={false}
          />
        )
      })}
    </>
  )
}
