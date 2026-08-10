import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router'
import { Input, Select, Pagination, Empty, Spin, message } from 'antd'
import { SearchOutlined, DownloadOutlined, PlusOutlined } from '@ant-design/icons'
import { Pill } from '@/components/ui'
import { reportsApi } from '@/api/reports'
import type { ReportMeta } from '@/api/mappers'

const PAGE_SIZE = 20

export default function ReportListScreen() {
  const navigate = useNavigate()
  const [reports, setReports] = useState<ReportMeta[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modeFilter, setModeFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'date' | 'score'>('date')
  const [generateSessionId, setGenerateSessionId] = useState('')

  const fetchReports = useCallback(async () => {
    setLoading(true)
    try {
      let items = await reportsApi.list()
      if (modeFilter !== 'all') {
        const want = modeFilter === 'exam' ? 'exam' : 'session'
        items = items.filter((r) => r.type === want)
      }
      if (search.trim()) {
        const q = search.toLowerCase()
        items = items.filter(
          (r) =>
            r.id.toLowerCase().includes(q) ||
            r.sessionId.toLowerCase().includes(q) ||
            r.status.toLowerCase().includes(q),
        )
      }
      items = [...items].sort((a, b) => {
        if (sortBy === 'date') {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        }
        return a.id.localeCompare(b.id)
      })
      setTotal(items.length)
      const start = (page - 1) * PAGE_SIZE
      setReports(items.slice(start, start + PAGE_SIZE))
    } catch {
      void message.error('Ошибка загрузки отчётов')
      setReports([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [page, search, modeFilter, sortBy])

  useEffect(() => {
    void fetchReports()
  }, [fetchReports])

  useEffect(() => {
    setPage(1)
  }, [search, modeFilter, sortBy])

  async function queueReport() {
    if (!generateSessionId.trim()) return
    try {
      const report = await reportsApi.create(generateSessionId.trim(), 'session')
      void message.success(`Отчёт создан (${report.status})`)
      setGenerateSessionId('')
      void fetchReports()
      void navigate(`/reports/${report.id}`)
    } catch {
      void message.error('Не удалось поставить отчёт в очередь')
    }
  }

  return (
    <div className="wrap">
      <div className="rise" style={{ marginBottom: 28 }}>
        <div className="sec">База данных · Отчёты</div>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            gap: 16,
            marginTop: 12,
          }}
        >
          <h1 className="h1">Журнал отчётов</h1>
          <span className="mono" style={{ fontSize: 12, color: 'var(--tx3)', paddingBottom: 4 }}>
            {total} записей
          </span>
        </div>
      </div>

      <div
        className="rise d1"
        style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}
      >
        <Input
          prefix={<SearchOutlined style={{ color: 'var(--tx4)' }} />}
          placeholder="ID отчёта, сессия…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: '1 1 220px', maxWidth: 340 }}
          allowClear
        />
        <Select
          value={modeFilter}
          onChange={setModeFilter}
          style={{ width: 160 }}
          options={[
            { value: 'all', label: 'Все типы' },
            { value: 'practice', label: 'Сессия' },
            { value: 'exam', label: 'Экзамен' },
          ]}
        />
        <Select
          value={sortBy}
          onChange={setSortBy}
          style={{ width: 180 }}
          options={[
            { value: 'date', label: 'По дате (нов.)' },
            { value: 'score', label: 'По ID' },
          ]}
        />
        <Input
          placeholder="session_id для генерации"
          value={generateSessionId}
          onChange={(e) => setGenerateSessionId(e.target.value)}
          style={{ width: 220 }}
        />
        <button className="btn btn-acc btn-sm" onClick={() => void queueReport()}>
          <PlusOutlined /> Сформировать
        </button>
      </div>

      <div className="cell rise d2" style={{ padding: 0, overflow: 'hidden', marginBottom: 18 }}>
        <div
          className="tbl-hd"
          style={{
            gridTemplateColumns: '1.2fr 1.4fr 120px 120px 100px',
            background: 'var(--srf)',
          }}
        >
          <div>Отчёт</div>
          <div>Сессия</div>
          <div>Тип</div>
          <div>Дата</div>
          <div>Статус</div>
        </div>

        {loading ? (
          <div style={{ padding: '40px 0', display: 'flex', justifyContent: 'center' }}>
            <Spin />
          </div>
        ) : reports.length === 0 ? (
          <div style={{ padding: '40px 0' }}>
            <Empty description="Отчётов не найдено" />
          </div>
        ) : (
          reports.map((r) => (
            <div
              key={r.id}
              className="tbl-row"
              style={{ gridTemplateColumns: '1.2fr 1.4fr 120px 120px 100px' }}
              onClick={() => void navigate(`/reports/${r.id}`)}
            >
              <div
                style={{
                  fontWeight: 500,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontFamily: 'var(--mono)',
                  fontSize: 12,
                }}
              >
                {r.id}
              </div>
              <div
                className="dim"
                style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              >
                {r.sessionId}
              </div>
              <div className="dim">{r.type === 'exam' ? 'Экзамен' : 'Сессия'}</div>
              <div className="mono dim" style={{ fontSize: 11 }}>
                {r.createdAt
                  ? new Date(r.createdAt).toLocaleDateString('ru-RU', {
                      day: '2-digit',
                      month: '2-digit',
                      year: '2-digit',
                    })
                  : '—'}
              </div>
              <div>
                <Pill
                  variant={r.status === 'ready' ? 'ok' : r.status === 'failed' ? 'alarm' : 'warn'}
                >
                  {r.status}
                </Pill>
              </div>
            </div>
          ))
        )}
      </div>

      {total > PAGE_SIZE && (
        <div
          className="rise d3"
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <Pagination
            current={page}
            total={total}
            pageSize={PAGE_SIZE}
            onChange={setPage}
            showSizeChanger={false}
            showQuickJumper
          />
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => window.open('/api/assessment/reports/export?format=csv')}
          >
            <DownloadOutlined /> Экспорт CSV
          </button>
        </div>
      )}
    </div>
  )
}
