/**
 * Sidebar AI panel for the self-training screen — merges what used to be two
 * separate features:
 *   1. The floating "ИИ-ассистент" chat (free-form Q&A).
 *   2. The plain "Журнал аварий" alarm list.
 *
 * Every new alarm is posted into the same thread as an assistant message
 * explaining the likely cause and recommended action (via the mocked
 * /api/ai/chat knowledge base, keyed by tag — see mocks/handlers/ai.ts), so
 * the operator sees the hint right where the alarm appeared instead of having
 * to separately open a chat widget. The operator can keep typing follow-up
 * questions in the same box.
 */
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { aiApi } from '@/api/ai'
import { useSessionStore, type ActiveAlarm } from '@/store/session'
import { Pill } from '@/components/ui'

interface Entry {
  id: string
  role: 'user' | 'assistant'
  kind: 'chat' | 'alert'
  content: string
  tag?: string
  level?: ActiveAlarm['level']
  pending?: boolean
}

const GREETING =
  'Здравствуйте. Я слежу за тревогами этой сессии и сразу подскажу вероятную причину и действия. Можете и сами спросить про узел или регламент.'

function alarmPrompt(alarm: ActiveAlarm): string {
  return `Сработала тревога ${alarm.tag} (${alarm.message}). Объясни вероятную причину и порекомендуй действия оператору.`
}

export function AiAlarmChat() {
  const { t } = useTranslation()
  const alarms = useSessionStore((s) => s.alarms)
  const [entries, setEntries] = useState<Entry[]>([
    { id: 'greeting', role: 'assistant', kind: 'chat', content: GREETING },
  ])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const seenAlarmIds = useRef(new Set<string>())
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [entries, sending])

  // New alarm → post a pending "alert" bubble, then fill it in with the
  // knowledge-base explanation once it comes back.
  useEffect(() => {
    const unseen = alarms.filter((a) => !seenAlarmIds.current.has(a.id))
    for (const alarm of unseen) {
      seenAlarmIds.current.add(alarm.id)
      const entryId = `alert-${alarm.id}`
      setEntries((e) => [
        ...e,
        {
          id: entryId,
          role: 'assistant',
          kind: 'alert',
          tag: alarm.tag,
          level: alarm.level,
          content: 'Анализирую причину…',
          pending: true,
        },
      ])
      void aiApi
        .chat([{ role: 'user', content: alarmPrompt(alarm) }])
        .then((reply) => {
          setEntries((e) =>
            e.map((it) => (it.id === entryId ? { ...it, content: reply, pending: false } : it)),
          )
        })
        .catch(() => {
          setEntries((e) =>
            e.map((it) =>
              it.id === entryId
                ? { ...it, content: 'Не удалось получить объяснение причины.', pending: false }
                : it,
            ),
          )
        })
    }
  }, [alarms])

  async function send() {
    const text = input.trim()
    if (!text || sending) return
    const history = entries.filter((e) => e.kind === 'chat')
    const next: Entry[] = [
      ...entries,
      { id: `u-${Date.now()}`, role: 'user', kind: 'chat', content: text },
    ]
    setEntries(next)
    setInput('')
    setSending(true)
    try {
      const reply = await aiApi.chat([
        ...history.map((e) => ({ role: e.role, content: e.content })),
        { role: 'user', content: text },
      ])
      setEntries((e) => [
        ...e,
        { id: `a-${Date.now()}`, role: 'assistant', kind: 'chat', content: reply },
      ])
    } catch {
      setEntries((e) => [
        ...e,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          kind: 'chat',
          content: 'Не удалось получить ответ. Попробуйте ещё раз.',
        },
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

  const LEVEL_VARIANT: Record<ActiveAlarm['level'], 'alarm' | 'warn' | 'ok' | 'acc'> = {
    HH: 'alarm',
    H: 'warn',
    L: 'acc',
    LL: 'acc',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%' }}>
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          padding: 14,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {entries.map((entry) => {
          if (entry.kind === 'alert') {
            return (
              <div key={entry.id} className="box-alarm" style={{ padding: '10px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  {entry.level && (
                    <Pill variant={LEVEL_VARIANT[entry.level]}>
                      {t(`alarm.levels.${entry.level}`)}
                    </Pill>
                  )}
                  <span
                    style={{
                      fontFamily: 'var(--mono)',
                      fontSize: 10,
                      letterSpacing: '0.08em',
                      color: 'inherit',
                      opacity: 0.85,
                    }}
                  >
                    {entry.tag} · ИИ-ассистент
                  </span>
                </div>
                <div style={{ fontSize: 12.5, lineHeight: 1.55 }}>
                  {entry.pending ? <span className="note">{entry.content}</span> : entry.content}
                </div>
              </div>
            )
          }
          const isUser = entry.role === 'user'
          return (
            <div
              key={entry.id}
              style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start' }}
            >
              <div
                style={{
                  maxWidth: '88%',
                  padding: '10px 12px',
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
                    marginBottom: 4,
                    fontSize: 9,
                    color: isUser ? 'var(--acc-txt)' : 'var(--tx3)',
                  }}
                >
                  {isUser ? 'Вы' : 'ИИ-ассистент'}
                </div>
                <div
                  style={{
                    fontSize: 12.5,
                    lineHeight: 1.55,
                    whiteSpace: 'pre-wrap',
                    color: 'var(--tx)',
                  }}
                >
                  {entry.content}
                </div>
              </div>
            </div>
          )
        })}

        {sending && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div className="box-mute" style={{ maxWidth: '88%', padding: '10px 12px' }}>
              <div className="note">печатает…</div>
            </div>
          </div>
        )}
      </div>

      <div style={{ flexShrink: 0, padding: '10px 12px 12px', borderTop: '1px solid var(--ln)' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <input
            className="fld-box"
            style={{ flex: 1, fontSize: 12.5, padding: '9px 10px' }}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Вопрос ассистенту…"
          />
          <button
            className="btn btn-acc btn-sm"
            onClick={() => void send()}
            disabled={sending || !input.trim()}
          >
            →
          </button>
        </div>
      </div>
    </div>
  )
}
