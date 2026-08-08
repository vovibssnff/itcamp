import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'acc' | 'ghost' | 'out' | 'danger'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: 'default' | 'sm'
  block?: boolean
  icon?: ReactNode
  children?: ReactNode
}

export function Button({
  variant = 'ghost',
  size,
  block,
  icon,
  children,
  className = '',
  ...rest
}: ButtonProps) {
  const cls = [
    'btn',
    variant ? `btn-${variant}` : '',
    size === 'sm' ? 'btn-sm' : '',
    block ? 'btn-w' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button className={cls} {...rest}>
      {icon && <span style={{ lineHeight: 0 }}>{icon}</span>}
      {children}
    </button>
  )
}
