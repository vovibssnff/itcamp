import { useState, useEffect, useCallback } from 'react'
import {
  Table,
  Tag,
  Button,
  Space,
  Select,
  Slider,
  Tooltip,
  message,
  Modal,
  Input,
  Form,
} from 'antd'
import {
  PlayCircleOutlined,
  PauseCircleOutlined,
  StopOutlined,
  EyeOutlined,
  CameraOutlined,
  EditOutlined,
  PlusOutlined,
  RollbackOutlined,
  FileTextOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router'
import type { SessionRecord } from '@/mocks/fixtures/sessions'
import { sessionsApi } from '@/api/sessions'
import { assessmentApi } from '@/api/assessment'
import { snapshotsApi } from '@/api/snapshots'
import { reportsApi } from '@/api/reports'
import { templatesApi } from '@/api/templates'
import { scenariosApi } from '@/api/scenarios'
import { usersApi } from '@/api/users'
import type { SnapshotMeta } from '@/api/mappers'
import type { TemplateSummary } from '@/api/mappers'
import type { UserProfile } from '@/store/auth'
import { tokens } from '@/theme/tokens'

const STATUS_COLORS: Record<string, string> = {
  idle: 'default',
  running: 'success',
  paused: 'warning',
  stopped: 'default',
  finished: 'processing',
}

const STATUS_LABELS: Record<string, string> = {
  idle: 'Ожидание',
  running: 'Идёт',
  paused: 'Пауза',
  stopped: 'Остановлена',
  finished: 'Завершена',
}

export default function InstructorConsole() {
  const [sessions, setSessions] = useState<SessionRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [snapshotModal, setSnapshotModal] = useState<{ open: boolean; sessionId: string | null }>({
    open: false,
    sessionId: null,
  })
  const [snapshotLabel, setSnapshotLabel] = useState('')
  const [overrideModal, setOverrideModal] = useState<{ open: boolean; sessionId: string | null }>({
    open: false,
    sessionId: null,
  })
  const [overrideScore, setOverrideScore] = useState(0)
  const [overrideComment, setOverrideComment] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm] = Form.useForm<{
    templateId: string
    scenarioId: string
    operatorId: string
    mode: 'training' | 'exam'
  }>()
  const [templates, setTemplates] = useState<TemplateSummary[]>([])
  const [scenarios, setScenarios] = useState<{ id: string; name: string }[]>([])
  const [operators, setOperators] = useState<UserProfile[]>([])
  const [restoreModal, setRestoreModal] = useState<{ open: boolean; sessionId: string | null }>({
    open: false,
    sessionId: null,
  })
  const [sessionSnapshots, setSessionSnapshots] = useState<SnapshotMeta[]>([])
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string | null>(null)
  const [snapshotDetail, setSnapshotDetail] = useState<SnapshotMeta | null>(null)
  const navigate = useNavigate()

  const fetchSessions = useCallback(async () => {
    setLoading(true)
    try {
      setSessions(await sessionsApi.list())
    } catch {
      void message.error('Ошибка загрузки сессий')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchSessions()
  }, [fetchSessions])

  async function openCreate() {
    try {
      const [tmpls, scens, users] = await Promise.all([
        templatesApi.list(),
        scenariosApi.list(),
        usersApi.list(),
      ])
      setTemplates(tmpls)
      setScenarios(
        (scens as { id?: string; name?: string }[]).map((s) => ({
          id: s.id ?? '',
          name: s.name ?? s.id ?? '',
        })),
      )
      setOperators(users.filter((u) => u.role === 'operator'))
      createForm.resetFields()
      createForm.setFieldsValue({ mode: 'training' })
      setCreateOpen(true)
    } catch {
      void message.error('Не удалось загрузить данные для создания сессии')
    }
  }

  async function createSession() {
    const values = await createForm.validateFields()
    try {
      const created = await sessionsApi.create({
        templateId: values.templateId,
        scenarioId: values.scenarioId,
        operatorIds: [values.operatorId],
        mode: values.mode,
      })
      void message.success('Сессия создана')
      setCreateOpen(false)
      void fetchSessions()
      void navigate(`/sessions/${created.id}/observe`)
    } catch {
      void message.error('Ошибка создания сессии')
    }
  }

  async function sessionAction(id: string, action: 'start' | 'pause' | 'resume' | 'stop') {
    await sessionsApi.action(id, action)
    void fetchSessions()
  }

  async function setSpeed(id: string, speed: number) {
    await sessionsApi.setSpeed(id, speed)
    void fetchSessions()
  }

  async function saveSnapshot() {
    if (!snapshotModal.sessionId || !snapshotLabel) return
    await sessionsApi.checkpoint(snapshotModal.sessionId, snapshotLabel)
    void message.success('Снимок сохранён')
    setSnapshotModal({ open: false, sessionId: null })
    setSnapshotLabel('')
  }

  async function submitOverride() {
    if (!overrideModal.sessionId) return
    await assessmentApi.override({
      sessionId: overrideModal.sessionId,
      newScore: overrideScore,
      verdict: overrideScore >= 60 ? 'pass' : 'fail',
      comment: overrideComment,
    })
    void message.success('Оценка скорректирована')
    setOverrideModal({ open: false, sessionId: null })
  }

  async function openRestore(sessionId: string) {
    try {
      const snaps = await snapshotsApi.list(sessionId)
      setSessionSnapshots(snaps)
      setSelectedSnapshotId(snaps[0]?.id ?? null)
      setRestoreModal({ open: true, sessionId })
      setSnapshotDetail(null)
    } catch {
      void message.error('Не удалось загрузить снимки')
    }
  }

  async function viewSnapshotDetail(id: string) {
    try {
      setSnapshotDetail(await snapshotsApi.get(id))
    } catch {
      void message.error('Не удалось загрузить снимок')
    }
  }

  async function restoreSnapshot() {
    if (!restoreModal.sessionId || !selectedSnapshotId) return
    try {
      await sessionsApi.restore(restoreModal.sessionId, selectedSnapshotId)
      void message.success('Сессия восстановлена из снимка')
      setRestoreModal({ open: false, sessionId: null })
      void fetchSessions()
    } catch {
      void message.error('Ошибка восстановления')
    }
  }

  async function queueReport(session: SessionRecord) {
    try {
      const report = await reportsApi.create(
        session.id,
        session.mode === 'exam' ? 'exam' : 'session',
      )
      void message.success(`Отчёт поставлен в очередь (${report.status})`)
      void navigate(`/reports/${report.id}`)
    } catch {
      void message.error('Ошибка постановки отчёта')
    }
  }

  const columns = [
    {
      title: 'Обучаемый',
      dataIndex: 'operatorName',
      key: 'operatorName',
      render: (v: string) => <span style={{ color: tokens.text.primary }}>{v}</span>,
    },
    {
      title: 'Сценарий',
      dataIndex: 'scenarioName',
      key: 'scenarioName',
      render: (v: string | undefined) => (
        <span style={{ color: tokens.text.secondary, fontSize: 12 }}>{v ?? '—'}</span>
      ),
    },
    {
      title: 'Режим',
      dataIndex: 'mode',
      key: 'mode',
      render: (v: string) => <Tag>{v === 'exam' ? 'Экзамен' : 'Тренировка'}</Tag>,
    },
    {
      title: 'Статус',
      dataIndex: 'status',
      key: 'status',
      render: (v: string) => <Tag color={STATUS_COLORS[v]}>{STATUS_LABELS[v] ?? v}</Tag>,
    },
    {
      title: 'Скорость',
      dataIndex: 'speed',
      key: 'speed',
      width: 160,
      render: (v: number, record: SessionRecord) => (
        <Select
          size="small"
          value={v}
          onChange={(val) => void setSpeed(record.id, val)}
          options={[0.1, 0.25, 0.5, 1, 2, 5, 10].map((s) => ({ value: s, label: `${s}×` }))}
          style={{ width: 80 }}
          disabled={record.status !== 'running'}
        />
      ),
    },
    {
      title: 'Действия',
      key: 'actions',
      render: (_: unknown, record: SessionRecord) => (
        <Space size={4}>
          {record.status === 'idle' && (
            <Tooltip title="Запустить">
              <Button
                size="small"
                icon={<PlayCircleOutlined />}
                onClick={() => void sessionAction(record.id, 'start')}
              />
            </Tooltip>
          )}
          {record.status === 'running' && (
            <Tooltip title="Пауза">
              <Button
                size="small"
                icon={<PauseCircleOutlined />}
                onClick={() => void sessionAction(record.id, 'pause')}
              />
            </Tooltip>
          )}
          {record.status === 'paused' && (
            <Tooltip title="Продолжить">
              <Button
                size="small"
                icon={<PlayCircleOutlined />}
                onClick={() => void sessionAction(record.id, 'resume')}
              />
            </Tooltip>
          )}
          {(record.status === 'running' || record.status === 'paused') && (
            <Tooltip title="Остановить">
              <Button
                size="small"
                danger
                icon={<StopOutlined />}
                onClick={() => void sessionAction(record.id, 'stop')}
              />
            </Tooltip>
          )}
          <Tooltip title="Наблюдение">
            <Button
              size="small"
              icon={<EyeOutlined />}
              onClick={() => void navigate(`/sessions/${record.id}/observe`)}
            />
          </Tooltip>
          <Tooltip title="Снимок">
            <Button
              size="small"
              icon={<CameraOutlined />}
              onClick={() => {
                setSnapshotModal({ open: true, sessionId: record.id })
                setSnapshotLabel('')
              }}
            />
          </Tooltip>
          <Tooltip title="Восстановить">
            <Button
              size="small"
              icon={<RollbackOutlined />}
              onClick={() => void openRestore(record.id)}
            />
          </Tooltip>
          <Tooltip title="Сформировать отчёт">
            <Button
              size="small"
              icon={<FileTextOutlined />}
              onClick={() => void queueReport(record)}
            />
          </Tooltip>
          {(record.reportId || record.status === 'finished' || record.status === 'stopped') && (
            <Tooltip title="Скорректировать оценку">
              <Button
                size="small"
                icon={<EditOutlined />}
                onClick={() => {
                  setOverrideModal({ open: true, sessionId: record.id })
                  setOverrideScore(0)
                }}
              />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div className="wrap">
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          marginBottom: 24,
        }}
        className="rise"
      >
        <div>
          <div className="sec">Инструктор</div>
          <h1 className="h1" style={{ marginTop: 12 }}>
            Консоль управления
          </h1>
          <p className="note" style={{ marginTop: 12 }}>
            Мониторинг и управление активными сессиями
          </p>
        </div>
        <Space>
          <button className="btn btn-ghost btn-sm" onClick={() => void fetchSessions()}>
            Обновить
          </button>
          <button className="btn btn-acc btn-sm" onClick={() => void openCreate()}>
            <PlusOutlined /> Новая сессия
          </button>
        </Space>
      </div>

      <Table
        dataSource={sessions}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={false}
      />

      <Modal
        title="Новая сессия"
        open={createOpen}
        onOk={() => void createSession()}
        onCancel={() => setCreateOpen(false)}
        okText="Создать"
        cancelText="Отмена"
      >
        <Form form={createForm} layout="vertical">
          <Form.Item name="templateId" label="Шаблон" rules={[{ required: true }]}>
            <Select
              options={templates.map((t) => ({ value: t.id, label: t.name }))}
              showSearch
              optionFilterProp="label"
            />
          </Form.Item>
          <Form.Item name="scenarioId" label="Сценарий" rules={[{ required: true }]}>
            <Select
              options={scenarios.map((s) => ({ value: s.id, label: s.name }))}
              showSearch
              optionFilterProp="label"
            />
          </Form.Item>
          <Form.Item name="operatorId" label="Оператор" rules={[{ required: true }]}>
            <Select
              options={operators.map((u) => ({
                value: u.id,
                label: `${u.displayName} (${u.username})`,
              }))}
              showSearch
              optionFilterProp="label"
            />
          </Form.Item>
          <Form.Item name="mode" label="Режим" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'training', label: 'Тренировка' },
                { value: 'exam', label: 'Экзамен' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Сохранить снимок"
        open={snapshotModal.open}
        onOk={() => void saveSnapshot()}
        onCancel={() => setSnapshotModal({ open: false, sessionId: null })}
        okText="Сохранить"
        cancelText="Отмена"
      >
        <Input
          placeholder="Название снимка"
          value={snapshotLabel}
          onChange={(e) => setSnapshotLabel(e.target.value)}
          autoFocus
        />
      </Modal>

      <Modal
        title="Восстановить из снимка"
        open={restoreModal.open}
        onOk={() => void restoreSnapshot()}
        onCancel={() => setRestoreModal({ open: false, sessionId: null })}
        okText="Восстановить"
        cancelText="Отмена"
      >
        <Select
          style={{ width: '100%', marginBottom: 12 }}
          value={selectedSnapshotId ?? undefined}
          onChange={(id) => {
            setSelectedSnapshotId(id)
            void viewSnapshotDetail(id)
          }}
          options={sessionSnapshots.map((s) => ({
            value: s.id,
            label: s.name || s.id,
          }))}
          placeholder="Выберите снимок"
        />
        {snapshotDetail && (
          <div style={{ fontSize: 12, color: tokens.text.secondary }}>
            <div>ID: {snapshotDetail.id}</div>
            <div>Сессия: {snapshotDetail.sessionId}</div>
            {snapshotDetail.modelTime !== undefined && (
              <div>Модельное время: {snapshotDetail.modelTime}s</div>
            )}
            {snapshotDetail.createdAt && (
              <div>{new Date(snapshotDetail.createdAt).toLocaleString('ru-RU')}</div>
            )}
          </div>
        )}
      </Modal>

      <Modal
        title="Корректировка оценки"
        open={overrideModal.open}
        onOk={() => void submitOverride()}
        onCancel={() => setOverrideModal({ open: false, sessionId: null })}
        okText="Применить"
        cancelText="Отмена"
      >
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, color: tokens.text.muted }}>Оценка (%)</label>
          <Slider
            min={0}
            max={100}
            value={overrideScore}
            onChange={setOverrideScore}
            marks={{ 0: '0', 50: '50', 100: '100' }}
          />
        </div>
        <div>
          <label style={{ fontSize: 12, color: tokens.text.muted }}>Комментарий</label>
          <Input.TextArea
            rows={3}
            value={overrideComment}
            onChange={(e) => setOverrideComment(e.target.value)}
            placeholder="Обоснование корректировки..."
          />
        </div>
      </Modal>
    </div>
  )
}
