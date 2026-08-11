import { ensureAccessToken } from './client'
import { ApiError } from './errors'

const BASE_URL =
  import.meta.env.VITE_MOCK_API === 'true' ? '' : (import.meta.env.VITE_API_BASE_URL ?? '')

export interface AiChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface ChatResponse {
  answer?: string
  reply?: string
}

export const aiApi = {
  /**
   * Send the conversation to the AI chat endpoint.
   * The gateway proxies POST /api/v1/ai/chat → ai service POST /v1/chat.
   * Only the last user message is sent as `question`; prior messages provide
   * conversational context that the server may or may not use.
   */
  async chat(messages: AiChatMessage[]): Promise<string> {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user')
    if (!lastUser) return ''

    const token = await ensureAccessToken()
    const res = await fetch(`${BASE_URL}/api/v1/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        question: lastUser.content,
        session_mode: 'training',
      }),
    })
    if (!res.ok) throw new ApiError(res.status, `HTTP ${res.status}`)
    const data = (await res.json()) as ChatResponse
    return data.answer ?? data.reply ?? ''
  },
}
