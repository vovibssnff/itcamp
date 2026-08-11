import type { ServerMessage, ClientMessage } from './types'
import { useAuthStore } from '@/store/auth'

export type WsChannel = 'operator' | 'observe'

interface WsOptions {
  sessionId: string
  channel: WsChannel
  onMessage: (msg: ServerMessage) => void
  onStatusChange?: (connected: boolean) => void
}

// Empty / unset → same-origin relative WS (Vite proxies /api with ws: true).
const WS_BASE = (import.meta.env.VITE_WS_BASE_URL as string | undefined)?.trim() || ''
const MAX_RECONNECT_DELAY = 30_000
const RECONNECT_TOLERANCE_MS = 3 * 60 * 1000

export class WsConnection {
  private ws: WebSocket | null = null
  private sessionId: string
  private channel: WsChannel
  private onMessage: (msg: ServerMessage) => void
  private onStatusChange: (connected: boolean) => void
  private reconnectAttempt = 0
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private disconnectedAt: number | null = null
  private destroyed = false
  private pingTimer: ReturnType<typeof setInterval> | null = null

  constructor(opts: WsOptions) {
    this.sessionId = opts.sessionId
    this.channel = opts.channel
    this.onMessage = opts.onMessage
    this.onStatusChange = opts.onStatusChange ?? (() => {})
    this.connect()
  }

  private buildUrl(): string {
    const token = useAuthStore.getState().accessToken
    const params = new URLSearchParams({ token: token ?? '' })
    const path = `/api/v1/ws/sessions/${this.sessionId}/${this.channel}?${params.toString()}`
    return WS_BASE ? `${WS_BASE}${path}` : path
  }

  private connect() {
    if (this.destroyed) return

    const token = useAuthStore.getState().accessToken
    if (!token) {
      // Token not ready yet (post-reload bootstrap) — retry shortly.
      this.scheduleReconnect()
      return
    }

    try {
      this.ws = new WebSocket(this.buildUrl())
    } catch {
      this.scheduleReconnect()
      return
    }

    this.ws.onopen = () => {
      this.reconnectAttempt = 0
      this.disconnectedAt = null
      this.onStatusChange(true)
      this.startPing()
    }

    this.ws.onmessage = (e: MessageEvent) => {
      try {
        const msg = JSON.parse(e.data as string) as ServerMessage
        this.onMessage(msg)
      } catch {
        // ignore malformed messages
      }
    }

    this.ws.onclose = () => {
      this.stopPing()
      this.onStatusChange(false)
      if (!this.disconnectedAt) this.disconnectedAt = Date.now()
      this.scheduleReconnect()
    }

    this.ws.onerror = () => {
      this.ws?.close()
    }
  }

  private scheduleReconnect() {
    if (this.destroyed) return

    if (this.disconnectedAt && Date.now() - this.disconnectedAt > RECONNECT_TOLERANCE_MS) {
      // Exceeded tolerance, give up
      return
    }

    const baseDelay = Math.min(1000 * Math.pow(2, this.reconnectAttempt), MAX_RECONNECT_DELAY)
    const jitter = Math.random() * 1000
    const delay = baseDelay + jitter
    this.reconnectAttempt++

    this.reconnectTimer = setTimeout(() => {
      this.connect()
    }, delay)
  }

  private startPing() {
    this.pingTimer = setInterval(() => {
      this.send({ type: 'ping' })
    }, 30_000)
  }

  private stopPing() {
    if (this.pingTimer) {
      clearInterval(this.pingTimer)
      this.pingTimer = null
    }
  }

  send(msg: ClientMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg))
    }
  }

  destroy() {
    this.destroyed = true
    this.stopPing()
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.ws?.close()
    this.ws = null
  }
}
