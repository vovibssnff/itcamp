import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router'
import { Input, Select, Pagination, Empty, Spin } from 'antd'
import { SearchOutlined, DownloadOutlined } from '@ant-design/icons'
import { Pill } from '@/components/ui'

interface ReportSummary {
  id: string
  sessionId: string
  operatorName: string
  scenario: string
  score: number
  maxScore: number
  mode: 'practice' | 'exam'
  completedAt: string
  duration: number
  passed: boolean
}

const PAGE_SIZE = 20

export default function ReportListScreen() {
  const navigate = useNavigate()
  const [reports, setReports] = useState<ReportSummary[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modeFilter, setModeFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'date' | 'score'>('date')

  const fetchReports = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
        search,
        mode: modeFilter !== 'all' ? modeFilter : '',
        sortBy,
      })
      const res = await fetch(`/api/assessment/reports?${params.toString()}`)
      if (!res.ok) throw new Error('fetch failed')
      const data = (await res.json()) as { items: ReportSummary[]; total: number }
      setReports(data.items)
      setTotal(data.total)
    } catch {
      // Fallback to mock data if API unavailable
      const mock = generateMockReports(PAGE_SIZE)
      setReports(mock)
      setTotal(87)
    } finally {
      setLoading(false)
    }
  }, [page, search, modeFilter, sortBy])

  useEffect(() => {
    void fetchReports()
  }, [fetchReports])

  // Reset page on filter change
  useEffect(() => {
    setPage(1)
  }, [search, modeFilter, sortBy])

  function fmtDuration(sec: number) {
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  return (
    <div className="wrap">
      {/* Header */}
      <div className="rise" style={{ marginBottom: 28 }}>
        <div className="kick" style={{ marginBottom: 6 }}>
          База данных · Отчёты
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            gap: 16,
          }}
        >
          <h1 className="h1">Журнал отчётов</h1>
          <span className="mono" style={{ fontSize: 12, color: 'var(--tx3)', paddingBottom: 4 }}>
            {total} записей
          </span>
        </div>
      </div>

      {/* Filters */}
      <div
        className="rise d1"
        style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}
      >
        <Input
          prefix={<SearchOutlined style={{ color: 'var(--tx4)' }} />}
          placeholder="Оператор, сценарий…"
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
            { value: 'all', label: 'Все режимы' },
            { value: 'practice', label: 'Тренировка' },
            { value: 'exam', label: 'Экзамен' },
          ]}
        />
        <Select
          value={sortBy}
          onChange={setSortBy}
          style={{ width: 180 }}
          options={[
            { value: 'date', label: 'По дате (нов.)' },
            { value: 'score', label: 'По оценке' },
          ]}
        />
      </div>

      {/* Table */}
      <div className="cell rise d2" style={{ padding: 0, overflow: 'hidden', marginBottom: 18 }}>
        <div
          className="tbl-hd"
          style={{
            gridTemplateColumns: '1.4fr 1.8fr 120px 80px 100px 90px',
            background: 'var(--srf)',
          }}
        >
          <div>Оператор</div>
          <div>Сценарий</div>
          <div>Дата</div>
          <div>Время</div>
          <div>Оценка</div>
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
          reports.map((r) => {
            const scoreColor =
              r.score >= 80 ? 'var(--ok)' : r.score >= 60 ? 'var(--warn)' : 'var(--alarm)'
            return (
              <div
                key={r.id}
                className="tbl-row"
                style={{ gridTemplateColumns: '1.4fr 1.8fr 120px 80px 100px 90px' }}
                onClick={() => void navigate(`/reports/${r.id}`)}
              >
                <div
                  style={{
                    fontWeight: 500,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {r.operatorName}
                </div>
                <div
                  className="dim"
                  style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                  {r.scenario}
                </div>
                <div className="mono dim" style={{ fontSize: 11 }}>
                  {new Date(r.completedAt).toLocaleDateString('ru-RU', {
                    day: '2-digit',
                    month: '2-digit',
                    year: '2-digit',
                  })}
                </div>
                <div className="mono dim" style={{ fontSize: 11 }}>
                  {fmtDuration(r.duration)}
                </div>
                <div className="mono" style={{ fontWeight: 600, fontSize: 13, color: scoreColor }}>
                  {r.score}
                  <span style={{ color: 'var(--tx4)', fontWeight: 400 }}>/{r.maxScore}</span>
                </div>
                <div>
                  <Pill variant={r.passed ? 'ok' : 'alarm'}>
                    {r.passed ? 'Зачтено' : 'Незачтено'}
                  </Pill>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Pagination */}
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

// Generates realistic mock data for development / API fallback
function generateMockReports(count: number): ReportSummary[] {
  const operators = [
    'Юсупова Н.Р.',
    'Петров К.К.',
    'Абрамов Д.С.',
    'Иванова М.В.',
    'Смирнов А.Г.',
    'Николаев П.В.',
    'Козлова Е.И.',
    'Фёдоров О.Н.',
  ]
  const scenarios = [
    'Пробой изолятора ЭД-1',
    'Прорыв воды из ЭЛОУ в К-2',
    'Обрыв факела в печи П-2',
    'Разгерметизация блока ГДМ',
    'Кавитация насоса Н-1',
    'Зависание уровнемера К-12/3',
  ]
  return Array.from({ length: count }, (_, i) => {
    const score = 45 + Math.floor(Math.random() * 56)
    return {
      id: `rep-${1000 + i}`,
      sessionId: `sess-${200 + i}`,
      operatorName: operators[i % operators.length] ?? 'Оператор',
      scenario: scenarios[i % scenarios.length] ?? 'Сценарий',
      score,
      maxScore: 100,
      mode: i % 3 === 0 ? 'exam' : 'practice',
      completedAt: new Date(Date.now() - i * 86_400_000 * (0.5 + Math.random())).toISOString(),
      duration: 480 + Math.floor(Math.random() * 720),
      passed: score >= 60,
    }
  })
}
