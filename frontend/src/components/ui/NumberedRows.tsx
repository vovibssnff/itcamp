import type { ReactNode } from 'react'

interface RowItem {
  num?: string
  title: ReactNode
  desc?: ReactNode
  badge?: ReactNode
  onClick?: () => void
}

interface NumberedRowsProps {
  items: RowItem[]
  className?: string
}

export function NumberedRows({ items, className = '' }: NumberedRowsProps) {
  return (
    <div className={['rows', className].filter(Boolean).join(' ')}>
      {items.map((item, i) => (
        <div
          key={i}
          className="row"
          onClick={item.onClick}
          style={{ cursor: item.onClick ? 'pointer' : 'default' }}
        >
          {item.num !== undefined && <span className="row-num">{item.num}</span>}
          <div className="row-body">
            <div className="row-title">{item.title}</div>
            {item.desc && <div className="row-desc">{item.desc}</div>}
          </div>
          {item.badge}
          {item.onClick && <span className="row-arrow">→</span>}
        </div>
      ))}
    </div>
  )
}
