import { useEffect, useRef, useState } from 'react'
import { message } from 'antd'
import { ensureAccessToken } from '@/api/client'
import { WsConnection, type WsChannel } from '@/ws/connection'
import { useSessionStore } from '@/store/session'
import { parseServerMessage } from '@/ws/types'

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
    addFault,
  } = useSessionStore()

  useEffect(() => {
    if (!sessionId || !enabled) {
      setConnected(false)
      return
    }

    let cancelled = false
    let ws: WsConnection | null = null

    void (async () => {
      const token = await ensureAccessToken()
      if (cancelled || !token) return

      ws = new WsConnection({
        sessionId,
        channel,
        onStatusChange: setConnected,
        onMessage: (raw) => {
          const msg = parseServerMessage(raw)
          if (!msg) return
          switch (msg.type) {
            case 'telemetry':
              updateTelemetry(msg.tags)
              break
            case 'alarm':
              addAlarm(msg.alarm)
              message.warning(`${msg.alarm.tag} · ${msg.alarm.level}`, 4)
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
            case 'fault':
              addFault(msg.fault)
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
    addFault,
  ])

  return {
    connected,
    send: (msg: Parameters<WsConnection['send']>[0]) => wsRef.current?.send(msg),
  }
}
