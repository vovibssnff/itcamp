import { RouterProvider } from 'react-router'
import { router } from './router'
import { ConfigProvider } from 'antd'
import { antdTheme } from './theme/antd-theme'
import ruRU from 'antd/locale/ru_RU'
import enUS from 'antd/locale/en_US'
import { useUIStore } from './store/ui'

export default function App() {
  const locale = useUIStore((s) => s.locale)

  return (
    <ConfigProvider theme={antdTheme} locale={locale === 'ru' ? ruRU : enUS}>
      <RouterProvider router={router} />
    </ConfigProvider>
  )
}
