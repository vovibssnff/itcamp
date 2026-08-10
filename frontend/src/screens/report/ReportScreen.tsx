import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router'
import { message } from 'antd'
import { DownloadOutlined, PlayCircleOutlined, ReloadOutlined } from '@ant-design/icons'
import { MetricGrid, BoxAcc, Pill } from '@/components/ui'
import { assessmentApi } from '@/api/assessment'
import { reportsApi } from '@/api/reports'
import { toErrorMessage } from '@/api/errors'
import type { ScoreData } from '@/api/mappers'
import type { ReportMeta } from '@/api/mappers'
import { useAuthStore } from '@/store/auth'

function emptyScore(sessionId: string, note: string): ScoreData {
  return {
    sessionId,
    score: 0,
    maxScore: 100,
    penalties: [],
    criticalErrors: [],
    aiAnalysis: note,
    completedAt: new Date().toISOString(),
  }
}

export default function ReportScreen() {
  const { id } = useParams<{ id: string }>()
  const [report, setReport] = useState<ScoreData | null>(null)
  const [reportMeta, setReportMeta] = useState<ReportMeta | null>(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  const role = useAuthStore((s) => s.user?.role)

  useEffect(() => {
    if (!id) return
    void (async () => {
      setLoading(true)
      try {
        let sessionId = id
        let meta: ReportMeta | null = null
        try {
          meta = await reportsApi.get(id)
          setReportMeta(meta)
          sessionId = meta.sessionId || id
        } catch {
          setReportMeta(null)
          try {
            const listed = await reportsApi.list(id)
            meta = listed[0] ?? null
            if (meta) {
              setReportMeta(meta)
              sessionId = meta.sessionId || id
            }
          } catch {
            /* no report meta */
          }
        }

        try {
          setReport(await assessmentApi.getScore(sessionId))
        } catch {
          if (role === 'instructor' || role === 'admin') {
            throw new Error('assessment score unavailable')
          }
          setReport(
            emptyScore(
              sessionId,
              'Детальная оценка доступна инструктору. PDF-отчёт можно скачать, если он уже сформирован.',
            ),
          )
        }
      } catch (err) {
        void message.error(toErrorMessage(err, 'Ошибка загрузки отчёта'))
      } finally {
        setLoading(false)
      }
    })()
  }, [id, role])

  async function refreshStatus() {
    if (!id) return
    try {
      const meta = await reportsApi.get(reportMeta?.id ?? id)
      setReportMeta(meta)
      void message.info(`Статус: ${meta.status}`)
    } catch (err) {
      void message.error(toErrorMessage(err, 'Не удалось обновить статус'))
    }
  }

  async function handleDownload() {
    const downloadId = reportMeta?.id ?? id
    if (!downloadId) return
    try {
      await reportsApi.download(downloadId)
    } catch (err) {
      void message.error(toErrorMessage(err, 'Не удалось скачать PDF'))
    }
  }

  if (loading || !report) return <div className="loading-spinner" />

  const passed = report.score >= 60
  const deducted = report.penalties.reduce((s, p) => s + p.deduction, 0)
  const scoreVariant = report.score >= 80 ? 'ok' : report.score >= 60 ? 'warn' : 'alarm'
  const scoreColor =
    report.score >= 80 ? 'var(--ok)' : report.score >= 60 ? 'var(--warn)' : 'var(--alarm)'

  function fmtTime(sec: number) {
    return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
  }

  const replaySessionId = report.sessionId || reportMeta?.sessionId || id

  return (
    <div className="wrap-n">
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
          <div className="sec">Отчёт · {report.sessionId}</div>
          <h1 className="h1" style={{ marginTop: 12 }}>
            Результаты обучения
          </h1>
          <p className="mono" style={{ marginTop: 10, fontSize: 12, color: 'var(--tx3)' }}>
            {new Date(report.completedAt).toLocaleString('ru-RU')}
            {reportMeta ? ` · PDF: ${reportMeta.status}` : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {reportMeta && (
            <button className="btn btn-ghost" onClick={() => void refreshStatus()}>
              <ReloadOutlined /> Статус PDF
            </button>
          )}
          <button
            className="btn btn-ghost"
            onClick={() => void navigate(`/reports/${replaySessionId}/replay`)}
          >
            <PlayCircleOutlined /> Воспроизведение
          </button>
          <button className="btn btn-acc" onClick={() => void handleDownload()}>
            <DownloadOutlined /> Скачать PDF
          </button>
        </div>
      </div>

      <div
        className="cell rise d2"
        style={{ display: 'flex', gap: 28, alignItems: 'center', marginBottom: 18 }}
      >
        <div style={{ textAlign: 'center', flexShrink: 0 }}>
          <div
            style={{
              fontSize: 56,
              fontWeight: 700,
              fontFamily: 'var(--mono)',
              color: scoreColor,
              lineHeight: 1,
            }}
          >
            {report.score}
          </div>
          <div className="mono" style={{ fontSize: 12, color: 'var(--tx3)', marginTop: 4 }}>
            / {report.maxScore}
          </div>
          <div style={{ marginTop: 8 }}>
            <Pill variant={scoreVariant}>{passed ? 'Зачтено' : 'Незачтено'}</Pill>
          </div>
        </div>
        <BoxAcc style={{ flex: 1 }}>
          <MetricGrid
            metrics={[
              { label: 'Штрафы', value: String(deducted) },
              { label: 'Критических', value: String(report.criticalErrors.length) },
              { label: 'Вердикт', value: report.verdict ?? (passed ? 'pass' : 'fail') },
            ]}
          />
        </BoxAcc>
      </div>

      {report.aiAnalysis && (
        <div className="cell rise d3" style={{ marginBottom: 18 }}>
          <div className="sec" style={{ marginBottom: 10 }}>
            Анализ ИИ
          </div>
          <p style={{ color: 'var(--tx2)', fontSize: 13, lineHeight: 1.55 }}>{report.aiAnalysis}</p>
        </div>
      )}

      <div className="cell rise d4">
        <div className="sec" style={{ marginBottom: 12 }}>
          Штрафы
        </div>
        {report.penalties.length === 0 ? (
          <p className="note">Нет штрафов</p>
        ) : (
          report.penalties.map((p) => (
            <div
              key={p.id}
              style={{
                display: 'flex',
                gap: 12,
                padding: '8px 0',
                borderBottom: '1px solid var(--ln)',
                fontSize: 13,
              }}
            >
              <span className="mono" style={{ color: 'var(--tx3)', minWidth: 48 }}>
                {fmtTime(p.timestamp)}
              </span>
              <span style={{ flex: 1, color: p.isCritical ? 'var(--alarm)' : 'var(--tx2)' }}>
                {p.description}
              </span>
              <span className="mono" style={{ color: 'var(--alarm)' }}>
                −{p.deduction}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
