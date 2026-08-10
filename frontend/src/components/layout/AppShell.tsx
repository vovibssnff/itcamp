import { Outlet, Navigate, useLocation, useNavigate } from 'react-router'
import { Layout, Dropdown, Menu } from 'antd'
import type { MenuProps } from 'antd'
import {
  UserOutlined,
  LogoutOutlined,
  CaretDownOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  HomeOutlined,
  ApartmentOutlined,
  ThunderboltOutlined,
  PlayCircleOutlined,
  FileTextOutlined,
  BookOutlined,
  AppstoreOutlined,
  TeamOutlined,
  SettingOutlined,
} from '@ant-design/icons'
import { useAuthStore, type UserRole } from '@/store/auth'
import { useUIStore } from '@/store/ui'
import { authApi } from '@/api/auth'
import { useTranslation } from 'react-i18next'
import styles from './AppShell.module.css'

const { Content, Sider } = Layout

const ROUTE_LABELS: Record<string, string> = {
  '/home': 'Главная',
  '/operator': 'Главная',
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

function buildMenuItems(
  role: UserRole | undefined,
  t: (key: string, opts?: { defaultValue?: string }) => string,
): MenuProps['items'] {
  if (role === 'operator') {
    return [
      { key: '/operator', icon: <HomeOutlined />, label: t('nav.home', { defaultValue: 'Home' }) },
      { key: '/knowledge', icon: <BookOutlined />, label: t('nav.knowledge') },
      { key: '/reports', icon: <FileTextOutlined />, label: t('nav.reports') },
    ]
  }

  const items: NonNullable<MenuProps['items']> = [
    { key: '/home', icon: <HomeOutlined />, label: t('nav.home', { defaultValue: 'Home' }) },
    { key: '/templates', icon: <ApartmentOutlined />, label: t('nav.templates') },
    { key: '/components', icon: <AppstoreOutlined />, label: t('nav.components') },
    { key: '/scenarios', icon: <ThunderboltOutlined />, label: t('nav.scenarios') },
    { key: '/sessions', icon: <PlayCircleOutlined />, label: t('nav.sessions') },
    { key: '/knowledge', icon: <BookOutlined />, label: t('nav.knowledge') },
    { key: '/reports', icon: <FileTextOutlined />, label: t('nav.reports') },
  ]

  if (role === 'admin') {
    items.push({
      key: 'admin',
      icon: <SettingOutlined />,
      label: t('nav.admin'),
      children: [
        { key: '/admin/users', icon: <TeamOutlined />, label: t('nav.users') },
        { key: '/admin/system', icon: <SettingOutlined />, label: t('nav.system') },
      ],
    })
  }

  return items
}

function selectedMenuKey(pathname: string, items: MenuProps['items']): string {
  const flat = (items ?? []).flatMap((item) => {
    if (!item || typeof item !== 'object' || !('key' in item)) return []
    const children =
      'children' in item && Array.isArray(item.children)
        ? item.children.filter(
            (c): c is { key: string } => !!c && typeof c === 'object' && 'key' in c,
          )
        : []
    return children.length ? children : [{ key: String(item.key) }]
  })
  const match = flat
    .map((i) => String(i.key))
    .filter((key) => pathname === key || pathname.startsWith(key + '/'))
    .sort((a, b) => b.length - a.length)[0]
  return match ?? ''
}

export function AppShell() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const { theme, setTheme, sidebarCollapsed, toggleSidebar } = useUIStore()
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const breadcrumbs = useBreadcrumbs(location.pathname)

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  // The training/exam HMI is a full-screen immersive experience (matches the
  // ktk.html reference) — it renders its own topbar, so the admin/instructor
  // chrome (nav sider + app topbar) would otherwise double up on top of it.
  const isImmersive = /^\/sessions\/[^/]+\/(operator|exam)$/.test(location.pathname)
  if (isImmersive) {
    return <Outlet />
  }

  const role = user?.role
  const menuItems = buildMenuItems(role, t)
  const selectedKey = selectedMenuKey(location.pathname, menuItems)

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
      {/* ── Glass topbar ── */}
      <div className={styles.topbar}>
        <div className={styles.topbarLeft}>
          <button
            type="button"
            className={styles.collapseBtn}
            onClick={toggleSidebar}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          </button>
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

      {/* ── Content ── */}
      <Layout className={styles.layout}>
        <Sider
          width={220}
          collapsedWidth={56}
          collapsed={sidebarCollapsed}
          className={styles.sider}
          trigger={null}
        >
          <Menu
            mode="inline"
            selectedKeys={selectedKey ? [selectedKey] : []}
            defaultOpenKeys={role === 'admin' ? ['admin'] : []}
            items={menuItems}
            onClick={({ key }) => {
              if (key.startsWith('/')) void navigate(key)
            }}
            className={styles.menu}
          />
        </Sider>

        <Content className={styles.content}>
          {/* Navigation bar — back on every non-home screen */}
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
