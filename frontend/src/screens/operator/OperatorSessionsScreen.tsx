import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { message, Table, Tag, Button, Modal, Select, Spin, Timeline } from 'antd'
import { PlayCircleOutlined, PlusOutlined, UnorderedListOutlined } from '@ant-design/icons'
import { sessionsApi } from '@/api/sessions'
import { scenariosApi } from '@/api/scenarios'
import { assessmentApi } from '@/api/assessment'
import type { ReplayEvent } from '@/api/mappers'
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

const EVENT_COLORS: Record<string, string> = {
  action: tokens.accent.cyan,
  alarm: tokens.accent.red,
  fault: tokens.accent.amber,
  penalty: tokens.accent.amber,
}

const EVENT_LABELS: Record<string, string> = {
  action: 'Действие',
  alarm: 'Авария',
  fault: 'Инцидент',
  penalty: 'Штраф',
}

const DEFAULT_TEMPLATE_ID = 'tmpl-elou-avt'

function formatModelTime(t: number): string {
  const sec = Math.max(0, Math.floor(t))
  return `${Math.floor(sec / 60)
    .toString()
    .padStart(2, '0')}:${(sec % 60).toString().padStart(2, '0')}`
}

function sessionActivityTs(s: SessionRecord): number {
  const raw = s.finishedAt || s.startedAt
  const t = raw ? Date.parse(raw) : NaN
  return Number.isFinite(t) ? t : 0
}

function formatSessionWhen(s: SessionRecord): { label: string; primary: string } | null {
  if (s.finishedAt) {
    const d = new Date(s.finishedAt)
    if (!Number.isNaN(d.getTime())) {
      return {
        label: 'Завершена',
        primary: d.toLocaleString('ru-RU', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
      }
    }
  }
  if (s.startedAt) {
    const d = new Date(s.startedAt)
    if (!Number.isNaN(d.getTime())) {
      return {
        label: 'Начата',
        primary: d.toLocaleString('ru-RU', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
      }
    }
  }
  return null
}

function isActiveStatus(st: string): boolean {
  return st === 'running' || st === 'paused' || st === 'idle'
}

export default function OperatorSessionsScreen() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const [sessions, setSessions] = useState<SessionRecord[]>([])
  const [loading, setLoading] = useState(true)

  const [trainModal, setTrainModal] = useState(false)
  const [scenarios, setScenarios] = useState<{ id: string; name: string }[]>([])
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | undefined>()
  const [starting, setStarting] = useState(false)

  const [timelineOpen, setTimelineOpen] = useState(false)
  const [timelineSession, setTimelineSession] = useState<SessionRecord | null>(null)
  const [timelineEvents, setTimelineEvents] = useState<ReplayEvent[]>([])
  const [timelineLoading, setTimelineLoading] = useState(false)

  useEffect(() => {
    void loadSessions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  async function loadScenarioNames(): Promise<Map<string, string>> {
    const map = new Map<string, string>()
    try {
      const raw = (await scenariosApi.list({ limit: '500' })) as {
        id?: string
        name?: string
      }[]
      for (const s of raw) {
        if (s.id) map.set(s.id, s.name?.trim() || s.id)
      }
    } catch {
      /* names are best-effort — table still works with ids */
    }
    return map
  }

  async function loadSessions() {
    setLoading(true)
    try {
      const [all, names] = await Promise.all([sessionsApi.list(), loadScenarioNames()])
      const mine = user?.id
        ? all.filter((s) => {
            const ids = s.operatorIds?.length ? s.operatorIds : [s.operatorId]
            return ids.includes(user.id)
          })
        : all
      const enriched = mine.map((s) => ({
        ...s,
        scenarioName:
          s.scenarioName ||
          (s.scenarioId ? names.get(s.scenarioId) : undefined) ||
          s.scenarioId ||
          undefined,
      }))
      // Newest activity first (finishedAt → startedAt).
      const sorted = [...enriched].sort((a, b) => sessionActivityTs(b) - sessionActivityTs(a))
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
      await sessionsApi.action(session.id, 'start')
      setTrainModal(false)
      void navigate(`/sessions/${session.id}/operator`)
    } catch (err) {
      void message.error(String(err))
    } finally {
      setStarting(false)
    }
  }

  async function openTimeline(row: SessionRecord) {
    setTimelineSession(row)
    setTimelineOpen(true)
    setTimelineEvents([])
    setTimelineLoading(true)
    try {
      const data = await assessmentApi.getReplay(row.id)
      setTimelineEvents(data.events)
    } catch {
      void message.error('Не удалось загрузить журнал сессии')
      setTimelineEvents([])
    } finally {
      setTimelineLoading(false)
    }
  }

  function handleOpen(row: SessionRecord) {
    if (isActiveStatus(row.status)) {
      // Exam sessions must use ExamScreen (timer, no AI hints), not training.
      void navigate(
        row.mode === 'exam' ? `/sessions/${row.id}/exam` : `/sessions/${row.id}/operator`,
      )
      return
    }
    void openTimeline(row)
  }

  const activeCount = sessions.filter((s) => isActiveStatus(s.status)).length

  return (
    <div className="wrap rise" style={{ maxWidth: 1680 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          marginBottom: 28,
          gap: 24,
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

        <button
          className="btn btn-acc"
          onClick={() => void openTrainModal()}
          style={{ marginTop: 40, flexShrink: 0 }}
        >
          <PlusOutlined /> Начать тренировку
        </button>
      </div>

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
                <div style={{ fontWeight: 500 }}>{v || row.scenarioId || '—'}</div>
                <div
                  style={{ fontSize: 11, color: tokens.text.muted, fontFamily: tokens.font.mono }}
                >
                  {row.id}
                </div>
              </div>
            ),
          },
          {
            title: 'Время',
            key: 'when',
            width: 180,
            render: (_: unknown, row: SessionRecord) => {
              const when = formatSessionWhen(row)
              if (!when) {
                return <span style={{ color: tokens.text.muted }}>—</span>
              }
              return (
                <div>
                  <div style={{ fontVariantNumeric: 'tabular-nums' }}>{when.primary}</div>
                  <div style={{ fontSize: 11, color: tokens.text.muted }}>{when.label}</div>
                </div>
              )
            },
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
            width: 140,
            render: (_: unknown, row: SessionRecord) => {
              const active = isActiveStatus(row.status)
              return (
                <Button
                  type={active ? 'primary' : 'default'}
                  size="small"
                  icon={active ? <PlayCircleOutlined /> : <UnorderedListOutlined />}
                  onClick={() => handleOpen(row)}
                >
                  {active ? 'Открыть' : 'Журнал'}
                </Button>
              )
            },
          },
        ]}
      />

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

      <Modal
        title={
          timelineSession
            ? `Журнал · ${timelineSession.scenarioName || timelineSession.scenarioId || timelineSession.id}`
            : 'Журнал сессии'
        }
        open={timelineOpen}
        onCancel={() => setTimelineOpen(false)}
        footer={null}
        width={640}
        destroyOnClose
      >
        <p
          style={{
            color: tokens.text.muted,
            fontSize: 12,
            marginBottom: 16,
            fontFamily: tokens.font.mono,
          }}
        >
          {timelineSession?.id}
        </p>
        {timelineLoading ? (
          <div style={{ padding: 32, display: 'flex', justifyContent: 'center' }}>
            <Spin />
          </div>
        ) : timelineEvents.length === 0 ? (
          <p style={{ color: tokens.text.secondary }}>
            Нет сохранённых действий или инцидентов для этой сессии.
          </p>
        ) : (
          <Timeline
            style={{ marginTop: 8, maxHeight: 420, overflowY: 'auto', paddingRight: 8 }}
            items={timelineEvents.map((e, i) => ({
              key: i,
              color: EVENT_COLORS[e.type] ?? tokens.text.dim,
              children: (
                <div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                    <span
                      style={{
                        fontFamily: tokens.font.mono,
                        fontSize: 12,
                        color: tokens.text.dim,
                        minWidth: 44,
                      }}
                    >
                      {formatModelTime(e.time)}
                    </span>
                    <Tag style={{ margin: 0 }}>{EVENT_LABELS[e.type] ?? e.type}</Tag>
                  </div>
                  <div style={{ marginTop: 4, color: tokens.text.primary }}>{e.description}</div>
                </div>
              ),
            }))}
          />
        )}
      </Modal>
    </div>
  )
}
