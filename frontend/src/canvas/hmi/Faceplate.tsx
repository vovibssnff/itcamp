import { useTranslation } from 'react-i18next'
import type { CanvasNode } from '@/store/constructor'
import type { TagValue, RegulatorState } from '@/store/session'

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

  if (!open || !node) return null

  const nodeTag = node.label
  const regulator = regulators[nodeTag]
  const tagValues = Object.values(telemetry).filter((tv) =>
    tv.tag.startsWith(nodeTag.split('-')[0] ?? ''),
  )

  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet" style={{ width: 420 }} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-hd">
          <div>
            <div className="sec">Узел установки</div>
            <div className="h2" style={{ marginTop: 5 }}>
              {node.label}
            </div>
          </div>
          <button className="x" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="sheet-bd">
          {regulator && (
            <>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 8,
                  marginBottom: 16,
                }}
              >
                {(['pv', 'sp', 'out'] as const).map((key) => (
                  <div key={key} className="box-mute" style={{ textAlign: 'center' }}>
                    <div
                      className="mono"
                      style={{
                        fontSize: 10,
                        color: 'var(--tx3)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                      }}
                    >
                      {t(`faceplate.${key}`)}
                    </div>
                    <div
                      className="mono"
                      style={{
                        fontSize: 22,
                        marginTop: 4,
                        color: key === 'pv' ? 'var(--tx)' : 'var(--acc-txt)',
                        lineHeight: 1.2,
                      }}
                    >
                      {regulator[key].toFixed(1)}
                    </div>
                  </div>
                ))}
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 14,
                  paddingTop: 4,
                  paddingBottom: 16,
                  borderBottom: '1px solid var(--ln2)',
                }}
              >
                <span style={{ fontSize: 13, color: 'var(--tx2)' }}>Режим:</span>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() =>
                    onSendCommand('regulator_mode', nodeTag, regulator.mode === 'auto' ? 0 : 1)
                  }
                >
                  {regulator.mode === 'auto' ? t('faceplate.auto') : t('faceplate.manual')}
                </button>
              </div>
            </>
          )}

          {tagValues.length > 0 && (
            <div style={{ marginTop: regulator ? 16 : 0 }}>
              {tagValues.map((tv) => (
                <div key={tv.tag} className="dr">
                  <span className="mono" style={{ fontSize: 11, color: 'var(--tx2)' }}>
                    {tv.tag}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span
                      className="mono"
                      style={{
                        fontSize: 14,
                        color: tv.alarmState !== 'normal' ? 'var(--alarm)' : 'var(--tx)',
                      }}
                    >
                      {tv.value.toFixed(2)}
                    </span>
                    <span style={{ fontSize: 10, color: 'var(--tx4)' }}>{tv.unit}</span>
                    {tv.alarmState !== 'normal' && (
                      <span
                        className="pill"
                        style={{
                          background:
                            tv.alarmState === 'HH' || tv.alarmState === 'LL'
                              ? 'rgba(255,74,74,0.12)'
                              : 'rgba(224,164,88,0.15)',
                          color:
                            tv.alarmState === 'HH' || tv.alarmState === 'LL'
                              ? 'var(--alarm)'
                              : 'var(--warn)',
                        }}
                      >
                        {tv.alarmState}
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => onSendCommand('actuator', `${nodeTag}_OPEN`, 100)}
            >
              {t('faceplate.open')}
            </button>
            <button
              className="btn btn-ghost btn-sm"
              style={{ borderColor: 'rgba(255,74,74,0.35)', color: 'var(--alarm)' }}
              onClick={() => onSendCommand('actuator', `${nodeTag}_CLOSE`, 0)}
            >
              {t('faceplate.close')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
