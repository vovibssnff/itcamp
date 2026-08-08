import { useState, useMemo } from 'react'
import { Input, Tag, Tooltip } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import type { ComponentType } from '@/mocks/fixtures/components'
import { tokens } from '@/theme/tokens'

interface ComponentPaletteProps {
  componentTypes: ComponentType[]
  onDragStart: (typeId: string) => void
}

const CATEGORIES = [
  { id: 'all', label: 'Все' },
  { id: 'elou', label: 'ЭЛОУ', color: tokens.zone.elou },
  { id: 'atm', label: 'Атмосфера', color: tokens.zone.atm },
  { id: 'gdm', label: 'ГДМ', color: tokens.zone.gdm },
  { id: 'common', label: 'Общие', color: tokens.text.secondary },
]

const SHAPE_ICONS: Record<string, string> = {
  pump: '⊙',
  column: '▬',
  vessel: '⬡',
  heatexchanger: '⊞',
  valve: '⋈',
  sensor: '◉',
  controller: '⊕',
  separator: '⊟',
  compressor: '◈',
  furnace: '▲',
}

export function ComponentPalette({ componentTypes, onDragStart }: ComponentPaletteProps) {
  const [category, setCategory] = useState('all')
  const [search, setSearch] = useState('')
  const { t } = useTranslation()

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return componentTypes.filter(
      (c) =>
        (category === 'all' || c.category === category) &&
        (!q || c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q)),
    )
  }, [componentTypes, category, search])

  const catColor = CATEGORIES.find((c) => c.id === category)?.color ?? tokens.text.secondary

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ padding: '10px 12px 6px', borderBottom: `1px solid ${tokens.border.subtle}` }}>
        <div
          style={{
            fontSize: 11,
            color: tokens.text.muted,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            marginBottom: 8,
          }}
        >
          {t('constructor.palette')}
        </div>
        <Input
          prefix={<SearchOutlined style={{ color: tokens.text.dim }} />}
          placeholder={t('constructor.search')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          size="small"
          style={{ background: tokens.bg.elevated, borderColor: tokens.border.subtle }}
        />
        <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
          {CATEGORIES.map((cat) => (
            <Tag
              key={cat.id}
              color={category === cat.id ? (cat.color ?? tokens.accent.cyan) : undefined}
              onClick={() => setCategory(cat.id)}
              style={{
                cursor: 'pointer',
                background: category === cat.id ? undefined : tokens.bg.elevated,
                borderColor:
                  category === cat.id ? (cat.color ?? tokens.accent.cyan) : tokens.border.subtle,
                color:
                  category === cat.id
                    ? cat.color
                      ? tokens.bg.base
                      : tokens.bg.base
                    : tokens.text.secondary,
                fontSize: 11,
              }}
            >
              {cat.label}
            </Tag>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
        {filtered.length === 0 && (
          <div
            style={{
              padding: '24px 12px',
              textAlign: 'center',
              color: tokens.text.inactive,
              fontSize: 12,
            }}
          >
            Нет компонентов
          </div>
        )}
        {filtered.map((ct) => (
          <PaletteItem key={ct.id} ct={ct} catColor={catColor} onDragStart={onDragStart} />
        ))}
      </div>
    </div>
  )
}

function PaletteItem({
  ct,
  catColor,
  onDragStart,
}: {
  ct: ComponentType
  catColor: string
  onDragStart: (id: string) => void
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <Tooltip title={ct.description} placement="right" mouseEnterDelay={0.6}>
      <div
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData('component-type-id', ct.id)
          onDragStart(ct.id)
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '7px 12px',
          cursor: 'grab',
          background: hovered ? 'rgba(255,255,255,0.04)' : 'transparent',
          transition: 'background 0.1s',
          borderLeft: `2px solid ${hovered ? catColor : 'transparent'}`,
        }}
      >
        <span style={{ fontSize: 16, width: 20, textAlign: 'center', color: catColor }}>
          {SHAPE_ICONS[ct.shape] ?? '⬜'}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 12,
              color: tokens.text.primary,
              fontWeight: 500,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {ct.name}
          </div>
          <div style={{ fontSize: 10, color: tokens.text.dim, marginTop: 1 }}>
            {ct.ports.length} порт
            {ct.ports.length % 10 === 1 && ct.ports.length !== 11
              ? ''
              : ct.ports.length % 10 < 5 &&
                  ct.ports.length !== 12 &&
                  ct.ports.length !== 13 &&
                  ct.ports.length !== 14
                ? 'а'
                : 'ов'}
          </div>
        </div>
      </div>
    </Tooltip>
  )
}
