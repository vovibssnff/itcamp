import { useState, useMemo, useEffect, useCallback } from 'react'
import { Input, Tag, Tooltip, Form, Select, message, Modal as AntModal } from 'antd'
import { SearchOutlined, PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import { type ComponentType } from '@/mocks/fixtures/components'
import { componentsApi } from '@/api/components'
import { summarizeImport } from '@/api/import'
import { JsonImportButton } from '@/components/ui/JsonImportButton'
import { ListPagination } from '@/components/ui'
import {
  CATEGORY_LABELS,
  categoryColor,
  categoryLabel,
  distinctCategories,
  shapeIcon,
} from '@/utils/component-display'
import { tokens } from '@/theme/tokens'

const PAGE_SIZE = 12

const SHAPES = [
  'pump',
  'column',
  'vessel',
  'heatexchanger',
  'valve',
  'sensor',
  'controller',
  'separator',
  'compressor',
  'furnace',
] as const

const EMPTY_FORM: Omit<ComponentType, 'id'> = {
  name: '',
  category: 'common',
  description: '',
  shape: 'vessel',
  ports: [],
  parameters: [],
}

export default function ComponentLibraryScreen() {
  const [components, setComponents] = useState<ComponentType[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<string>('all')
  const [page, setPage] = useState(1)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [editing, setEditing] = useState<ComponentType | null>(null)
  const [form] = Form.useForm<Omit<ComponentType, 'id'> & { id?: string }>()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      // Full catalog (limit=500) so filter chips reflect distinct backend categories.
      setComponents(await componentsApi.list())
    } catch {
      void message.error('Ошибка загрузки компонентов')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const categoryTabs = useMemo(() => {
    const fromApi = distinctCategories(components)
    return [
      { id: 'all', label: 'Все', color: tokens.accent.cyan },
      ...fromApi.map((id) => ({
        id,
        label: categoryLabel(id),
        color: categoryColor(id),
      })),
    ]
  }, [components])

  const categoryOptions = useMemo(() => {
    const fromApi = distinctCategories(components)
    const known = Object.keys(CATEGORY_LABELS)
    const ids = [...new Set([...fromApi, ...known])]
    return distinctCategories(ids.map((id) => ({ category: id }))).map((id) => ({
      value: id,
      label: categoryLabel(id),
    }))
  }, [components])

  // Client-side filter on the loaded catalog (chips stay stable). list({ category, q }) is wired for API use.
  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return components.filter(
      (c) =>
        (category === 'all' || c.category === category) &&
        (!q ||
          c.name.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q) ||
          c.shape.toLowerCase().includes(q) ||
          c.id.toLowerCase().includes(q)),
    )
  }, [search, category, components])

  useEffect(() => {
    setPage(1)
  }, [search, category])

  useEffect(() => {
    if (category !== 'all' && !categoryTabs.some((t) => t.id === category)) {
      setCategory('all')
    }
  }, [category, categoryTabs])

  const paged = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return filtered.slice(start, start + PAGE_SIZE)
  }, [filtered, page])

  function openCreate() {
    setEditing(null)
    form.setFieldsValue(EMPTY_FORM as never)
    setEditOpen(true)
  }

  async function openEdit(ct: ComponentType) {
    try {
      const full = await componentsApi.get(ct.id)
      setEditing(full)
      form.setFieldsValue(full as never)
      setEditOpen(true)
    } catch {
      void message.error('Ошибка загрузки компонента')
    }
  }

  async function saveComponent() {
    const values = await form.validateFields()
    try {
      if (editing) {
        await componentsApi.update(editing.id, { ...editing, ...values, id: editing.id })
      } else {
        await componentsApi.create({
          ...EMPTY_FORM,
          ...values,
          id: `ct-${Date.now()}`,
          ports: values.ports ?? [],
          parameters: values.parameters ?? [],
        })
      }
      void message.success('Сохранено')
      setEditOpen(false)
      void load()
    } catch {
      void message.error('Ошибка сохранения')
    }
  }

  async function deleteComponent(id: string) {
    try {
      await componentsApi.remove(id)
      void message.success('Удалено')
      void load()
    } catch {
      void message.error('Ошибка удаления (возможно, компонент используется)')
    }
  }

  return (
    <div className="wrap">
      <div
        style={{
          marginBottom: 20,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
        }}
        className="rise"
      >
        <div>
          <div className="sec">Конструктор</div>
          <h1 className="h1" style={{ marginTop: 12 }}>
            Библиотека компонентов
          </h1>
          <p className="note" style={{ marginTop: 12 }}>
            {loading
              ? '…'
              : `${filtered.length} из ${components.length} · на странице ${paged.length}`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <JsonImportButton
            label="Импорт библиотеки"
            onImport={async (data) => {
              const result = await componentsApi.import(data as { components: unknown[] })
              void message.success(`Импорт: ${summarizeImport(result)}`)
              if (result.errors?.length) {
                void message.warning(result.errors.map((e) => e.message).join('; '))
              }
              await load()
            }}
          />
          <button className="btn btn-acc" onClick={openCreate}>
            <PlusOutlined /> Новый тип
          </button>
        </div>
      </div>

      <Input
        prefix={<SearchOutlined />}
        placeholder="Поиск по названию, id, форме..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ maxWidth: 400, marginBottom: 16 }}
        allowClear
      />

      <div
        style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 24 }}
        className="rise d1"
      >
        {categoryTabs.map((cat) => {
          const active = category === cat.id
          return (
            <Tag
              key={cat.id}
              onClick={() => setCategory(cat.id)}
              style={{
                cursor: 'pointer',
                marginInlineEnd: 0,
                background: active ? cat.color : tokens.bg.elevated,
                borderColor: active ? cat.color : tokens.border.subtle,
                color: active ? tokens.bg.base : tokens.text.secondary,
                fontSize: 11,
              }}
            >
              {cat.label}
            </Tag>
          )
        })}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: 12,
        }}
        className="rise d2"
      >
        {paged.map((ct) => {
          const accent = categoryColor(ct.category)
          return (
            <div
              key={ct.id}
              onClick={() => setExpandedId(expandedId === ct.id ? null : ct.id)}
              style={{
                background: tokens.bg.surface,
                border: `1px solid ${expandedId === ct.id ? accent : tokens.border.subtle}`,
                borderRadius: tokens.radius.lg,
                padding: 16,
                cursor: 'pointer',
                transition: 'border-color 0.15s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <span
                  aria-hidden
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: tokens.radius.md,
                    background: tokens.bg.elevated ?? tokens.bg.surface,
                    border: `1px solid ${tokens.border.subtle}`,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 20,
                    color: accent,
                    flexShrink: 0,
                  }}
                >
                  {shapeIcon(ct.shape)}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: tokens.text.primary, fontSize: 13 }}>
                    {ct.name}
                  </div>
                  <div style={{ fontSize: 11, color: tokens.text.muted, marginTop: 2 }}>
                    {ct.description || '—'}
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      fontFamily: tokens.font.mono,
                      color: tokens.text.dim,
                      marginTop: 4,
                    }}
                  >
                    {ct.id}
                  </div>
                </div>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                    alignItems: 'flex-end',
                  }}
                >
                  <Tag style={{ fontSize: 10, fontFamily: tokens.font.mono, marginInlineEnd: 0 }}>
                    {ct.shape}
                  </Tag>
                  <Tag
                    style={{
                      fontSize: 10,
                      marginInlineEnd: 0,
                      borderColor: accent,
                      color: accent,
                      background: 'transparent',
                    }}
                  >
                    {categoryLabel(ct.category)}
                  </Tag>
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  gap: 8,
                  marginTop: 10,
                  fontSize: 11,
                  color: tokens.text.dim,
                }}
              >
                <span>{ct.ports.length} порт.</span>
                <span>{ct.parameters.length} пар.</span>
              </div>

              <div
                style={{ display: 'flex', gap: 6, marginTop: 10 }}
                onClick={(e) => e.stopPropagation()}
              >
                <button className="btn btn-ghost btn-sm" onClick={() => void openEdit(ct)}>
                  <EditOutlined />
                </button>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => void deleteComponent(ct.id)}
                >
                  <DeleteOutlined />
                </button>
              </div>

              {expandedId === ct.id && (
                <div
                  style={{
                    marginTop: 12,
                    paddingTop: 12,
                    borderTop: `1px solid ${tokens.border.subtle}`,
                  }}
                >
                  <div style={{ marginBottom: 8 }}>
                    <div
                      style={{
                        fontSize: 10,
                        color: tokens.text.dim,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        marginBottom: 4,
                      }}
                    >
                      Порты
                    </div>
                    {ct.ports.length === 0 ? (
                      <span style={{ fontSize: 11, color: tokens.text.dim }}>Нет портов</span>
                    ) : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {ct.ports.map((p) => (
                          <Tooltip
                            key={p.id}
                            title={`${p.direction === 'in' ? 'Вход' : 'Выход'} · ${p.type}`}
                          >
                            <Tag
                              style={{
                                fontSize: 10,
                                fontFamily: tokens.font.mono,
                                cursor: 'default',
                              }}
                            >
                              {p.name}
                            </Tag>
                          </Tooltip>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: 10,
                        color: tokens.text.dim,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        marginBottom: 4,
                      }}
                    >
                      Параметры
                    </div>
                    {ct.parameters.length === 0 ? (
                      <span style={{ fontSize: 11, color: tokens.text.dim }}>Нет параметров</span>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {ct.parameters.map((p) => (
                          <div
                            key={p.id}
                            style={{
                              display: 'grid',
                              gridTemplateColumns: '1fr auto auto auto',
                              gap: 8,
                              fontSize: 11,
                              alignItems: 'baseline',
                            }}
                          >
                            <span style={{ color: tokens.text.secondary }}>
                              {p.label || p.name}
                            </span>
                            <span
                              style={{
                                color: tokens.text.dim,
                                fontFamily: tokens.font.mono,
                                fontSize: 10,
                              }}
                            >
                              {p.type}
                            </span>
                            {p.unit ? (
                              <span
                                style={{ color: tokens.text.dim, fontFamily: tokens.font.mono }}
                              >
                                {p.unit}
                              </span>
                            ) : (
                              <span />
                            )}
                            {p.defaultValue !== undefined && p.defaultValue !== null ? (
                              <span
                                style={{
                                  fontFamily: tokens.font.mono,
                                  color: tokens.accent.cyan,
                                }}
                              >
                                {String(p.defaultValue)}
                              </span>
                            ) : (
                              <span />
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {!loading && filtered.length === 0 && (
        <p className="note" style={{ marginTop: 24 }}>
          Компоненты не найдены
        </p>
      )}

      {filtered.length > PAGE_SIZE && (
        <div style={{ marginTop: 16, marginBottom: 24 }}>
          <ListPagination
            current={page}
            total={filtered.length}
            pageSize={PAGE_SIZE}
            onChange={setPage}
          />
        </div>
      )}

      <AntModal
        title={editing ? 'Редактировать компонент' : 'Новый компонент'}
        open={editOpen}
        onOk={() => void saveComponent()}
        onCancel={() => setEditOpen(false)}
        okText="Сохранить"
        cancelText="Отмена"
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="Название" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="Описание">
            <Input />
          </Form.Item>
          <Form.Item name="category" label="Категория" rules={[{ required: true }]}>
            <Select options={categoryOptions} />
          </Form.Item>
          <Form.Item name="shape" label="Форма" rules={[{ required: true }]}>
            <Select options={SHAPES.map((s) => ({ value: s, label: s }))} />
          </Form.Item>
        </Form>
      </AntModal>
    </div>
  )
}
