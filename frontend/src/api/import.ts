import { ensureAccessToken } from './client'
import { ApiError } from './errors'

const BASE_URL =
  import.meta.env.VITE_MOCK_API === 'true' ? '' : (import.meta.env.VITE_API_BASE_URL ?? '')

export interface ImportItemError {
  id?: string
  index: number
  message: string
}

export interface ImportResult {
  created: number
  updated: number
  errors: ImportItemError[]
}

export interface TemplateImportResult {
  template: { id: string; name: string; [key: string]: unknown }
  validation: { valid: boolean; errors?: { code?: string; message?: string }[] }
}

/** Authenticated JSON POST for import endpoints not yet in generated GatewayPaths. */
export async function postImport<T>(path: string, body: unknown): Promise<T> {
  const token = await ensureAccessToken()
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    let message = `HTTP ${res.status}`
    try {
      const text = await res.text()
      if (text) message = text
    } catch {
      // ignore
    }
    throw new ApiError(res.status, message)
  }
  return (await res.json()) as T
}

export function summarizeImport(result: ImportResult): string {
  const errCount = result.errors?.length ?? 0
  const parts = [`создано: ${result.created}`, `обновлено: ${result.updated}`]
  if (errCount) parts.push(`ошибок: ${errCount}`)
  return parts.join(', ')
}
