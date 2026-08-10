import { http, HttpResponse } from 'msw'

interface MockReport {
  id: string
  session_id: string
  type: 'session' | 'exam'
  status: 'queued' | 'processing' | 'ready' | 'failed'
  download_url: string
  created_at: string
}

const reports: MockReport[] = [
  {
    id: 'rep-001',
    session_id: 'sess-002',
    type: 'exam',
    status: 'ready',
    download_url: '/api/v1/reports/rep-001/download',
    created_at: new Date(Date.now() - 3600000).toISOString(),
  },
]

export const reportHandlers = [
  http.get('/api/v1/reports', ({ request }) => {
    const url = new URL(request.url)
    const sessionId = url.searchParams.get('session_id')
    const items = sessionId ? reports.filter((r) => r.session_id === sessionId) : reports
    return HttpResponse.json(items)
  }),

  http.post('/api/v1/reports', async ({ request }) => {
    const body = (await request.json()) as { session_id: string; type?: 'session' | 'exam' }
    const created: MockReport = {
      id: `rep-${Date.now()}`,
      session_id: body.session_id,
      type: body.type ?? 'session',
      status: 'queued',
      download_url: '',
      created_at: new Date().toISOString(),
    }
    reports.push(created)
    // Simulate async ready shortly for mock UX
    created.status = 'ready'
    created.download_url = `/api/v1/reports/${created.id}/download`
    return HttpResponse.json(created, { status: 202 })
  }),

  http.get('/api/v1/reports/:id', ({ params }) => {
    const found = reports.find((r) => r.id === params.id)
    if (!found) {
      return HttpResponse.json({
        id: params.id,
        session_id: 'sess-002',
        type: 'session',
        status: 'ready',
        download_url: `/api/v1/reports/${params.id}/download`,
        created_at: new Date(Date.now() - 3600000).toISOString(),
      })
    }
    return HttpResponse.json(found)
  }),

  http.get('/api/v1/reports/:id/download', () => {
    const pdfContent = '%PDF-1.4 mock pdf content'
    return new HttpResponse(pdfContent, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="report.pdf"',
      },
    })
  }),
]
