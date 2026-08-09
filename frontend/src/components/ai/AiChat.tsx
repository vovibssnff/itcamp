import { useEffect, useRef, useState } from 'react'
import { aiApi, type AiChatMessage } from '@/api/ai'

interface AiChatProps {
  /** First assistant message shown when the chat opens. */
  greeting?: string
  placeholder?: string
  /** Small disclaimer under the input (page variant only). */
  footnote?: string
  /** Layout preset: `page` = full-height knowledge base, `compact` = floating widget. */
  variant?: 'page' | 'compact'
  sendLabel?: string
}

const DEFAULT_GREETING =
  'Здравствуйте. Я — ИИ-ассистент. Спросите про технологический режим, регламент действий или устройство узла установки ЭЛОУ-АВТ.'

export function AiChat({
  greeting = DEFAULT_GREETING,
  placeholder = 'Вопрос ассистенту…',
  footnote,
  variant = 'page',
  sendLabel = 'Отправить',
}: AiChatProps) {
  const compact = variant === 'compact'
  const [messages, setMessages] = useState<AiChatMessage[]>([
    { role: 'assistant', content: greeting },
  ])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, sending])

  async function send() {
    const text = input.trim()
    if (!text || sending) return
    const next: AiChatMessage[] = [...messages, { role: 'user', content: text }]
    setMessages(next)
    setInput('')
    setSending(true)
    try {
      const reply = await aiApi.chat(next)
      setMessages((m) => [...m, { role: 'assistant', content: reply }])
    } catch {
      setMessages((m) => [
        ...m,
        { role: 'assistant', content: 'Не удалось получить ответ. Попробуйте ещё раз.' },
      ])
    } finally {
      setSending(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void send()
    }
  }

  const bubbleMaxWidth = compact ? '88%' : '78%'
  const bubblePadding = compact ? '10px 12px' : '13px 16px'
  const textSize = compact ? 12.5 : 13.5
  const gap = compact ? 12 : 16

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%' }}>
      {/* Message list */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          padding: compact ? 14 : '32px 0 20px',
          display: 'flex',
          flexDirection: 'column',
          gap,
        }}
      >
        {messages.map((m, i) => {
          const isUser = m.role === 'user'
          return (
            <div
              key={i}
              style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start' }}
            >
              <div
                style={{
                  maxWidth: bubbleMaxWidth,
                  padding: bubblePadding,
                  borderRadius: 2,
                  background: isUser ? 'var(--acc-dim)' : 'var(--srf2)',
                  border: isUser
                    ? '1px solid color-mix(in srgb, var(--acc) 24%, transparent)'
                    : '1px solid var(--ln)',
                }}
              >
                <div
                  className="sec"
                  style={{
                    marginBottom: compact ? 4 : 6,
                    fontSize: compact ? 9 : undefined,
                    color: isUser ? 'var(--acc-txt)' : 'var(--tx3)',
                  }}
                >
                  {isUser ? 'Вы' : 'ИИ-ассистент'}
                </div>
                <div
                  style={{
                    fontSize: textSize,
                    lineHeight: compact ? 1.55 : 1.62,
                    whiteSpace: 'pre-wrap',
                    color: 'var(--tx)',
                  }}
                >
                  {m.content}
                </div>
              </div>
            </div>
          )
        })}

        {sending && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div className="box-mute" style={{ maxWidth: bubbleMaxWidth, padding: bubblePadding }}>
              {!compact && (
                <div className="sec" style={{ marginBottom: 6 }}>
                  ИИ-ассистент
                </div>
              )}
              <div className="note">печатает…</div>
            </div>
          </div>
        )}
      </div>

      {/* Composer */}
      <div
        style={{
          flexShrink: 0,
          padding: compact ? '10px 12px 12px' : '16px 0 26px',
          borderTop: '1px solid var(--ln)',
        }}
      >
        <div style={{ display: 'flex', gap: compact ? 8 : 10, alignItems: 'flex-end' }}>
          <input
            className="fld-box"
            style={{
              flex: 1,
              fontSize: compact ? 12.5 : 13,
              padding: compact ? '9px 10px' : '12px 13px',
            }}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
          />
          <button
            className="btn btn-acc btn-sm"
            onClick={() => void send()}
            disabled={sending || !input.trim()}
          >
            {compact ? '→' : sendLabel}
          </button>
        </div>
        {footnote && (
          <div className="note" style={{ marginTop: 9, fontSize: 11 }}>
            {footnote}
          </div>
        )}
      </div>
    </div>
  )
}
