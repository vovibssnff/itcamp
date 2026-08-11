import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router'
import { message, Select, InputNumber, Tooltip } from 'antd'
import {
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  CopyOutlined,
  RobotOutlined,
  SaveOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons'
import type {
  Scenario,
  ScenarioFaultEntry,
  ReferenceActionEntry,
  ScenarioCriteria,
  FaultCatalogItem,
} from '@/types'
import {
  DataTable,
  Pill,
  Modal,
  Field,
  TextArea,
  Seg,
  SectionLabel,
  ListPagination,
} from '@/components/ui'
import { JsonImportButton } from '@/components/ui/JsonImportButton'
import { useAutoSave } from '@/hooks/useAutoSave'
import { scenariosApi } from '@/api/scenarios'
import { summarizeImport } from '@/api/import'
import { templatesApi } from '@/api/templates'
import { snapshotsApi } from '@/api/snapshots'
import { ensureAccessToken } from '@/api/client'
import { isMockApi } from '@/utils/env'

// ─── List View ────────────────────────────────────────────────────────────────

const SCENARIO_PAGE_SIZE = 20

function ScenarioList({ onEdit }: { onEdit: (id: string) => void }) {
  const navigate = useNavigate()
  const mock = isMockApi()
  const [scenarios, setScenarios] = useState<
    Omit<Scenario, 'faults' | 'reference_actions' | 'criteria'>[]
  >([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [filterType, setFilterType] = useState('')
  const [q, setQ] = useState('')
  const [aiModal, setAiModal] = useState(false)
  const [aiDesc, setAiDesc] = useState('')
  const [aiTemplateId, setAiTemplateId] = useState('tmpl-elou-avt')

  const fetch_ = useCallback(async () => {
    setLoading(true)
    try {
      const query: Record<string, string> = {}
      if (filterType) query.type = filterType
      if (q) query.q = q
      const data = (await scenariosApi.list(query)) as typeof scenarios
      setScenarios(data)
      setPage(1)
    } catch {
      void message.error('Ошибка загрузки сценариев')
    } finally {
      setLoading(false)
    }
  }, [filterType, q])

  useEffect(() => {
    void fetch_()
  }, [fetch_])

  const pagedScenarios = useMemo(() => {
    const start = (page - 1) * SCENARIO_PAGE_SIZE
    return scenarios.slice(start, start + SCENARIO_PAGE_SIZE)
  }, [scenarios, page])

  async function doDelete(id: string) {
    await scenariosApi.remove(id)
    void fetch_()
    void message.success('Сценарий удалён')
  }

  async function doClone(id: string) {
    await scenariosApi.clone(id, {})
    void fetch_()
    void message.success('Сценарий скопирован')
  }

  async function doAiGenerate() {
    if (!aiTemplateId) return
    const sc = (await scenariosApi.aiGenerate({
      template_id: aiTemplateId,
      description: aiDesc,
    })) as Scenario
    setAiModal(false)
    setAiDesc('')
    void fetch_()
    void message.success(`ИИ-сценарий создан: ${sc.name}`)
  }

  return (
    <div className="wrap">
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          marginBottom: 24,
        }}
        className="rise"
      >
        <div>
          <div className="sec">Инструктор</div>
          <h1 className="h1" style={{ marginTop: 12 }}>
            Сценарии
          </h1>
          <p className="note" style={{ marginTop: 12 }}>
            Управление сценариями обучения и аттестации
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <JsonImportButton
            label="Импорт неисправностей"
            onImport={async (data) => {
              const result = await scenariosApi.importFaults(data as { faults: unknown[] })
              void message.success(`Неисправности: ${summarizeImport(result)}`)
              if (result.errors?.length) {
                void message.warning(result.errors.map((e) => e.message).join('; '))
              }
            }}
          />
          <JsonImportButton
            label="Импорт сценариев"
            onImport={async (data) => {
              const result = await scenariosApi.importScenarios(data as { scenarios: unknown[] })
              void message.success(`Сценарии: ${summarizeImport(result)}`)
              if (result.errors?.length) {
                void message.warning(result.errors.map((e) => e.message).join('; '))
              }
              await fetch_()
            }}
          />
          {mock && (
            <Tooltip title="Сгенерировать черновик с помощью ИИ">
              <button className="btn btn-ghost" onClick={() => setAiModal(true)}>
                <RobotOutlined /> ИИ-черновик
              </button>
            </Tooltip>
          )}
          <button className="btn btn-acc" onClick={() => void navigate('/scenarios/new')}>
            <PlusOutlined /> Новый сценарий
          </button>
        </div>
      </div>

      {/* Filters */}
      <div
        style={{
          display: 'flex',
          gap: 10,
          marginBottom: 16,
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <input
          className="fld-box"
          placeholder="Поиск..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ width: 220 }}
        />
        <Seg
          options={[
            { value: '', label: 'Все' },
            { value: 'training', label: 'Тренировка' },
            { value: 'exam', label: 'Экзамен' },
          ]}
          value={filterType}
          onChange={setFilterType}
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="loading-spinner" />
      ) : (
        <div className="rise d2">
          <DataTable
            columns={[
              { key: 'name', title: 'Название', width: '2fr' },
              {
                key: 'type',
                title: 'Тип',
                width: '100px',
                render: (row) => (
                  <Pill variant={row.type === 'exam' ? 'alarm' : 'acc'}>
                    {row.type === 'exam' ? 'Экзамен' : 'Тренировка'}
                  </Pill>
                ),
              },
              {
                key: 'updated_at',
                title: 'Обновлён',
                width: '110px',
                render: (row) => (
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--tx3)' }}>
                    {new Date(row.updated_at).toLocaleDateString('ru-RU')}
                  </span>
                ),
              },
              {
                key: 'actions',
                title: '',
                width: '200px',
                render: (row) => (
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => onEdit(row.id)}>
                      <EditOutlined />
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => void doClone(row.id)}>
                      <CopyOutlined />
                    </button>
                    <button className="btn btn-danger btn-sm" onClick={() => void doDelete(row.id)}>
                      <DeleteOutlined />
                    </button>
                  </div>
                ),
              },
            ]}
            rows={pagedScenarios}
            rowKey={(row) => row.id}
          />
          {scenarios.length > SCENARIO_PAGE_SIZE && (
            <div style={{ marginTop: 16 }}>
              <ListPagination
                current={page}
                total={scenarios.length}
                pageSize={SCENARIO_PAGE_SIZE}
                onChange={setPage}
              />
            </div>
          )}
        </div>
      )}

      {/* AI generate modal */}
      <Modal
        open={aiModal}
        onClose={() => setAiModal(false)}
        title="Генерация черновика с помощью ИИ"
        width={500}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setAiModal(false)}>
              Отмена
            </button>
            <button className="btn btn-acc" onClick={() => void doAiGenerate()}>
              <RobotOutlined /> Сгенерировать
            </button>
          </>
        }
      >
        <Field
          label="Шаблон установки"
          value={aiTemplateId}
          onChange={(e) => setAiTemplateId(e.target.value)}
          placeholder="tmpl-elou-avt"
        />
        <TextArea
          label="Описание задачи (необязательно)"
          value={aiDesc}
          onChange={(e) => setAiDesc(e.target.value)}
          placeholder="Опишите учебную ситуацию..."
          rows={3}
        />
        <div className="box-mute note" style={{ marginTop: 12 }}>
          ИИ создаст черновик с неисправностями и эталонными действиями на основе шаблона. Результат
          требует проверки перед публикацией.
        </div>
      </Modal>
    </div>
  )
}

// ─── Scenario Editor ──────────────────────────────────────────────────────────

function ScenarioEditor({ id }: { id: string }) {
  const navigate = useNavigate()
  const [scenario, setScenario] = useState<Scenario | null>(null)
  const [loading, setLoading] = useState(true)
  const [dirty, setDirty] = useState(false)
  const [activeTab, setActiveTab] = useState('meta')
  const [faultCatalog, setFaultCatalog] = useState<FaultCatalogItem[]>([])
  const [faultModal, setFaultModal] = useState(false)
  const [editFault, setEditFault] = useState<Partial<ScenarioFaultEntry> | null>(null)
  const [actionModal, setActionModal] = useState(false)
  const [editAction, setEditAction] = useState<Partial<ReferenceActionEntry> | null>(null)
  const [templates, setTemplates] = useState<{ id: string; name: string }[]>([])
  const [presets, setPresets] = useState<{ id: string; label: string }[]>([])
  const [templateNodes, setTemplateNodes] = useState<
    { id: string; label: string; typeId: string }[]
  >([])

  const isNew = id === 'new'

  useEffect(() => {
    void (async () => {
      if (isNew) {
        const now = new Date().toISOString()
        setScenario({
          id: '',
          name: '',
          description: '',
          template_id: 'tmpl-elou-avt',
          type: 'training',
          author_id: 'user-instructor',
          faults: [],
          reference_actions: [],
          criteria: {
            max_score: 100,
            penalty_late: 0.5,
            penalty_miss: 10,
            penalty_forbidden: 5,
            critical_actions: [],
            pass_threshold: 60,
          },
          created_at: now,
          updated_at: now,
        })
        setLoading(false)
      } else {
        setLoading(true)
        const data = (await scenariosApi.get(id!)) as Scenario
        setScenario({
          ...data,
          faults: data.faults ?? [],
          reference_actions: data.reference_actions ?? [],
          criteria: data.criteria ?? {
            max_score: 100,
            penalty_late: 0.5,
            penalty_miss: 10,
            penalty_forbidden: 5,
            critical_actions: [],
            pass_threshold: 60,
          },
          created_at: data.created_at || data.updated_at || new Date().toISOString(),
          updated_at: data.updated_at || data.created_at || new Date().toISOString(),
        })
        setLoading(false)
      }
    })()

    void scenariosApi.listFaults().then((d) => setFaultCatalog(d as FaultCatalogItem[]))

    void templatesApi.list().then((d) => setTemplates(d.map((t) => ({ id: t.id, name: t.name }))))

    void snapshotsApi.list().then((d) => setPresets(d.map((s) => ({ id: s.id, label: s.name }))))
  }, [id, isNew])

  // Load the bound template's node instances so faults can target concrete nodes (FR-FLT-01)
  const boundTemplateId = scenario?.template_id
  useEffect(() => {
    if (!boundTemplateId) {
      setTemplateNodes([])
      return
    }
    void templatesApi
      .get(boundTemplateId)
      .then((tmpl) => {
        setTemplateNodes(tmpl.nodes.map((n) => ({ id: n.id, label: n.label, typeId: n.typeId })))
      })
      .catch(() => setTemplateNodes([]))
  }, [boundTemplateId])

  const [faultDetailId, setFaultDetailId] = useState<string | null>(null)
  const [faultDetail, setFaultDetail] = useState<FaultCatalogItem | null>(null)
  const [faultDetailLoading, setFaultDetailLoading] = useState(false)

  async function showFaultDetail(faultId: string) {
    if (faultDetailId === faultId) {
      setFaultDetailId(null)
      return
    }
    setFaultDetailId(faultId)
    setFaultDetailLoading(true)
    try {
      const token = await ensureAccessToken()
      const raw = await fetch(`/api/v1/faults/${encodeURIComponent(faultId)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!raw.ok) throw new Error()
      setFaultDetail((await raw.json()) as FaultCatalogItem)
    } catch {
      const catalogItem = faultCatalog.find((f) => f.fault_id === faultId) ?? null
      setFaultDetail(catalogItem)
    } finally {
      setFaultDetailLoading(false)
    }
  }

  function patch(p: Partial<Scenario>) {
    setScenario((prev) => (prev ? { ...prev, ...p } : prev))
    setDirty(true)
  }

  const save = useCallback(async () => {
    if (!scenario) return
    if (isNew) {
      const created = (await scenariosApi.create(scenario)) as Scenario
      void message.success('Сценарий создан')
      setDirty(false)
      void navigate(`/scenarios/${created.id}`)
    } else {
      await scenariosApi.update(scenario.id, scenario)
      void message.success('Сохранено')
      setDirty(false)
    }
  }, [scenario, isNew, navigate])

  useAutoSave(dirty && !isNew, save, 30000)

  function addFault() {
    setEditFault({
      id: `sf-${Date.now()}`,
      fault_id: faultCatalog[0]?.fault_id ?? '',
      component_instance_id: '',
      params: { severity_pct: 80, ramp_seconds: 0 },
      trigger: { type: 'time', at_model_time: 60 },
      hidden: false,
    })
    setFaultModal(true)
  }

  function saveFault() {
    if (!scenario || !editFault?.fault_id) return
    const full = editFault as ScenarioFaultEntry
    const existing = scenario.faults.findIndex((f) => f.id === full.id)
    if (existing >= 0) {
      const updated = [...scenario.faults]
      updated[existing] = full
      patch({ faults: updated })
    } else {
      patch({ faults: [...scenario.faults, full] })
    }
    setFaultModal(false)
  }

  function removeFault(fid: string) {
    if (!scenario) return
    patch({ faults: scenario.faults.filter((f) => f.id !== fid) })
  }

  function addAction() {
    const nextStep = (scenario?.reference_actions.length ?? 0) + 1
    setEditAction({
      step: nextStep,
      description: '',
      expected: { target: '', action: 'set' },
      deadline_seconds: 60,
      mandatory: true,
    })
    setActionModal(true)
  }

  function saveAction() {
    if (!scenario || !editAction?.description) return
    const full = editAction as ReferenceActionEntry
    const existing = scenario.reference_actions.findIndex((a) => a.step === full.step)
    if (existing >= 0) {
      const updated = [...scenario.reference_actions]
      updated[existing] = full
      patch({ reference_actions: updated })
    } else {
      patch({
        reference_actions: [...scenario.reference_actions, full].sort((a, b) => a.step - b.step),
      })
    }
    setActionModal(false)
  }

  function removeAction(step: number) {
    if (!scenario) return
    patch({ reference_actions: scenario.reference_actions.filter((a) => a.step !== step) })
  }

  if (loading || !scenario) return <div className="loading-spinner" />

  const faultCatalogOptions = faultCatalog.map((f) => ({ value: f.fault_id, label: f.name }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 22px',
          borderBottom: '1px solid var(--ln)',
          background: 'var(--srf)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--tx2)' }}>
            {isNew ? 'Новый сценарий' : scenario.name || 'Без названия'}
          </span>
          {dirty && (
            <span style={{ fontSize: 10, color: 'var(--warn)', fontFamily: 'var(--mono)' }}>
              ● несохранено
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-acc btn-sm" onClick={() => void save()}>
            <SaveOutlined /> Сохранить
          </button>
        </div>
      </div>

      {/* Tab body */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <div
          style={{
            borderBottom: '1px solid var(--ln)',
            padding: '0 22px',
            background: 'var(--srf)',
          }}
        >
          <div className="tabs" style={{ borderBottom: 'none' }}>
            {[
              { key: 'meta', label: 'Параметры' },
              { key: 'faults', label: `Неисправности (${scenario.faults.length})` },
              {
                key: 'actions',
                label: `Эталонные действия (${scenario.reference_actions.length})`,
              },
              { key: 'criteria', label: 'Критерии оценки' },
              { key: 'overview', label: 'Обзор' },
            ].map((t) => (
              <div
                key={t.key}
                className={`tab ${activeTab === t.key ? 'active' : ''}`}
                onClick={() => setActiveTab(t.key)}
              >
                {t.label}
              </div>
            ))}
          </div>
        </div>

        <div style={{ padding: '24px 22px' }}>
          {/* ─── Meta ─── */}
          {activeTab === 'meta' && (
            <div style={{ maxWidth: 600 }}>
              <Field
                label="Название"
                value={scenario.name}
                onChange={(e) => patch({ name: e.target.value })}
                placeholder="Введите название сценария"
              />
              <TextArea
                label="Описание"
                value={scenario.description}
                onChange={(e) => patch({ description: e.target.value })}
                placeholder="Краткое описание учебной задачи"
                rows={3}
              />
              <div style={{ marginBottom: 18 }}>
                <label className="fld-lbl">Тип</label>
                <Seg
                  options={[
                    { value: 'training', label: 'Тренировка' },
                    { value: 'exam', label: 'Экзамен' },
                  ]}
                  value={scenario.type}
                  onChange={(v) => patch({ type: v as 'training' | 'exam' })}
                />
              </div>
              <div className="fld-group" style={{ marginBottom: 18 }}>
                <label className="fld-lbl">Шаблон установки</label>
                <Select
                  value={scenario.template_id || undefined}
                  options={templates.map((t) => ({ value: t.id, label: t.name }))}
                  onChange={(v) => patch({ template_id: v })}
                  placeholder="Выберите шаблон"
                  showSearch
                  optionFilterProp="label"
                  style={{ width: '100%' }}
                />
              </div>
              <div className="fld-group" style={{ marginBottom: 18 }}>
                <label className="fld-lbl">Начальный пресет (необязательно)</label>
                <Select
                  value={scenario.start_preset_id ?? undefined}
                  options={presets.map((p) => ({ value: p.id, label: p.label }))}
                  onChange={(v) => patch({ start_preset_id: v || undefined })}
                  placeholder="Не задан"
                  allowClear
                  style={{ width: '100%' }}
                />
              </div>
            </div>
          )}

          {/* ─── Faults ─── */}
          {activeTab === 'faults' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
                <button className="btn btn-ghost" onClick={addFault}>
                  <PlusOutlined /> Добавить неисправность
                </button>
              </div>

              {scenario.faults.length === 0 ? (
                <div className="box-mute" style={{ textAlign: 'center', padding: '28px 20px' }}>
                  <div className="sec" style={{ marginBottom: 8 }}>
                    Нет неисправностей
                  </div>
                  <p className="note">Добавьте неисправность для создания нештатной ситуации</p>
                </div>
              ) : (
                <DataTable
                  columns={[
                    {
                      key: 'fault_id',
                      title: 'Неисправность',
                      width: '2fr',
                      render: (row) => (
                        <span>
                          {faultCatalog.find((f) => f.fault_id === row.fault_id)?.name ??
                            row.fault_id}
                        </span>
                      ),
                    },
                    {
                      key: 'component_instance_id',
                      title: 'Узел',
                      width: '120px',
                      render: (row) => (
                        <span style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>
                          {row.component_instance_id}
                        </span>
                      ),
                    },
                    {
                      key: 'params',
                      title: 'Тяжесть',
                      width: '80px',
                      render: (row) => (
                        <span style={{ fontFamily: 'var(--mono)' }}>
                          {row.params.severity_pct}%
                        </span>
                      ),
                    },
                    {
                      key: 'trigger',
                      title: 'Триггер',
                      width: '160px',
                      render: (row) =>
                        row.trigger.type === 'time'
                          ? `t=${row.trigger.at_model_time}с`
                          : `${row.trigger.condition?.tag} ${row.trigger.condition?.op} ${row.trigger.condition?.value}`,
                    },
                    {
                      key: 'hidden',
                      title: 'Скрыта',
                      width: '70px',
                      render: (row) => (row.hidden ? <Pill variant="warn">Да</Pill> : ''),
                    },
                    {
                      key: 'actions',
                      title: '',
                      width: '80px',
                      render: (row) => (
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button
                            className="btn btn-ghost btn-sm"
                            title="Подробности"
                            onClick={() => void showFaultDetail(row.fault_id)}
                          >
                            <InfoCircleOutlined />
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => {
                              setEditFault(row)
                              setFaultModal(true)
                            }}
                          >
                            <EditOutlined />
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => removeFault(row.id)}
                          >
                            <DeleteOutlined />
                          </button>
                        </div>
                      ),
                    },
                  ]}
                  rows={scenario.faults}
                  rowKey={(row) => row.id}
                />
              )}
            </div>
          )}

          {/* ─── Reference Actions ─── */}
          {activeTab === 'actions' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
                <button className="btn btn-ghost" onClick={addAction}>
                  <PlusOutlined /> Добавить шаг
                </button>
              </div>

              {scenario.reference_actions.length === 0 ? (
                <div className="box-mute" style={{ textAlign: 'center', padding: '28px 20px' }}>
                  <div className="sec" style={{ marginBottom: 8 }}>
                    Нет эталонных действий
                  </div>
                  <p className="note">
                    Добавьте действия оператора в правильной последовательности
                  </p>
                </div>
              ) : (
                <DataTable
                  columns={[
                    {
                      key: 'step',
                      title: '№',
                      width: '50px',
                      render: (row) => (
                        <span style={{ fontFamily: 'var(--mono)', color: 'var(--tx3)' }}>
                          {String(row.step).padStart(2, '0')}
                        </span>
                      ),
                    },
                    { key: 'description', title: 'Описание', width: '3fr' },
                    {
                      key: 'expected',
                      title: 'Цель',
                      width: '160px',
                      render: (row) => (
                        <span style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>
                          {row.expected.target} · {row.expected.action}
                          {row.expected.value !== undefined && ` → ${row.expected.value}`}
                        </span>
                      ),
                    },
                    {
                      key: 'deadline_seconds',
                      title: 'Срок, с',
                      width: '80px',
                      render: (row) => (
                        <span style={{ fontFamily: 'var(--mono)' }}>{row.deadline_seconds}</span>
                      ),
                    },
                    {
                      key: 'mandatory',
                      title: 'Крит.',
                      width: '60px',
                      render: (row) => (row.mandatory ? <Pill variant="alarm">Да</Pill> : ''),
                    },
                    {
                      key: 'actions',
                      title: '',
                      width: '80px',
                      render: (row) => (
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => {
                              setEditAction(row)
                              setActionModal(true)
                            }}
                          >
                            <EditOutlined />
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => removeAction(row.step)}
                          >
                            <DeleteOutlined />
                          </button>
                        </div>
                      ),
                    },
                  ]}
                  rows={scenario.reference_actions}
                  rowKey={(row) => String(row.step)}
                />
              )}
            </div>
          )}

          {/* ─── Criteria ─── */}
          {activeTab === 'criteria' && (
            <div style={{ maxWidth: 560 }}>
              <SectionLabel style={{ marginBottom: 16 }}>Параметры оценки</SectionLabel>
              <CriteriaEditor
                criteria={scenario.criteria}
                onChange={(c) => patch({ criteria: c })}
              />
            </div>
          )}

          {/* ─── Fault detail panel ─── */}
          {faultDetailId && (
            <div
              className="box-mute rise"
              style={{
                margin: '16px 0',
                padding: '16px 18px',
                borderLeft: '3px solid var(--warn)',
                maxWidth: 600,
              }}
            >
              {faultDetailLoading ? (
                <div className="loading-spinner" />
              ) : faultDetail ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <strong style={{ fontSize: 14 }}>{faultDetail.name}</strong>
                    <Pill
                      variant={
                        faultDetail.severity === 'critical'
                          ? 'alarm'
                          : faultDetail.severity === 'high'
                            ? 'alarm'
                            : faultDetail.severity === 'medium'
                              ? 'warn'
                              : 'default'
                      }
                    >
                      {faultDetail.severity}
                    </Pill>
                  </div>
                  <p className="note" style={{ marginBottom: 8 }}>
                    {faultDetail.description}
                  </p>
                  <div style={{ display: 'flex', gap: 24, fontSize: 12, color: 'var(--tx2)' }}>
                    <span>
                      Ущерб:{' '}
                      <strong style={{ fontFamily: 'var(--mono)' }}>
                        {faultDetail.damage_per_sec}/с
                      </strong>
                    </span>
                    <span>Теги: {faultDetail.affected_tags.join(', ') || '—'}</span>
                  </div>
                  {faultDetail.applicable_component_types.length > 0 && (
                    <div style={{ marginTop: 6, fontSize: 12, color: 'var(--tx2)' }}>
                      Типы компонентов: {faultDetail.applicable_component_types.join(', ')}
                    </div>
                  )}
                </>
              ) : (
                <div className="note">Не удалось загрузить данные неисправности</div>
              )}
            </div>
          )}

          {/* ─── Overview ─── */}
          {activeTab === 'overview' && (
            <div>
              {/* Criteria summary */}
              <div
                className="box-mute rise"
                style={{ marginBottom: 20, padding: '16px 18px', maxWidth: 700 }}
              >
                <SectionLabel style={{ marginBottom: 10 }}>Критерии оценки</SectionLabel>
                <div
                  style={{
                    display: 'flex',
                    gap: 24,
                    flexWrap: 'wrap',
                    fontSize: 13,
                    color: 'var(--tx2)',
                  }}
                >
                  <span>
                    Макс. балл:{' '}
                    <strong style={{ color: 'var(--tx1)' }}>{scenario.criteria.max_score}</strong>
                  </span>
                  <span>
                    Порог:{' '}
                    <strong style={{ color: 'var(--tx1)' }}>
                      {scenario.criteria.pass_threshold}%
                    </strong>
                  </span>
                  <span>Пропуск: −{scenario.criteria.penalty_miss}</span>
                  <span>Опоздание: −{scenario.criteria.penalty_late}/с</span>
                  <span>Запрещ. действие: −{scenario.criteria.penalty_forbidden}</span>
                </div>
              </div>

              {/* Trigger timeline */}
              <SectionLabel style={{ marginBottom: 12 }}>
                Неисправности ({scenario.faults.length}) — хронология
              </SectionLabel>
              {scenario.faults.length === 0 ? (
                <div className="box-mute note" style={{ padding: '14px 16px', marginBottom: 20 }}>
                  Нет неисправностей
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                  {[...scenario.faults]
                    .sort((a, b) => {
                      const ta = a.trigger.type === 'time' ? (a.trigger.at_model_time ?? 0) : 9999
                      const tb = b.trigger.type === 'time' ? (b.trigger.at_model_time ?? 0) : 9999
                      return ta - tb
                    })
                    .map((f) => {
                      const catalogEntry = faultCatalog.find((c) => c.fault_id === f.fault_id)
                      return (
                        <div
                          key={f.id}
                          className="box-mute"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            padding: '10px 14px',
                            borderLeft: f.hidden ? '3px solid var(--tx3)' : '3px solid var(--warn)',
                          }}
                        >
                          <span
                            style={{
                              fontFamily: 'var(--mono)',
                              fontSize: 11,
                              color: 'var(--tx3)',
                              minWidth: 70,
                            }}
                          >
                            {f.trigger.type === 'time'
                              ? `t=${f.trigger.at_model_time ?? 0}с`
                              : `${f.trigger.condition?.tag ?? '?'} ${f.trigger.condition?.op ?? ''} ${f.trigger.condition?.value ?? ''}`}
                          </span>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 500, fontSize: 13 }}>
                              {catalogEntry?.name ?? f.fault_id}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--tx3)' }}>
                              узел: {f.component_instance_id || '—'} · тяжесть:{' '}
                              {f.params.severity_pct}%
                            </div>
                          </div>
                          {f.hidden && (
                            <Pill variant="default" style={{ fontSize: 10 }}>
                              скрытая
                            </Pill>
                          )}
                        </div>
                      )
                    })}
                </div>
              )}

              {/* Reference actions */}
              <SectionLabel style={{ marginBottom: 12 }}>
                Эталонные действия ({scenario.reference_actions.length})
              </SectionLabel>
              {scenario.reference_actions.length === 0 ? (
                <div className="box-mute note" style={{ padding: '14px 16px' }}>
                  Нет эталонных действий
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {[...scenario.reference_actions]
                    .sort((a, b) => a.step - b.step)
                    .map((a) => (
                      <div
                        key={a.step}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 12,
                          padding: '8px 14px',
                          borderLeft: a.mandatory
                            ? '3px solid var(--alarm)'
                            : '3px solid var(--ln)',
                          background: 'var(--srf2)',
                          borderRadius: 4,
                        }}
                      >
                        <span
                          style={{
                            fontFamily: 'var(--mono)',
                            fontSize: 11,
                            color: 'var(--tx3)',
                            minWidth: 28,
                          }}
                        >
                          {String(a.step).padStart(2, '0')}
                        </span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13 }}>{a.description}</div>
                          <div style={{ fontSize: 11, color: 'var(--tx3)', marginTop: 2 }}>
                            {a.expected.target} · {a.expected.action}
                            {a.expected.value !== undefined && ` → ${a.expected.value}`} · срок:{' '}
                            {a.deadline_seconds}с
                          </div>
                        </div>
                        {a.mandatory && <Pill variant="alarm">крит.</Pill>}
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Fault edit modal ── */}
      <Modal
        open={faultModal}
        onClose={() => setFaultModal(false)}
        title="Неисправность"
        width={560}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setFaultModal(false)}>
              Отмена
            </button>
            <button className="btn btn-acc" onClick={saveFault}>
              Сохранить
            </button>
          </>
        }
      >
        {editFault && (
          <div>
            <div className="fld-group">
              <label className="fld-lbl">Тип неисправности</label>
              <Select
                value={editFault.fault_id}
                options={faultCatalogOptions}
                onChange={(v) => setEditFault((p) => (p ? { ...p, fault_id: v } : p))}
                style={{ width: '100%' }}
              />
            </div>
            <div className="fld-group">
              <label className="fld-lbl">Экземпляр компонента</label>
              <Select
                value={editFault.component_instance_id || undefined}
                options={templateNodes.map((n) => ({
                  value: n.id,
                  label: `${n.label} (${n.id})`,
                }))}
                onChange={(v) => setEditFault((p) => (p ? { ...p, component_instance_id: v } : p))}
                placeholder="Выберите узел установки"
                showSearch
                optionFilterProp="label"
                notFoundContent={
                  templateNodes.length === 0 ? 'Шаблон не содержит узлов' : undefined
                }
                style={{ width: '100%' }}
              />
            </div>
            <div
              style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 18 }}
            >
              <div className="fld-group">
                <label className="fld-lbl">Тяжесть %</label>
                <InputNumber
                  min={0}
                  max={100}
                  value={editFault.params?.severity_pct}
                  onChange={(v) =>
                    setEditFault((p) =>
                      p ? { ...p, params: { ...p.params!, severity_pct: v ?? 80 } } : p,
                    )
                  }
                  style={{ width: '100%' }}
                />
              </div>
              <div className="fld-group">
                <label className="fld-lbl">Нарастание, с</label>
                <InputNumber
                  min={0}
                  value={editFault.params?.ramp_seconds}
                  onChange={(v) =>
                    setEditFault((p) =>
                      p ? { ...p, params: { ...p.params!, ramp_seconds: v ?? 0 } } : p,
                    )
                  }
                  style={{ width: '100%' }}
                />
              </div>
            </div>

            <div className="fld-group">
              <label className="fld-lbl">Тип триггера</label>
              <Seg
                options={[
                  { value: 'time', label: 'По времени' },
                  { value: 'condition', label: 'По условию' },
                ]}
                value={editFault.trigger?.type ?? 'time'}
                onChange={(v) =>
                  setEditFault((p) =>
                    p ? { ...p, trigger: { ...p.trigger!, type: v as 'time' | 'condition' } } : p,
                  )
                }
              />
            </div>

            {editFault.trigger?.type === 'time' && (
              <div className="fld-group">
                <label className="fld-lbl">Время модели, с</label>
                <InputNumber
                  min={0}
                  value={editFault.trigger.at_model_time}
                  onChange={(v) =>
                    setEditFault((p) =>
                      p ? { ...p, trigger: { ...p.trigger!, at_model_time: v ?? 60 } } : p,
                    )
                  }
                  style={{ width: '100%' }}
                />
              </div>
            )}

            {editFault.trigger?.type === 'condition' && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 80px 80px',
                  gap: 10,
                  marginBottom: 12,
                }}
              >
                <div className="fld-group">
                  <label className="fld-lbl">Тег</label>
                  <input
                    className="fld-box"
                    value={editFault.trigger.condition?.tag ?? ''}
                    onChange={(e) =>
                      setEditFault((p) =>
                        p
                          ? {
                              ...p,
                              trigger: {
                                ...p.trigger!,
                                condition: { ...p.trigger!.condition!, tag: e.target.value },
                              },
                            }
                          : p,
                      )
                    }
                    style={{ width: '100%' }}
                  />
                </div>
                <div className="fld-group">
                  <label className="fld-lbl">Оп.</label>
                  <Select
                    size="small"
                    value={editFault.trigger.condition?.op ?? '>'}
                    options={['>', '<', '>=', '<=', '==', '!='].map((o) => ({
                      value: o,
                      label: o,
                    }))}
                    onChange={(v) =>
                      setEditFault((p) =>
                        p
                          ? {
                              ...p,
                              trigger: {
                                ...p.trigger!,
                                condition: { ...p.trigger!.condition!, op: v as '>' },
                              },
                            }
                          : p,
                      )
                    }
                    style={{ width: '100%' }}
                  />
                </div>
                <div className="fld-group">
                  <label className="fld-lbl">Значение</label>
                  <InputNumber
                    value={editFault.trigger.condition?.value}
                    onChange={(v) =>
                      setEditFault((p) =>
                        p
                          ? {
                              ...p,
                              trigger: {
                                ...p.trigger!,
                                condition: { ...p.trigger!.condition!, value: v ?? 0 },
                              },
                            }
                          : p,
                      )
                    }
                    style={{ width: '100%' }}
                  />
                </div>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input
                type="checkbox"
                id="fault-hidden"
                checked={editFault.hidden ?? false}
                onChange={(e) => setEditFault((p) => (p ? { ...p, hidden: e.target.checked } : p))}
              />
              <label htmlFor="fault-hidden" className="fld-lbl" style={{ margin: 0 }}>
                Скрытая неисправность (не отображается оператору)
              </label>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Action edit modal ── */}
      <Modal
        open={actionModal}
        onClose={() => setActionModal(false)}
        title="Эталонное действие"
        width={520}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setActionModal(false)}>
              Отмена
            </button>
            <button className="btn btn-acc" onClick={saveAction}>
              Сохранить
            </button>
          </>
        }
      >
        {editAction && (
          <div>
            <div
              style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: 12, marginBottom: 0 }}
            >
              <div className="fld-group">
                <label className="fld-lbl">Шаг №</label>
                <InputNumber
                  min={1}
                  value={editAction.step}
                  onChange={(v) => setEditAction((p) => (p ? { ...p, step: v ?? 1 } : p))}
                  style={{ width: '100%' }}
                />
              </div>
              <div />
            </div>
            <TextArea
              label="Описание"
              value={editAction.description ?? ''}
              onChange={(e) =>
                setEditAction((p) => (p ? { ...p, description: e.target.value } : p))
              }
              rows={2}
            />
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '2fr 1fr 100px',
                gap: 12,
                marginBottom: 12,
              }}
            >
              <Field
                label="Цель (тег/узел)"
                value={editAction.expected?.target ?? ''}
                onChange={(e) =>
                  setEditAction((p) =>
                    p ? { ...p, expected: { ...p.expected!, target: e.target.value } } : p,
                  )
                }
                placeholder="FV 101"
              />
              <Field
                label="Действие"
                value={editAction.expected?.action ?? 'set'}
                onChange={(e) =>
                  setEditAction((p) =>
                    p ? { ...p, expected: { ...p.expected!, action: e.target.value } } : p,
                  )
                }
                placeholder="set"
              />
              <div className="fld-group">
                <label className="fld-lbl">Значение</label>
                <InputNumber
                  value={editAction.expected?.value}
                  onChange={(v) =>
                    setEditAction((p) =>
                      p ? { ...p, expected: { ...p.expected!, value: v ?? undefined } } : p,
                    )
                  }
                  style={{ width: '100%' }}
                />
              </div>
            </div>
            <div
              style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}
            >
              <div className="fld-group">
                <label className="fld-lbl">Срок выполнения, с</label>
                <InputNumber
                  min={0}
                  value={editAction.deadline_seconds}
                  onChange={(v) =>
                    setEditAction((p) => (p ? { ...p, deadline_seconds: v ?? 60 } : p))
                  }
                  style={{ width: '100%' }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input
                type="checkbox"
                id="action-mandatory"
                checked={editAction.mandatory ?? false}
                onChange={(e) =>
                  setEditAction((p) => (p ? { ...p, mandatory: e.target.checked } : p))
                }
              />
              <label htmlFor="action-mandatory" className="fld-lbl" style={{ margin: 0 }}>
                Обязательное действие (ошибка = критический сбой)
              </label>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

// ─── Criteria Editor ──────────────────────────────────────────────────────────

function CriteriaEditor({
  criteria,
  onChange,
}: {
  criteria: ScenarioCriteria
  onChange: (c: ScenarioCriteria) => void
}) {
  function p(patch: Partial<ScenarioCriteria>) {
    onChange({ ...criteria, ...patch })
  }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        <div className="fld-group">
          <label className="fld-lbl">Максимальный балл</label>
          <InputNumber
            min={0}
            value={criteria.max_score}
            onChange={(v) => p({ max_score: v ?? 100 })}
            style={{ width: '100%' }}
          />
        </div>
        <div className="fld-group">
          <label className="fld-lbl">Порог зачёта %</label>
          <InputNumber
            min={0}
            max={100}
            value={criteria.pass_threshold}
            onChange={(v) => p({ pass_threshold: v ?? 60 })}
            style={{ width: '100%' }}
          />
        </div>
      </div>

      <SectionLabel style={{ marginBottom: 10 }}>Штрафы</SectionLabel>
      <div
        style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}
      >
        <div className="fld-group">
          <label className="fld-lbl">Опоздание (за с)</label>
          <InputNumber
            step={0.1}
            min={0}
            value={criteria.penalty_late}
            onChange={(v) => p({ penalty_late: v ?? 0.5 })}
            style={{ width: '100%' }}
          />
        </div>
        <div className="fld-group">
          <label className="fld-lbl">Пропуск</label>
          <InputNumber
            min={0}
            value={criteria.penalty_miss}
            onChange={(v) => p({ penalty_miss: v ?? 10 })}
            style={{ width: '100%' }}
          />
        </div>
        <div className="fld-group">
          <label className="fld-lbl">Запрещённое действие</label>
          <InputNumber
            min={0}
            value={criteria.penalty_forbidden}
            onChange={(v) => p({ penalty_forbidden: v ?? 5 })}
            style={{ width: '100%' }}
          />
        </div>
      </div>

      <div className="fld-group">
        <label className="fld-lbl">Критические шаги (через запятую)</label>
        <input
          className="fld-box"
          value={criteria.critical_actions.join(', ')}
          onChange={(e) =>
            p({
              critical_actions: e.target.value
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean),
            })
          }
          placeholder="1, 3, 5"
          style={{ width: '100%' }}
        />
      </div>
    </div>
  )
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function ScenarioEditorScreen() {
  const { id } = useParams<{ id?: string }>()
  const navigate = useNavigate()

  if (!id) {
    return <ScenarioList onEdit={(sid) => void navigate(`/scenarios/${sid}`)} />
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '8px 22px',
          borderBottom: '1px solid var(--ln)',
          background: 'var(--srf2)',
          flexShrink: 0,
        }}
      >
        <button className="btn btn-ghost btn-sm" onClick={() => void navigate('/scenarios')}>
          ← Список
        </button>
      </div>
      <ScenarioEditor id={id} />
    </div>
  )
}
