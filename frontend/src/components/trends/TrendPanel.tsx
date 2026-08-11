/**
 * TrendPanel — sidebar telemetry display.
 * Prefers process instruments that actually move (levels/pressures under fault)
 * over flat helper setpoints (AVZ speeds, cooling water constants).
 */
import { useEffect, useMemo, useState } from 'react'
import { useSessionStore, normalizeTagId, type TagValue } from '@/store/session'
import { useUIStore } from '@/store/ui'

const MAX_POINTS = 120
const MAX_SERIES = 8

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

/** Higher = more interesting for operator trends. */
function tagPriority(tag: string): number {
  const t = tag.toUpperCase()
  if (/^(LRCA|LRCSA|PRSA|PRCA|TRC|FRC)\b/.test(t)) return 100
  if (/^(PRA|LRA|TR|FR|TI|PI|LI|FI)\b/.test(t)) return 80
  if (/^PUMP-/.test(t) || /^FAN-/.test(t)) return 20
  if (/^(AVZ|COOLING)/.test(t)) return 5
  return 40
}

function seriesVariance(values: number[]): number {
  const finite = values.filter((v) => Number.isFinite(v))
  if (finite.length < 2) return 0
  const min = Math.min(...finite)
  const max = Math.max(...finite)
  return max - min
}

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
  const moving = seriesVariance(finiteValues) > 1e-6

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
          {moving ? '' : ''}
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
            stroke={color}
            strokeWidth="1.5"
            strokeLinejoin="round"
            strokeLinecap="round"
            opacity={moving ? 1 : 0.45}
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

function pickLiveTags(
  telemetry: Record<string, TagValue>,
  seriesData: Record<string, number[]>,
): string[] {
  const keys = Object.keys(telemetry)
    .map((k) => normalizeTagId(k) || k)
    .filter(Boolean)

  const scored = keys.map((tag) => {
    const hist = seriesData[tag] ?? []
    const variance = seriesVariance(hist)
    const alarmBoost =
      telemetry[tag]?.alarmState && telemetry[tag]!.alarmState !== 'normal' ? 50 : 0
    return {
      tag,
      score: tagPriority(tag) + alarmBoost + Math.min(80, variance * 2),
    }
  })

  scored.sort((a, b) => b.score - a.score || a.tag.localeCompare(b.tag))
  return scored.slice(0, MAX_SERIES).map((s) => s.tag)
}

export function TrendPanel(_props: TrendPanelProps = {}) {
  const theme = useUIStore((s) => s.theme)
  const colors = theme === 'light' ? ZONE_COLORS_LIGHT : ZONE_COLORS

  const telemetry = useSessionStore((s) => s.telemetry)
  const [seriesData, setSeriesData] = useState<Record<string, number[]>>({})

  // Keep history for all tags so variance ranking can promote movers.
  useEffect(() => {
    const keys = Object.keys(telemetry)
    if (keys.length === 0) return
    setSeriesData((prev) => {
      const next = { ...prev }
      for (const raw of keys) {
        const tag = normalizeTagId(raw) || raw
        const val = telemetry[raw]?.value ?? telemetry[tag]?.value ?? NaN
        next[tag] = [...(prev[tag] ?? []), val].slice(-MAX_POINTS)
      }
      return next
    })
  }, [telemetry])

  const liveTags = useMemo(() => pickLiveTags(telemetry, seriesData), [telemetry, seriesData])

  return (
    <div>
      <div className="side-hd" style={{ borderBottom: '1px solid var(--ln)', cursor: 'default' }}>
        <span className="sec">
          <span style={{ color: 'var(--tx4)' }}>01</span>&nbsp;&nbsp;Параметры
        </span>
      </div>

      <div style={{ borderBottom: '1px solid var(--ln)', padding: '4px 16px 12px' }}>
        {liveTags.length === 0 && (
          <div style={{ fontSize: 12, color: 'var(--tx4)', padding: '12px 0' }}>
            Нет телеметрии — ожидаем данные сессии
          </div>
        )}
        {liveTags.map((tag, i) => {
          const tv = telemetry[tag]
          return (
            <SparklineRow
              key={tag}
              label={tag}
              unit={tv?.unit ?? ''}
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
