import { useState, useEffect, useCallback } from 'react'
import { Button, Table, Tag, Space, Modal, Input, Typography, message } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, CopyOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router'
import { tokens } from '@/theme/tokens'
import type { Template } from '@/mocks/fixtures/templates'

const { Title, Text } = Typography

export default function TemplateListScreen() {
  const [templates, setTemplates] = useState<Omit<Template, 'nodes' | 'edges'>[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const navigate = useNavigate()

  const fetchTemplates = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/templates')
      const data = (await res.json()) as typeof templates
      setTemplates(data)
    } catch {
      void message.error('Ошибка загрузки шаблонов')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchTemplates()
  }, [fetchTemplates])

  async function createTemplate() {
    if (!newName.trim()) return
    try {
      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, description: newDesc }),
      })
      const tmpl = (await res.json()) as Template
      void message.success('Шаблон создан')
      setCreateOpen(false)
      setNewName('')
      setNewDesc('')
      void navigate(`/templates/${tmpl.id}/edit`)
    } catch {
      void message.error('Ошибка создания шаблона')
    }
  }

  async function deleteTemplate(id: string) {
    try {
      await fetch(`/api/templates/${id}`, { method: 'DELETE' })
      void message.success('Шаблон удалён')
      void fetchTemplates()
    } catch {
      void message.error('Ошибка удаления')
    }
  }

  const columns = [
    {
      title: 'Название',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => <Text style={{ color: tokens.text.primary }}>{text}</Text>,
    },
    {
      title: 'Описание',
      dataIndex: 'description',
      key: 'description',
      render: (text: string) => (
        <Text style={{ color: tokens.text.secondary, fontSize: 12 }}>{text}</Text>
      ),
    },
    {
      title: 'Статус',
      dataIndex: 'isValid',
      key: 'isValid',
      render: (v: boolean) => (
        <Tag color={v ? 'success' : 'warning'}>{v ? 'Валидный' : 'Черновик'}</Tag>
      ),
    },
    {
      title: 'Обновлён',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      render: (v: string) => (
        <Text style={{ color: tokens.text.dim, fontFamily: tokens.font.mono, fontSize: 11 }}>
          {new Date(v).toLocaleDateString('ru-RU')}
        </Text>
      ),
    },
    {
      title: '',
      key: 'actions',
      render: (_: unknown, record: { id: string }) => (
        <Space>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => void navigate(`/templates/${record.id}/edit`)}
          >
            Редактировать
          </Button>
          <Button size="small" icon={<CopyOutlined />} />
          <Button
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => void deleteTemplate(record.id)}
          />
        </Space>
      ),
    },
  ]

  return (
    <div style={{ padding: 24, height: '100%' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 20,
        }}
      >
        <div>
          <Title level={4} style={{ color: tokens.text.primary, margin: 0 }}>
            Шаблоны установок
          </Title>
          <Text style={{ color: tokens.text.muted, fontSize: 12 }}>
            Конструктор технологических схем
          </Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
          Новый шаблон
        </Button>
      </div>

      <Table
        dataSource={templates}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={false}
        style={{ background: tokens.bg.surface }}
        rowClassName={() => 'template-row'}
      />

      <Modal
        title="Новый шаблон"
        open={createOpen}
        onOk={() => void createTemplate()}
        onCancel={() => setCreateOpen(false)}
        okText="Создать"
        cancelText="Отмена"
      >
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, color: tokens.text.muted }}>Название</label>
          <Input
            style={{ marginTop: 4 }}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="ЭЛОУ-АВТ №1"
            autoFocus
          />
        </div>
        <div>
          <label style={{ fontSize: 12, color: tokens.text.muted }}>Описание</label>
          <Input.TextArea
            style={{ marginTop: 4 }}
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            rows={2}
            placeholder="Краткое описание шаблона"
          />
        </div>
      </Modal>
    </div>
  )
}
