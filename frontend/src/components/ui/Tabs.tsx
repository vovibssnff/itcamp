import type { ReactNode } from 'react'

interface Tab {
  key: string
  label: ReactNode
  content?: ReactNode
}

interface TabsProps {
  tabs: Tab[]
  active: string
  onChange: (key: string) => void
  children?: ReactNode
  className?: string
}

export function Tabs({ tabs, active, onChange, children, className = '' }: TabsProps) {
  return (
    <div className={className}>
      <div className="tabs">
        {tabs.map((tab) => (
          <div
            key={tab.key}
            className={['tab', active === tab.key ? 'active' : ''].filter(Boolean).join(' ')}
            onClick={() => onChange(tab.key)}
            aria-selected={active === tab.key}
            role="tab"
          >
            {tab.label}
          </div>
        ))}
      </div>
      {children ??
        tabs.map((tab) =>
          active === tab.key && tab.content ? (
            <div key={tab.key} role="tabpanel">
              {tab.content}
            </div>
          ) : null,
        )}
    </div>
  )
}
