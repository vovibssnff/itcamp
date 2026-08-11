import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router'
import { sessionsApi } from '@/api/sessions'

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

export default function ModeSelectScreen() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [sessionMode, setSessionMode] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    void (async () => {
      try {
        if (id) {
          const session = await sessionsApi.get(id)
          setSessionMode(session.mode)
        }
      } catch {
        // No session context — show default modes only.
      } finally {
        setLoaded(true)
      }
    })()
  }, [id])

  const modes: ModeCard[] = []
  let num = 1
  modes.push({ ...BASE_MODES[0]!, num: String(num++).padStart(2, '0') })

  // Show exam card when the session was created in exam mode.
  if (sessionMode === 'exam') {
    modes.push({
      key: 'exam',
      num: String(num++).padStart(2, '0'),
      label: 'Экзамен',
      desc: 'Экзаменационный режим без подсказок ИИ. Результат фиксируется в журнале.',
      route: 'exam',
    })
  }

  // Knowledge base is available in all modes.
  modes.push({
    ...BASE_MODES[1]!,
    num: String(num++).padStart(2, '0'),
  })

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
