/**
 * TrendPanel — sidebar telemetry display matching the ktk.html reference.
 * Shows one collapsible sparkline row per parameter:
 *   label  ·  current value (colored)
 *   ──────────────────── SVG polyline ────────────────────
 */
import { useEffect, useState } from 'react'
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

const INITIAL_TAGS = ['FI-101', 'TI-101', 'LI-101', 'PI-102', 'TI-105', 'LI-102']

interface SparklineRowProps {
  label: string
  unit: string
  color: string
  values: number[]
  alarmState?: string
}

function SparklineRow({ label, unit, color, values, alarmState }: SparklineRowProps) {
  const finiteValues = values.filter((v) => Number.isFinite(v))
  const latest = finiteValues.at(-1) ?? NaN
  const hasData = finiteValues.length >= 2

  // Normalize values to SVG viewport 200×34
  let points = ''
  if (hasData) {
    const min = Math.min(...finiteValues)
    const max = Math.max(...finiteValues)
    const range = max - min || 1
    const step = 200 / (finiteValues.length - 1)
    points = finiteValues
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
          alignItems: 'center',
          gap: 10,
        }}
      >
        <span
          style={{
            fontSize: 11.5,
            lineHeight: 1,
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
          style={{
            fontSize: 12,
            lineHeight: 1,
            fontWeight: 600,
            color: valueColor,
            flexShrink: 0,
            display: 'inline-grid',
            gridTemplateColumns: '4.5ch 3.2em',
            alignItems: 'baseline',
            columnGap: 4,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          <span style={{ textAlign: 'right' }}>{isNaN(latest) ? '—' : latest.toFixed(1)}</span>
          <span style={{ fontSize: 9, fontWeight: 400, color: 'var(--tx4)' }}>{unit || ''}</span>
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
  /** @deprecated telemetry is now displayed in full without an inner scroll */
  height?: number
}

export function TrendPanel(_props: TrendPanelProps = {}) {
  const theme = useUIStore((s) => s.theme)
  const colors = theme === 'light' ? ZONE_COLORS_LIGHT : ZONE_COLORS

  const telemetry = useSessionStore((s) => s.telemetry)
  const [seriesData, setSeriesData] = useState<Record<string, number[]>>({})

  useEffect(() => {
    setSeriesData((prev) => {
      const next = { ...prev }
      for (const tag of INITIAL_TAGS) {
        const val = telemetry[tag]?.value ?? NaN
        next[tag] = [...(prev[tag] ?? []), val].slice(-MAX_POINTS)
      }
      return next
    })
  }, [telemetry])

  return (
    <div>
      {/* Section header (matches "02 · Журнал аварий" styling below) */}
      <div className="side-hd" style={{ borderBottom: '1px solid var(--ln)', cursor: 'default' }}>
        <span className="sec">
          <span style={{ color: 'var(--tx4)' }}>01</span>&nbsp;&nbsp;Параметры
        </span>
      </div>

      <div style={{ borderBottom: '1px solid var(--ln)', padding: '4px 16px 12px' }}>
        {INITIAL_TAGS.map((tag, i) => {
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
        })}
      </div>
    </div>
  )
}
