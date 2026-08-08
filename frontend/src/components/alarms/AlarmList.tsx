import { CheckOutlined } from '@ant-design/icons'
import { useSessionStore, type ActiveAlarm } from '@/store/session'
import { useTranslation } from 'react-i18next'
import { Pill } from '@/components/ui'

const LEVEL_VARIANT: Record<ActiveAlarm['level'], 'alarm' | 'warn' | 'ok' | 'acc'> = {
  HH: 'alarm',
  H: 'warn',
  L: 'acc',
  LL: 'acc',
}

export function AlarmList({ maxHeight = 300 }: { maxHeight?: number }) {
  const alarms = useSessionStore((s) => s.alarms)
  const acknowledgeAlarm = useSessionStore((s) => s.acknowledgeAlarm)
  const { t } = useTranslation()

  if (alarms.length === 0) {
    return (
      <div
        style={{
          padding: '20px 16px',
          textAlign: 'center',
          color: 'var(--tx3)',
          fontFamily: 'var(--mono)',
          fontSize: 10,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
        }}
      >
        Нет активных сигнализаций
      </div>
    )
  }

  return (
    <div style={{ maxHeight, overflowY: 'auto' }}>
      {alarms.map((alarm) => (
        <div
          key={alarm.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '8px 14px',
            borderBottom: '1px solid var(--ln)',
            opacity: alarm.acknowledged ? 0.45 : 1,
            background: alarm.acknowledged ? 'transparent' : 'rgba(255,74,74,0.04)',
          }}
        >
          <Pill variant={LEVEL_VARIANT[alarm.level]}>{t(`alarm.levels.${alarm.level}`)}</Pill>
          <span
            style={{
              fontFamily: 'var(--mono)',
              fontSize: 10,
              color: 'var(--tx3)',
              letterSpacing: '0.08em',
              flexShrink: 0,
            }}
          >
            {alarm.tag}
          </span>
          <span style={{ flex: 1, fontSize: 12, color: 'var(--tx)' }}>{alarm.message}</span>
          <span
            style={{
              fontSize: 9,
              color: 'var(--tx4)',
              fontFamily: 'var(--mono)',
              letterSpacing: '0.06em',
              flexShrink: 0,
            }}
          >
            {new Date(alarm.timestamp).toLocaleTimeString('ru-RU')}
          </span>
          {!alarm.acknowledged && (
            <button
              className="btn-icon"
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--tx3)',
                cursor: 'pointer',
                fontSize: 12,
                padding: '4px 6px',
                borderRadius: '2px',
                transition: 'color 0.15s',
              }}
              onClick={() => acknowledgeAlarm(alarm.id)}
              title={t('alarm.acknowledge')}
            >
              <CheckOutlined />
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
