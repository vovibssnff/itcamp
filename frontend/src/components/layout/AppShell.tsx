import { Outlet, Navigate, useLocation, useNavigate } from 'react-router'
import { Layout, Dropdown } from 'antd'
import { UserOutlined, LogoutOutlined, CaretDownOutlined } from '@ant-design/icons'
import { useAuthStore } from '@/store/auth'
import { useUIStore } from '@/store/ui'
import { authApi } from '@/api/auth'
import { useTranslation } from 'react-i18next'
import styles from './AppShell.module.css'

const { Content } = Layout

const ROUTE_LABELS: Record<string, string> = {
  '/home': 'Главная',
  '/operator': 'Главная',
  '/operator/sessions': 'Мои сессии',
  '/templates': 'Установки',
  '/components': 'Компоненты',
  '/scenarios': 'Сценарии',
  '/sessions': 'Сессии',
  '/knowledge': 'База знаний',
  '/reports': 'Отчёты',
  '/admin/users': 'Пользователи',
  '/admin/system': 'Система',
  '/admin': 'Администрирование',
}

function useBreadcrumbs(pathname: string) {
  const segments = pathname.split('/').filter(Boolean)
  const crumbs: { label: string; path: string }[] = []

  let acc = ''
  for (const seg of segments) {
    acc += '/' + seg
    const label = ROUTE_LABELS[acc]
    if (label) crumbs.push({ label, path: acc })
    else if (/^[0-9a-f-]{8,}$/.test(seg)) crumbs.push({ label: '#' + seg.slice(0, 8), path: acc })
  }
  return crumbs
}

export function AppShell() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const { theme, setTheme } = useUIStore()
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const breadcrumbs = useBreadcrumbs(location.pathname)

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  // Training/exam HMI is full-screen — skip chrome.
  const isImmersive = /^\/sessions\/[^/]+\/(operator|exam)$/.test(location.pathname)
  if (isImmersive) {
    return <Outlet />
  }

  const role = user?.role

  const userMenu = {
    items: [
      {
        key: 'logout',
        icon: <LogoutOutlined />,
        label: t('auth.logout'),
        danger: true,
        onClick: () => {
          const refresh = useAuthStore.getState().refreshToken
          void authApi
            .logout(refresh)
            .catch(() => {
              // Best-effort revoke; always clear local session.
            })
            .finally(() => {
              logout()
              void navigate('/login')
            })
        },
      },
    ],
  }

  const roleLabel: Record<string, string> = {
    admin: 'Администратор',
    instructor: 'Инструктор',
    operator: 'Оператор',
  }

  const homePath = role === 'operator' ? '/operator' : '/home'
  const canGoBack = location.pathname !== homePath && location.pathname !== '/'
  const isRoot =
    location.pathname === homePath ||
    location.pathname === '/' ||
    /^\/(sessions\/[^/]+\/(mode|operator|exam))$/.test(location.pathname)

  return (
    <Layout className={styles.root}>
      <div className={styles.topbar}>
        <div className={styles.topbarLeft}>
          <a
            className={styles.mark}
            onClick={() => {
              void navigate(homePath)
            }}
          >
            <i className={styles.markDot} />
            <span>КТК</span>
          </a>
        </div>

        <div className={styles.topbarRight}>
          <div className={styles.themeSeg}>
            <button
              className={`${styles.themeSegBtn} ${theme === 'dark' ? styles.themeSegBtnActive : ''}`}
              onClick={() => setTheme('dark')}
            >
              Тёмная
            </button>
            <button
              className={`${styles.themeSegBtn} ${theme === 'light' ? styles.themeSegBtnActive : ''}`}
              onClick={() => setTheme('light')}
            >
              Светлая
            </button>
          </div>

          <Dropdown menu={userMenu} trigger={['click']}>
            <div className={styles.userChip}>
              <UserOutlined style={{ color: 'var(--tx3)', fontSize: 13 }} />
              <div>
                <div className={styles.userName}>{user?.displayName}</div>
                <div className={styles.userRole}>{role ? (roleLabel[role] ?? role) : ''}</div>
              </div>
              <CaretDownOutlined style={{ color: 'var(--tx4)', fontSize: 10 }} />
            </div>
          </Dropdown>
        </div>
      </div>

      <Layout className={styles.layout}>
        <Content className={styles.contentFull}>
          <div className={styles.breadcrumbBar}>
            {canGoBack && (
              <button className={styles.backBtn} onClick={() => navigate(-1)}>
                ← Назад
              </button>
            )}
            {!isRoot && (
              <button className={styles.backBtn} onClick={() => void navigate(homePath)}>
                ⌂
              </button>
            )}
            {breadcrumbs.length > 0 && (
              <nav
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontFamily: 'var(--mono)',
                  fontSize: 10,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: 'var(--tx3)',
                }}
              >
                {breadcrumbs.map((crumb, i) => (
                  <span key={crumb.path} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {i > 0 && <span style={{ color: 'var(--tx4)' }}>/</span>}
                    <span
                      style={{
                        cursor: i < breadcrumbs.length - 1 ? 'pointer' : 'default',
                        color: i === breadcrumbs.length - 1 ? 'var(--tx)' : 'var(--tx3)',
                        transition: 'color 0.15s',
                      }}
                      onClick={() => i < breadcrumbs.length - 1 && void navigate(crumb.path)}
                    >
                      {crumb.label}
                    </span>
                  </span>
                ))}
              </nav>
            )}
          </div>

          <div
            style={{
              flex: 1,
              minHeight: 0,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <Outlet />
          </div>
        </Content>
      </Layout>
    </Layout>
  )
}
