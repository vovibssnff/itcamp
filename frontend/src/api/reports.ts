import { apiClient } from './client'
import { unwrap } from './request'
import { mapReport, type ReportMeta } from './mappers'
import { useAuthStore } from '@/store/auth'

const BASE_URL =
  import.meta.env.VITE_MOCK_API === 'true' ? '' : (import.meta.env.VITE_API_BASE_URL ?? '')

export const reportsApi = {
  async list(sessionId?: string): Promise<ReportMeta[]> {
    const raw = await unwrap<unknown[]>(
      apiClient.GET('/api/v1/reports', {
        params: sessionId ? { query: { session_id: sessionId } as never } : undefined,
      }),
    )
    return (raw ?? []).map(mapReport)
  },

  async get(id: string): Promise<ReportMeta> {
    const raw = await unwrap<unknown>(
      apiClient.GET('/api/v1/reports/{id}', { params: { path: { id } } }),
    )
    return mapReport(raw)
  },

  async create(sessionId: string, type: 'session' | 'exam' = 'session'): Promise<ReportMeta> {
    const raw = await unwrap<unknown>(
      apiClient.POST('/api/v1/reports', {
        body: { session_id: sessionId, type } as never,
      }),
    )
    return mapReport(raw)
  },

  downloadUrl(id: string): string {
    return `${BASE_URL}/api/v1/reports/${id}/download`
  },

  async download(id: string): Promise<void> {
    const token = useAuthStore.getState().accessToken
    const res = await fetch(this.downloadUrl(id), {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (!res.ok) {
      throw new Error(`Download failed: HTTP ${res.status}`)
    }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `report-${id}.pdf`
    a.click()
    URL.revokeObjectURL(url)
  },
}
