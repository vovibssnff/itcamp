import { describe, expect, it } from 'vitest'
import { mapUser, pickPrimaryRole, rolesFromAccessToken } from './mappers'

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
