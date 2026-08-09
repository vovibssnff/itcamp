import { useState, useEffect, useCallback } from 'react'
import { message } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router'
import { DataTable, Pill, Modal } from '@/components/ui'
import { Field } from '@/components/ui'
import type { Template } from '@/mocks/fixtures/templates'

type TemplateRow = Omit<Template, 'nodes' | 'edges'>

export default function TemplateListScreen() {
  const [templates, setTemplates] = useState<TemplateRow[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const navigate = useNavigate()

  const fetchTemplates = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/templates')
      const data = (await res.json()) as TemplateRow[]
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

  return (
    <div className="wrap">
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          marginBottom: 28,
        }}
        className="rise"
      >
        <div>
          <div className="sec">Конструктор</div>
          <h1 className="h1" style={{ marginTop: 12 }}>
            Шаблоны установок
          </h1>
          <p className="note" style={{ marginTop: 12 }}>
            Технологические схемы КТК для сценариев обучения
          </p>
        </div>
        <button className="btn btn-acc" onClick={() => setCreateOpen(true)}>
          <PlusOutlined /> Новый шаблон
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="loading-spinner" />
      ) : (
        <div className="rise d2">
          <DataTable<TemplateRow>
            columns={[
              { key: 'name', title: 'Название', width: '2fr' },
              { key: 'description', title: 'Описание', width: '3fr' },
              {
                key: 'isValid',
                title: 'Статус',
                width: '100px',
                render: (row) => (
                  <Pill variant={row.isValid ? 'ok' : 'warn'}>
                    {row.isValid ? 'Валидный' : 'Черновик'}
                  </Pill>
                ),
              },
              {
                key: 'updatedAt',
                title: 'Обновлён',
                width: '120px',
                render: (row) => (
                  <span
                    style={{
                      fontFamily: 'var(--mono)',
                      fontSize: 11,
                      color: 'var(--tx3)',
                    }}
                  >
                    {new Date(row.updatedAt).toLocaleDateString('ru-RU')}
                  </span>
                ),
              },
              {
                key: 'actions',
                title: '',
                width: '140px',
                render: (row) => (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => void navigate(`/templates/${row.id}/edit`)}
                    >
                      <EditOutlined /> Открыть
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      style={{ padding: '5px 8px' }}
                      onClick={() => void deleteTemplate(row.id)}
                    >
                      <DeleteOutlined />
                    </button>
                  </div>
                ),
              },
            ]}
            rows={templates}
            rowKey={(row) => row.id}
            onRowClick={(row) => void navigate(`/templates/${row.id}/edit`)}
            emptyText="Шаблоны не найдены"
          />
        </div>
      )}

      {/* Create modal */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Новый шаблон"
        width={480}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setCreateOpen(false)}>
              Отмена
            </button>
            <button className="btn btn-acc" onClick={() => void createTemplate()}>
              Создать
            </button>
          </>
        }
      >
        <Field
          label="Название"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="ЭЛОУ-АВТ №1"
          autoFocus
        />
        <Field
          label="Описание"
          value={newDesc}
          onChange={(e) => setNewDesc(e.target.value)}
          placeholder="Краткое описание шаблона"
        />
      </Modal>
    </div>
  )
}
