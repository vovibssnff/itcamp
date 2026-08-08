import { useParams, useNavigate } from 'react-router'

const MODES = [
  {
    key: 'operator',
    num: '01',
    icon: '📗',
    label: 'Тренировка',
    desc: 'Изучение технологического процесса с подсказками ИИ и неограниченным временем',
    route: 'operator',
  },
  {
    key: 'exam',
    num: '02',
    icon: '🏆',
    label: 'Экзамен',
    desc: 'Оценочное испытание без подсказок — результат фиксируется в журнале',
    route: 'exam',
  },
]

export default function ModeSelectScreen() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  return (
    <div className="wrap-n">
      <div style={{ marginBottom: 32 }} className="rise">
        <div className="kick" style={{ marginBottom: 8 }}>
          Сессия {id}
        </div>
        <h1 className="h1">Выберите режим</h1>
        <p className="lede" style={{ marginTop: 8 }}>
          Тренировка доступна в любое время. Экзамен назначается инструктором.
        </p>
      </div>

      <div className="cell rise d2" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="rows">
          {MODES.map((mode) => (
            <div
              key={mode.key}
              className="row"
              onClick={() => void navigate(`/sessions/${id}/${mode.route}`)}
            >
              <span className="row-num">{mode.num}</span>
              <div className="row-body">
                <div className="row-title">{mode.label}</div>
                <div className="row-desc">{mode.desc}</div>
              </div>
              <span className="row-arrow">→</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
