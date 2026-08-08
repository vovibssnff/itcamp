import { useState, useMemo } from 'react'
import { Input, Tag, Tooltip } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import { COMPONENT_TYPES, type ComponentType } from '@/mocks/fixtures/components'
import { tokens } from '@/theme/tokens'

const CATEGORY_COLORS: Record<string, string> = {
  elou: tokens.zone.elou,
  atm: tokens.zone.atm,
  gdm: tokens.zone.gdm,
  common: tokens.text.secondary,
}

const CATEGORY_LABELS: Record<string, string> = {
  elou: 'ЭЛОУ',
  atm: 'Атмосфера',
  gdm: 'ГДМ',
  common: 'Общие',
}

export default function ComponentLibraryScreen() {
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    if (!q) return COMPONENT_TYPES
    return COMPONENT_TYPES.filter(
      (c) => c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q),
    )
  }, [search])

  const grouped = useMemo(() => {
    const groups: Record<string, ComponentType[]> = {}
    for (const ct of filtered) {
      if (!groups[ct.category]) groups[ct.category] = []
      groups[ct.category]!.push(ct)
    }
    return groups
  }, [filtered])

  return (
    <div style={{ padding: 24, maxWidth: 1200 }}>
      <div style={{ marginBottom: 20 }}>
        <h3 style={{ color: tokens.text.primary, margin: '0 0 4px' }}>Библиотека компонентов</h3>
        <span style={{ color: tokens.text.muted, fontSize: 12 }}>
          {COMPONENT_TYPES.length} типов компонентов
        </span>
      </div>

      <Input
        prefix={<SearchOutlined />}
        placeholder="Поиск..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ maxWidth: 400, marginBottom: 24 }}
      />

      {Object.entries(grouped).map(([cat, types]) => (
        <div key={cat} style={{ marginBottom: 32 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 12,
              paddingBottom: 8,
              borderBottom: `1px solid ${tokens.border.subtle}`,
            }}
          >
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: CATEGORY_COLORS[cat] ?? tokens.text.secondary,
              }}
            />
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: CATEGORY_COLORS[cat] ?? tokens.text.secondary,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              {CATEGORY_LABELS[cat] ?? cat}
            </span>
            <span style={{ fontSize: 11, color: tokens.text.dim }}>{types.length}</span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: 12,
            }}
          >
            {types.map((ct) => (
              <div
                key={ct.id}
                onClick={() => setExpandedId(expandedId === ct.id ? null : ct.id)}
                style={{
                  background: tokens.bg.surface,
                  border: `1px solid ${expandedId === ct.id ? (CATEGORY_COLORS[ct.category] ?? tokens.border.medium) : tokens.border.subtle}`,
                  borderRadius: tokens.radius.lg,
                  padding: 16,
                  cursor: 'pointer',
                  transition: 'border-color 0.15s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, color: tokens.text.primary, fontSize: 13 }}>
                      {ct.name}
                    </div>
                    <div style={{ fontSize: 11, color: tokens.text.muted, marginTop: 2 }}>
                      {ct.description}
                    </div>
                  </div>
                  <Tag style={{ flexShrink: 0, fontSize: 10, fontFamily: tokens.font.mono }}>
                    {ct.shape}
                  </Tag>
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
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {ct.parameters.map((p) => (
                          <div key={p.id} style={{ display: 'flex', gap: 8, fontSize: 11 }}>
                            <span style={{ color: tokens.text.secondary, flex: 1 }}>{p.label}</span>
                            {p.unit && (
                              <span
                                style={{ color: tokens.text.dim, fontFamily: tokens.font.mono }}
                              >
                                {p.unit}
                              </span>
                            )}
                            {p.defaultValue !== undefined && (
                              <span
                                style={{ fontFamily: tokens.font.mono, color: tokens.accent.cyan }}
                              >
                                {String(p.defaultValue)}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
