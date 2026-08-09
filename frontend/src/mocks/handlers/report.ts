import { http, HttpResponse } from 'msw'

export const reportHandlers = [
  http.post('/api/reports', async ({ request }) => {
    const body = (await request.json()) as { sessionId: string }
    return HttpResponse.json(
      {
        id: `rep-${Date.now()}`,
        sessionId: body.sessionId,
        status: 'generating',
        createdAt: new Date().toISOString(),
      },
      { status: 201 },
    )
  }),

  http.get('/api/reports/:id', ({ params }) => {
    return HttpResponse.json({
      id: params.id,
      sessionId: 'sess-002',
      status: 'ready',
      score: 87,
      createdAt: new Date(Date.now() - 3600000).toISOString(),
      downloadUrl: `/api/reports/${params.id}/download`,
    })
  }),

  http.get('/api/reports/:id/download', () => {
    const pdfContent = '%PDF-1.4 mock pdf content'
    return new HttpResponse(pdfContent, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="report.pdf"',
      },
    })
  }),
]
