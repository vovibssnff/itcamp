import type { ReactNode, HTMLAttributes } from 'react'

type BoxVariant = 'acc' | 'alarm' | 'mute'

interface BoxProps extends HTMLAttributes<HTMLDivElement> {
  variant?: BoxVariant
  children: ReactNode
}

export function Box({ variant = 'mute', children, className = '', ...rest }: BoxProps) {
  return (
    <div className={[`box-${variant}`, className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </div>
  )
}

export function BoxAcc({ children, ...rest }: Omit<BoxProps, 'variant'>) {
  return (
    <Box variant="acc" {...rest}>
      {children}
    </Box>
  )
}

export function BoxAlarm({ children, ...rest }: Omit<BoxProps, 'variant'>) {
  return (
    <Box variant="alarm" {...rest}>
      {children}
    </Box>
  )
}

export function BoxMute({ children, ...rest }: Omit<BoxProps, 'variant'>) {
  return (
    <Box variant="mute" {...rest}>
      {children}
    </Box>
  )
}
