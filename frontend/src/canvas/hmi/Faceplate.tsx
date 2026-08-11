import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { CanvasNode } from '@/store/constructor'
import type { TagValue, RegulatorState } from '@/store/session'
import { lookupTelemetry, lookupRegulator, normalizeTagId } from '@/store/session'
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
  /** modal = overlay sheet (default); dock = inline right panel without scrim */
  variant?: 'modal' | 'dock'
}

export function Faceplate({
  node,
  componentTypes,
  open,
  onClose,
  telemetry,
  regulators,
  onSendCommand,
  variant = 'modal',
}: FaceplateProps) {
  const { t } = useTranslation()
  const [refOpen, setRefOpen] = useState(false)
  const [spDraft, setSpDraft] = useState<string>('')
  const [outDraft, setOutDraft] = useState<string>('')

  if (!open || !node) {
    if (variant === 'dock') {
      return (
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            color: 'var(--tx3)',
            fontSize: 13,
            textAlign: 'center',
            lineHeight: 1.5,
          }}
        >
          Выберите узел на мнемосхеме,
          <br />
          чтобы увидеть параметры и управление
        </div>
      )
    }
    return null
  }

  const shape = componentTypes.find((c) => c.id === node.typeId)?.shape
  const reference = getEquipmentReference(node.typeId, shape)

  const tagCandidates = [node.label, ...(node.tags ?? [])]
  let regulator: RegulatorState | undefined
  for (const c of tagCandidates) {
    regulator = lookupRegulator(regulators, c)
    if (regulator) break
  }

  const tagValues: TagValue[] = (node.tags ?? [])
    .map((tag) => lookupTelemetry(telemetry, tag))
    .filter((tv): tv is TagValue => Boolean(tv))

  if (tagValues.length === 0) {
    const byLabel = lookupTelemetry(telemetry, node.label)
    if (byLabel) tagValues.push(byLabel)
  }

  const regulatorTag = regulator?.tag ?? normalizeTagId(node.label) ?? node.label
  // Discrete equipment commands must use sim IDs (PUMP-N1), not labels (Н-1).
  const actuatorTag =
    (node.tags ?? []).find((t) => /^(PUMP|FAN|XV|ZV)[- ]/i.test(t)) ??
    (node.tags ?? [])[0] ??
    regulatorTag

  function commitSp() {
    const v = parseFloat(spDraft)
    if (!Number.isFinite(v)) return
    onSendCommand('regulator_sp', regulatorTag, v)
    setSpDraft('')
  }

  function commitOut() {
    const v = parseFloat(outDraft)
    if (!Number.isFinite(v)) return
    onSendCommand('regulator_out', regulatorTag, v)
    setOutDraft('')
  }

  const body = (
    <>
      <div
        className="sheet-hd"
        style={variant === 'dock' ? { borderBottom: '1px solid var(--ln)' } : undefined}
      >
        <div>
          <div className="sec">Узел установки</div>
          <div className="h2" style={{ marginTop: 5 }}>
            {node.label}
          </div>
        </div>
        <button className="x" onClick={onClose} aria-label="Закрыть">
          ×
        </button>
      </div>

      <div
        className="sheet-bd"
        style={variant === 'dock' ? { flex: 1, overflowY: 'auto' } : undefined}
      >
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
                flexDirection: 'column',
                gap: 10,
                paddingBottom: 16,
                borderBottom: '1px solid var(--ln2)',
              }}
            >
              <div
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <span style={{ fontSize: 13, color: 'var(--tx2)' }}>Режим:</span>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() =>
                    onSendCommand('regulator_mode', regulatorTag, regulator.mode === 'auto' ? 0 : 1)
                  }
                >
                  {regulator.mode === 'auto' ? t('faceplate.auto') : t('faceplate.manual')}
                </button>
              </div>

              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: 'var(--tx3)', width: 36 }}>SP</span>
                <input
                  className="mono"
                  value={spDraft}
                  placeholder={String(regulator.sp)}
                  onChange={(e) => setSpDraft(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && commitSp()}
                  style={{
                    flex: 1,
                    background: 'var(--bg2)',
                    border: '1px solid var(--ln2)',
                    borderRadius: 4,
                    padding: '4px 8px',
                    color: 'var(--tx)',
                    fontSize: 13,
                  }}
                />
                <button className="btn btn-ghost btn-sm" onClick={commitSp}>
                  Задать
                </button>
              </div>

              {regulator.mode === 'manual' && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: 'var(--tx3)', width: 36 }}>OUT</span>
                  <input
                    className="mono"
                    value={outDraft}
                    placeholder={String(regulator.out)}
                    onChange={(e) => setOutDraft(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && commitOut()}
                    style={{
                      flex: 1,
                      background: 'var(--bg2)',
                      border: '1px solid var(--ln2)',
                      borderRadius: 4,
                      padding: '4px 8px',
                      color: 'var(--tx)',
                      fontSize: 13,
                    }}
                  />
                  <button className="btn btn-ghost btn-sm" onClick={commitOut}>
                    Задать
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        {(shape === 'valve' || shape === 'pump' || shape === 'compressor') && (
          <div
            style={{
              display: 'flex',
              gap: 8,
              marginTop: regulator ? 12 : 0,
              marginBottom: 12,
            }}
          >
            {shape === 'valve' ? (
              <>
                <button
                  className="btn btn-acc btn-sm"
                  onClick={() => onSendCommand('actuator', actuatorTag, 100)}
                >
                  Открыть
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => onSendCommand('actuator', actuatorTag, 0)}
                >
                  Закрыть
                </button>
              </>
            ) : (
              <>
                <button
                  className="btn btn-acc btn-sm"
                  onClick={() => onSendCommand('actuator', actuatorTag, 1)}
                >
                  Пуск
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => onSendCommand('actuator', actuatorTag, 0)}
                >
                  Стоп
                </button>
              </>
            )}
          </div>
        )}

        {tagValues.length > 0 && (
          <div style={{ marginTop: regulator ? 16 : 0 }}>
            <div className="sec" style={{ marginBottom: 8 }}>
              Параметры
            </div>
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
                    {/^PUMP[- ]/i.test(tv.tag)
                      ? tv.value > 0.5
                        ? 'РАБ'
                        : 'СТОП'
                      : tv.value.toFixed(2)}
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

        {!regulator && tagValues.length === 0 && (
          <div className="note" style={{ marginBottom: 12 }}>
            Нет живых тегов для этого узла — показана справочная информация.
          </div>
        )}

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
                      <li key={i} style={{ fontSize: 12.5, lineHeight: 1.55, color: 'var(--tx2)' }}>
                        {rule}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {reference.failureConsequences.length > 0 && (
                <div className="box-alarm" style={{ marginTop: 14 }}>
                  <div className="sec" style={{ marginBottom: 6, color: 'inherit', opacity: 0.85 }}>
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
    </>
  )

  if (variant === 'dock') {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          minHeight: 0,
          background: 'var(--srf)',
        }}
      >
        {body}
      </div>
    )
  }

  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet" style={{ width: 420 }} onClick={(e) => e.stopPropagation()}>
        {body}
      </div>
    </div>
  )
}
