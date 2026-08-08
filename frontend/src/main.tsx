import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './theme/global.css'
import './i18n/config'

async function bootstrap() {
  if (import.meta.env.VITE_MOCK_API === 'true') {
    const { worker } = await import('./mocks/browser')
    await worker.start({ onUnhandledRequest: 'bypass' })
    const { installMockWebSocket } = await import('./mocks/ws/install-mock-ws')
    installMockWebSocket()
  }

  const root = document.getElementById('root')
  if (!root) throw new Error('Root element not found')

  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
}

bootstrap().catch(console.error)
