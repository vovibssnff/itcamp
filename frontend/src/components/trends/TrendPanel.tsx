import { useEffect, useState } from 'react'
import { Select } from 'antd'
import { useSessionStore } from '@/store/session'
import { TrendChart, type TrendSeries } from './TrendChart'
import { TAG_CONFIG } from '@/mocks/fixtures/telemetry'

const MAX_POINTS = 300

const ZONE_COLORS = [
  '#e9ff57', // acc / ЭЛОУ
  '#e0a458', // warn / Атмосфера
  '#7e9cd8', // GDM blue
  '#ff4a4a', // alarm
  '#a395d6', // purple
  '#7fd18f', // ok green
  '#d98bae', // rose
  '#86c98b', // light green
]

const INITIAL_TAGS = ['TI-201', 'TI-202', 'PI-101', 'LI-301']

interface TrendPanelProps {
  width?: number
  height?: number
}

export function TrendPanel({ width = 600, height = 200 }: TrendPanelProps) {
  const telemetry = useSessionStore((s) => s.telemetry)
  const [selectedTags, setSelectedTags] = useState<string[]>(INITIAL_TAGS)
  const [timestamps, setTimestamps] = useState<number[]>([])
  const [seriesData, setSeriesData] = useState<Record<string, number[]>>({})

  useEffect(() => {
    const now = Date.now()
    setTimestamps((prev) => [...prev, now].slice(-MAX_POINTS))
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
      color: ZONE_COLORS[i % ZONE_COLORS.length] ?? '#e9ff57',
      unit: cfg?.unit ?? '',
    }
  })

  const data = selectedTags.map((tag) => seriesData[tag] ?? [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className="sec">Тренды</span>
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
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => {
            setTimestamps([])
            setSeriesData({})
          }}
        >
          Сброс
        </button>
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
