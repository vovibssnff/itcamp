import { apiClient } from './client'
import { unwrap } from './request'
import { mapReplay, mapScore, type ReplayData, type ScoreData } from './mappers'

export const assessmentApi = {
  async getScore(sessionId: string): Promise<ScoreData> {
    const raw = await unwrap<unknown>(
      apiClient.GET('/api/v1/assessment/session/{id}/score', {
        params: { path: { id: sessionId } },
      }),
    )
    return mapScore(raw)
  },

  async override(input: {
    sessionId: string
    newScore: number
    verdict: 'pass' | 'fail'
    comment: string
  }): Promise<ScoreData> {
    const raw = await unwrap<unknown>(
      apiClient.POST('/api/v1/assessment/override', {
        body: {
          session_id: input.sessionId,
          new_score: input.newScore,
          verdict: input.verdict,
          comment: input.comment,
        } as never,
      }),
    )
    return mapScore(raw)
  },

  async getReplay(sessionId: string): Promise<ReplayData> {
    const raw = await unwrap<unknown>(
      apiClient.GET('/api/v1/assessment/session/{id}/replay', {
        params: { path: { id: sessionId } },
      }),
    )
    return mapReplay(raw)
  },
}
