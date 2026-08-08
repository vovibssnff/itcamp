import { Outlet, Navigate, useLocation, useNavigate } from 'react-router'
import { Layout, Menu, Button, Space, Typography, Dropdown } from 'antd'
import {
  AppstoreOutlined,
  ApartmentOutlined,
  ThunderboltOutlined,
  PlayCircleOutlined,
  FileTextOutlined,
  SettingOutlined,
  UserOutlined,
  LogoutOutlined,
  GlobalOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from '@ant-design/icons'
import { useAuthStore } from '@/store/auth'
import { useUIStore } from '@/store/ui'
import { useTranslation } from 'react-i18next'
import styles from './AppShell.module.css'

const { Header, Sider, Content } = Layout
const { Text } = Typography

export function AppShell() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const { locale, setLocale, sidebarCollapsed, toggleSidebar } = useUIStore()
  const { t, i18n } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()

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
            key: 'admin',
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
        icon: <GlobalOutlined />,
        label: locale === 'ru' ? 'English' : 'Русский',
        onClick: () => {
          const next = locale === 'ru' ? 'en' : 'ru'
          setLocale(next)
          void i18n.changeLanguage(next)
        },
      },
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

  const selectedKey =
    menuItems
      .flatMap((item) => ('children' in item && item.children ? item.children : [item]))
      .find((item) => location.pathname.startsWith(item.key))?.key ?? ''

  return (
    <Layout className={styles.root}>
      <Header className={styles.header}>
        <div className={styles.headerLeft}>
          <Button
            type="text"
            icon={sidebarCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={toggleSidebar}
            className={styles.collapseBtn}
          />
          <span className={styles.logo}>
            <span className={styles.logoCyan}>КТК</span>
            <span className={styles.logoText}> Конструктор</span>
          </span>
        </div>
        <Space>
          <Text className={styles.userRole}>{user?.role?.toUpperCase()}</Text>
          <Dropdown menu={userMenu} trigger={['click']}>
            <Button type="text" icon={<UserOutlined />} className={styles.userBtn}>
              {user?.displayName}
            </Button>
          </Dropdown>
        </Space>
      </Header>
      <Layout>
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
            items={menuItems}
            onClick={({ key }) => void navigate(key)}
            className={styles.menu}
          />
        </Sider>
        <Content className={styles.content}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}
