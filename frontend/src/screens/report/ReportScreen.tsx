import { useState, useEffect } from 'react'
import { useParams } from 'react-router'
import { Button, Tag, Progress, Divider, Typography, message } from 'antd'
import { DownloadOutlined, PlayCircleOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router'
import { tokens } from '@/theme/tokens'

const { Title, Text } = Typography

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

  const scoreColor =
    report.score >= 80
      ? tokens.accent.cyan
      : report.score >= 60
        ? tokens.accent.amber
        : tokens.accent.red

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 24px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          marginBottom: 32,
        }}
      >
        <div>
          <Title level={3} style={{ color: tokens.text.primary, margin: 0 }}>
            Отчёт об обучении
          </Title>
          <Text style={{ color: tokens.text.muted, fontSize: 12 }}>
            Сессия {report.sessionId} · {new Date(report.completedAt).toLocaleString('ru-RU')}
          </Text>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button
            icon={<PlayCircleOutlined />}
            onClick={() => void navigate(`/reports/${id}/replay`)}
          >
            Воспроизведение
          </Button>
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            onClick={() => window.open(`/api/reports/${id}/download`)}
          >
            Скачать PDF
          </Button>
        </div>
      </div>

      {/* Score card */}
      <div
        style={{
          background: tokens.bg.surface,
          border: `1px solid ${tokens.border.subtle}`,
          borderRadius: tokens.radius.lg,
          padding: '24px',
          marginBottom: 24,
          display: 'flex',
          alignItems: 'center',
          gap: 32,
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              fontFamily: tokens.font.mono,
              fontSize: 56,
              color: scoreColor,
              fontWeight: 600,
              lineHeight: 1,
            }}
          >
            {report.score}
          </div>
          <div style={{ fontSize: 12, color: tokens.text.muted, marginTop: 4 }}>
            из {report.maxScore}
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <Progress
            percent={report.score}
            strokeColor={scoreColor}
            trailColor={tokens.border.subtle}
            strokeWidth={12}
            showInfo={false}
          />
          <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: tokens.text.dim }}>Нарушений</div>
              <div
                style={{ fontFamily: tokens.font.mono, fontSize: 18, color: tokens.accent.amber }}
              >
                {report.penalties.length}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: tokens.text.dim }}>Критических</div>
              <div style={{ fontFamily: tokens.font.mono, fontSize: 18, color: tokens.accent.red }}>
                {report.criticalErrors.length}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: tokens.text.dim }}>Снято баллов</div>
              <div
                style={{ fontFamily: tokens.font.mono, fontSize: 18, color: tokens.text.primary }}
              >
                {report.penalties.reduce((s, p) => s + p.deduction, 0)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Penalties */}
      {report.penalties.length > 0 && (
        <div
          style={{
            background: tokens.bg.surface,
            border: `1px solid ${tokens.border.subtle}`,
            borderRadius: tokens.radius.lg,
            padding: 20,
            marginBottom: 16,
          }}
        >
          <Title level={5} style={{ color: tokens.text.primary, margin: '0 0 12px' }}>
            Нарушения
          </Title>
          {report.penalties.map((p) => (
            <div
              key={p.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '6px 0',
                borderBottom: `1px solid ${tokens.border.subtle}`,
              }}
            >
              {p.isCritical && <Tag color="error">Крит.</Tag>}
              <span style={{ flex: 1, fontSize: 13, color: tokens.text.secondary }}>
                {p.description}
              </span>
              <span style={{ fontFamily: tokens.font.mono, fontSize: 11, color: tokens.text.dim }}>
                {Math.floor(p.timestamp / 60)}:{String(p.timestamp % 60).padStart(2, '0')}
              </span>
              <span style={{ fontFamily: tokens.font.mono, color: tokens.accent.red }}>
                −{p.deduction}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* AI Analysis */}
      <div
        style={{
          background: tokens.accent.cyanBg,
          border: `1px solid ${tokens.accent.cyanBorder}`,
          borderRadius: tokens.radius.lg,
          padding: 20,
        }}
      >
        <Title level={5} style={{ color: tokens.accent.cyan, margin: '0 0 8px' }}>
          Анализ ИИ
        </Title>
        <Text style={{ color: tokens.text.secondary, fontSize: 13, lineHeight: 1.6 }}>
          {report.aiAnalysis}
        </Text>
      </div>
    </div>
  )
}
