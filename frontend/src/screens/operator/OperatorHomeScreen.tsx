import { useNavigate } from 'react-router'
import { useAuthStore } from '@/store/auth'

interface NavCard {
  title: string
  desc: string
  path: string
}

const OPERATOR_CARDS: NavCard[] = [
  {
    title: 'Мои сессии',
    desc: 'Активные и завершённые тренировки — старт сценария, журнал действий и инцидентов',
    path: '/operator/sessions',
  },
  {
    title: 'База знаний',
    desc: 'Справочные материалы и ИИ-ассистент по технологическому процессу',
    path: '/knowledge',
  },
  {
    title: 'Отчёты',
    desc: 'Результаты завершённых сессий — оценки и детальный анализ',
    path: '/reports',
  },
]

export default function OperatorHomeScreen() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)

  return (
    <div className="wrap-n mode-select-screen">
      <div style={{ marginBottom: 32 }} className="rise">
        <div className="sec">Оператор</div>
        <h1 className="h1" style={{ marginTop: 12 }}>
          Добро пожаловать{user?.displayName ? `, ${user.displayName}` : ''}
        </h1>
        <p className="lede" style={{ marginTop: 12 }}>
          Платформа подготовки операторов нефтеперерабатывающих установок КТК.
        </p>
      </div>

      <div className="rows rise d2" style={{ marginTop: 44 }}>
        {OPERATOR_CARDS.map((card, i) => (
          <div
            key={card.path}
            className="row"
            style={{ animationDelay: `${0.05 + i * 0.04}s` }}
            onClick={() => void navigate(card.path)}
          >
            <span className="row-num">{String(i + 1).padStart(2, '0')}</span>
            <div className="row-body">
              <div className="row-title">{card.title}</div>
              <div className="row-desc">{card.desc}</div>
            </div>
            <span className="row-arrow">→</span>
          </div>
        ))}
      </div>
    </div>
  )
}
