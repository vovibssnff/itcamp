// Installs a mock WebSocket implementation (dev/mock mode only) that routes
// connections to `/api/v1/ws/sessions/:id/:channel` into the in-browser telemetry simulation.
// Any other URL falls back to the real WebSocket.
import { connectMockWsClient, type MockWsClient } from './mock-ws-server'

const SESSION_PATH = /\/api\/v1\/ws\/sessions\/([^/?]+)\/(operator|observe)/

export function installMockWebSocket() {
  const RealWebSocket = window.WebSocket

  class MockWebSocket implements WebSocket {
    static readonly CONNECTING = 0
    static readonly OPEN = 1
    static readonly CLOSING = 2
    static readonly CLOSED = 3
    readonly CONNECTING = 0
    readonly OPEN = 1
    readonly CLOSING = 2
    readonly CLOSED = 3

    url: string
    readyState = 0
    binaryType: BinaryType = 'blob'
    bufferedAmount = 0
    extensions = ''
    protocol = ''

    onopen: ((this: WebSocket, ev: Event) => unknown) | null = null
    onmessage: ((this: WebSocket, ev: MessageEvent) => unknown) | null = null
    onclose: ((this: WebSocket, ev: CloseEvent) => unknown) | null = null
    onerror: ((this: WebSocket, ev: Event) => unknown) | null = null

    private listeners = new Map<string, Set<EventListenerOrEventListenerObject>>()
    private client: MockWsClient | null = null

    constructor(url: string | URL, _protocols?: string | string[]) {
      this.url = typeof url === 'string' ? url : url.toString()
      const match = SESSION_PATH.exec(this.url)
      if (!match) {
        // Not a session socket: delegate to the real implementation.
        return new RealWebSocket(url, _protocols) as unknown as MockWebSocket
      }
      const sessionId = decodeURIComponent(match[1]!)
      const ch = match[2] === 'observe' ? 'observe' : 'operator'

      queueMicrotask(() => {
        this.readyState = this.OPEN
        this.dispatch('open', new Event('open'))
        this.client = connectMockWsClient(
          sessionId,
          (data: string) => {
            if (this.readyState !== this.OPEN) return
            this.dispatch('message', new MessageEvent('message', { data }))
          },
          ch,
        )
      })
    }

    private dispatch(type: string, event: Event) {
      const handler = (this as unknown as Record<string, ((ev: Event) => unknown) | null>)[
        `on${type}`
      ]
      if (typeof handler === 'function') handler.call(this, event)
      this.listeners.get(type)?.forEach((l) => {
        if (typeof l === 'function') l.call(this, event)
        else l.handleEvent(event)
      })
    }

    send(data: string) {
      if (this.readyState === this.OPEN && this.client) this.client.onMessage(data)
    }

    close() {
      if (this.readyState === this.CLOSED) return
      this.readyState = this.CLOSED
      this.client?.disconnect()
      this.client = null
      this.dispatch('close', new CloseEvent('close', { wasClean: true, code: 1000 }))
    }

    addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
      if (!this.listeners.has(type)) this.listeners.set(type, new Set())
      this.listeners.get(type)!.add(listener)
    }

    removeEventListener(type: string, listener: EventListenerOrEventListenerObject) {
      this.listeners.get(type)?.delete(listener)
    }

    dispatchEvent(): boolean {
      return true
    }
  }

  window.WebSocket = MockWebSocket as unknown as typeof WebSocket
}
