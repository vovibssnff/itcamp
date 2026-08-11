import { useSessionStore } from '@/store/session'
import { useTranslation } from 'react-i18next'

interface AlarmBannerProps {
  /** When provided, ack goes through this callback (REST/WS); else local store only. */
  onAcknowledge?: (ids: string[]) => void
}

export function AlarmBanner({ onAcknowledge }: AlarmBannerProps = {}) {
  const alarms = useSessionStore((s) => s.alarms)
  const acknowledgeAlarm = useSessionStore((s) => s.acknowledgeAlarm)
  const { t } = useTranslation()

  const activeAlarms = alarms.filter((a) => !a.acknowledged)
  const hhAlarms = activeAlarms.filter((a) => a.level === 'HH')
  const hasAlarms = activeAlarms.length > 0

  if (!hasAlarms) return null

  function handleAckAll() {
    const ids = activeAlarms.map((a) => a.id)
    if (onAcknowledge) {
      onAcknowledge(ids)
    }
    ids.forEach((id) => acknowledgeAlarm(id))
  }

  return (
    <div className="alarmbar" data-testid="alarm-banner">
      <b />
      <span
        data-testid="alarm-count"
        style={{ fontWeight: 700, color: 'var(--alarm)', fontSize: 13 }}
      >
        {activeAlarms.length}
      </span>
      <span>
        активных сигнализаций
        {hhAlarms.length > 0 && (
          <span style={{ color: 'var(--alarm)', marginLeft: 12 }}>
            · {hhAlarms.length} критических
          </span>
        )}
      </span>
      <div style={{ flex: 1 }} />
      {activeAlarms[0] && (
        <span
          style={{
            fontFamily: 'var(--mono)',
            fontSize: 11,
            color: 'var(--tx2)',
            maxWidth: 360,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            letterSpacing: '0.06em',
          }}
        >
          {activeAlarms[0].message}
        </span>
      )}
      <button
        className="btn btn-ghost btn-sm"
        style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.1em' }}
        onClick={handleAckAll}
      >
        {t('alarm.acknowledgeAll')}
      </button>
    </div>
  )
}
