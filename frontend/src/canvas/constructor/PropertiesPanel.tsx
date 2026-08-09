import { Form, Input, InputNumber, Select, Switch, Button, Typography, Divider } from 'antd'
import { DeleteOutlined, CheckCircleOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import type { CanvasNode } from '@/store/constructor'
import type { ComponentType, ComponentParameter } from '@/mocks/fixtures/components'
import { tokens } from '@/theme/tokens'

const { Text } = Typography

interface PropertiesPanelProps {
  node: CanvasNode | null
  componentType: ComponentType | null
  onUpdate: (id: string, patch: Partial<CanvasNode>) => void
  onDelete: (id: string) => void
  validationErrors: string[]
}

export function PropertiesPanel({
  node,
  componentType,
  onUpdate,
  onDelete,
  validationErrors,
}: PropertiesPanelProps) {
  const { t } = useTranslation()
  const [form] = Form.useForm()

  if (!node || !componentType) {
    return (
      <div style={{ padding: 16, color: tokens.text.inactive, fontSize: 12, textAlign: 'center' }}>
        <div style={{ fontSize: 20, marginBottom: 8 }}>←</div>
        Выберите компонент для редактирования свойств
      </div>
    )
  }

  function handleValuesChange(changedValues: Record<string, unknown>) {
    if (!node) return
    const updatedParams = { ...node.parameters, ...changedValues }
    onUpdate(node.id, { parameters: updatedParams })
  }

  function handleLabelChange(label: string) {
    if (!node) return
    onUpdate(node.id, { label })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ padding: '10px 12px 8px', borderBottom: `1px solid ${tokens.border.subtle}` }}>
        <div
          style={{
            fontSize: 11,
            color: tokens.text.muted,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >
          {t('constructor.properties')}
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 6,
          }}
        >
          <Text style={{ color: tokens.text.primary, fontWeight: 600, fontSize: 13 }}>
            {componentType.name}
          </Text>
          <Button
            size="small"
            type="text"
            danger
            icon={<DeleteOutlined />}
            onClick={() => onDelete(node.id)}
          />
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
        {validationErrors.length > 0 && (
          <div
            style={{
              background: tokens.accent.redBg,
              border: `1px solid ${tokens.accent.redBorder}`,
              borderRadius: tokens.radius.md,
              padding: '8px 10px',
              marginBottom: 12,
              fontSize: 11,
              color: tokens.accent.red,
            }}
          >
            {validationErrors.map((e, i) => (
              <div key={i}>{e}</div>
            ))}
          </div>
        )}

        {/* Label field */}
        <div style={{ marginBottom: 12 }}>
          <label
            style={{ fontSize: 11, color: tokens.text.muted, display: 'block', marginBottom: 4 }}
          >
            Обозначение
          </label>
          <Input
            size="small"
            value={node.label}
            onChange={(e) => handleLabelChange(e.target.value)}
            style={{
              fontFamily: tokens.font.mono,
              background: tokens.bg.elevated,
              borderColor: tokens.border.subtle,
            }}
          />
        </div>

        <Divider style={{ borderColor: tokens.border.subtle, margin: '8px 0' }} />

        <Form
          form={form}
          layout="vertical"
          size="small"
          initialValues={node.parameters as Record<string, unknown>}
          onValuesChange={handleValuesChange}
        >
          {componentType.parameters.map((param) => (
            <ParamField key={param.id} param={param} />
          ))}
        </Form>

        <Divider style={{ borderColor: tokens.border.subtle, margin: '8px 0' }} />

        {/* Port list */}
        <div>
          <div
            style={{
              fontSize: 11,
              color: tokens.text.muted,
              marginBottom: 6,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            Порты
          </div>
          {componentType.ports.map((port) => (
            <div
              key={port.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '3px 0',
                fontSize: 11,
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: PORT_COLORS[port.type],
                  flexShrink: 0,
                }}
              />
              <span style={{ color: tokens.text.secondary, flex: 1 }}>{port.name}</span>
              <span style={{ color: tokens.text.dim, fontFamily: tokens.font.mono, fontSize: 10 }}>
                {port.direction === 'in' ? '→' : '←'}
              </span>
            </div>
          ))}
        </div>

        {validationErrors.length === 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              marginTop: 12,
              fontSize: 11,
              color: tokens.accent.cyan,
            }}
          >
            <CheckCircleOutlined />
            Нет ошибок
          </div>
        )}
      </div>
    </div>
  )
}

const PORT_COLORS: Record<string, string> = {
  liquid: tokens.accent.cyan,
  gas: tokens.accent.amber,
  signal: tokens.accent.blue,
  electric: tokens.accent.red,
}

function ParamField({ param }: { param: ComponentParameter }) {
  const labelStyle: React.CSSProperties = {
    fontSize: 11,
    color: tokens.text.muted,
    fontWeight: 400,
  }

  const name = param.name

  if (param.type === 'boolean') {
    return (
      <Form.Item
        name={name}
        label={<span style={labelStyle}>{param.label}</span>}
        valuePropName="checked"
        style={{ marginBottom: 10 }}
      >
        <Switch size="small" />
      </Form.Item>
    )
  }

  if (param.type === 'enum' && param.options) {
    return (
      <Form.Item
        name={name}
        label={<span style={labelStyle}>{param.label}</span>}
        style={{ marginBottom: 10 }}
      >
        <Select
          size="small"
          options={param.options.map((o) => ({ value: o, label: o }))}
          style={{ background: tokens.bg.elevated }}
        />
      </Form.Item>
    )
  }

  if (param.type === 'number') {
    return (
      <Form.Item
        name={name}
        label={
          <span style={labelStyle}>
            {param.label}
            {param.unit && <span style={{ color: tokens.text.dim }}> ({param.unit})</span>}
          </span>
        }
        style={{ marginBottom: 10 }}
      >
        <InputNumber
          size="small"
          min={param.min}
          max={param.max}
          style={{ width: '100%', fontFamily: tokens.font.mono, background: tokens.bg.elevated }}
        />
      </Form.Item>
    )
  }

  return (
    <Form.Item
      name={name}
      label={<span style={labelStyle}>{param.label}</span>}
      style={{ marginBottom: 10 }}
    >
      <Input
        size="small"
        style={{ fontFamily: tokens.font.mono, background: tokens.bg.elevated }}
      />
    </Form.Item>
  )
}
