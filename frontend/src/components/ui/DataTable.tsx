import type { ReactNode, CSSProperties } from 'react'

interface Column<T> {
  key: string
  title: string
  render?: (row: T, idx: number) => ReactNode
  /** Width token e.g. "1fr", "120px", "2fr" */
  width?: string
  align?: 'left' | 'right' | 'center'
}

interface DataTableProps<T extends object> {
  columns: Column<T>[]
  rows: T[]
  rowKey?: (row: T, idx: number) => string | number
  onRowClick?: (row: T) => void
  emptyText?: string
  style?: CSSProperties
  className?: string
}

function gridStyle(columns: Column<unknown>[]): CSSProperties {
  return {
    gridTemplateColumns: columns.map((c) => c.width ?? '1fr').join(' '),
  }
}

export function DataTable<T extends object>({
  columns,
  rows,
  rowKey,
  onRowClick,
  emptyText = 'Нет данных',
  style,
  className = '',
}: DataTableProps<T>) {
  return (
    <div className={['tbl', className].filter(Boolean).join(' ')} style={style}>
      <div className="tbl-hd" style={gridStyle(columns as Column<unknown>[])}>
        {columns.map((col) => (
          <span key={col.key} style={{ textAlign: col.align }}>
            {col.title}
          </span>
        ))}
      </div>

      {rows.length === 0 ? (
        <div
          style={{
            padding: '32px 18px',
            color: 'var(--tx3)',
            fontFamily: 'var(--mono)',
            fontSize: 11,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            textAlign: 'center',
          }}
        >
          {emptyText}
        </div>
      ) : (
        rows.map((row, idx) => (
          <div
            key={rowKey ? rowKey(row, idx) : idx}
            className="tbl-row"
            style={{
              ...gridStyle(columns as Column<unknown>[]),
              cursor: onRowClick ? 'pointer' : undefined,
            }}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
          >
            {columns.map((col) => (
              <span key={col.key} style={{ textAlign: col.align, overflow: 'hidden' }}>
                {col.render ? col.render(row, idx) : (row as Record<string, ReactNode>)[col.key]}
              </span>
            ))}
          </div>
        ))
      )}
    </div>
  )
}
