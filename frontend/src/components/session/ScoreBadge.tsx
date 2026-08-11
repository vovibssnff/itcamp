import { useEffect, useState } from 'react'
import { Tag } from 'antd'
import { assessmentApi } from '@/api/assessment'

interface ScoreBadgeProps {
  sessionId: string
}

/** Loads and shows assessment score for a stopped/finished session. */
export function ScoreBadge({ sessionId }: ScoreBadgeProps) {
  const [label, setLabel] = useState<string | null>(null)
  const [pass, setPass] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const score = await assessmentApi.getScore(sessionId)
        if (cancelled) return
        const pct = Math.round(score.score)
        const verdict = score.verdict ?? (pct >= 60 ? 'pass' : 'fail')
        setPass(verdict === 'pass')
        setLabel(`${pct}%`)
      } catch {
        if (!cancelled) setLabel(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [sessionId])

  if (!label) return null
  return (
    <Tag data-testid="session-score" color={pass ? 'success' : 'error'}>
      {label}
    </Tag>
  )
}
