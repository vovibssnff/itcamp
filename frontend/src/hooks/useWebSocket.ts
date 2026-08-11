import { useEffect, useRef, useState } from 'react'
import { ensureAccessToken } from '@/api/client'
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
    if (!sessionId || !enabled) {
      setConnected(false)
      return
    }

    let cancelled = false
    let ws: WsConnection | null = null

    void (async () => {
      // Access tokens are not persisted — wait for bootstrap/refresh before opening WS
      // or the gateway rejects the upgrade (empty ?token=) and we reconnect forever.
      const token = await ensureAccessToken()
      if (cancelled || !token) return

      ws = new WsConnection({
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
      if (cancelled) {
        ws.destroy()
        return
      }
      wsRef.current = ws
    })()

    return () => {
      cancelled = true
      ws?.destroy()
      wsRef.current = null
      setConnected(false)
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
