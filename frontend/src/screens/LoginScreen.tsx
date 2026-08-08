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

type AuthMode = 'login' | 'register'

export default function LoginScreen() {
  const [roleTab, setRoleTab] = useState<RoleTab>('operator')
  const [mode, setMode] = useState<AuthMode>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(false)
  const { setTokens, setUser } = useAuthStore()
  const navigate = useNavigate()
  const { t } = useTranslation()

  async function handleSubmit() {
    if (!username || !password) return
    setLoading(true)
    try {
      const result =
        mode === 'register'
          ? await authApi.register({ username, password, displayName, role: roleTab })
          : await authApi.login(username, password)
      setTokens(result.access_token, result.refresh_token)
      setUser(result.user)
      // Landing route is resolved by the role-based index redirect at "/".
      void navigate('/', { replace: true })
    } catch (err) {
      if (mode === 'register') {
        const msg =
          err instanceof Error && err.message.includes('already exists')
            ? t('auth.userExists')
            : t('auth.registerError')
        void message.error(msg)
      } else {
        void message.error(t('auth.loginError'))
      }
    } finally {
      setLoading(false)
    }
  }

  function toggleMode() {
    setMode((m) => (m === 'login' ? 'register' : 'login'))
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') void handleSubmit()
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

        {mode === 'register' && (
          <>
            <label className={styles.label} style={{ marginTop: 16 }}>
              {t('auth.displayName')}
            </label>
            <Input
              className={styles.input}
              placeholder="Иванов Иван Иванович"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              onKeyDown={handleKeyDown}
              autoComplete="name"
            />
          </>
        )}

        <label className={styles.label} style={{ marginTop: 16 }}>
          {t('auth.password')}
        </label>
        <Input.Password
          className={styles.input}
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={handleKeyDown}
          autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
        />

        <button
          className={styles.loginBtn}
          onClick={() => void handleSubmit()}
          disabled={loading || !username || !password}
        >
          {loading ? '...' : mode === 'register' ? t('auth.register') : t('auth.login')}
        </button>

        <button type="button" className={styles.modeToggle} onClick={toggleMode}>
          {mode === 'login' ? t('auth.noAccount') : t('auth.haveAccount')}
        </button>

        <div className={styles.footer}>Astra Linux SE 1.8 · Аутентификация: корпоративный LDAP</div>
      </div>
    </div>
  )
}
