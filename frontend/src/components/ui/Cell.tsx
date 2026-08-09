import type { HTMLAttributes, ReactNode } from 'react'

interface CellProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  noPad?: boolean
}

export function Cell({ children, className = '', noPad, style, ...rest }: CellProps) {
  return (
    <div
      className={['cell', className].filter(Boolean).join(' ')}
      style={noPad ? { padding: 0, ...style } : style}
      {...rest}
    >
      {children}
    </div>
  )
}
