const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

export interface AiChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface ChatResponse {
  reply: string
}

export const aiApi = {
  async chat(messages: AiChatMessage[]): Promise<string> {
    const res = await fetch(`${BASE_URL}/api/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = (await res.json()) as ChatResponse
    return data.reply
  },
}
