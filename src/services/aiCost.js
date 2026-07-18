// Kostenschaetzung fuer AI-Calls. Grob per Design: die Anzeige sagt "≈" und "~".
// USD je Million Tokens. Stand 2026-07 — bei Modellwechsel gegen
// https://docs.anthropic.com (Pricing) pruefen. EINZIGE Preis-Stelle der App.
export const PRICING = {
  'claude-sonnet-5': { input: 3, output: 15 },
}
const FALLBACK = PRICING['claude-sonnet-5']

export function estimateTokens(payload) {
  try { return Math.round(JSON.stringify(payload).length / 4) } catch { return null }
}

export function estimateCostUsd({ inputTokens = 0, outputTokens = 0, model } = {}) {
  const p = PRICING[model] || FALLBACK
  return (inputTokens * p.input + outputTokens * p.output) / 1e6
}

export function formatTokens(n) {
  if (n == null || !Number.isFinite(Number(n))) return '—'
  const v = Number(n)
  return v >= 500 ? `${(v / 1000).toFixed(1).replace('.', ',')}k` : String(v)
}

function formatUsd(usd) {
  return `${usd.toFixed(2).replace('.', ',')} $`
}

export function formatEstimate(payload, model) {
  const tok = estimateTokens(payload)
  if (tok == null) return ''
  const usd = estimateCostUsd({ inputTokens: tok, model })
  return `≈ ${formatTokens(tok)} Tokens · ~${formatUsd(usd)}`
}

export function formatUsage(usage, model) {
  if (!usage) return ''
  const inTok = usage.input_tokens ?? 0
  const outTok = usage.output_tokens ?? 0
  const cache = usage.cache_read_input_tokens ?? 0
  const usd = estimateCostUsd({ inputTokens: inTok, outputTokens: outTok, model })
  const parts = [`${formatTokens(inTok)} in / ${formatTokens(outTok)} out`]
  if (cache > 0) parts.push(`Cache ${formatTokens(cache)}`)
  parts.push(`~${formatUsd(usd)}`)
  return parts.join(' · ')
}
