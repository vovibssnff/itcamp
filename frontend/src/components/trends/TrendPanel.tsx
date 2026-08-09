/**
 * TrendPanel — sidebar telemetry display matching the ktk.html reference.
 * Shows one collapsible sparkline row per parameter:
 *   label  ·  current value (colored)
 *   ──────────────────── SVG polyline ────────────────────
 */
import { useEffect, useState } from 'react'
import { Select } from 'antd'
import { useSessionStore } from '@/store/session'
import { TAG_CONFIG } from '@/mocks/fixtures/telemetry'
import { useUIStore } from '@/store/ui'

const MAX_POINTS = 120

const ZONE_COLORS = [
  '#e9ff57',
  '#e0a458',
  '#7e9cd8',
  '#ff4a4a',
  '#a395d6',
  '#7fd18f',
  '#d98bae',
  '#86c98b',
]

const ZONE_COLORS_LIGHT = [
  '#8faf6e',
  '#c78a3e',
  '#5f79b0',
  '#d23b3b',
  '#7a6cb8',
  '#4f9e63',
  '#bd6a91',
  '#5fa267',
]

const INITIAL_TAGS = ['TI-201', 'TI-202', 'PI-101', 'LI-301', 'FI-101', 'AI-401']

interface SparklineRowProps {
  label: string
  unit: string
  color: string
  values: number[]
  alarmState?: string
}

function SparklineRow({ label, unit, color, values, alarmState }: SparklineRowProps) {
  const latest = values.at(-1) ?? NaN
  const hasData = values.length >= 2

  // Normalize values to SVG viewport 200×34
  let points = ''
  if (hasData) {
    const min = Math.min(...values)
    const max = Math.max(...values)
    const range = max - min || 1
    const step = 200 / (values.length - 1)
    points = values
      .map((v, i) => {
        const x = i * step
        const y = 34 - ((v - min) / range) * 30 - 2
        return `${x.toFixed(1)},${y.toFixed(1)}`
      })
      .join(' ')
  }

  const valueColor =
    alarmState === 'HH' || alarmState === 'LL'
      ? 'var(--alarm)'
      : alarmState === 'H' || alarmState === 'L'
        ? 'var(--warn)'
        : color

  return (
    <div className="trend">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          gap: 10,
        }}
      >
        <span
          style={{
            fontSize: 11.5,
            color: 'var(--tx2)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {label}
        </span>
        <span
          className="mono"
          style={{ fontSize: 12, fontWeight: 600, color: valueColor, flexShrink: 0 }}
        >
          {isNaN(latest) ? '—' : latest.toFixed(1)}
          {unit && (
            <span style={{ fontSize: 9, fontWeight: 400, color: 'var(--tx4)', marginLeft: 3 }}>
              {unit}
            </span>
          )}
        </span>
      </div>
      <svg
        viewBox="0 0 200 34"
        width="100%"
        height="34"
        preserveAspectRatio="none"
        style={{ marginTop: 4, display: 'block' }}
      >
        {hasData ? (
          <polyline
            points={points}
            fill="none"
            stroke={valueColor}
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"
          />
        ) : (
          <line
            x1="0"
            y1="17"
            x2="200"
            y2="17"
            stroke={color}
            strokeWidth="0.75"
            strokeDasharray="4 4"
            opacity="0.4"
          />
        )}
      </svg>
    </div>
  )
}

interface TrendPanelProps {
  width?: number
  height?: number
}

export function TrendPanel({ height = 340 }: TrendPanelProps) {
  const theme = useUIStore((s) => s.theme)
  const colors = theme === 'light' ? ZONE_COLORS_LIGHT : ZONE_COLORS

  const telemetry = useSessionStore((s) => s.telemetry)
  const [selectedTags, setSelectedTags] = useState<string[]>(INITIAL_TAGS)
  const [seriesData, setSeriesData] = useState<Record<string, number[]>>({})
  const [open, setOpen] = useState(true)

  useEffect(() => {
    setSeriesData((prev) => {
      const next = { ...prev }
      for (const tag of selectedTags) {
        const val = telemetry[tag]?.value ?? NaN
        next[tag] = [...(prev[tag] ?? []), val].slice(-MAX_POINTS)
      }
      return next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [telemetry])

  const tagOptions = TAG_CONFIG.map((t) => ({ value: t.tag, label: `${t.tag} — ${t.label}` }))

  return (
    <div>
      {/* Section header (matches reference "01 · Тренды · до 8 параметров") */}
      <div
        className="side-hd"
        onClick={() => setOpen((o) => !o)}
        style={{ borderBottom: open ? '1px solid var(--ln)' : undefined }}
      >
        <span className="sec">
          <span style={{ color: 'var(--tx4)' }}>01</span>&nbsp;&nbsp;Тренды · до 8 параметров
        </span>
        <span className="sec">{open ? '▴' : '▾'}</span>
      </div>

      {open && (
        <div style={{ borderBottom: '1px solid var(--ln)' }}>
          {/* Tag selector */}
          <div style={{ padding: '8px 16px' }}>
            <Select
              mode="multiple"
              size="small"
              value={selectedTags}
              onChange={(tags) => setSelectedTags(tags.slice(0, 8))}
              options={tagOptions}
              maxCount={8}
              style={{ width: '100%' }}
              placeholder="Выберите теги…"
            />
          </div>

          {/* Sparkline rows */}
          <div
            style={{
              padding: '0 16px 12px',
              maxHeight: height,
              overflowY: 'auto',
            }}
          >
            {selectedTags.length === 0 ? (
              <p className="note" style={{ padding: '12px 0' }}>
                Выберите параметры для отображения трендов
              </p>
            ) : (
              selectedTags.map((tag, i) => {
                const cfg = TAG_CONFIG.find((t) => t.tag === tag)
                const tv = telemetry[tag]
                return (
                  <SparklineRow
                    key={tag}
                    label={cfg?.label ?? tag}
                    unit={cfg?.unit ?? ''}
                    color={colors[i % colors.length] ?? '#e9ff57'}
                    values={seriesData[tag] ?? []}
                    alarmState={tv?.alarmState}
                  />
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
