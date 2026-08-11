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
  DeleteOutlined,
  BulbOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router'
import type { SessionRecord } from '@/mocks/fixtures/sessions'
import type { ExamAssignment, OperatorRecommendation } from '@/mocks/fixtures/assignments'
import { sessionsApi } from '@/api/sessions'
import { assessmentApi } from '@/api/assessment'
import { snapshotsApi } from '@/api/snapshots'
import { reportsApi } from '@/api/reports'
import { templatesApi } from '@/api/templates'
import { isMockApi } from '@/utils/env'
import { scenariosApi } from '@/api/scenarios'
import { usersApi } from '@/api/users'
import { toErrorMessage } from '@/api/errors'
import type { SnapshotMeta } from '@/api/mappers'
import { tablePagination } from '@/components/ui'
import type { TemplateSummary } from '@/api/mappers'
import type { UserProfile } from '@/store/auth'
import { tokens } from '@/theme/tokens'
import { ScoreBadge } from '@/components/session/ScoreBadge'

const EMPTY_ASSIGN_FORM = {
  operatorId: '',
  scenarioId: '',
  dueDate: '',
  note: '',
}

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
  const selectedTemplateId = Form.useWatch('templateId', createForm)
  const [templates, setTemplates] = useState<TemplateSummary[]>([])
  const [scenarios, setScenarios] = useState<{ id: string; name: string }[]>([])
  const [scenariosLoading, setScenariosLoading] = useState(false)
  const [operators, setOperators] = useState<UserProfile[]>([])
  const [restoreModal, setRestoreModal] = useState<{ open: boolean; sessionId: string | null }>({
    open: false,
    sessionId: null,
  })
  const [sessionSnapshots, setSessionSnapshots] = useState<SnapshotMeta[]>([])
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string | null>(null)
  const [snapshotDetail, setSnapshotDetail] = useState<SnapshotMeta | null>(null)
  const navigate = useNavigate()

  // ── Exam assignments ──────────────────────────────────────────────────────
  const [assignments, setAssignments] = useState<ExamAssignment[]>([])
  const [examScenarios, setExamScenarios] = useState<{ id: string; name: string }[]>([])
  const [assignOpen, setAssignOpen] = useState(false)
  const [assignForm, setAssignForm] = useState(EMPTY_ASSIGN_FORM)
  const [assignSaving, setAssignSaving] = useState(false)
  const [recommendation, setRecommendation] = useState<OperatorRecommendation | null>(null)
  const [recLoading, setRecLoading] = useState(false)

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

  const fetchAssignments = useCallback(async () => {
    if (!isMockApi()) {
      setAssignments([])
      return
    }
    try {
      const res = await fetch('/api/assignments')
      setAssignments((await res.json()) as ExamAssignment[])
    } catch {
      void message.error('Ошибка загрузки назначений')
    }
  }, [])

  useEffect(() => {
    void fetchSessions()
    void fetchAssignments()
    void (async () => {
      try {
        const [users, scens] = await Promise.all([usersApi.list(), scenariosApi.list()])
        setOperators(users.filter((u) => (u.roles ?? []).includes('operator')))
        setExamScenarios(
          (scens as { id?: string; name?: string }[]).map((s) => ({
            id: s.id ?? '',
            name: s.name ?? s.id ?? '',
          })),
        )
      } catch {
        void message.error('Ошибка загрузки списка учеников/тем')
      }
    })()
  }, [fetchSessions, fetchAssignments])

  function openAssignModal() {
    setAssignForm(EMPTY_ASSIGN_FORM)
    setRecommendation(null)
    setAssignOpen(true)
  }

  async function handleOperatorPicked(operatorId: string) {
    setAssignForm((f) => ({ ...f, operatorId }))
    setRecommendation(null)
    setRecLoading(true)
    try {
      const res = await fetch(`/api/assessment/operator/${operatorId}/recommendation`)
      setRecommendation((await res.json()) as OperatorRecommendation)
    } catch {
      void message.error('Не удалось получить рекомендацию ИИ')
    } finally {
      setRecLoading(false)
    }
  }

  async function submitAssignment() {
    const operator = operators.find((o) => o.id === assignForm.operatorId)
    const scenario = examScenarios.find((s) => s.id === assignForm.scenarioId)
    if (!operator || !scenario || !assignForm.dueDate) {
      void message.warning('Выберите ученика, тему и срок сдачи')
      return
    }
    setAssignSaving(true)
    try {
      await fetch('/api/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operatorId: operator.id,
          operatorName: operator.displayName,
          scenarioId: scenario.id,
          scenarioName: scenario.name,
          dueDate: new Date(assignForm.dueDate).toISOString(),
          note: assignForm.note || undefined,
        }),
      })
      void message.success('Экзамен назначен')
      setAssignOpen(false)
      void fetchAssignments()
    } catch {
      void message.error('Ошибка назначения экзамена')
    } finally {
      setAssignSaving(false)
    }
  }

  async function cancelAssignment(id: string) {
    await fetch(`/api/assignments/${id}`, { method: 'DELETE' })
    void message.success('Назначение отменено')
    void fetchAssignments()
  }

  async function loadScenariosForTemplate(templateId: string) {
    setScenariosLoading(true)
    try {
      const scens = await scenariosApi.list({ template_id: templateId, limit: '200' })
      setScenarios(
        (scens as { id?: string; name?: string }[]).map((s) => ({
          id: s.id ?? '',
          name: s.name ?? s.id ?? '',
        })),
      )
    } finally {
      setScenariosLoading(false)
    }
  }

  async function openCreate() {
    try {
      const [tmpls, users] = await Promise.all([templatesApi.list(), usersApi.list()])
      setTemplates(tmpls)
      setScenarios([])
      setOperators(users.filter((u) => (u.roles ?? []).includes('operator')))
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
    try {
      await sessionsApi.action(id, action)
      void fetchSessions()
    } catch (err) {
      void message.error(toErrorMessage(err, 'Ошибка действия над сессией'))
    }
  }

  async function setSpeed(id: string, speed: number) {
    try {
      await sessionsApi.setSpeed(id, speed)
      void fetchSessions()
    } catch (err) {
      void message.error(toErrorMessage(err, 'Не удалось изменить скорость'))
    }
  }

  async function saveSnapshot() {
    if (!snapshotModal.sessionId || !snapshotLabel) return
    try {
      await sessionsApi.checkpoint(snapshotModal.sessionId, snapshotLabel)
      void message.success('Снимок сохранён')
      setSnapshotModal({ open: false, sessionId: null })
      setSnapshotLabel('')
    } catch (err) {
      void message.error(toErrorMessage(err, 'Не удалось сохранить снимок'))
    }
  }

  async function submitOverride() {
    if (!overrideModal.sessionId) return
    if (!overrideComment.trim()) {
      void message.warning('Укажите комментарий к корректировке')
      return
    }
    try {
      const threshold = 60
      await assessmentApi.override({
        sessionId: overrideModal.sessionId,
        newScore: overrideScore,
        verdict: overrideScore >= threshold ? 'pass' : 'fail',
        comment: overrideComment.trim(),
      })
      void message.success('Оценка скорректирована')
      setOverrideModal({ open: false, sessionId: null })
    } catch (err) {
      void message.error(toErrorMessage(err, 'Не удалось скорректировать оценку'))
    }
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

  const todayStr = new Date().toISOString().slice(0, 10)

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
                data-testid="session-start"
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
          {(record.status === 'finished' || record.status === 'stopped') && (
            <ScoreBadge sessionId={record.id} />
          )}
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

  const assignmentColumns = [
    {
      title: 'Ученик',
      dataIndex: 'operatorName',
      key: 'operatorName',
      render: (v: string) => <span style={{ color: tokens.text.primary }}>{v}</span>,
    },
    {
      title: 'Тема',
      dataIndex: 'scenarioName',
      key: 'scenarioName',
      render: (v: string, record: ExamAssignment) => (
        <div>
          <div style={{ color: tokens.text.secondary, fontSize: 12 }}>{v}</div>
          {record.note && (
            <div style={{ color: tokens.text.muted, fontSize: 11, marginTop: 2 }}>
              {record.note}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Срок',
      dataIndex: 'dueDate',
      key: 'dueDate',
      width: 130,
      render: (v: string) => {
        const overdue = v.slice(0, 10) < todayStr
        return (
          <span
            style={{ color: overdue ? tokens.accent.red : tokens.text.secondary, fontSize: 12 }}
          >
            {new Date(v).toLocaleDateString('ru-RU')}
          </span>
        )
      },
    },
    {
      title: 'Статус',
      dataIndex: 'status',
      key: 'status',
      width: 130,
      render: (v: ExamAssignment['status'], record: ExamAssignment) => {
        if (v === 'completed') return <Tag color="success">Завершён</Tag>
        const overdue = record.dueDate.slice(0, 10) < todayStr
        return overdue ? <Tag color="error">Просрочен</Tag> : <Tag color="processing">Назначен</Tag>
      },
    },
    {
      title: '',
      key: 'actions',
      width: 60,
      render: (_: unknown, record: ExamAssignment) => (
        <Button
          size="small"
          danger
          icon={<DeleteOutlined />}
          title="Отменить назначение"
          onClick={(e) => {
            e.stopPropagation()
            void cancelAssignment(record.id)
          }}
        />
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
        pagination={tablePagination()}
      />

      {/* ── Exam assignments (mock-only) ─────────────────────────────────── */}
      {isMockApi() && (
        <>
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              marginTop: 40,
              marginBottom: 16,
            }}
          >
            <div>
              <div className="sec">Назначенные экзамены</div>
              <p className="note" style={{ marginTop: 8 }}>
                Экзамены по конкретным темам с индивидуальным сроком сдачи
              </p>
            </div>
            <Button type="primary" icon={<PlusOutlined />} onClick={openAssignModal}>
              Назначить экзамен
            </Button>
          </div>

          <Table
            dataSource={assignments}
            columns={assignmentColumns}
            rowKey="id"
            pagination={tablePagination({ pageSize: 10, hideOnSinglePage: true })}
            locale={{ emptyText: 'Нет назначенных экзаменов' }}
          />

          <Modal
            title="Назначить экзамен"
            open={assignOpen}
            onOk={() => void submitAssignment()}
            onCancel={() => setAssignOpen(false)}
            okText="Назначить"
            cancelText="Отмена"
            confirmLoading={assignSaving}
            width={520}
          >
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, color: tokens.text.muted }}>Ученик</label>
              <Select
                style={{ width: '100%', marginTop: 4 }}
                placeholder="Выберите ученика"
                value={assignForm.operatorId || undefined}
                onChange={(v) => void handleOperatorPicked(v)}
                options={operators.map((o) => ({ value: o.id, label: o.displayName }))}
              />
            </div>

            {assignForm.operatorId && (
              <div
                className="box-acc"
                style={{ marginBottom: 14, display: 'flex', gap: 10, alignItems: 'flex-start' }}
              >
                <BulbOutlined style={{ marginTop: 2, color: tokens.accent.cyan }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, color: tokens.text.muted, marginBottom: 4 }}>
                    РЕКОМЕНДАЦИЯ ИИ
                  </div>
                  {recLoading ? (
                    <div style={{ fontSize: 12.5, color: tokens.text.secondary }}>
                      Анализ результатов…
                    </div>
                  ) : recommendation ? (
                    <>
                      <div style={{ fontSize: 12.5, color: tokens.text.primary, lineHeight: 1.5 }}>
                        {recommendation.summary}
                      </div>
                      {recommendation.weakTopics.length > 0 && (
                        <ul style={{ margin: '8px 0 0', paddingLeft: 16 }}>
                          {recommendation.weakTopics.map((t) => (
                            <li key={t.scenarioId} style={{ fontSize: 12, marginBottom: 6 }}>
                              <button
                                className="btn btn-ghost btn-sm"
                                style={{ padding: '1px 8px', fontSize: 11, marginRight: 6 }}
                                onClick={() =>
                                  setAssignForm((f) => ({ ...f, scenarioId: t.scenarioId }))
                                }
                              >
                                Выбрать тему
                              </button>
                              <strong style={{ color: tokens.text.primary }}>
                                {t.scenarioName}
                              </strong>
                              <div style={{ color: tokens.text.secondary, marginTop: 2 }}>
                                {t.detail}
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </>
                  ) : null}
                </div>
              </div>
            )}

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, color: tokens.text.muted }}>Тема экзамена</label>
              <Select
                style={{ width: '100%', marginTop: 4 }}
                placeholder="Выберите тему"
                value={assignForm.scenarioId || undefined}
                onChange={(v) => setAssignForm((f) => ({ ...f, scenarioId: v }))}
                options={examScenarios.map((s) => ({ value: s.id, label: s.name }))}
              />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, color: tokens.text.muted }}>Срок сдачи</label>
              <Input
                type="date"
                style={{ marginTop: 4 }}
                min={todayStr}
                value={assignForm.dueDate}
                onChange={(e) => setAssignForm((f) => ({ ...f, dueDate: e.target.value }))}
              />
            </div>

            <div>
              <label style={{ fontSize: 12, color: tokens.text.muted }}>
                Комментарий (необязательно)
              </label>
              <Input.TextArea
                rows={2}
                style={{ marginTop: 4 }}
                value={assignForm.note}
                onChange={(e) => setAssignForm((f) => ({ ...f, note: e.target.value }))}
                placeholder="На что обратить внимание при подготовке..."
              />
            </div>
          </Modal>
        </>
      )}

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
              onChange={(templateId: string) => {
                createForm.setFieldValue('scenarioId', undefined)
                void loadScenariosForTemplate(templateId).catch(() => {
                  void message.error('Не удалось загрузить сценарии шаблона')
                })
              }}
            />
          </Form.Item>
          <Form.Item name="scenarioId" label="Сценарий" rules={[{ required: true }]}>
            <Select
              options={scenarios.map((s) => ({ value: s.id, label: s.name }))}
              showSearch
              optionFilterProp="label"
              loading={scenariosLoading}
              disabled={!selectedTemplateId || scenariosLoading}
              placeholder={selectedTemplateId ? 'Выберите сценарий' : 'Сначала выберите шаблон'}
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
