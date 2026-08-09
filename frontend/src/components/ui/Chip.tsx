import type { ReactNode, HTMLAttributes } from 'react'

interface ChipProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode
}

export function Chip({ children, className = '', ...rest }: ChipProps) {
  return (
    <span className={['chip', className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </span>
  )
}

type PillVariant = 'ok' | 'alarm' | 'warn' | 'acc' | 'default'

interface PillProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: PillVariant
  children: ReactNode
}

export function Pill({ variant = 'default', children, className = '', style, ...rest }: PillProps) {
  const variantCls = variant !== 'default' ? `pill-${variant}` : ''
  return (
    <span
      className={['pill', variantCls, className].filter(Boolean).join(' ')}
      style={
        variant === 'default' ? { background: 'var(--srf2)', color: 'var(--tx3)', ...style } : style
      }
      {...rest}
    >
      {children}
    </span>
  )
}
