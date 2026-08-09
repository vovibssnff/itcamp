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
    'Тренировка на мнемосхеме установки, отработка аварийных ситуаций и разбор действий по регламенту.',
  instructor:
    'Управление сессиями, конструктор сценариев и шаблонов, наблюдение за обучаемыми и оценка.',
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
  const { theme, setTheme } = useUIStore()
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
    <div className="auth">
      {/* ── Left brand panel ── */}
      <div className="auth-l">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div
            className="rise"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 9,
              fontFamily: 'var(--mono)',
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: 'var(--tx2)',
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
            АВТОР · КТК ЭЛОУ-АВТ
          </div>

          <div className="seg seg-mono">
            <button
              style={{
                background: theme === 'dark' ? 'var(--acc)' : 'transparent',
                color: theme === 'dark' ? 'var(--acc-ink)' : 'var(--tx3)',
              }}
              onClick={() => setTheme('dark')}
            >
              Тёмная
            </button>
            <button
              style={{
                background: theme === 'light' ? 'var(--acc)' : 'transparent',
                color: theme === 'light' ? 'var(--acc-ink)' : 'var(--tx3)',
              }}
              onClick={() => setTheme('light')}
            >
              Светлая
            </button>
          </div>
        </div>

        <div style={{ padding: '48px 0' }}>
          <div className="kick rise d1" style={{ marginBottom: 18 }}>
            КТК ЭЛОУ-АВТ · Тренажёрный комплекс
          </div>
          <h1 className="auth-display rise d2">
            <span style={{ color: 'var(--acc)' }}>АВТ</span>ОР
          </h1>
          <p className="lede rise d3" style={{ marginTop: 26, maxWidth: '52ch' }}>
            Компьютерный тренажёрный комплекс для подготовки операторов технологического процесса:
            мнемосхема установки, отработка нештатных ситуаций и разбор действий по регламенту.
          </p>
        </div>

        <div className="auth-meta rise d4">
          <div>
            <span>Установка</span>
            <b>ЭЛОУ-АВТ / КТК</b>
          </div>
          <div>
            <span>Платформа</span>
            <b>Astra Linux SE 1.8</b>
          </div>
          <div>
            <span>Аутентификация</span>
            <b>Корпоративный LDAP</b>
          </div>
        </div>
      </div>

      {/* ── Right auth form ── */}
      <div className="auth-r">
        <div style={{ width: '100%', maxWidth: 360 }}>
          <div className="sec rise" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>{mode === 'register' ? 'Регистрация' : 'Вход в систему'}</span>
            <span>02 / 02</span>
          </div>
          <h2 className="h1 rise d1" style={{ marginTop: 12 }}>
            {mode === 'register' ? 'Создать учётную запись' : 'Авторизация'}
          </h2>

          {/* Role */}
          <div className="rise d2" style={{ marginTop: 32 }}>
            <div className="sec" style={{ marginBottom: 9 }}>
              Роль
            </div>
            <div className="seg" style={{ width: '100%' }}>
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
            <div className="note" style={{ marginTop: 10 }}>
              {ROLE_DESCRIPTIONS[roleTab]}
            </div>
          </div>

          {/* Username */}
          <div className="rise d3" style={{ marginTop: 30 }}>
            <label className="fld-lbl">{t('auth.username')}</label>
            <input
              className="fld"
              placeholder="Ivanov.II"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
              autoComplete="username"
            />
          </div>

          {mode === 'register' && (
            <div className="rise d3" style={{ marginTop: 22 }}>
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

          {/* Password */}
          <div className="rise d4" style={{ marginTop: 22 }}>
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

          <div className="rise d5" style={{ marginTop: 34 }}>
            <button
              className="btn btn-acc btn-w"
              onClick={() => void handleSubmit()}
              disabled={loading || !username || !password}
            >
              {loading ? '...' : mode === 'register' ? t('auth.register') : 'Войти в тренажёр'}
            </button>
          </div>

          <button
            type="button"
            className="btn btn-ghost btn-w btn-sm"
            style={{ marginTop: 12 }}
            onClick={() => setMode((m) => (m === 'login' ? 'register' : 'login'))}
          >
            {mode === 'login' ? t('auth.noAccount') : t('auth.haveAccount')}
          </button>

          <div className="note rise d6" style={{ marginTop: 18, fontSize: 11 }}>
            Доступ фиксируется в журнале безопасности. Учётные данные — корпоративные.
          </div>
        </div>
      </div>
    </div>
  )
}
