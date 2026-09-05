// Transport fuer /api/ai-advice: POST + SSE-Stream + Validierung.
// Gleiches Muster wie aiDraftReviewClient.js / aiStrategyClient.js — die
// Payload-Erzeugung bleibt bei buildAIAdviceRequest/buildAdviceRequestArgs,
// hier steckt nur der Weg zum Server und zurueck.
import { validateAdvice } from './aiValidate'

/**
 * Fragt eine AI-Empfehlung an und liefert das validierte Ergebnis.
 *
 * @param {object} payload          Fertiger Anthropic-Request (buildAIAdviceRequest)
 * @param {string} apiKey           Anthropic-Key des Nutzers (nur als Header, nie im Body)
 * @param {Set}    availableNnames  Noch verfuegbare Spieler — verhindert, dass
 *                                  das Modell bereits gedraftete empfiehlt.
 * @returns {Promise<{advice, warnings, usage, model}>}
 */
export async function askAiAdvice({ payload, apiKey, availableNnames }) {
  const res = await fetch('/api/ai-advice', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Anthropic-Key': apiKey },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.message || err?.error || `HTTP ${res.status}`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let result = null

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const parts = buffer.split('\n\n')
    buffer = parts.pop() ?? ''

    for (const part of parts) {
      if (!part.trim()) continue
      const lines = part.split('\n')
      const eventType = lines.find((l) => l.startsWith('event: '))?.slice(7).trim() || 'message'
      const dataLine = lines.find((l) => l.startsWith('data: '))
      if (!dataLine) continue
      let data
      try { data = JSON.parse(dataLine.slice(6)) } catch { continue }

      if (eventType === 'error') throw new Error(data.message || 'AI error')
      if (eventType !== 'result') continue
      if (!data.ok) throw new Error(data.message || 'AI error')

      const { cleaned, warnings } = validateAdvice(data.parsed, availableNnames)
      result = { advice: cleaned, warnings, usage: data.usage || null, model: data.model || '' }
    }
  }

  // Bricht die Verbindung waehrend der ~25s Wartezeit ab (Mobilfunk, Proxy,
  // Tab-Wechsel), endete die Schleife sonst stumm: kein Ergebnis, kein Fehler.
  if (!result) {
    throw new Error('Verbindung zur AI abgebrochen, bevor eine Antwort ankam. Bitte erneut versuchen.')
  }
  return result
}

/** Prueft einen Anthropic-Key gegen /api/validate-key. */
export async function validateAnthropicKey(apiKey) {
  try {
    const res = await fetch('/api/validate-key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Anthropic-Key': apiKey },
      body: JSON.stringify({}),
    })
    return res.ok
  } catch {
    return false
  }
}
