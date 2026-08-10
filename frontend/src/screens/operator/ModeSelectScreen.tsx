import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router'
import { useAuthStore } from '@/store/auth'
import type { ExamAssignment } from '@/mocks/fixtures/assignments'
import { isMockApi } from '@/utils/env'

interface ModeCard {
  key: string
  num: string
  label: string
  desc: string
  route: string
  dueLabel?: string
  overdue?: boolean
}

const BASE_MODES: ModeCard[] = [
  {
    key: 'operator',
    num: '01',
    label: 'Самостоятельная тренировка',
    desc: 'Изучение технологического процесса с подсказками ИИ и неограниченным временем',
    route: 'operator',
  },
  {
    key: 'knowledge',
    num: '03',
    label: 'База знаний',
    desc: 'Чат с ИИ-ассистентом по регламентам и технологии установки',
    route: 'knowledge',
  },
]

function formatDue(iso: string): string {
  return new Date(iso).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export default function ModeSelectScreen() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const [examAssignment, setExamAssignment] = useState<ExamAssignment | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!user?.id || !isMockApi()) {
      setLoaded(true)
      return
    }
    void (async () => {
      try {
        const res = await fetch('/api/assignments')
        const data = (await res.json()) as ExamAssignment[]
        const active = data
          .filter((a) => a.operatorId === user.id && a.status === 'scheduled')
          .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0]
        setExamAssignment(active ?? null)
      } catch {
        setExamAssignment(null)
      } finally {
        setLoaded(true)
      }
    })()
  }, [user?.id])

  const modes: ModeCard[] = []
  let num = 1
  modes.push({ ...BASE_MODES[0]!, num: String(num++).padStart(2, '0') })

  // Exam is always available for this session in real mode (instructor created exam session).
  if (!isMockApi()) {
    modes.push({
      key: 'exam',
      num: String(num++).padStart(2, '0'),
      label: 'Экзамен',
      desc: 'Экзаменационный режим без подсказок ИИ',
      route: 'exam',
    })
  } else if (examAssignment) {
    const overdue = examAssignment.dueDate.slice(0, 10) < new Date().toISOString().slice(0, 10)
    modes.push({
      key: 'exam',
      num: String(num++).padStart(2, '0'),
      label: 'Экзамен',
      desc: overdue
        ? `Назначен: «${examAssignment.scenarioName}». Срок истёк — пройдите как можно скорее.`
        : `Назначен: «${examAssignment.scenarioName}». Без подсказок ИИ, результат фиксируется в журнале.`,
      route: 'exam',
      dueLabel: overdue
        ? `Просрочен · было до ${formatDue(examAssignment.dueDate)}`
        : `Сдать до ${formatDue(examAssignment.dueDate)}`,
      overdue,
    })
  }

  if (isMockApi()) {
    modes.push({
      ...BASE_MODES[1]!,
      num: String(num++).padStart(2, '0'),
    })
  }

  return (
    <div className="wrap-n mode-select-screen">
      <div style={{ marginBottom: 24 }} className="rise">
        <h1 className="h1" style={{ fontSize: 34 }}>
          Выберите режим
        </h1>
        <p className="lede" style={{ marginTop: 12 }}>
          Тренировка доступна в любое время. Экзамен появляется здесь только после назначения
          инструктором и со сроком сдачи.
        </p>
      </div>

      {!loaded ? (
        <div className="loading-spinner" />
      ) : (
        <div className="rows rise d2" style={{ marginTop: 24 }}>
          {modes.map((mode) => (
            <div
              key={mode.key}
              className="row"
              onClick={() =>
                void navigate(
                  mode.route === 'knowledge' ? '/knowledge' : `/sessions/${id}/${mode.route}`,
                )
              }
            >
              <span className="row-num">{mode.num}</span>
              <div className="row-body">
                <div className="row-title">{mode.label}</div>
                <div className="row-desc">{mode.desc}</div>
                {mode.dueLabel && (
                  <div
                    style={{
                      marginTop: 8,
                      fontFamily: 'var(--mono)',
                      fontSize: 11,
                      letterSpacing: '0.04em',
                      color: mode.overdue ? 'var(--alarm)' : 'var(--acc-txt)',
                    }}
                  >
                    {mode.dueLabel}
                  </div>
                )}
              </div>
              <span className="row-arrow">→</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
