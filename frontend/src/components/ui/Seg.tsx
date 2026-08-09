import type { ReactNode } from 'react'

interface SegOption<T extends string = string> {
  value: T
  label: ReactNode
}

interface SegProps<T extends string = string> {
  options: SegOption<T>[]
  value: T
  onChange: (v: T) => void
  mono?: boolean
  className?: string
}

export function Seg<T extends string = string>({
  options,
  value,
  onChange,
  mono,
  className = '',
}: SegProps<T>) {
  return (
    <div className={['seg', mono ? 'seg-mono' : '', className].filter(Boolean).join(' ')}>
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          style={{
            background: value === opt.value ? 'var(--acc)' : undefined,
            color: value === opt.value ? 'var(--acc-ink)' : undefined,
            fontWeight: value === opt.value ? 600 : undefined,
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
