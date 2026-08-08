import { useEffect, useRef, useState } from 'react'
import { WsConnection, type WsChannel } from '@/ws/connection'
import { useSessionStore } from '@/store/session'
import type { ServerMessage } from '@/ws/types'

interface UseWebSocketOptions {
  sessionId: string | null
  channel: WsChannel
  enabled?: boolean
}

export function useWebSocket({ sessionId, channel, enabled = true }: UseWebSocketOptions) {
  const [connected, setConnected] = useState(false)
  const wsRef = useRef<WsConnection | null>(null)
  const {
    updateTelemetry,
    addAlarm,
    acknowledgeAlarm,
    setStatus,
    setModelTime,
    setSpeed,
    updateRegulator,
  } = useSessionStore()

  useEffect(() => {
    if (!sessionId || !enabled) return

    const ws = new WsConnection({
      sessionId,
      channel,
      onStatusChange: setConnected,
      onMessage: (msg: ServerMessage) => {
        switch (msg.type) {
          case 'telemetry':
            updateTelemetry(msg.tags)
            break
          case 'alarm':
            addAlarm(msg.alarm)
            break
          case 'alarm_clear':
            // mark alarm as resolved
            acknowledgeAlarm(msg.id)
            break
          case 'session_status':
            setStatus(msg.status)
            setModelTime(msg.modelTime)
            setSpeed(msg.speed)
            break
          case 'regulator_state':
            updateRegulator(msg.regulator)
            break
        }
      },
    })
    wsRef.current = ws

    return () => {
      ws.destroy()
      wsRef.current = null
    }
  }, [
    sessionId,
    channel,
    enabled,
    updateTelemetry,
    addAlarm,
    acknowledgeAlarm,
    setStatus,
    setModelTime,
    setSpeed,
    updateRegulator,
  ])

  return {
    connected,
    send: (msg: Parameters<WsConnection['send']>[0]) => wsRef.current?.send(msg),
  }
}
