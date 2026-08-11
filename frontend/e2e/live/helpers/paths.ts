import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))

export function fixturesDir() {
  return join(HERE, '..', '..', 'fixtures')
}

export function liveDir() {
  return join(HERE, '..')
}
