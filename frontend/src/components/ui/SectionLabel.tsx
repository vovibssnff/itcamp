import type { ReactNode, HTMLAttributes } from 'react'

interface SectionLabelProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
}

export function SectionLabel({ children, className = '', style, ...rest }: SectionLabelProps) {
  return (
    <div
      className={['sec', className].filter(Boolean).join(' ')}
      style={{ marginBottom: 10, ...style }}
      {...rest}
    >
      {children}
    </div>
  )
}
