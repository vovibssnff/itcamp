import { describe, expect, it } from 'vitest'
import {
  inferComponentShape,
  mapComponent,
  mapReplay,
  mapTemplate,
  mapUser,
  pickPrimaryRole,
  rolesFromAccessToken,
  toTemplateBody,
} from './mappers'

function jwtWithRoles(roles: string[]): string {
  const payload = btoa(JSON.stringify({ roles }))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
  return `hdr.${payload}.sig`
}

describe('mapReplay', () => {
  it('builds descriptions from action/fault/alarm fields', () => {
    const data = mapReplay({
      actions: [{ type: 'actuator', target: 'LRCA-641', action: 'set_mode', model_time: 12 }],
      alarms: [{ tag_id: 'P-101', priority: 'HH', model_time: 20 }],
      faults: [{ fault_id: 'level_drop', component: 'elec-1', model_time: 30 }],
    })
    expect(data.events).toHaveLength(3)
    expect(data.events[0]?.description).toContain('LRCA-641')
    expect(data.events[1]?.description).toContain('P-101')
    expect(data.events[2]?.description).toContain('level_drop')
  })
})

describe('toTemplateBody', () => {
  it('maps canvas nodes/edges to backend graph shape with string schema_version', () => {
    const body = toTemplateBody({
      name: 'Test',
      description: 'd',
      nodes: [
        {
          id: 'n1',
          typeId: 'centrifugal_pump',
          x: 10,
          y: 20,
          label: 'Н-1',
          parameters: {},
          tags: ['FI 101'],
          width: 44,
          height: 44,
        },
      ],
      edges: [
        {
          id: 'e1',
          type: 'steam',
          sourceNodeId: 'n1',
          sourcePortId: 'out',
          targetNodeId: 'n2',
          targetPortId: 'in',
        },
      ],
    })
    expect(body.graph.schema_version).toBe('2.0')
    expect(typeof body.graph.schema_version).toBe('string')
    expect(body.graph.nodes[0]).toMatchObject({
      id: 'n1',
      component_type_id: 'centrifugal_pump',
      position: { x: 10, y: 20 },
      tags: ['FI 101'],
    })
    expect(body.graph.edges[0]).toMatchObject({
      id: 'e1',
      type: 'steam',
      from: { node_id: 'n1', port: 'out' },
      to: { node_id: 'n2', port: 'in' },
    })
    expect(body.graph.layout.mnemo_positions.n1).toEqual({ x: 10, y: 20 })
  })

  it('derives edge type from source port when edge.type missing', () => {
    const body = toTemplateBody(
      {
        name: 'Test',
        nodes: [{ id: 'n1', typeId: 'pump', x: 0, y: 0, label: 'P', parameters: {} }],
        edges: [
          {
            id: 'e1',
            sourceNodeId: 'n1',
            sourcePortId: 'outlet',
            targetNodeId: 'n2',
            targetPortId: 'in',
          },
        ],
      },
      [{ id: 'pump', ports: [{ id: 'outlet', type: 'gas' }] }],
    )
    expect(body.graph.edges[0]?.type).toBe('gas')
  })

  it('round-trips edge.type, tags, positions, and schema_version string "2.0"', () => {
    const canvas = {
      name: 'ЭЛОУ round-trip',
      description: 'contract',
      nodes: [
        {
          id: 'n-pump',
          typeId: 'centrifugal_pump',
          x: 120,
          y: 240,
          label: 'Н-1',
          parameters: { flow: 400 },
          tags: ['FI 101', 'PI 101'],
          width: 44,
          height: 44,
        },
        {
          id: 'n-valve',
          typeId: 'control_valve',
          x: 280,
          y: 240,
          label: 'FV 101',
          parameters: {},
          tags: ['FV 101'],
        },
      ],
      edges: [
        {
          id: 'e-steam',
          type: 'steam' as const,
          sourceNodeId: 'n-pump',
          sourcePortId: 'out',
          targetNodeId: 'n-valve',
          targetPortId: 'in',
        },
        {
          id: 'e-signal',
          type: 'signal' as const,
          sourceNodeId: 'n-valve',
          sourcePortId: 'sig',
          targetNodeId: 'n-pump',
          targetPortId: 'cmd',
        },
      ],
    }

    const body = toTemplateBody(canvas)
    expect(body.graph.schema_version).toBe('2.0')
    expect(typeof body.graph.schema_version).toBe('string')
    expect(body.graph.edges.map((e) => e.type)).toEqual(['steam', 'signal'])
    expect(body.graph.nodes[0]).toMatchObject({
      position: { x: 120, y: 240 },
      tags: ['FI 101', 'PI 101'],
    })
    expect(body.graph.layout.mnemo_positions['n-pump']).toEqual({ x: 120, y: 240 })
    expect(body.graph.layout.mnemo_positions['n-valve']).toEqual({ x: 280, y: 240 })

    const mapped = mapTemplate({
      id: 'tmpl-rt',
      name: canvas.name,
      description: canvas.description,
      status: 'published',
      created_at: '2026-08-11T00:00:00Z',
      updated_at: '2026-08-11T00:00:00Z',
      graph: body.graph,
    })

    expect(mapped.nodes).toHaveLength(2)
    expect(mapped.nodes[0]).toMatchObject({
      id: 'n-pump',
      typeId: 'centrifugal_pump',
      x: 120,
      y: 240,
      tags: ['FI 101', 'PI 101'],
      width: 44,
      height: 44,
    })
    expect(mapped.edges).toEqual([
      {
        id: 'e-steam',
        type: 'steam',
        sourceNodeId: 'n-pump',
        sourcePortId: 'out',
        targetNodeId: 'n-valve',
        targetPortId: 'in',
      },
      {
        id: 'e-signal',
        type: 'signal',
        sourceNodeId: 'n-valve',
        sourcePortId: 'sig',
        targetNodeId: 'n-pump',
        targetPortId: 'cmd',
      },
    ])

    // Second save must keep schema_version as string "2.0" and media types.
    const body2 = toTemplateBody({ ...mapped, name: mapped.name })
    expect(body2.graph.schema_version).toBe('2.0')
    expect(typeof body2.graph.schema_version).toBe('string')
    expect(body2.graph.edges.map((e) => e.type)).toEqual(['steam', 'signal'])
  })

  it('reads positions from mnemo_positions when node.position missing', () => {
    const mapped = mapTemplate({
      id: 'tmpl-mnemo',
      name: 'Mnemo',
      graph: {
        schema_version: '2.0',
        nodes: [{ id: 'n1', component_type_id: 'pump', label: 'P', parameters: {} }],
        edges: [],
        layout: { mnemo_positions: { n1: { x: 55, y: 66 } }, custom_labels: {} },
      },
    })
    expect(mapped.nodes[0]).toMatchObject({ id: 'n1', x: 55, y: 66 })
  })
})

describe('mapUser roles', () => {
  it('prefers admin over instructor', () => {
    const u = mapUser({
      id: '1',
      login: 'a',
      full_name: 'A',
      roles: ['operator', 'admin', 'instructor'],
    })
    expect(u.role).toBe('admin')
    expect(u.roles).toEqual(['admin', 'instructor', 'operator'])
  })

  it('maps instructor when roles present', () => {
    const u = mapUser({ id: '1', login: 'i', full_name: 'Инструктор', roles: ['instructor'] })
    expect(u.role).toBe('instructor')
  })

  it('defaults to operator only when roles empty', () => {
    const u = mapUser({ id: '1', login: 'x', full_name: 'Инструктор', roles: [] })
    expect(u.role).toBe('operator')
    expect(u.roles).toEqual([])
  })
})

describe('rolesFromAccessToken', () => {
  it('reads roles claim', () => {
    expect(rolesFromAccessToken(jwtWithRoles(['instructor', 'operator']))).toEqual([
      'instructor',
      'operator',
    ])
  })

  it('pickPrimaryRole prefers instructor over operator', () => {
    expect(pickPrimaryRole(['operator', 'instructor'])).toBe('instructor')
  })
})

describe('mapComponent', () => {
  it('normalizes API import shape to mock-compatible ComponentType', () => {
    const ct = mapComponent({
      id: 'centrifugal_pump',
      name: 'Центробежный насос',
      category: 'Общие',
      description: 'Q-H',
      model_code: 'centrifugal_pump',
      ports: [
        { id: 'inlet', name: 'Вход', type: 'liquid', direction: 'in' },
        { id: 'outlet', name: 'Выход', type: 'steam', direction: 'out' },
      ],
      parameters: [
        {
          id: 'Q_nom',
          name: 'Номинальная подача',
          unit: 'м3/ч',
          type: 'float',
          default: 450,
          min: 0,
          max: 2000,
        },
        { id: 'on', name: 'Включён', type: 'bool', default: true },
        {
          id: 'mode',
          name: 'Режим',
          type: 'select',
          default: 'auto',
          options: ['auto', 'manual'],
        },
      ],
    })
    expect(ct.category).toBe('common')
    expect(ct.shape).toBe('pump')
    expect(ct.ports[1]?.type).toBe('steam')
    expect(ct.parameters[0]).toMatchObject({
      label: 'Номинальная подача',
      type: 'number',
      defaultValue: 450,
      unit: 'м3/ч',
    })
    expect(ct.parameters[1]?.type).toBe('boolean')
    expect(ct.parameters[2]?.type).toBe('enum')
  })

  it('keeps mock shape/category/label fields as-is', () => {
    const ct = mapComponent({
      id: 'ct-desalter',
      name: 'Электродесольватор',
      category: 'elou',
      description: 'x',
      shape: 'vessel',
      ports: [],
      parameters: [
        {
          id: 'p-temp',
          name: 'temp',
          label: 'Температура',
          type: 'number',
          defaultValue: 120,
        },
      ],
    })
    expect(ct.category).toBe('elou')
    expect(ct.shape).toBe('vessel')
    expect(ct.parameters[0]?.label).toBe('Температура')
    expect(ct.parameters[0]?.defaultValue).toBe(120)
  })

  it('preserves custom API categories instead of collapsing to common', () => {
    const ct = mapComponent({
      id: 'custom-unit',
      name: 'Кастомный блок',
      category: 'Утилиты',
      description: '',
      model_code: 'custom_unit',
      ports: [],
      parameters: [],
    })
    expect(ct.category).toBe('Утилиты')
  })

  it('infers shapes from model codes', () => {
    expect(inferComponentShape('distillation_column', 'x')).toBe('column')
    expect(inferComponentShape('heat_exchanger', 'x')).toBe('heatexchanger')
    expect(inferComponentShape('furnace', 'x')).toBe('furnace')
    expect(inferComponentShape('pid_controller', 'x')).toBe('controller')
  })
})
