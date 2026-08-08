import type { ReactNode, CSSProperties } from 'react'

interface Metric {
  label: string
  value: ReactNode
  color?: string
}

interface MetricGridProps {
  metrics: Metric[]
  cols?: 2 | 3 | 4
  style?: CSSProperties
  className?: string
}

export function MetricGrid({ metrics, cols = 3, style, className = '' }: MetricGridProps) {
  return (
    <div
      className={['mgrid', className].filter(Boolean).join(' ')}
      style={{
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        ...style,
      }}
    >
      {metrics.map((m, i) => (
        <div key={i} className="mgrid-cell">
          <div className="mval" style={m.color ? { color: m.color } : undefined}>
            {m.value}
          </div>
          <div className="mlbl">{m.label}</div>
        </div>
      ))}
    </div>
  )
}
