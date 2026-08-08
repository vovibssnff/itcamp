import { Button } from 'antd'
import { BellOutlined } from '@ant-design/icons'
import { useSessionStore } from '@/store/session'
import { useTranslation } from 'react-i18next'
import { tokens } from '@/theme/tokens'

export function AlarmBanner() {
  const alarms = useSessionStore((s) => s.alarms)
  const acknowledgeAlarm = useSessionStore((s) => s.acknowledgeAlarm)
  const { t } = useTranslation()

  const activeAlarms = alarms.filter((a) => !a.acknowledged)
  const hhAlarms = activeAlarms.filter((a) => a.level === 'HH')
  const hasAlarms = activeAlarms.length > 0

  if (!hasAlarms) return null

  return (
    <div
      className={hhAlarms.length > 0 ? 'alarm-banner-blink' : undefined}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '6px 16px',
        background: hhAlarms.length > 0 ? 'rgba(255,77,77,0.12)' : 'rgba(255,176,32,0.08)',
        borderBottom: `1px solid ${hhAlarms.length > 0 ? tokens.accent.redBorder : 'rgba(255,176,32,0.3)'}`,
        fontSize: 12,
        flexShrink: 0,
      }}
    >
      <BellOutlined
        style={{
          color: hhAlarms.length > 0 ? tokens.accent.red : tokens.accent.amber,
          fontSize: 14,
        }}
        className={hhAlarms.length > 0 ? 'alarm-pulse' : undefined}
      />
      <span style={{ color: tokens.text.primary }}>
        <span
          style={{
            color: hhAlarms.length > 0 ? tokens.accent.red : tokens.accent.amber,
            fontWeight: 600,
          }}
        >
          {activeAlarms.length}
        </span>{' '}
        активных сигнализаций
        {hhAlarms.length > 0 && (
          <span style={{ color: tokens.accent.red, marginLeft: 8 }}>
            · {hhAlarms.length} критических
          </span>
        )}
      </span>
      <div style={{ flex: 1 }} />
      {activeAlarms[0] && (
        <span
          style={{
            fontFamily: tokens.font.mono,
            fontSize: 11,
            color: tokens.text.secondary,
            maxWidth: 300,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {activeAlarms[0].message}
        </span>
      )}
      <Button
        size="small"
        type="text"
        style={{ color: tokens.text.secondary, fontSize: 11 }}
        onClick={() => activeAlarms.forEach((a) => acknowledgeAlarm(a.id))}
      >
        {t('alarm.acknowledgeAll')}
      </Button>
    </div>
  )
}
