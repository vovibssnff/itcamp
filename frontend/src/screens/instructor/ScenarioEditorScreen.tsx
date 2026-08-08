import { useState, useEffect } from 'react'
import { Table, Button, Tag, Modal, Form, Input, InputNumber, Space, message, Tabs } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, ThunderboltOutlined } from '@ant-design/icons'
import type { Scenario, ScenarioFault, ReferenceAction } from '@/mocks/fixtures/scenarios'
import { tokens } from '@/theme/tokens'

const FAULT_TYPES = [
  { value: 'sensor_fail', label: 'Отказ датчика' },
  { value: 'valve_stuck', label: 'Заклинивание клапана' },
  { value: 'pump_trip', label: 'Останов насоса' },
  { value: 'leak', label: 'Разгерметизация' },
  { value: 'fouling', label: 'Загрязнение' },
  { value: 'controller_fail', label: 'Отказ регулятора' },
]

const SEVERITY_COLORS: Record<string, string> = {
  low: 'default',
  medium: 'warning',
  high: 'error',
  critical: 'red',
}

export default function ScenarioEditorScreen() {
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Scenario | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [form] = Form.useForm()

  async function fetchScenarios() {
    setLoading(true)
    try {
      const res = await fetch('/api/scenarios')
      const data = (await res.json()) as Scenario[]
      setScenarios(data)
    } catch {
      void message.error('Ошибка загрузки сценариев')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchScenarios()
  }, [])

  async function deleteScenario(id: string) {
    await fetch(`/api/scenarios/${id}`, { method: 'DELETE' })
    void message.success('Удалён')
    void fetchScenarios()
  }

  function openEdit(sc: Scenario) {
    setSelected(sc)
    form.setFieldsValue(sc)
    setEditOpen(true)
  }

  async function saveScenario() {
    const values = (await form.validateFields()) as Scenario
    if (selected) {
      await fetch(`/api/scenarios/${selected.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...selected, ...values }),
      })
    } else {
      await fetch('/api/scenarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
    }
    void message.success('Сохранено')
    setEditOpen(false)
    void fetchScenarios()
  }

  const columns = [
    {
      title: 'Название',
      dataIndex: 'name',
      key: 'name',
      render: (v: string) => (
        <span style={{ color: tokens.text.primary, fontWeight: 500 }}>{v}</span>
      ),
    },
    {
      title: 'Сложность',
      dataIndex: 'difficulty',
      key: 'difficulty',
      render: (v: number) => '★'.repeat(v),
    },
    {
      title: 'Неисправностей',
      dataIndex: 'faults',
      key: 'faults',
      render: (faults: ScenarioFault[]) => (
        <span style={{ fontFamily: tokens.font.mono }}>{faults.length}</span>
      ),
    },
    {
      title: 'Мин. оценка',
      dataIndex: 'passingScore',
      key: 'passingScore',
      render: (v: number) => <span style={{ fontFamily: tokens.font.mono }}>{v}%</span>,
    },
    {
      title: '',
      key: 'actions',
      render: (_: unknown, record: Scenario) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} />
          <Button
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => void deleteScenario(record.id)}
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
        <div>
          <h3 style={{ color: tokens.text.primary, margin: 0 }}>Сценарии</h3>
          <span style={{ color: tokens.text.muted, fontSize: 12 }}>
            Управление сценариями и неисправностями
          </span>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            setSelected(null)
            form.resetFields()
            setEditOpen(true)
          }}
        >
          Новый сценарий
        </Button>
      </div>

      <Table
        dataSource={scenarios}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={false}
        expandable={{
          expandedRowRender: (record) => (
            <div style={{ padding: '8px 24px' }}>
              <Tabs
                size="small"
                items={[
                  {
                    key: 'faults',
                    label: (
                      <span>
                        <ThunderboltOutlined /> Неисправности
                      </span>
                    ),
                    children: (
                      <div>
                        {record.faults.map((f) => (
                          <div
                            key={f.id}
                            style={{
                              display: 'flex',
                              gap: 12,
                              padding: '4px 0',
                              borderBottom: `1px solid ${tokens.border.subtle}`,
                            }}
                          >
                            <Tag color={SEVERITY_COLORS[f.severity]}>{f.severity}</Tag>
                            <Tag>
                              {FAULT_TYPES.find((ft) => ft.value === f.type)?.label ?? f.type}
                            </Tag>
                            <span style={{ fontFamily: tokens.font.mono, fontSize: 11 }}>
                              {f.tag}
                            </span>
                            <span style={{ fontSize: 12, color: tokens.text.secondary }}>
                              {f.description}
                            </span>
                            {f.triggerDelay && (
                              <span
                                style={{
                                  fontFamily: tokens.font.mono,
                                  fontSize: 11,
                                  color: tokens.text.dim,
                                }}
                              >
                                +{f.triggerDelay}с
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    ),
                  },
                  {
                    key: 'actions',
                    label: 'Эталонные действия',
                    children: (
                      <div>
                        {record.referenceActions.map((a: ReferenceAction, i: number) => (
                          <div
                            key={i}
                            style={{
                              display: 'flex',
                              gap: 12,
                              padding: '4px 0',
                              borderBottom: `1px solid ${tokens.border.subtle}`,
                            }}
                          >
                            <span
                              style={{
                                fontFamily: tokens.font.mono,
                                fontSize: 11,
                                color: tokens.text.dim,
                                width: 40,
                              }}
                            >
                              {a.time}с
                            </span>
                            {a.isCritical && <Tag color="error">Крит.</Tag>}
                            <span style={{ fontSize: 12, color: tokens.text.secondary }}>
                              {a.description}
                            </span>
                          </div>
                        ))}
                      </div>
                    ),
                  },
                ]}
              />
            </div>
          ),
        }}
      />

      <Modal
        title={selected ? 'Редактировать сценарий' : 'Новый сценарий'}
        open={editOpen}
        onOk={() => void saveScenario()}
        onCancel={() => setEditOpen(false)}
        width={600}
        okText="Сохранить"
        cancelText="Отмена"
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="Название" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="Описание">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Space>
            <Form.Item name="difficulty" label="Сложность">
              <InputNumber min={1} max={5} />
            </Form.Item>
            <Form.Item name="passingScore" label="Мин. балл (%)">
              <InputNumber min={0} max={100} />
            </Form.Item>
            <Form.Item name="duration" label="Длительность (с)">
              <InputNumber min={60} />
            </Form.Item>
          </Space>
        </Form>
      </Modal>
    </div>
  )
}
