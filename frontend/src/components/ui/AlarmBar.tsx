import type { ReactNode } from 'react'

interface AlarmBarProps {
  message: ReactNode
  count?: number
  className?: string
}

export function AlarmBar({ message, count, className = '' }: AlarmBarProps) {
  return (
    <div className={['alarmbar', className].filter(Boolean).join(' ')}>
      <b />
      {count !== undefined && (
        <span style={{ fontWeight: 700, color: 'var(--alarm)' }}>{count}</span>
      )}
      <span>{message}</span>
    </div>
  )
}
