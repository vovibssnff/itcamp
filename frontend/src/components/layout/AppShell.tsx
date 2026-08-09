import { Outlet, Navigate, useLocation, useNavigate } from 'react-router'
import { Layout, Menu, Dropdown } from 'antd'
import {
  AppstoreOutlined,
  ApartmentOutlined,
  ThunderboltOutlined,
  PlayCircleOutlined,
  FileTextOutlined,
  SettingOutlined,
  UserOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  CaretDownOutlined,
} from '@ant-design/icons'
import { useAuthStore } from '@/store/auth'
import { useUIStore } from '@/store/ui'
import { useTranslation } from 'react-i18next'
import styles from './AppShell.module.css'

const { Sider, Content } = Layout

const ROUTE_LABELS: Record<string, string> = {
  '/home': 'Главная',
  '/templates': 'Шаблоны',
  '/components': 'Компоненты',
  '/scenarios': 'Сценарии',
  '/sessions': 'Сессии',
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
  const { locale, setLocale, theme, setTheme, sidebarCollapsed, toggleSidebar } = useUIStore()
  const { t, i18n } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const breadcrumbs = useBreadcrumbs(location.pathname)

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  const role = user?.role

  const menuItems = [
    ...(role === 'instructor' || role === 'admin'
      ? [
          {
            key: '/templates',
            icon: <ApartmentOutlined />,
            label: t('nav.templates'),
          },
          {
            key: '/components',
            icon: <AppstoreOutlined />,
            label: t('nav.components'),
          },
          {
            key: '/scenarios',
            icon: <ThunderboltOutlined />,
            label: t('nav.scenarios'),
          },
          {
            key: '/sessions',
            icon: <PlayCircleOutlined />,
            label: t('nav.sessions'),
          },
        ]
      : []),
    {
      key: '/reports',
      icon: <FileTextOutlined />,
      label: t('nav.reports'),
    },
    ...(role === 'admin'
      ? [
          {
            key: 'admin-group',
            icon: <SettingOutlined />,
            label: t('nav.admin'),
            children: [
              { key: '/admin/users', label: t('nav.users') },
              { key: '/admin/system', label: t('nav.system') },
            ],
          },
        ]
      : []),
  ]

  const userMenu = {
    items: [
      {
        key: 'lang',
        label: locale === 'ru' ? 'English' : 'Русский',
        onClick: () => {
          const next = locale === 'ru' ? 'en' : 'ru'
          setLocale(next)
          void i18n.changeLanguage(next)
        },
      },
      { type: 'divider' as const },
      {
        key: 'logout',
        icon: <LogoutOutlined />,
        label: t('auth.logout'),
        danger: true,
        onClick: () => {
          logout()
          void navigate('/login')
        },
      },
    ],
  }

  const allItems = menuItems.flatMap((item) =>
    'children' in item && item.children ? item.children : [item],
  )
  const selectedKey =
    allItems.find((item) => location.pathname.startsWith(item.key as string))?.key?.toString() ?? ''

  const roleLabel: Record<string, string> = {
    admin: 'Администратор',
    instructor: 'Инструктор',
    operator: 'Оператор',
  }

  const canGoBack = location.pathname !== '/home' && location.pathname !== '/'
  const isRoot =
    location.pathname === '/home' ||
    location.pathname === '/' ||
    /^\/(sessions\/[^/]+\/(mode|operator|exam))$/.test(location.pathname)

  return (
    <Layout className={styles.root}>
      {/* ── Glass topbar ── */}
      <div className={styles.topbar}>
        <div className={styles.topbarLeft}>
          <button className={styles.collapseBtn} onClick={toggleSidebar} aria-label="Свернуть меню">
            {sidebarCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          </button>

          <a
            className={styles.mark}
            onClick={() => {
              const home = role === 'operator' ? '/sessions/sess-001/mode' : '/home'
              void navigate(home)
            }}
          >
            <i className={styles.markDot} />
            <span>КТК</span>
          </a>
        </div>

        <div className={styles.topbarRight}>
          {/* Theme toggle */}
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

          {/* Language */}
          <button
            className={styles.themeSegBtn}
            style={{
              border: '1px solid var(--ln2)',
              borderRadius: 'var(--r)',
              padding: '5px 11px',
            }}
            onClick={() => {
              const next = locale === 'ru' ? 'en' : 'ru'
              setLocale(next)
              void i18n.changeLanguage(next)
            }}
          >
            {locale.toUpperCase()}
          </button>

          {/* User */}
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

      {/* ── Sidebar + Content ── */}
      <Layout className={styles.layout}>
        <Sider
          width={220}
          collapsedWidth={48}
          collapsed={sidebarCollapsed}
          className={styles.sider}
        >
          <Menu
            theme="dark"
            mode="inline"
            selectedKeys={[selectedKey]}
            defaultOpenKeys={['admin-group']}
            items={menuItems}
            onClick={({ key }) => void navigate(key)}
            className={styles.menu}
          />
        </Sider>

        <Content className={styles.content}>
          {/* Breadcrumb bar */}
          {breadcrumbs.length > 0 && (
            <div className={styles.breadcrumbBar}>
              {canGoBack && (
                <button className={styles.backBtn} onClick={() => navigate(-1)}>
                  ← Назад
                </button>
              )}
              {!isRoot && (
                <button
                  className={styles.backBtn}
                  onClick={() =>
                    void navigate(role === 'operator' ? '/sessions/sess-001/mode' : '/home')
                  }
                >
                  ⌂
                </button>
              )}
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
            </div>
          )}

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
