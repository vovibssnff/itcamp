import { useNavigate } from 'react-router'
import { useAuthStore } from '@/store/auth'

interface NavCard {
  num: string
  title: string
  desc: string
  path: string
  roles?: string[]
}

const INSTRUCTOR_CARDS: NavCard[] = [
  {
    num: '01',
    title: 'Шаблоны',
    desc: 'Конструктор схем КТК — создание и редактирование технологических шаблонов',
    path: '/templates',
  },
  {
    num: '02',
    title: 'Компоненты',
    desc: 'Библиотека компонентов КТК для построения технологических схем',
    path: '/components',
  },
  {
    num: '03',
    title: 'Сценарии',
    desc: 'Управление сценариями обучения: создание, настройка неисправностей и критериев оценки',
    path: '/scenarios',
  },
  {
    num: '04',
    title: 'Сессии',
    desc: 'Консоль инструктора — запуск и наблюдение за сессиями обучения и аттестации',
    path: '/sessions',
  },
  {
    num: '05',
    title: 'Отчёты',
    desc: 'Результаты завершённых сессий — оценки, детальный анализ действий оператора',
    path: '/reports',
  },
]

const ADMIN_EXTRA: NavCard[] = [
  {
    num: '06',
    title: 'Пользователи',
    desc: 'Управление учётными записями, ролями и правами доступа',
    path: '/admin/users',
    roles: ['admin'],
  },
  {
    num: '07',
    title: 'Система',
    desc: 'Системные настройки, мониторинг состояния сервисов и конфигурация',
    path: '/admin/system',
    roles: ['admin'],
  },
]

export default function HomeScreen() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const role = user?.role ?? 'instructor'

  const cards = role === 'admin' ? [...INSTRUCTOR_CARDS, ...ADMIN_EXTRA] : INSTRUCTOR_CARDS

  const roleLabel: Record<string, string> = {
    admin: 'Администратор',
    instructor: 'Инструктор',
    operator: 'Оператор',
  }

  return (
    <div className="wrap-n">
      <div style={{ marginBottom: 32 }} className="rise">
        <div className="kick" style={{ marginBottom: 8 }}>
          {roleLabel[role] ?? role}
        </div>
        <h1 className="h1">Добро пожаловать{user?.displayName ? `, ${user.displayName}` : ''}</h1>
        <p className="lede" style={{ marginTop: 8 }}>
          Платформа подготовки операторов нефтеперерабатывающих установок КТК.
        </p>
      </div>

      <div className="cell rise d2" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="rows">
          {cards.map((card, i) => (
            <div
              key={card.path}
              className="row"
              style={{ animationDelay: `${0.05 + i * 0.04}s` }}
              onClick={() => void navigate(card.path)}
            >
              <span className="row-num">{card.num}</span>
              <div className="row-body">
                <div className="row-title">{card.title}</div>
                <div className="row-desc">{card.desc}</div>
              </div>
              <span className="row-arrow">→</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
