import { useState, useEffect } from 'react'
import { Table, Tag } from 'antd'
import type { UserProfile, UserRole } from '@/store/auth'
import { usersApi } from '@/api/users'
import { tablePagination } from '@/components/ui'
import { tokens } from '@/theme/tokens'
import { message } from 'antd'

const ROLE_COLORS: Record<UserRole, string> = {
  admin: 'red',
  instructor: 'warning',
  operator: 'processing',
}

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Администратор',
  instructor: 'Инструктор',
  operator: 'Оператор',
}

export default function UsersScreen() {
  const [users, setUsers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)

  async function fetchUsers() {
    setLoading(true)
    try {
      setUsers(await usersApi.list())
    } catch {
      void message.error('Ошибка загрузки пользователей')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchUsers()
  }, [])

  const columns = [
    {
      title: 'Логин',
      dataIndex: 'username',
      key: 'username',
      render: (v: string) => (
        <span style={{ fontFamily: tokens.font.mono, color: tokens.text.primary }}>{v}</span>
      ),
    },
    {
      title: 'Отображаемое имя',
      dataIndex: 'displayName',
      key: 'displayName',
      render: (v: string) => <span style={{ color: tokens.text.secondary }}>{v}</span>,
    },
    {
      title: 'Роль',
      dataIndex: 'role',
      key: 'role',
      render: (v: UserRole) => <Tag color={ROLE_COLORS[v]}>{ROLE_LABELS[v]}</Tag>,
    },
  ]

  return (
    <div className="wrap">
      <div style={{ marginBottom: 24 }} className="rise">
        <div className="sec">Администрирование</div>
        <h1 className="h1" style={{ marginTop: 12 }}>
          Пользователи
        </h1>
        <p style={{ color: tokens.text.secondary, marginTop: 8 }}>
          Учётные записи ведутся во внешнем каталоге (LDAP). Только просмотр.
        </p>
      </div>

      <Table
        dataSource={users}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={tablePagination()}
      />
    </div>
  )
}
