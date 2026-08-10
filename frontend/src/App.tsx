import { useEffect } from 'react'
import { RouterProvider } from 'react-router'
import { router } from './router'
import { ConfigProvider } from 'antd'
import { darkTheme, lightTheme } from './theme/antd-theme'
import ruRU from 'antd/locale/ru_RU'
import enUS from 'antd/locale/en_US'
import { useUIStore } from './store/ui'
import { useAuthStore } from './store/auth'
import { authApi } from './api/auth'
import { useTranslation } from 'react-i18next'

export default function App() {
  const locale = useUIStore((s) => s.locale)
  const theme = useUIStore((s) => s.theme)
  const { i18n } = useTranslation()

  // Apply the theme to the document root for CSS variable switching
  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light')
    } else {
      document.documentElement.removeAttribute('data-theme')
    }
  }, [theme])

  // Sync persisted locale to i18next on boot (fix cold-start locale mismatch)
  useEffect(() => {
    if (locale && i18n.language !== locale) {
      void i18n.changeLanguage(locale)
    }
  }, [locale, i18n])

  // On load, exchange a persisted refresh token for a fresh access token so
  // reloads and deep-links keep the user signed in.
  useEffect(() => {
    const { accessToken, refreshToken } = useAuthStore.getState()
    if (accessToken || !refreshToken) return
    authApi
      .refresh(refreshToken)
      .then(async (res) => {
        useAuthStore.getState().setTokens(res.access_token, res.refresh_token)
        const user = await authApi.me()
        useAuthStore.getState().setUser(user)
      })
      .catch(() => useAuthStore.getState().logout())
  }, [])

  const antdTheme = theme === 'light' ? lightTheme : darkTheme

  return (
    <ConfigProvider theme={antdTheme} locale={locale === 'ru' ? ruRU : enUS}>
      <RouterProvider router={router} />
    </ConfigProvider>
  )
}
