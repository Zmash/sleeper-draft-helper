import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { callAiDraftStrategy } from './aiStrategyClient'

const PAYLOAD = {
  format: { teams: 12, scoringType: 'half_ppr', superflex: false, rosterPositions: ['QB','RB'] },
  season: '2026', draftMode: 'redraft', draftSlot: 7, principles: 'P',
}

function sseResponse(lines) {
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(lines))
      controller.close()
    },
  })
  return new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } })
}

beforeEach(() => { localStorage.setItem('sdh_api_key', 'sk-test') })
afterEach(() => { vi.restoreAllMocks(); localStorage.clear() })

describe('callAiDraftStrategy', () => {
  it('schickt den Key im Header, nicht im Body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(sseResponse(
      'event: result\ndata: {"ok":true,"parsed":{"summary":"S","rules":[],"sources":[]},"model":"m"}\n\n'
    ))
    vi.stubGlobal('fetch', fetchMock)

    await callAiDraftStrategy(PAYLOAD)

    const [url, opts] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/ai-draft-strategy')
    expect(opts.headers['x-anthropic-key']).toBe('sk-test')
    expect(opts.body).not.toContain('sk-test')
  })

  it('liefert das geparste Ergebnis', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(sseResponse(
      'event: result\ndata: {"ok":true,"parsed":{"summary":"Leitlinie","rules":["R1"],"sources":[]},"model":"m"}\n\n'
    )))
    const got = await callAiDraftStrategy(PAYLOAD)
    expect(got.parsed.summary).toBe('Leitlinie')
    expect(got.model).toBe('m')
  })

  it('wirft bei event: error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(sseResponse(
      'event: error\ndata: {"ok":false,"message":"Kaputt"}\n\n'
    )))
    await expect(callAiDraftStrategy(PAYLOAD)).rejects.toThrow('Kaputt')
  })

  it('wirft ohne API-Key', async () => {
    localStorage.clear()
    await expect(callAiDraftStrategy(PAYLOAD)).rejects.toThrow(/key/i)
  })

  it('wirft bei HTTP-Fehler', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 'Bad payload' }), { status: 400 })
    ))
    await expect(callAiDraftStrategy(PAYLOAD)).rejects.toThrow('Bad payload')
  })
})
