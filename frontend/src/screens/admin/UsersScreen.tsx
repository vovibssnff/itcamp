import { useState, useEffect } from 'react'
import { Table, Button, Tag, Space, Modal, Form, Input, Select, message, Typography } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import type { UserProfile, UserRole } from '@/store/auth'
import { tokens } from '@/theme/tokens'

const { Title } = Typography

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
  const [editOpen, setEditOpen] = useState(false)
  const [editing, setEditing] = useState<UserProfile | null>(null)
  const [form] = Form.useForm<UserProfile>()

  async function fetchUsers() {
    setLoading(true)
    try {
      const res = await fetch('/api/users')
      const data = (await res.json()) as UserProfile[]
      setUsers(data)
    } catch {
      void message.error('Ошибка загрузки')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchUsers()
  }, [])

  async function deleteUser(id: string) {
    await fetch(`/api/users/${id}`, { method: 'DELETE' })
    void message.success('Удалён')
    void fetchUsers()
  }

  function openEdit(user: UserProfile | null) {
    setEditing(user)
    if (user) form.setFieldsValue(user)
    else form.resetFields()
    setEditOpen(true)
  }

  async function saveUser() {
    const values = await form.validateFields()
    if (editing) {
      await fetch(`/api/users/${editing.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...editing, ...values }),
      })
    } else {
      await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
    }
    void message.success('Сохранено')
    setEditOpen(false)
    void fetchUsers()
  }

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
    {
      title: '',
      key: 'actions',
      render: (_: unknown, record: UserProfile) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} />
          <Button
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => void deleteUser(record.id)}
          />
        </Space>
      ),
    },
  ]

  return (
    <div style={{ padding: 24 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 20,
        }}
      >
        <Title level={4} style={{ color: tokens.text.primary, margin: 0 }}>
          Пользователи
        </Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openEdit(null)}>
          Новый пользователь
        </Button>
      </div>

      <Table
        dataSource={users}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={false}
      />

      <Modal
        title={editing ? 'Редактировать пользователя' : 'Новый пользователь'}
        open={editOpen}
        onOk={() => void saveUser()}
        onCancel={() => setEditOpen(false)}
        okText="Сохранить"
        cancelText="Отмена"
      >
        <Form form={form} layout="vertical">
          <Form.Item name="username" label="Логин" rules={[{ required: true }]}>
            <Input placeholder="ivanov.ii" />
          </Form.Item>
          <Form.Item name="displayName" label="Отображаемое имя" rules={[{ required: true }]}>
            <Input placeholder="Иванов И.И." />
          </Form.Item>
          <Form.Item name="role" label="Роль" rules={[{ required: true }]}>
            <Select
              options={(['admin', 'instructor', 'operator'] as UserRole[]).map((r) => ({
                value: r,
                label: ROLE_LABELS[r],
              }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
