import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Input, message } from 'antd'
import { useAuthStore } from '@/store/auth'
import { authApi } from '@/api/auth'
import { useTranslation } from 'react-i18next'
import styles from './LoginScreen.module.css'

type RoleTab = 'operator' | 'instructor'

const ROLE_DESCRIPTIONS: Record<RoleTab, string> = {
  operator:
    'Режим обучаемого оператора — прохождение тренировок и экзаменов по управлению технологическим процессом',
  instructor: 'Режим инструктора — управление сессиями, сценариями, шаблонами и оценкой обучаемых',
}

export default function LoginScreen() {
  const [roleTab, setRoleTab] = useState<RoleTab>('operator')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const { setTokens, setUser } = useAuthStore()
  const navigate = useNavigate()
  const { t } = useTranslation()

  async function handleLogin() {
    if (!username || !password) return
    setLoading(true)
    try {
      const result = await authApi.login(username, password)
      setTokens(result.access_token, result.refresh_token)
      setUser(result.user)
      const defaultRoute =
        result.user.role === 'operator'
          ? '/sessions'
          : result.user.role === 'instructor'
            ? '/sessions'
            : '/admin/users'
      void navigate(defaultRoute, { replace: true })
    } catch {
      void message.error(t('auth.loginError'))
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') void handleLogin()
  }

  return (
    <div className={styles.root}>
      <div className={styles.card}>
        <div className={styles.brand}>КТК · Тренажёрный комплекс</div>
        <div className={styles.title}>Установка ЭЛОУ-АВТ</div>
        <div className={styles.subtitle}>
          Компьютерный тренажёрный комплекс для обучения операторов технологического процесса
        </div>

        <div className={styles.roleTabs}>
          <button
            className={`${styles.roleTab} ${roleTab === 'operator' ? styles.roleTabActive : ''}`}
            onClick={() => setRoleTab('operator')}
          >
            Обучаемый
          </button>
          <button
            className={`${styles.roleTab} ${roleTab === 'instructor' ? styles.roleTabActive : ''}`}
            onClick={() => setRoleTab('instructor')}
          >
            Инструктор
          </button>
        </div>
        <div className={styles.roleDesc}>{ROLE_DESCRIPTIONS[roleTab]}</div>

        <label className={styles.label}>{t('auth.username')}</label>
        <Input
          className={styles.input}
          placeholder="Ivanov.II"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
          autoComplete="username"
        />

        <label className={styles.label} style={{ marginTop: 16 }}>
          {t('auth.password')}
        </label>
        <Input.Password
          className={styles.input}
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={handleKeyDown}
          autoComplete="current-password"
        />

        <button
          className={styles.loginBtn}
          onClick={() => void handleLogin()}
          disabled={loading || !username || !password}
        >
          {loading ? 'Вход...' : t('auth.login')}
        </button>

        <div className={styles.footer}>Astra Linux SE 1.8 · Аутентификация: корпоративный LDAP</div>
      </div>
    </div>
  )
}
