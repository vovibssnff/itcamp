import { apiClient } from './client'
import { unwrap } from './request'
import { mapSnapshot, type SnapshotMeta } from './mappers'

export const snapshotsApi = {
  async list(sessionId?: string): Promise<SnapshotMeta[]> {
    const raw = await unwrap<unknown[]>(
      apiClient.GET('/api/v1/snapshots', {
        params: sessionId ? { query: { session_id: sessionId } as never } : undefined,
      }),
    )
    return (raw ?? []).map(mapSnapshot)
  },

  async get(id: string): Promise<SnapshotMeta> {
    const raw = await unwrap<unknown>(
      apiClient.GET('/api/v1/snapshots/{id}', { params: { path: { id } } }),
    )
    return mapSnapshot(raw)
  },
}
