export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export function toErrorMessage(error: unknown, fallback = 'Request failed'): string {
  if (error instanceof ApiError) return error.message || `HTTP ${error.status}`
  if (error instanceof Error) return error.message
  return fallback
}
