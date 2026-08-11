import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { message, Table, Tag, Button, Modal, Select } from 'antd'
import { PlayCircleOutlined, PlusOutlined } from '@ant-design/icons'
import { sessionsApi } from '@/api/sessions'
import { scenariosApi } from '@/api/scenarios'
import { useAuthStore } from '@/store/auth'
import type { SessionRecord } from '@/types'
import { tablePagination } from '@/components/ui'
import { tokens } from '@/theme/tokens'

const STATUS_COLORS: Record<string, string> = {
  idle: 'processing',
  running: 'success',
  paused: 'warning',
  stopped: 'default',
  finished: 'default',
}

const STATUS_LABELS: Record<string, string> = {
  idle: 'Ожидание',
  running: 'Идёт',
  paused: 'Пауза',
  stopped: 'Завершена',
  finished: 'Завершена',
}

const DEFAULT_TEMPLATE_ID = 'tmpl-elou-avt'

export default function OperatorHomeScreen() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const [sessions, setSessions] = useState<SessionRecord[]>([])
  const [loading, setLoading] = useState(true)

  // Self-service training modal
  const [trainModal, setTrainModal] = useState(false)
  const [scenarios, setScenarios] = useState<{ id: string; name: string }[]>([])
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | undefined>()
  const [starting, setStarting] = useState(false)

  useEffect(() => {
    void loadSessions()
    // loadSessions closes over stable state setters; re-run when user changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  async function loadSessions() {
    setLoading(true)
    try {
      const all = await sessionsApi.list()
      const mine = user?.id
        ? all.filter((s) => {
            const ids = s.operatorIds?.length ? s.operatorIds : [s.operatorId]
            return ids.includes(user.id)
          })
        : all
      const sorted = [...mine].sort((a, b) => {
        const rank = (st: string) => (st === 'running' || st === 'paused' || st === 'idle' ? 0 : 1)
        return rank(a.status) - rank(b.status)
      })
      setSessions(sorted)
    } catch {
      void message.error('Не удалось загрузить сессии')
    } finally {
      setLoading(false)
    }
  }

  async function openTrainModal() {
    setTrainModal(true)
    setSelectedScenarioId(undefined)
    try {
      const raw = (await scenariosApi.list({
        type: 'training',
        template_id: DEFAULT_TEMPLATE_ID,
      })) as {
        id?: string
        name?: string
      }[]
      setScenarios(raw.map((s) => ({ id: s.id ?? '', name: s.name ?? s.id ?? '' })))
    } catch {
      void message.error('Не удалось загрузить сценарии')
    }
  }

  async function startTraining() {
    if (!selectedScenarioId || !user?.id) return
    setStarting(true)
    try {
      const session = await sessionsApi.create({
        templateId: DEFAULT_TEMPLATE_ID,
        scenarioId: selectedScenarioId,
        operatorIds: [user.id],
        mode: 'training',
        speed: 1,
      })
      // Start the sim immediately — operator self-service
      await sessionsApi.action(session.id, 'start')
      setTrainModal(false)
      void navigate(`/sessions/${session.id}/operator`)
    } catch (err) {
      void message.error(String(err))
    } finally {
      setStarting(false)
    }
  }

  const activeCount = sessions.filter(
    (s) => s.status === 'running' || s.status === 'paused' || s.status === 'idle',
  ).length

  return (
    <div className="wrap rise">
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          marginBottom: 28,
        }}
      >
        <div>
          <div className="sec">Оператор</div>
          <h1 className="h1" style={{ marginTop: 12 }}>
            Мои сессии
          </h1>
          <p style={{ color: tokens.text.secondary, marginTop: 8 }}>
            {activeCount > 0
              ? `${activeCount} активных сессий`
              : 'Нет активных сессий — начните тренировку или дождитесь назначения инструктора'}
          </p>
        </div>

        <button className="btn btn-acc" onClick={() => void openTrainModal()}>
          <PlusOutlined /> Начать тренировку
        </button>
      </div>

      {/* Sessions table */}
      <Table
        rowKey="id"
        loading={loading}
        dataSource={sessions}
        locale={{ emptyText: 'Нет сессий' }}
        pagination={tablePagination({ hideOnSinglePage: true })}
        columns={[
          {
            title: 'Сценарий',
            dataIndex: 'scenarioName',
            render: (v: string | undefined, row: SessionRecord) => (
              <div>
                <div style={{ fontWeight: 500 }}>{v ?? '—'}</div>
                <div
                  style={{ fontSize: 11, color: tokens.text.muted, fontFamily: tokens.font.mono }}
                >
                  {row.id}
                </div>
              </div>
            ),
          },
          {
            title: 'Режим',
            dataIndex: 'mode',
            width: 110,
            render: (v: string) => (
              <Tag color={v === 'exam' ? 'red' : undefined}>
                {v === 'exam' ? 'Экзамен' : 'Тренировка'}
              </Tag>
            ),
          },
          {
            title: 'Статус',
            dataIndex: 'status',
            width: 120,
            render: (v: string) => <Tag color={STATUS_COLORS[v]}>{STATUS_LABELS[v] ?? v}</Tag>,
          },
          {
            title: '',
            key: 'go',
            width: 120,
            render: (_: unknown, row: SessionRecord) => {
              const active =
                row.status === 'running' || row.status === 'paused' || row.status === 'idle'
              return (
                <Button
                  type="primary"
                  size="small"
                  icon={<PlayCircleOutlined />}
                  disabled={!active}
                  onClick={() => void navigate(`/sessions/${row.id}/operator`)}
                >
                  Открыть
                </Button>
              )
            },
          },
        ]}
      />

      {/* Self-service training modal */}
      <Modal
        title="Начать тренировку"
        open={trainModal}
        onCancel={() => setTrainModal(false)}
        onOk={() => void startTraining()}
        okText="Начать"
        cancelText="Отмена"
        confirmLoading={starting}
        okButtonProps={{ disabled: !selectedScenarioId }}
      >
        <p style={{ color: tokens.text.secondary, marginBottom: 16 }}>
          Выберите учебный сценарий. Тренировка начнётся немедленно.
        </p>
        <div className="fld-group">
          <label className="fld-lbl">Сценарий</label>
          <Select
            style={{ width: '100%' }}
            placeholder="Выберите сценарий"
            value={selectedScenarioId}
            onChange={setSelectedScenarioId}
            options={scenarios.map((s) => ({ value: s.id, label: s.name }))}
            showSearch
            optionFilterProp="label"
            notFoundContent={scenarios.length === 0 ? 'Загрузка…' : 'Сценарии не найдены'}
          />
        </div>
      </Modal>
    </div>
  )
}
