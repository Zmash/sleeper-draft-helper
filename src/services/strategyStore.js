// Persistenz der Draft-Strategie-Bibliothek. Bewusst getrennt von
// strategyMatch.js: das Matching kennt kein localStorage und bleibt rein testbar.

export const STRATEGIES_KEY = 'sdh.strategies.v1'
const LEGACY_KEY = 'sdh.strategy.v1'

const EMPTY = { version: 1, principles: '', items: [] }

export function loadStrategies() {
  try {
    const raw = JSON.parse(localStorage.getItem(STRATEGIES_KEY) || 'null')
    if (!raw || typeof raw !== 'object') return { ...EMPTY }
    return {
      version: 1,
      principles: String(raw.principles || ''),
      items: Array.isArray(raw.items) ? raw.items : [],
    }
  } catch {
    return { ...EMPTY }
  }
}

export function saveStrategies(store) {
  try {
    localStorage.setItem(STRATEGIES_KEY, JSON.stringify({
      version: 1,
      principles: String(store?.principles || ''),
      items: Array.isArray(store?.items) ? store.items : [],
    }))
  } catch {}
}

export function newStrategyItem({
  label = '', fingerprint = null, summary = '', rules = [],
  sources = [], contested = [], source = 'manual',
} = {}) {
  const id = (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? `str_${crypto.randomUUID()}`
    : `str_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  return {
    id, label, fingerprint, summary,
    rules: Array.isArray(rules) ? rules : [],
    sources: Array.isArray(sources) ? sources : [],
    contested: Array.isArray(contested) ? contested : [],
    source,
    createdAt: new Date().toISOString(),
  }
}

// Uebernimmt den alten globalen Freitext als Wildcard-Item (fingerprint: null) —
// es passt damit ueberall, wird aber nie einem echten Format-Treffer vorgezogen.
// Der alte Key bleibt liegen, damit ein Rollback moeglich bleibt.
export function migrateLegacyStrategy() {
  try {
    if (localStorage.getItem(STRATEGIES_KEY)) return
    const legacy = String(localStorage.getItem(LEGACY_KEY) || '').trim()
    if (!legacy) return
    saveStrategies({
      version: 1,
      principles: '',
      items: [newStrategyItem({ label: 'Uebernommen', summary: legacy, source: 'manual' })],
    })
    console.log('[SDH] Draft-Strategie aus sdh.strategy.v1 uebernommen')
  } catch {}
}
