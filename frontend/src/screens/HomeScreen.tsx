import { useNavigate } from 'react-router'
import { useAuthStore } from '@/store/auth'

interface NavCard {
  title: string
  desc: string
  path: string
  roles?: string[]
}

const INSTRUCTOR_CARDS: NavCard[] = [
  {
    title: 'Установки',
    desc: 'Конструктор технологических схем — создание и редактирование установок КТК',
    path: '/templates',
  },
  {
    title: 'Сценарии',
    desc: 'Управление сценариями обучения: создание, настройка неисправностей и критериев оценки',
    path: '/scenarios',
  },
  {
    title: 'Сессии',
    desc: 'Консоль инструктора — запуск и наблюдение за сессиями обучения и аттестации',
    path: '/sessions',
  },
  {
    title: 'Отчёты',
    desc: 'Результаты завершённых сессий — оценки, детальный анализ действий оператора',
    path: '/reports',
  },
]

const ADMIN_EXTRA: NavCard[] = [
  {
    title: 'Пользователи',
    desc: 'Управление учётными записями, ролями и правами доступа',
    path: '/admin/users',
    roles: ['admin'],
  },
  {
    title: 'Система',
    desc: 'Системные настройки, мониторинг состояния сервисов и конфигурация',
    path: '/admin/system',
    roles: ['admin'],
  },
  {
    title: 'Компоненты',
    desc: 'Библиотека типов компонентов КТК для построения технологических схем',
    path: '/components',
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
        <div className="sec">{roleLabel[role] ?? role}</div>
        <h1 className="h1" style={{ marginTop: 12 }}>
          Добро пожаловать{user?.displayName ? `, ${user.displayName}` : ''}
        </h1>
        <p className="lede" style={{ marginTop: 12 }}>
          Платформа подготовки операторов нефтеперерабатывающих установок КТК.
        </p>
      </div>

      <div className="rows rise d2" style={{ marginTop: 44 }}>
        {cards.map((card, i) => (
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
