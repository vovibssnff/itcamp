import { useParams, useNavigate } from 'react-router'
import { Card } from 'antd'
import { BookOutlined, TrophyOutlined } from '@ant-design/icons'
import { tokens } from '@/theme/tokens'

const MODES = [
  {
    key: 'operator',
    icon: <BookOutlined style={{ fontSize: 28, color: tokens.accent.cyan }} />,
    label: 'Тренировка',
    desc: 'Изучение технологического процесса с подсказками ИИ',
    route: 'operator',
  },
  {
    key: 'exam',
    icon: <TrophyOutlined style={{ fontSize: 28, color: tokens.accent.amber }} />,
    label: 'Экзамен',
    desc: 'Оценочное испытание без подсказок с фиксацией результата',
    route: 'exam',
  },
]

export default function ModeSelectScreen() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  return (
    <div
      style={{
        maxWidth: 800,
        margin: '0 auto',
        padding: '48px 24px',
      }}
    >
      <h2 style={{ color: tokens.text.primary, marginBottom: 8 }}>Выберите режим</h2>
      <p style={{ color: tokens.text.muted, marginBottom: 32 }}>Сессия {id}</p>
      <div style={{ display: 'flex', gap: 16 }}>
        {MODES.map((mode) => (
          <Card
            key={mode.key}
            hoverable
            style={{
              flex: 1,
              background: tokens.bg.surface,
              border: `1px solid ${tokens.border.subtle}`,
              cursor: 'pointer',
            }}
            onClick={() => void navigate(`/sessions/${id}/${mode.route}`)}
          >
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
              {mode.icon}
              <h3 style={{ color: tokens.text.primary, margin: '12px 0 8px' }}>{mode.label}</h3>
              <p style={{ color: tokens.text.muted, fontSize: 13 }}>{mode.desc}</p>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
