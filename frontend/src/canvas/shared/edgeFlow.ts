import type { CanvasNode, CanvasEdge } from '@/store/constructor'
import type { TagValue } from '@/store/session'
import { lookupTelemetry } from '@/store/session'
import type { ComponentType } from '@/mocks/fixtures/components'
import type { EdgeMediaType } from '@/canvas/shared/equipmentGeometry'

const FLOW_RATE_RE = /^(FRC|FRCA|FYQR|FR|FQRC|FQR)\b/i
const PUMP_RE = /^PUMP[- ]/i
const FAN_RE = /^FAN[- ]/i
const FLOW_RATE_MIN = 15

function nodeTags(node: CanvasNode | undefined): string[] {
  return node?.tags ?? []
}

function tagValue(telemetry: Record<string, TagValue>, tag: string): number | undefined {
  return lookupTelemetry(telemetry, tag)?.value
}

/** True when a discrete pump/fan tag is running. */
function equipmentRunning(telemetry: Record<string, TagValue>, tag: string): boolean {
  const v = tagValue(telemetry, tag)
  return v !== undefined && v > 0.5
}

/** True when a flow-rate tag indicates significant throughput. */
function flowRateActive(telemetry: Record<string, TagValue>, tag: string): boolean {
  const v = tagValue(telemetry, tag)
  return v !== undefined && Math.abs(v) >= FLOW_RATE_MIN
}

/**
 * Decide whether a process wire should show marching-dash flow animation.
 *
 * Rules (liquid / gas / steam):
 * 1. Prefer discrete PUMP / FAN tags on either endpoint — animate iff any is running.
 * 2. Else prefer flow instruments (FRC / FRCA / ...) on either endpoint — animate iff rate >= threshold.
 * 3. Else fall back to session-level sessionActive (unknown wiring still moves when plant runs).
 *
 * Signal / electric wires do not animate as process flow.
 */
export function isEdgeFlowing(
  edge: CanvasEdge,
  nodes: CanvasNode[],
  _componentTypes: ComponentType[],
  telemetry: Record<string, TagValue>,
  sessionActive: boolean,
  media: EdgeMediaType,
): boolean {
  if (!sessionActive) return false
  if (media === 'signal' || media === 'electric') return false

  const src = nodes.find((n) => n.id === edge.sourceNodeId)
  const dst = nodes.find((n) => n.id === edge.targetNodeId)
  const tags = [...nodeTags(src), ...nodeTags(dst)]

  const pumps = tags.filter((t) => PUMP_RE.test(t) || FAN_RE.test(t))
  if (pumps.length > 0) {
    return pumps.some((t) => equipmentRunning(telemetry, t))
  }

  const rates = tags.filter((t) => FLOW_RATE_RE.test(t))
  if (rates.length > 0) {
    return rates.some((t) => flowRateActive(telemetry, t))
  }

  return sessionActive
}

/** Compact bitstring of per-edge flow flags — stable across telemetry ticks when state unchanged. */
export function edgeFlowKey(
  edges: CanvasEdge[],
  nodes: CanvasNode[],
  componentTypes: ComponentType[],
  telemetry: Record<string, TagValue>,
  sessionActive: boolean,
  mediaOf: (edge: CanvasEdge) => EdgeMediaType,
): string {
  if (!sessionActive) return 'off'
  return edges
    .map((e) =>
      isEdgeFlowing(e, nodes, componentTypes, telemetry, sessionActive, mediaOf(e)) ? '1' : '0',
    )
    .join('')
}
