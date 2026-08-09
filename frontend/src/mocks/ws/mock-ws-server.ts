import { generateTelemetryTick, resetTelemetry } from '../fixtures/telemetry'
import type { TagValue, ActiveAlarm } from '@/store/session'

type WsMessage =
  | { type: 'telemetry'; tags: TagValue[] }
  | { type: 'alarm'; alarm: ActiveAlarm }
  | { type: 'alarm_clear'; id: string }
  | { type: 'session_status'; status: string; modelTime: number; speed: number }
  | { type: 'ai_hint'; text: string; tag?: string }

type ClientMessage =
  | { type: 'actuator'; tag: string; value: number }
  | { type: 'ack_alarm'; id: string }
  | { type: 'subscribe'; tags: string[] }
  | { type: 'ping' }

type SendFn = (data: string) => void

interface MockSession {
  sessionId: string
  status: 'running' | 'paused' | 'stopped'
  modelTime: number
  speed: number
  intervalId: ReturnType<typeof setInterval> | null
  sockets: Set<SendFn>
  activeAlarms: Map<string, ActiveAlarm>
}

const sessions = new Map<string, MockSession>()

function broadcast(session: MockSession, msg: WsMessage) {
  const data = JSON.stringify(msg)
  session.sockets.forEach((send) => {
    try {
      send(data)
    } catch {
      // socket closed
    }
  })
}

function startTelemetryLoop(session: MockSession) {
  if (session.intervalId) return
  session.intervalId = setInterval(() => {
    if (session.status !== 'running') return

    session.modelTime += session.speed

    const tags = generateTelemetryTick(session.speed)
    broadcast(session, { type: 'telemetry', tags })

    // Check for new alarms
    for (const tag of tags) {
      if (tag.alarmState !== 'normal') {
        const alarmId = `alarm-${tag.tag}-${tag.alarmState}`
        if (!session.activeAlarms.has(alarmId)) {
          const alarm: ActiveAlarm = {
            id: alarmId,
            tag: tag.tag,
            level: tag.alarmState as ActiveAlarm['level'],
            message: `${tag.tag} ${tag.alarmState === 'HH' || tag.alarmState === 'H' ? 'превышение' : 'снижение'} (${tag.value.toFixed(1)} ${tag.unit})`,
            timestamp: Date.now(),
            acknowledged: false,
          }
          session.activeAlarms.set(alarmId, alarm)
          broadcast(session, { type: 'alarm', alarm })
        }
      } else {
        // Clear alarms for normal tags
        for (const [id, alarm] of session.activeAlarms) {
          if (alarm.tag === tag.tag) {
            session.activeAlarms.delete(id)
            broadcast(session, { type: 'alarm_clear', id })
          }
        }
      }
    }

    broadcast(session, {
      type: 'session_status',
      status: session.status,
      modelTime: session.modelTime,
      speed: session.speed,
    })
  }, 1000)
}

function stopTelemetryLoop(session: MockSession) {
  if (session.intervalId) {
    clearInterval(session.intervalId)
    session.intervalId = null
  }
}

export function createMockWsSession(sessionId: string): MockSession {
  if (sessions.has(sessionId)) return sessions.get(sessionId)!

  const session: MockSession = {
    sessionId,
    status: 'running',
    modelTime: 0,
    speed: 1,
    intervalId: null,
    sockets: new Set(),
    activeAlarms: new Map(),
  }
  sessions.set(sessionId, session)
  resetTelemetry()
  startTelemetryLoop(session)
  return session
}

export interface MockWsClient {
  /** Feed a raw message string sent by the client into the mock server. */
  onMessage: (rawData: string) => void
  /** Detach this client; stops the telemetry loop when the last one leaves. */
  disconnect: () => void
}

export function connectMockWsClient(
  sessionId: string,
  send: SendFn,
  channel: 'operator' | 'observe',
): MockWsClient {
  const session = createMockWsSession(sessionId)
  session.sockets.add(send)

  // Send initial status
  send(
    JSON.stringify({
      type: 'session_status',
      status: session.status,
      modelTime: session.modelTime,
      speed: session.speed,
    }),
  )

  // Send initial telemetry snapshot
  const tags = generateTelemetryTick(0)
  send(JSON.stringify({ type: 'telemetry', tags }))

  function onMessage(rawData: string) {
    try {
      const msg = JSON.parse(rawData) as ClientMessage
      handleClientMessage(session, msg, send, channel)
    } catch {
      // ignore parse errors
    }
  }

  function disconnect() {
    session.sockets.delete(send)
    if (session.sockets.size === 0) {
      stopTelemetryLoop(session)
      sessions.delete(sessionId)
    }
  }

  return { onMessage, disconnect }
}

function handleClientMessage(
  session: MockSession,
  msg: ClientMessage,
  _send: SendFn,
  channel: 'operator' | 'observe',
) {
  if (channel === 'observe') return // read-only

  switch (msg.type) {
    case 'actuator':
      // Simulate effect on tags (simplified)
      break

    case 'ack_alarm': {
      const alarm = session.activeAlarms.get(msg.id)
      if (alarm) {
        alarm.acknowledged = true
      }
      break
    }

    case 'ping':
      break
  }
}
