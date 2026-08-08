import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router'
import { message } from 'antd'
import { DownloadOutlined, PlayCircleOutlined } from '@ant-design/icons'
import { MetricGrid, BoxAcc, Pill } from '@/components/ui'

interface Penalty {
  id: string
  description: string
  deduction: number
  timestamp: number
  isCritical?: boolean
}

interface ReportData {
  sessionId: string
  score: number
  maxScore: number
  penalties: Penalty[]
  criticalErrors: { id: string; description: string; timestamp: number }[]
  aiAnalysis: string
  completedAt: string
  downloadUrl?: string
}

export default function ReportScreen() {
  const { id } = useParams<{ id: string }>()
  const [report, setReport] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    void (async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/assessment/session/${id}/score`)
        const data = (await res.json()) as ReportData
        setReport(data)
      } catch {
        void message.error('Ошибка загрузки отчёта')
      } finally {
        setLoading(false)
      }
    })()
  }, [id])

  if (loading || !report) return <div className="loading-spinner" />

  const passed = report.score >= 60
  const deducted = report.penalties.reduce((s, p) => s + p.deduction, 0)
  const scoreVariant = report.score >= 80 ? 'ok' : report.score >= 60 ? 'warn' : 'alarm'
  const scoreColor =
    report.score >= 80 ? 'var(--ok)' : report.score >= 60 ? 'var(--warn)' : 'var(--alarm)'

  function fmtTime(sec: number) {
    return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
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
          <div className="kick" style={{ marginBottom: 6 }}>
            Отчёт · {report.sessionId}
          </div>
          <h1 className="h1">Результаты обучения</h1>
          <p className="note" style={{ marginTop: 6 }}>
            {new Date(report.completedAt).toLocaleString('ru-RU')}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost" onClick={() => void navigate(`/reports/${id}/replay`)}>
            <PlayCircleOutlined /> Воспроизведение
          </button>
          <button
            className="btn btn-acc"
            onClick={() => window.open(`/api/reports/${id}/download`)}
          >
            <DownloadOutlined /> Скачать PDF
          </button>
        </div>
      </div>

      {/* Score card */}
      <div
        className="cell rise d2"
        style={{ display: 'flex', gap: 28, alignItems: 'center', marginBottom: 18 }}
      >
        <div style={{ textAlign: 'center', flexShrink: 0 }}>
          <div
            style={{
              fontFamily: 'var(--mono)',
              fontSize: 64,
              fontWeight: 700,
              color: scoreColor,
              lineHeight: 1,
              letterSpacing: '-0.04em',
            }}
          >
            {report.score}
          </div>
          <div className="note" style={{ marginTop: 4 }}>
            из {report.maxScore}
          </div>
          <Pill variant={scoreVariant} style={{ marginTop: 8 }}>
            {passed ? 'Зачтено' : 'Не зачтено'}
          </Pill>
        </div>

        <div style={{ flex: 1 }}>
          <div
            style={{
              height: 10,
              background: 'var(--srf3)',
              borderRadius: 'var(--r)',
              overflow: 'hidden',
              marginBottom: 16,
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${report.score}%`,
                background: scoreColor,
                transition: 'width 0.6s var(--ease)',
              }}
            />
          </div>
          <MetricGrid
            metrics={[
              { label: 'Нарушений', value: report.penalties.length, color: 'var(--warn)' },
              { label: 'Критических', value: report.criticalErrors.length, color: 'var(--alarm)' },
              { label: 'Снято баллов', value: `−${deducted}`, color: 'var(--alarm)' },
            ]}
            cols={3}
          />
        </div>
      </div>

      {/* Penalties */}
      {report.penalties.length > 0 && (
        <div className="cell rise d3" style={{ padding: 0, overflow: 'hidden', marginBottom: 16 }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--ln)' }}>
            <span className="sec">Нарушения</span>
          </div>
          {report.penalties.map((p) => (
            <div
              key={p.id}
              className="dr"
              style={{ padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 12 }}
            >
              {p.isCritical && <Pill variant="alarm">Крит.</Pill>}
              <span style={{ flex: 1, fontSize: 13, color: 'var(--tx2)' }}>{p.description}</span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--tx4)' }}>
                {fmtTime(p.timestamp)}
              </span>
              <span style={{ fontFamily: 'var(--mono)', color: 'var(--alarm)', fontWeight: 600 }}>
                −{p.deduction}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* AI Analysis */}
      <BoxAcc className="rise d4">
        <div className="kick" style={{ marginBottom: 8 }}>
          Анализ ИИ
        </div>
        <p style={{ fontSize: 13, color: 'var(--tx2)', lineHeight: 1.6, margin: 0 }}>
          {report.aiAnalysis}
        </p>
      </BoxAcc>
    </div>
  )
}
