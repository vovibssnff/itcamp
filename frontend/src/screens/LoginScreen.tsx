import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Input, message } from 'antd'
import { useAuthStore } from '@/store/auth'
import { authApi } from '@/api/auth'
import { toErrorMessage } from '@/api/errors'
import { useTranslation } from 'react-i18next'
import { useUIStore } from '@/store/ui'

export default function LoginScreen() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const { setTokens, setUser } = useAuthStore()
  const { theme, setTheme } = useUIStore()
  const navigate = useNavigate()
  const { t } = useTranslation()

  async function handleSubmit() {
    if (!username || !password) return
    setLoading(true)
    try {
      const result = await authApi.login(username, password)
      setTokens(result.access_token, result.refresh_token)
      const user = await authApi.me()
      setUser(user)
      void navigate('/', { replace: true })
    } catch (err) {
      void message.error(toErrorMessage(err, t('auth.loginError')))
      useAuthStore.getState().logout()
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
            АВТОР · Компьютерный тренажёрный комплекс
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

        <div
          style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}
        >
          <div className="kick rise d1" style={{ marginBottom: 18 }}>
            Тренажёрный комплекс
          </div>
          <h1 className="auth-display rise d2">
            <span style={{ color: 'var(--acc)' }}>АВТ</span>ОР
          </h1>
          <p className="lede rise d3" style={{ marginTop: 26, maxWidth: '52ch' }}>
            Компьютерный тренажёрный комплекс для подготовки операторов технологического процесса:
            мнемосхема установки, отработка нештатных ситуаций и разбор действий по регламенту.
          </p>
        </div>
      </div>

      {/* ── Right auth form ── */}
      <div className="auth-r">
        <div style={{ width: '100%', maxWidth: 360 }}>
          <div className="sec rise" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Вход в систему</span>
            <span>02 / 02</span>
          </div>
          <h2 className="h1 rise d1" style={{ marginTop: 12 }}>
            Авторизация
          </h2>

          {/* Username */}
          <div className="rise d3" style={{ marginTop: 32 }}>
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

          {/* Password */}
          <div className="rise d4" style={{ marginTop: 22 }}>
            <label className="fld-lbl">{t('auth.password')}</label>
            <Input.Password
              className="fld"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={handleKeyDown}
              autoComplete="current-password"
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
              {loading ? '...' : 'Войти в тренажёр'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
