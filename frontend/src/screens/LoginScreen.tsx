import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { Input, message } from 'antd'
import QRCode from 'qrcode'
import { useAuthStore } from '@/store/auth'
import { authApi, isMfaRequired } from '@/api/auth'
import { useTranslation } from 'react-i18next'
import { useUIStore } from '@/store/ui'

export default function LoginScreen() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [mfaCode, setMfaCode] = useState('')
  const [mfaRequired, setMfaRequired] = useState(false)
  const [mfaSecret, setMfaSecret] = useState<string | null>(null)
  const [otpauthUri, setOtpauthUri] = useState<string | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const { setTokens, setUser } = useAuthStore()
  const { theme, setTheme } = useUIStore()
  const navigate = useNavigate()
  const { t } = useTranslation()

  useEffect(() => {
    if (!otpauthUri) {
      setQrDataUrl(null)
      return
    }
    let cancelled = false
    void QRCode.toDataURL(otpauthUri, {
      width: 200,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#111111', light: '#ffffff' },
    }).then((url) => {
      if (!cancelled) setQrDataUrl(url)
    })
    return () => {
      cancelled = true
    }
  }, [otpauthUri])

  async function completeLogin(access: string, refresh: string) {
    setTokens(access, refresh)
    const user = await authApi.me()
    setUser(user)
    void navigate('/', { replace: true })
  }

  async function handleSubmit() {
    if (!username || !password) return
    if (mfaRequired && !mfaCode) return
    setLoading(true)
    try {
      const result = await authApi.login(username, password, mfaRequired ? mfaCode : undefined)
      if (isMfaRequired(result)) {
        setMfaRequired(true)
        setMfaSecret(result.secret ?? null)
        setOtpauthUri(result.otpauth_uri ?? null)
        void message.info(
          result.secret
            ? t('auth.mfaSetup', { defaultValue: 'Отсканируйте QR и введите код из приложения' })
            : t('auth.mfaRequired', { defaultValue: 'Введите код MFA' }),
        )
        return
      }
      await completeLogin(result.access_token, result.refresh_token)
    } catch {
      void message.error(t('auth.loginError'))
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') void handleSubmit()
  }

  async function copySecret() {
    if (!mfaSecret) return
    try {
      await navigator.clipboard.writeText(mfaSecret)
      void message.success(t('auth.mfaSecretCopied', { defaultValue: 'Секрет скопирован' }))
    } catch {
      void message.error(t('auth.mfaSecretCopyFailed', { defaultValue: 'Не удалось скопировать' }))
    }
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
              disabled={mfaRequired}
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
              disabled={mfaRequired}
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

          {mfaRequired && mfaSecret && (
            <div className="rise d4" style={{ marginTop: 28 }}>
              <label className="fld-lbl">
                {t('auth.mfaEnrollTitle', { defaultValue: 'Настройка 2FA' })}
              </label>
              <p
                style={{
                  margin: '8px 0 14px',
                  fontSize: 13,
                  lineHeight: 1.45,
                  color: 'var(--tx2)',
                }}
              >
                {t('auth.mfaEnrollHint', {
                  defaultValue:
                    'Отсканируйте QR в Google Authenticator / Authy или введите секрет вручную, затем укажите 6-значный код.',
                })}
              </p>
              {qrDataUrl && (
                <img
                  src={qrDataUrl}
                  alt={t('auth.mfaQrAlt', { defaultValue: 'QR-код для настройки MFA' })}
                  width={200}
                  height={200}
                  style={{
                    display: 'block',
                    marginBottom: 12,
                    background: '#fff',
                    padding: 8,
                    border: '1px solid var(--ln2)',
                  }}
                />
              )}
              <div
                style={{
                  display: 'flex',
                  gap: 8,
                  alignItems: 'center',
                  flexWrap: 'wrap',
                }}
              >
                <code
                  style={{
                    flex: 1,
                    minWidth: 0,
                    fontFamily: 'var(--mono)',
                    fontSize: 12,
                    wordBreak: 'break-all',
                    color: 'var(--tx)',
                    padding: '8px 0',
                  }}
                >
                  {mfaSecret}
                </code>
                <button type="button" className="btn" onClick={() => void copySecret()}>
                  {t('auth.mfaCopySecret', { defaultValue: 'Копировать' })}
                </button>
              </div>
            </div>
          )}

          {mfaRequired && (
            <div className="rise d4" style={{ marginTop: 22 }}>
              <label className="fld-lbl">{t('auth.mfaCode', { defaultValue: 'Код MFA' })}</label>
              <input
                className="fld"
                placeholder="123456"
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                onKeyDown={handleKeyDown}
                autoFocus
                autoComplete="one-time-code"
                inputMode="numeric"
              />
            </div>
          )}

          <div className="rise d5" style={{ marginTop: 34 }}>
            <button
              className="btn btn-acc btn-w"
              onClick={() => void handleSubmit()}
              disabled={loading || !username || !password || (mfaRequired && mfaCode.length < 6)}
            >
              {loading ? '...' : 'Войти в тренажёр'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
