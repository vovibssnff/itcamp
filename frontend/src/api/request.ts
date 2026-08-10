import { ApiError } from './errors'

interface FetchResult {
  data?: unknown
  error?: unknown
  response: Response
}

/**
 * Normalize an openapi-fetch result into a typed value.
 * The gateway OpenAPI often omits response schemas (`content?: never`),
 * so we fall back to parsing the Response body when `data` is undefined.
 */
export async function unwrap<T>(result: FetchResult | Promise<FetchResult>): Promise<T> {
  const { data, error, response } = await result

  if (!response.ok) {
    let message = `HTTP ${response.status}`
    if (error && typeof error === 'object') {
      const errObj = error as { message?: unknown; error?: unknown }
      if (typeof errObj.message === 'string') message = errObj.message
      else if (typeof errObj.error === 'string') message = errObj.error
      else message = JSON.stringify(error)
    } else {
      try {
        const text = await response.clone().text()
        if (text) message = text
      } catch {
        // ignore
      }
    }
    throw new ApiError(response.status, message)
  }

  if (data !== undefined && data !== null) {
    return data as T
  }

  // No typed body in the OpenAPI schema — parse JSON if present.
  const text = await response.clone().text()
  if (!text) return undefined as T
  return JSON.parse(text) as T
}

export async function unwrapVoid(result: FetchResult | Promise<FetchResult>): Promise<void> {
  await unwrap<unknown>(result)
}
