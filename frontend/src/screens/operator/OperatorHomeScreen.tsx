import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { message, Table, Tag, Button } from 'antd'
import { sessionsApi } from '@/api/sessions'
import { useAuthStore } from '@/store/auth'
import type { SessionRecord } from '@/mocks/fixtures/sessions'
import { tablePagination } from '@/components/ui'
import { tokens } from '@/theme/tokens'

/** Operator landing: list sessions assigned to the current user. */
export default function OperatorHomeScreen() {
  const navigate = useNavigate()
  const userId = useAuthStore((s) => s.user?.id)
  const [sessions, setSessions] = useState<SessionRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const all = await sessionsApi.list()
        const mine = userId
          ? all.filter((s) => {
              const ids = s.operatorIds?.length ? s.operatorIds : [s.operatorId]
              return ids.includes(userId)
            })
          : all
        // Prefer active sessions; keep stopped for history.
        const sorted = [...mine].sort((a, b) => {
          const rank = (st: string) =>
            st === 'running' || st === 'paused' || st === 'idle' || st === 'created' ? 0 : 1
          return rank(a.status) - rank(b.status)
        })
        if (!cancelled) setSessions(sorted)
      } catch {
        if (!cancelled) void message.error('Не удалось загрузить сессии')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [userId])

  return (
    <div className="wrap rise">
      <div className="sec">Оператор</div>
      <h1 className="h1" style={{ marginTop: 12 }}>
        Мои сессии
      </h1>
      <p style={{ color: tokens.text.secondary, marginBottom: 24 }}>
        Выберите сессию, назначенную инструктором.
      </p>

      <Table
        rowKey="id"
        loading={loading}
        dataSource={sessions}
        locale={{ emptyText: 'Нет назначенных сессий' }}
        pagination={tablePagination()}
        columns={[
          {
            title: 'ID',
            dataIndex: 'id',
            render: (v: string) => <span style={{ fontFamily: tokens.font.mono }}>{v}</span>,
          },
          {
            title: 'Режим',
            dataIndex: 'mode',
            render: (v: string) => <Tag>{v}</Tag>,
          },
          {
            title: 'Статус',
            dataIndex: 'status',
            render: (v: string) => (
              <Tag color={v === 'running' ? 'processing' : undefined}>{v}</Tag>
            ),
          },
          {
            title: '',
            key: 'go',
            render: (_: unknown, row: SessionRecord) => (
              <Button
                type="primary"
                size="small"
                disabled={row.status === 'stopped' || row.status === 'finished'}
                onClick={() => void navigate(`/sessions/${row.id}/mode`)}
              >
                Открыть
              </Button>
            ),
          },
        ]}
      />
    </div>
  )
}
