import { describe, expect, it } from 'vitest'
import {
  inferComponentShape,
  mapComponent,
  mapUser,
  pickPrimaryRole,
  rolesFromAccessToken,
} from './mappers'

function jwtWithRoles(roles: string[]): string {
  const payload = btoa(JSON.stringify({ roles }))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
  return `hdr.${payload}.sig`
}

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
    expect(ct.ports[1]?.type).toBe('gas')
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
