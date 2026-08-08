import { useEffect } from 'react'
import { RouterProvider } from 'react-router'
import { router } from './router'
import { ConfigProvider } from 'antd'
import { antdTheme } from './theme/antd-theme'
import ruRU from 'antd/locale/ru_RU'
import enUS from 'antd/locale/en_US'
import { useUIStore } from './store/ui'
import { useAuthStore } from './store/auth'
import { authApi } from './api/auth'

export default function App() {
  const locale = useUIStore((s) => s.locale)

  // On load, exchange a persisted refresh token for a fresh access token so
  // reloads and deep-links keep the user signed in. Access tokens aren't
  // persisted, so without this a reload would drop to the login screen.
  useEffect(() => {
    const { accessToken, refreshToken } = useAuthStore.getState()
    if (accessToken || !refreshToken) return
    authApi
      .refresh(refreshToken)
      .then((res) => {
        useAuthStore.getState().setTokens(res.access_token, res.refresh_token)
        useAuthStore.getState().setUser(res.user)
      })
      .catch(() => useAuthStore.getState().logout())
  }, [])

  return (
    <ConfigProvider theme={antdTheme} locale={locale === 'ru' ? ruRU : enUS}>
      <RouterProvider router={router} />
    </ConfigProvider>
  )
}
