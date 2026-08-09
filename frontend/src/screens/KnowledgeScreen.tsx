import { AiChat } from '@/components/ai/AiChat'

export default function KnowledgeScreen() {
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
