import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'react-router'
import { Button, Tooltip, Space, message } from 'antd'
import {
  UndoOutlined,
  RedoOutlined,
  CheckCircleOutlined,
  SaveOutlined,
  ExportOutlined,
} from '@ant-design/icons'
import { ConstructorCanvas } from '@/canvas/constructor/ConstructorCanvas'
import { ComponentPalette } from '@/canvas/constructor/ComponentPalette'
import { PropertiesPanel } from '@/canvas/constructor/PropertiesPanel'
import { useConstructorStore } from '@/store/constructor'
import { useAutoSave } from '@/hooks/useAutoSave'
import { useUndo } from '@/hooks/useUndo'
import { type ComponentType } from '@/mocks/fixtures/components'
import type { Template } from '@/mocks/fixtures/templates'
import { templatesApi } from '@/api/templates'
import { componentsApi } from '@/api/components'
import { toErrorMessage } from '@/api/errors'
import { tokens } from '@/theme/tokens'
import { getDefaultNodeSize } from '@/canvas/shared/equipmentGeometry'

const CANVAS_PADDING = 240 // palette width

export default function ConstructorScreen() {
  const { id } = useParams<{ id: string }>()
  const [loading, setLoading] = useState(true)
  const [template, setTemplate] = useState<Template | null>(null)
  const [componentTypes, setComponentTypes] = useState<ComponentType[]>([])
  const [canvasSize, setCanvasSize] = useState({ w: 800, h: 600 })
  const [previewFlow, setPreviewFlow] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const {
    nodes,
    edges,
    selectedNodeId,
    isDirty,
    validationErrors,
    setTemplate: setStoreTemplate,
    setNodes,
    setEdges,
    addNode,
    updateNode,
    removeNode,
    markClean,
    setValidationErrors,
    undo,
    redo,
  } = useConstructorStore()

  const { canUndo, canRedo, handleKeyDown } = useUndo()

  // Register Ctrl+Z / Ctrl+Y keyboard shortcuts
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  useEffect(() => {
    if (!id) return
    void (async () => {
      setLoading(true)
      try {
        const [tmpl, components] = await Promise.all([templatesApi.get(id), componentsApi.list()])
        setTemplate(tmpl)
        setComponentTypes(components)
        setStoreTemplate(id)
        setNodes(tmpl.nodes)
        setEdges(tmpl.edges)
      } catch {
        void message.error('Ошибка загрузки шаблона')
      } finally {
        setLoading(false)
      }
    })()
  }, [id, setStoreTemplate, setNodes, setEdges])

  // Measure canvas container. Depends on `loading` because while loading the
  // canvas container is not mounted (early return renders a spinner) — the
  // observer must (re)attach once the real layout is in the DOM.
  useEffect(() => {
    if (loading) return
    const el = containerRef.current
    if (!el) return
    const obs = new ResizeObserver(() => {
      setCanvasSize({ w: el.clientWidth, h: el.clientHeight })
    })
    obs.observe(el)
    setCanvasSize({ w: el.clientWidth, h: el.clientHeight })
    return () => obs.disconnect()
  }, [loading])

  const saveTemplate = useCallback(async () => {
    if (!id || !template) return
    try {
      await templatesApi.update(id, { ...template, nodes, edges })
      markClean()
      void message.success('Шаблон сохранён')
    } catch (err) {
      void message.error(toErrorMessage(err, 'Ошибка сохранения'))
    }
  }, [id, template, nodes, edges, markClean])

  useAutoSave(isDirty, saveTemplate, 30000)

  async function handleValidate() {
    if (!id) return
    try {
      const result = await templatesApi.validate(id)
      if (result.valid) {
        void message.success('Граф валиден')
        setValidationErrors([])
      } else {
        setValidationErrors(result.errors.map((e) => e.message))
        void message.warning(`Ошибок: ${result.errors.length}`)
      }
    } catch {
      void message.error('Ошибка валидации')
    }
  }

  function handleExport() {
    const stage = document.querySelector('canvas')
    if (!stage) return
    const url = stage.toDataURL('image/png')
    const a = document.createElement('a')
    a.href = url
    a.download = `${template?.name ?? 'template'}.png`
    a.click()
  }

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? null
  const selectedNodeType = selectedNode
    ? (componentTypes.find((c) => c.id === selectedNode.typeId) ?? null)
    : null
  const selectedNodeErrors = selectedNode?.validationErrors ?? []

  function handleDropComponent(typeId: string, x: number, y: number) {
    const ct = componentTypes.find((c) => c.id === typeId)
    if (!ct) return
    const defaults: Record<string, unknown> = {}
    for (const p of ct.parameters) {
      defaults[p.name] = p.defaultValue
    }
    const size = getDefaultNodeSize(ct.shape)
    addNode({
      id: `n-${Date.now()}`,
      typeId,
      x,
      y,
      width: size.w,
      height: size.h,
      label: ct.name.substring(0, 8),
      parameters: defaults,
    })
  }

  if (loading) return <div className="loading-spinner" />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 12px',
          borderBottom: `1px solid ${tokens.border.subtle}`,
          background: tokens.bg.elevated,
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: tokens.font.mono, fontSize: 12, color: tokens.accent.cyan }}>
            {template?.name}
          </span>
          {isDirty && (
            <span style={{ fontSize: 10, color: tokens.accent.amber }}>
              ● несохранённые изменения
            </span>
          )}
        </div>
        <Space>
          <Tooltip title="Отменить (Ctrl+Z)">
            <Button size="small" icon={<UndoOutlined />} disabled={!canUndo} onClick={undo} />
          </Tooltip>
          <Tooltip title="Повторить (Ctrl+Y)">
            <Button size="small" icon={<RedoOutlined />} disabled={!canRedo} onClick={redo} />
          </Tooltip>
          <Tooltip title="Предпросмотр потока">
            <Button
              size="small"
              type={previewFlow ? 'primary' : 'default'}
              onClick={() => setPreviewFlow((v) => !v)}
            >
              Поток
            </Button>
          </Tooltip>
          <Tooltip title="Валидировать граф">
            <Button
              size="small"
              icon={<CheckCircleOutlined />}
              onClick={() => void handleValidate()}
            >
              Проверить
            </Button>
          </Tooltip>
          <Tooltip title="Сохранить (30с авто)">
            <Button
              size="small"
              type={isDirty ? 'primary' : 'default'}
              icon={<SaveOutlined />}
              onClick={() => void saveTemplate()}
            >
              Сохранить
            </Button>
          </Tooltip>
          <Tooltip title="Экспорт PNG">
            <Button size="small" icon={<ExportOutlined />} onClick={handleExport} />
          </Tooltip>
        </Space>
      </div>

      {/* Main area */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left palette */}
        <div
          style={{
            width: CANVAS_PADDING,
            borderRight: `1px solid ${tokens.border.subtle}`,
            background: tokens.bg.surface,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <ComponentPalette componentTypes={componentTypes} onDragStart={() => {}} />
        </div>

        {/* Canvas */}
        <div
          ref={containerRef}
          style={{ flex: 1, minWidth: 0, minHeight: 0, overflow: 'hidden', position: 'relative' }}
        >
          {validationErrors.length > 0 && (
            <div
              style={{
                position: 'absolute',
                top: 8,
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 10,
                background: tokens.accent.redBg,
                border: `1px solid ${tokens.accent.redBorder}`,
                borderRadius: tokens.radius.md,
                padding: '4px 12px',
                fontSize: 11,
                color: tokens.accent.red,
                pointerEvents: 'none',
              }}
            >
              {validationErrors.length} ошибок валидации
            </div>
          )}
          <ConstructorCanvas
            componentTypes={componentTypes}
            width={canvasSize.w}
            height={canvasSize.h}
            onDropComponent={handleDropComponent}
            previewFlow={previewFlow}
          />
        </div>

        {/* Right properties */}
        <div
          style={{
            width: 240,
            borderLeft: `1px solid ${tokens.border.subtle}`,
            background: tokens.bg.surface,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <PropertiesPanel
            node={selectedNode}
            componentType={selectedNodeType}
            onUpdate={updateNode}
            onDelete={removeNode}
            validationErrors={selectedNodeErrors}
          />
        </div>
      </div>
    </div>
  )
}
