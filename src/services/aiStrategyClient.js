import { getOpenAIKey } from './key'

// Liest den SSE-Stream von /api/ai-draft-strategy. Bewusst eigenstaendig statt
// gemeinsam mit aiDraftReviewClient: dort ist der Reader an das Review-Format
// gebunden, hier reichen result und error.
async function readSSEResult(res) {
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let result = null
  let error = null
  let usage = null
  let model = ''

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    const chunks = buffer.split('\n\n')
    buffer = chunks.pop() || ''

    for (const chunk of chunks) {
      const evLine = chunk.split('\n').find(l => l.startsWith('event: '))
      const dataLine = chunk.split('\n').find(l => l.startsWith('data: '))
      if (!evLine || !dataLine) continue

      const event = evLine.slice(7).trim()
      let data = null
      try { data = JSON.parse(dataLine.slice(6)) } catch { continue }

      if (event === 'result') {
        result = data?.parsed || null
        usage = data?.usage || null
        model = data?.model || ''
      } else if (event === 'error') {
        error = data?.message || 'Strategie-Recherche fehlgeschlagen'
      }
    }
  }

  if (error) throw new Error(error)
  if (!result) throw new Error('Keine Strategie erhalten')
  return { parsed: result, usage, model }
}

/**
 * Ruft /api/ai-draft-strategy und liefert { parsed, usage, model }.
 * parsed = { summary, rules[], sources[], contested? }
 */
export async function callAiDraftStrategy({ format, season, draftMode, draftSlot = null, principles = '' }) {
  const key = getOpenAIKey()
  if (!key) throw new Error('Kein Anthropic API-Key hinterlegt')

  const res = await fetch('/api/ai-draft-strategy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-anthropic-key': key },
    body: JSON.stringify({ format, season, draftMode, draftSlot, principles }),
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data?.error || data?.message || `HTTP ${res.status}`)
  }

  return readSSEResult(res)
}
