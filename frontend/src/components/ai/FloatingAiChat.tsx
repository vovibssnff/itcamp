import { useState } from 'react'
import { AiChat } from './AiChat'

interface FloatingAiChatProps {
  greeting?: string
  /** Hide the assistant entirely (e.g. during a qualification exam). */
  disabled?: boolean
  disabledLabel?: string
}

export function FloatingAiChat({ greeting, disabled, disabledLabel }: FloatingAiChatProps) {
  const [open, setOpen] = useState(false)

  if (disabled) {
    return (
      <div
        className="btn btn-ghost"
        style={{
          position: 'fixed',
          right: 20,
          bottom: 20,
          zIndex: 80,
          cursor: 'default',
          opacity: 0.7,
        }}
        title={disabledLabel ?? 'Подсказки ИИ отключены'}
      >
        ИИ отключён
      </div>
    )
  }

  if (!open) {
    return (
      <button
        className="btn btn-acc"
        onClick={() => setOpen(true)}
        style={{
          position: 'fixed',
          right: 20,
          bottom: 20,
          zIndex: 80,
          boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
        }}
      >
        ИИ-ассистент
      </button>
    )
  }

  return (
    <div
      style={{
        position: 'fixed',
        right: 20,
        bottom: 20,
        width: 320,
        height: 440,
        maxHeight: 'calc(100vh - 40px)',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--srf)',
        border: '1px solid var(--ln)',
        borderRadius: 'var(--r)',
        boxShadow: '0 12px 32px rgba(0,0,0,0.4)',
        zIndex: 80,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 14px',
          borderBottom: '1px solid var(--ln)',
          flexShrink: 0,
        }}
      >
        <span className="sec">ИИ-ассистент</span>
        <button
          onClick={() => setOpen(false)}
          aria-label="Закрыть"
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--tx3)',
            cursor: 'pointer',
            fontSize: 18,
            lineHeight: 1,
            padding: 0,
          }}
        >
          ×
        </button>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <AiChat
          variant="compact"
          greeting={
            greeting ??
            'Здравствуйте. Я — ИИ-ассистент установки ЭЛОУ-АВТ. Спросите про текущую тревогу, узел или регламент действий.'
          }
          placeholder="Вопрос ассистенту…"
        />
      </div>
    </div>
  )
}
