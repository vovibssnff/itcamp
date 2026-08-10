import { AiChat } from '@/components/ai/AiChat'
import { isMockApi } from '@/utils/env'
import { tokens } from '@/theme/tokens'

export default function KnowledgeScreen() {
  if (!isMockApi()) {
    return (
      <div className="wrap rise">
        <div className="sec">База знаний</div>
        <h1 className="h1" style={{ marginTop: 12 }}>
          ИИ-ассистент недоступен
        </h1>
        <p style={{ color: tokens.text.secondary, marginTop: 12 }}>
          REST-чат с ИИ пока доступен только в mock-режиме. В реальном стеке подсказки ИИ приходят
          через WebSocket (`ai_hint`) во время тренировки.
        </p>
      </div>
    )
  }

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 760,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          padding: '0 26px',
        }}
      >
        <AiChat
          variant="page"
          greeting="Здравствуйте. Я — ассистент базы знаний по установке ЭЛОУ-АВТ. Спросите про технологический режим, регламент действий при отклонении параметра или устройство узла."
          placeholder="Спросите про регламент, узел или аварийную ситуацию…"
          footnote="Отвечает ИИ на основе регламентов установки ЭЛОУ-АВТ. Ответы справочные и не заменяют инструкцию по эксплуатации."
        />
      </div>
    </div>
  )
}
