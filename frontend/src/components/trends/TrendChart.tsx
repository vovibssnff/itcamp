import { useEffect, useRef } from 'react'
import uPlot from 'uplot'
import 'uplot/dist/uPlot.min.css'
import { tokens } from '@/theme/tokens'

export interface TrendSeries {
  tag: string
  label: string
  color: string
  unit: string
}

interface TrendChartProps {
  series: TrendSeries[]
  data: number[][]
  timestamps: number[]
  width: number
  height: number
}

const SERIES_COLORS = [
  tokens.accent.cyan,
  tokens.accent.amber,
  tokens.accent.blue,
  tokens.accent.red,
  '#a78bfa',
  '#34d399',
  '#f472b6',
  '#fb923c',
]

export function TrendChart({ series, data, timestamps, width, height }: TrendChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const plotRef = useRef<uPlot | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const opts: uPlot.Options = {
      width,
      height,
      plugins: [],
      scales: {
        x: { time: true },
        y: { auto: true },
      },
      axes: [
        {
          stroke: tokens.text.dim,
          grid: { stroke: tokens.border.subtle, width: 1 },
          ticks: { stroke: tokens.border.subtle },
          font: `11px 'IBM Plex Mono', monospace`,
          labelFont: `11px 'IBM Plex Mono', monospace`,
        },
        {
          stroke: tokens.text.dim,
          grid: { stroke: tokens.border.subtle, width: 1 },
          ticks: { stroke: tokens.border.subtle },
          font: `11px 'IBM Plex Mono', monospace`,
          labelFont: `11px 'IBM Plex Mono', monospace`,
        },
      ],
      series: [
        {},
        ...series.map((s, i) => ({
          label: s.label,
          stroke: SERIES_COLORS[i % SERIES_COLORS.length] ?? tokens.accent.cyan,
          width: 1.5,
          fill: `${SERIES_COLORS[i % SERIES_COLORS.length] ?? tokens.accent.cyan}15`,
        })),
      ],
      cursor: {
        points: { fill: 'transparent', stroke: 'transparent' },
      },
      legend: {
        show: true,
        live: true,
      },
    }

    const plotData: uPlot.AlignedData = [timestamps.map((t) => t / 1000), ...data]

    if (plotRef.current) {
      plotRef.current.destroy()
    }

    const plot = new uPlot(opts, plotData, containerRef.current)
    containerRef.current.style.background = tokens.bg.surface
    plotRef.current = plot

    return () => {
      plot.destroy()
      plotRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height, series.length])

  useEffect(() => {
    if (!plotRef.current) return
    const plotData: uPlot.AlignedData = [timestamps.map((t) => t / 1000), ...data]
    plotRef.current.setData(plotData)
  }, [timestamps, data])

  return (
    <div
      ref={containerRef}
      style={{
        background: tokens.bg.surface,
        borderRadius: tokens.radius.md,
        overflow: 'hidden',
      }}
    />
  )
}
