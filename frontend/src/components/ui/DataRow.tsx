import type { ReactNode } from 'react'

interface DataRowItem {
  label: string
  value: ReactNode
}

interface DataRowProps {
  items: DataRowItem[]
  className?: string
}

export function DataRow({ label, value }: DataRowItem) {
  return (
    <div className="dr">
      <span className="dr-key">{label}</span>
      <span className="dr-val">{value}</span>
    </div>
  )
}

export function DataRows({ items, className = '' }: DataRowProps) {
  return (
    <div className={className}>
      {items.map((item, i) => (
        <DataRow key={i} {...item} />
      ))}
    </div>
  )
}
