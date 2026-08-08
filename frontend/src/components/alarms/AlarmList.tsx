import { Tag, Button } from 'antd'
import { CheckOutlined } from '@ant-design/icons'
import { useSessionStore, type ActiveAlarm } from '@/store/session'
import { useTranslation } from 'react-i18next'
import { tokens } from '@/theme/tokens'

const LEVEL_COLORS: Record<ActiveAlarm['level'], string> = {
  HH: 'error',
  H: 'warning',
  L: 'processing',
  LL: 'purple',
}

export function AlarmList({ maxHeight = 300 }: { maxHeight?: number }) {
  const alarms = useSessionStore((s) => s.alarms)
  const acknowledgeAlarm = useSessionStore((s) => s.acknowledgeAlarm)
  const { t } = useTranslation()

  return (
    <div style={{ maxHeight, overflowY: 'auto' }}>
      {alarms.length === 0 && (
        <div
          style={{
            padding: '16px',
            textAlign: 'center',
            color: tokens.text.inactive,
            fontSize: 12,
          }}
        >
          Нет активных сигнализаций
        </div>
      )}
      {alarms.map((alarm) => (
        <div
          key={alarm.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 12px',
            borderBottom: `1px solid ${tokens.border.subtle}`,
            opacity: alarm.acknowledged ? 0.5 : 1,
            background: alarm.acknowledged ? 'transparent' : tokens.accent.redBg,
          }}
        >
          <Tag color={LEVEL_COLORS[alarm.level]}>{t(`alarm.levels.${alarm.level}`)}</Tag>
          <span
            style={{ fontFamily: tokens.font.mono, fontSize: 11, color: tokens.text.secondary }}
          >
            {alarm.tag}
          </span>
          <span style={{ flex: 1, fontSize: 12, color: tokens.text.primary }}>{alarm.message}</span>
          <span style={{ fontSize: 10, color: tokens.text.dim, fontFamily: tokens.font.mono }}>
            {new Date(alarm.timestamp).toLocaleTimeString('ru-RU')}
          </span>
          {!alarm.acknowledged && (
            <Button
              size="small"
              type="text"
              icon={<CheckOutlined />}
              onClick={() => acknowledgeAlarm(alarm.id)}
              style={{ color: tokens.text.muted }}
            />
          )}
        </div>
      ))}
    </div>
  )
}
