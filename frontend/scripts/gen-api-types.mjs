// Generates TypeScript types from each backend service's OpenAPI spec.
// The specs reference shared schemas via the placeholder URL
// `https://ktc.itcamp/schemas/*.json`, which we rewrite to the local
// repo `schemas/` directory before running openapi-typescript.
// Usage: pnpm openapi:gen
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '..', '..')
const servicesDir = resolve(repoRoot, 'services')
const schemasDir = resolve(repoRoot, 'schemas')
const outDir = resolve(__dirname, '..', 'src', 'api', 'generated')
const cli = resolve(__dirname, '..', 'node_modules', 'openapi-typescript', 'bin', 'cli.js')

const SCHEMA_URL_PREFIX = 'https://ktc.itcamp/schemas/'

if (!existsSync(servicesDir)) {
  console.error(`services/ directory not found at ${servicesDir}`)
  process.exit(1)
}

mkdirSync(outDir, { recursive: true })

const services = readdirSync(servicesDir, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)

const tmpBase = resolve(tmpdir(), `ktk-openapi-${Date.now()}`)
mkdirSync(tmpBase, { recursive: true })

let generated = 0
const failures = []

for (const service of services) {
  const spec = resolve(servicesDir, service, 'api', 'openapi.yaml')
  if (!existsSync(spec)) continue

  // Rewrite placeholder schema URLs to local absolute file paths.
  const raw = readFileSync(spec, 'utf8')
  const rewritten = raw.replaceAll(SCHEMA_URL_PREFIX, `${schemasDir}/`)
  const tmpSpec = resolve(tmpBase, `${service}.yaml`)
  writeFileSync(tmpSpec, rewritten)

  const out = resolve(outDir, `${service}.ts`)
  console.log(`→ ${service}`)
  try {
    execFileSync('node', [cli, tmpSpec, '-o', out], { stdio: 'inherit' })
    generated++
  } catch {
    failures.push(service)
  }
}

rmSync(tmpBase, { recursive: true, force: true })

console.log(`\nGenerated types for ${generated} service(s) into src/api/generated/`)
if (failures.length > 0) {
  console.error(`Failed: ${failures.join(', ')}`)
  process.exit(1)
}
