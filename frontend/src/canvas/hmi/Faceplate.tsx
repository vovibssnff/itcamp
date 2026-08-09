import { Modal, Button, Typography, Space, Divider, Tag } from 'antd'
import { useTranslation } from 'react-i18next'
import type { CanvasNode } from '@/store/constructor'
import type { TagValue, RegulatorState } from '@/store/session'
import { tokens } from '@/theme/tokens'

const { Text } = Typography

interface FaceplateProps {
  node: CanvasNode | null
  open: boolean
  onClose: () => void
  telemetry: Record<string, TagValue>
  regulators: Record<string, RegulatorState>
  onSendCommand: (type: string, tag: string, value: number) => void
}

export function Faceplate({
  node,
  open,
  onClose,
  telemetry,
  regulators,
  onSendCommand,
}: FaceplateProps) {
  const { t } = useTranslation()

  if (!node) return null

  const nodeTag = node.label
  const regulator = regulators[nodeTag]
  const tagValues = Object.values(telemetry).filter((t) =>
    t.tag.startsWith(nodeTag.split('-')[0] ?? ''),
  )

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: tokens.font.mono, color: tokens.accent.cyan }}>
            {node.label}
          </span>
          <span style={{ fontSize: 12, color: tokens.text.muted }}>Фейсплейт</span>
        </div>
      }
      open={open}
      onCancel={onClose}
      footer={null}
      width={420}
      styles={{ body: { background: tokens.bg.surface, padding: '16px' } }}
    >
      {/* PV/SP/OUT display */}
      {regulator && (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: 8,
              marginBottom: 16,
            }}
          >
            {(['pv', 'sp', 'out'] as const).map((key) => (
              <div
                key={key}
                style={{
                  background: tokens.bg.elevated,
                  border: `1px solid ${tokens.border.subtle}`,
                  borderRadius: tokens.radius.md,
                  padding: '10px 8px',
                  textAlign: 'center',
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    color: tokens.text.muted,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                  }}
                >
                  {t(`faceplate.${key}`)}
                </div>
                <div
                  style={{
                    fontFamily: tokens.font.mono,
                    fontSize: 24,
                    color: key === 'pv' ? tokens.text.primary : tokens.accent.cyan,
                    lineHeight: 1.2,
                  }}
                >
                  {regulator[key].toFixed(1)}
                </div>
              </div>
            ))}
          </div>

          {/* Mode toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Text style={{ color: tokens.text.secondary, fontSize: 12 }}>Режим:</Text>
            <Button
              size="small"
              type={regulator.mode === 'auto' ? 'primary' : 'default'}
              onClick={() =>
                onSendCommand('regulator_mode', nodeTag, regulator.mode === 'auto' ? 0 : 1)
              }
            >
              {regulator.mode === 'auto' ? t('faceplate.auto') : t('faceplate.manual')}
            </Button>
          </div>
        </>
      )}

      {/* Tag values */}
      {tagValues.length > 0 && (
        <>
          <Divider style={{ borderColor: tokens.border.subtle, margin: '8px 0' }} />
          <div style={{ marginBottom: 12 }}>
            {tagValues.map((tv) => (
              <div
                key={tv.tag}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '4px 0',
                  borderBottom: `1px solid ${tokens.border.subtle}`,
                }}
              >
                <Text
                  style={{
                    fontFamily: tokens.font.mono,
                    fontSize: 11,
                    color: tokens.text.secondary,
                  }}
                >
                  {tv.tag}
                </Text>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Text
                    style={{
                      fontFamily: tokens.font.mono,
                      fontSize: 14,
                      color: tv.alarmState !== 'normal' ? tokens.accent.red : tokens.text.primary,
                    }}
                  >
                    {tv.value.toFixed(2)}
                  </Text>
                  <Text style={{ fontSize: 10, color: tokens.text.dim }}>{tv.unit}</Text>
                  {tv.alarmState !== 'normal' && (
                    <Tag
                      color={tv.alarmState === 'HH' || tv.alarmState === 'LL' ? 'error' : 'warning'}
                    >
                      {tv.alarmState}
                    </Tag>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Control buttons */}
      <Space>
        <Button size="small" onClick={() => onSendCommand('actuator', `${nodeTag}_OPEN`, 100)}>
          {t('faceplate.open')}
        </Button>
        <Button
          size="small"
          danger
          onClick={() => onSendCommand('actuator', `${nodeTag}_CLOSE`, 0)}
        >
          {t('faceplate.close')}
        </Button>
      </Space>
    </Modal>
  )
}
