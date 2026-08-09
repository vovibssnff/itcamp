import { useState, useEffect } from 'react'
import { Table, Tag, Button, Space, Select, Slider, Tooltip, message, Modal, Input } from 'antd'
import {
  PlayCircleOutlined,
  PauseCircleOutlined,
  StopOutlined,
  EyeOutlined,
  CameraOutlined,
  EditOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router'
import type { SessionRecord } from '@/mocks/fixtures/sessions'
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
  const navigate = useNavigate()

  async function fetchSessions() {
    setLoading(true)
    try {
      const res = await fetch('/api/sessions')
      const data = (await res.json()) as SessionRecord[]
      setSessions(data)
    } catch {
      void message.error('Ошибка загрузки сессий')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchSessions()
  }, [])

  async function sessionAction(id: string, action: 'start' | 'pause' | 'resume' | 'stop') {
    await fetch(`/api/sessions/${id}/${action}`, { method: 'POST' })
    void fetchSessions()
  }

  async function setSpeed(id: string, speed: number) {
    await fetch(`/api/sessions/${id}/speed`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ speed }),
    })
    void fetchSessions()
  }

  async function saveSnapshot() {
    if (!snapshotModal.sessionId || !snapshotLabel) return
    await fetch(`/api/sessions/${snapshotModal.sessionId}/snapshots`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: snapshotLabel }),
    })
    void message.success('Снимок сохранён')
    setSnapshotModal({ open: false, sessionId: null })
    setSnapshotLabel('')
  }

  async function submitOverride() {
    if (!overrideModal.sessionId) return
    await fetch(`/api/assessment/session/${overrideModal.sessionId}/override`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ score: overrideScore, comment: overrideComment }),
    })
    void message.success('Оценка скорректирована')
    setOverrideModal({ open: false, sessionId: null })
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
          {record.reportId && (
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
        <button className="btn btn-ghost btn-sm" onClick={() => void fetchSessions()}>
          Обновить
        </button>
      </div>

      <Table
        dataSource={sessions}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={false}
      />

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
