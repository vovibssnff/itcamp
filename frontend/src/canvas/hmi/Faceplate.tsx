import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { CanvasNode } from '@/store/constructor'
import type { TagValue, RegulatorState } from '@/store/session'
import type { ComponentType } from '@/mocks/fixtures/components'
import { getEquipmentReference } from './equipmentReference'

interface FaceplateProps {
  node: CanvasNode | null
  componentTypes: ComponentType[]
  open: boolean
  onClose: () => void
  telemetry: Record<string, TagValue>
  regulators: Record<string, RegulatorState>
  onSendCommand: (type: string, tag: string, value: number) => void
}

export function Faceplate({
  node,
  componentTypes,
  open,
  onClose,
  telemetry,
  regulators,
  onSendCommand,
}: FaceplateProps) {
  const { t } = useTranslation()
  const [refOpen, setRefOpen] = useState(true)

  if (!open || !node) return null

  const nodeTag = node.label
  const regulator = regulators[nodeTag]
  const tagValues = (node.tags ?? [])
    .map((tag) => telemetry[tag])
    .filter((tv): tv is TagValue => Boolean(tv))
  const shape = componentTypes.find((c) => c.id === node.typeId)?.shape
  const reference = getEquipmentReference(node.typeId, shape)

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

          {/* Справка — grounded in the real эксплуатационный регламент установки */}
          <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--ln2)' }}>
            <div
              onClick={() => setRefOpen((o) => !o)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
              }}
            >
              <span className="sec">Справка по узлу</span>
              <span className="sec">{refOpen ? '▴' : '▾'}</span>
            </div>

            {refOpen && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--tx)' }}>
                  {reference.purpose}
                </div>

                {reference.safetyRules.length > 0 && (
                  <div style={{ marginTop: 14 }}>
                    <div className="sec" style={{ marginBottom: 6 }}>
                      Меры безопасности
                    </div>
                    <ul style={{ margin: 0, paddingLeft: 18 }}>
                      {reference.safetyRules.map((rule, i) => (
                        <li
                          key={i}
                          style={{ fontSize: 12.5, lineHeight: 1.55, color: 'var(--tx2)' }}
                        >
                          {rule}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {reference.failureConsequences.length > 0 && (
                  <div className="box-alarm" style={{ marginTop: 14 }}>
                    <div
                      className="sec"
                      style={{ marginBottom: 6, color: 'inherit', opacity: 0.85 }}
                    >
                      Возможные последствия отказа
                    </div>
                    <ul style={{ margin: 0, paddingLeft: 18 }}>
                      {reference.failureConsequences.map((item, i) => (
                        <li key={i} style={{ lineHeight: 1.55 }}>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="note" style={{ marginTop: 12, fontSize: 11 }}>
                  Источник: {reference.regulation}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
