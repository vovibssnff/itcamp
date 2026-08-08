import { useEffect, useState } from 'react'
import { Select, Button } from 'antd'
import { useSessionStore } from '@/store/session'
import { TrendChart, type TrendSeries } from './TrendChart'
import { TAG_CONFIG } from '@/mocks/fixtures/telemetry'
import { tokens } from '@/theme/tokens'

const MAX_POINTS = 300 // 5 min at 1Hz
const INITIAL_TAGS = ['TI-201', 'TI-202', 'PI-101', 'LI-301']
const COLORS = [
  tokens.accent.cyan,
  tokens.accent.amber,
  tokens.accent.blue,
  tokens.accent.red,
  '#a78bfa',
  '#34d399',
  '#f472b6',
  '#fb923c',
]

interface TrendPanelProps {
  width?: number
  height?: number
}

export function TrendPanel({ width = 600, height = 200 }: TrendPanelProps) {
  const telemetry = useSessionStore((s) => s.telemetry)
  const [selectedTags, setSelectedTags] = useState<string[]>(INITIAL_TAGS)
  const [timestamps, setTimestamps] = useState<number[]>([])
  const [seriesData, setSeriesData] = useState<Record<string, number[]>>({})

  // Accumulate rolling window data
  useEffect(() => {
    const now = Date.now()
    setTimestamps((prev) => {
      const next = [...prev, now].slice(-MAX_POINTS)
      return next
    })
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

  const series: TrendSeries[] = selectedTags.map((tag, i) => {
    const cfg = TAG_CONFIG.find((t) => t.tag === tag)
    return {
      tag,
      label: cfg?.label ?? tag,
      color: COLORS[i % COLORS.length] ?? tokens.accent.cyan,
      unit: cfg?.unit ?? '',
    }
  })

  const data = selectedTags.map((tag) => seriesData[tag] ?? [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          style={{
            fontSize: 11,
            color: tokens.text.muted,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}
        >
          Тренды
        </span>
        <Select
          mode="multiple"
          size="small"
          value={selectedTags}
          onChange={setSelectedTags}
          options={tagOptions}
          maxCount={8}
          style={{ flex: 1, minWidth: 200 }}
          placeholder="Выберите теги..."
        />
        <Button
          size="small"
          onClick={() => {
            setTimestamps([])
            setSeriesData({})
          }}
        >
          Сброс
        </Button>
      </div>
      <TrendChart
        series={series}
        data={data}
        timestamps={timestamps}
        width={width}
        height={height}
      />
    </div>
  )
}
