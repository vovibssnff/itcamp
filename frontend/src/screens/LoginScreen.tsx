import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Input, message } from 'antd'
import { useAuthStore } from '@/store/auth'
import { authApi } from '@/api/auth'
import { useTranslation } from 'react-i18next'
import { useUIStore } from '@/store/ui'

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
  const { theme, toggleTheme } = useUIStore()
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

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') void handleSubmit()
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--ink)',
        padding: '24px',
        position: 'relative',
      }}
    >
      <div className="bg-grid" />

      {/* Theme toggle */}
      <button
        className="btn btn-ghost btn-sm"
        style={{
          position: 'absolute',
          top: 22,
          right: 22,
          fontFamily: 'var(--mono)',
          fontSize: 10,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
        }}
        onClick={toggleTheme}
      >
        {theme === 'dark' ? '◑ Светлая' : '● Тёмная'}
      </button>

      {/* Login card */}
      <div
        className="cell rise"
        style={{
          width: '100%',
          maxWidth: 420,
          padding: '40px 36px',
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* Brand */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 9,
            marginBottom: 28,
          }}
        >
          <i
            style={{
              width: 7,
              height: 7,
              background: 'var(--acc)',
              borderRadius: 1,
              display: 'block',
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontFamily: 'var(--mono)',
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: 'var(--tx2)',
            }}
          >
            КТК · Тренажёр
          </span>
        </div>

        <h2 className="h2" style={{ marginBottom: 4 }}>
          Вход в систему
        </h2>
        <p className="note" style={{ marginBottom: 24 }}>
          Компьютерный тренажёрный комплекс ЭЛОУ-АВТ
        </p>

        {/* Role tabs */}
        <div className="seg" style={{ width: '100%', marginBottom: 20 }}>
          <button
            style={{
              flex: 1,
              background: roleTab === 'operator' ? 'var(--acc)' : undefined,
              color: roleTab === 'operator' ? 'var(--acc-ink)' : undefined,
              fontWeight: roleTab === 'operator' ? 600 : undefined,
            }}
            onClick={() => setRoleTab('operator')}
          >
            Обучаемый
          </button>
          <button
            style={{
              flex: 1,
              background: roleTab === 'instructor' ? 'var(--acc)' : undefined,
              color: roleTab === 'instructor' ? 'var(--acc-ink)' : undefined,
              fontWeight: roleTab === 'instructor' ? 600 : undefined,
            }}
            onClick={() => setRoleTab('instructor')}
          >
            Инструктор
          </button>
        </div>

        <p className="note" style={{ marginBottom: 22 }}>
          {ROLE_DESCRIPTIONS[roleTab]}
        </p>

        {/* Fields */}
        <div style={{ marginBottom: 16 }}>
          <label className="fld-lbl">{t('auth.username')}</label>
          <input
            className="fld"
            placeholder="ivanov.ii"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
            autoComplete="username"
          />
        </div>

        {mode === 'register' && (
          <div style={{ marginBottom: 16 }}>
            <label className="fld-lbl">{t('auth.displayName')}</label>
            <input
              className="fld"
              placeholder="Иванов Иван Иванович"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              onKeyDown={handleKeyDown}
              autoComplete="name"
            />
          </div>
        )}

        <div style={{ marginBottom: 28 }}>
          <label className="fld-lbl">{t('auth.password')}</label>
          <Input.Password
            className="fld"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={handleKeyDown}
            autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
            style={{
              background: 'transparent',
              border: 'none',
              borderBottom: '1.5px solid var(--ln2)',
              borderRadius: 0,
              padding: '10px 0',
              fontFamily: 'var(--mono)',
              fontSize: 15,
              color: 'var(--tx)',
              boxShadow: 'none',
            }}
          />
        </div>

        <button
          className="btn btn-acc btn-w"
          onClick={() => void handleSubmit()}
          disabled={loading || !username || !password}
          style={{ marginBottom: 14 }}
        >
          {loading ? '...' : mode === 'register' ? t('auth.register') : t('auth.login')}
        </button>

        <button
          type="button"
          className="btn btn-ghost btn-w btn-sm"
          onClick={() => setMode((m) => (m === 'login' ? 'register' : 'login'))}
        >
          {mode === 'login' ? t('auth.noAccount') : t('auth.haveAccount')}
        </button>

        <div
          style={{
            marginTop: 28,
            fontFamily: 'var(--mono)',
            fontSize: 9,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--tx4)',
            textAlign: 'center',
          }}
        >
          Astra Linux SE 1.8 · LDAP
        </div>
      </div>
    </div>
  )
}
