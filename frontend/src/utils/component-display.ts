import type { ComponentType } from '@/mocks/fixtures/components'
import { tokens } from '@/theme/tokens'

/** Unicode glyphs used by palette + library cards (same as historical mock UI). */
export const SHAPE_ICONS: Record<ComponentType['shape'], string> = {
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

/** Known SPA category keys → human labels (backend uses Russian enum today). */
export const CATEGORY_LABELS: Record<string, string> = {
  elou: 'ЭЛОУ',
  atm: 'Атмосфера',
  gdm: 'ГДМ',
  common: 'Общие',
}

/** SPA / mock keys → constructor API category values. */
export const CATEGORY_TO_API: Record<string, string> = {
  elou: 'ЭЛОУ',
  atm: 'Атмосфера',
  gdm: 'ГДМ',
  common: 'Общие',
  ЭЛОУ: 'ЭЛОУ',
  Атмосфера: 'Атмосфера',
  ГДМ: 'ГДМ',
  Общие: 'Общие',
}

const KNOWN_CATEGORY_ORDER = ['elou', 'atm', 'gdm', 'common'] as const

export const CATEGORY_COLORS: Record<string, string> = {
  elou: tokens.zone.elou,
  atm: tokens.zone.atm,
  gdm: tokens.zone.gdm,
  common: tokens.text.secondary,
}

export function shapeIcon(shape: ComponentType['shape'] | string | undefined): string {
  if (!shape) return '⬜'
  return SHAPE_ICONS[shape as ComponentType['shape']] ?? '⬜'
}

export function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category
}

export function categoryToApi(category: string): string {
  return CATEGORY_TO_API[category] ?? category
}

export function categoryColor(category: string): string {
  return CATEGORY_COLORS[category] ?? tokens.text.secondary
}

/** Stable order: known zones first, then custom API categories alphabetically. */
export function sortCategories(categories: Iterable<string>): string[] {
  return [...new Set(categories)].filter(Boolean).sort((a, b) => {
    const ia = (KNOWN_CATEGORY_ORDER as readonly string[]).indexOf(a)
    const ib = (KNOWN_CATEGORY_ORDER as readonly string[]).indexOf(b)
    if (ia === -1 && ib === -1) return a.localeCompare(b, 'ru')
    if (ia === -1) return 1
    if (ib === -1) return -1
    return ia - ib
  })
}

export function distinctCategories(components: Array<{ category: string }>): string[] {
  return sortCategories(components.map((c) => c.category))
}
