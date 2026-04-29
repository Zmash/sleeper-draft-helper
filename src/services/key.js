// Provider-agnostic API key storage (migrated from OpenAI to Anthropic).
// Function names kept stable to avoid cascading renames across components.
const KEY_STORAGE = 'sdh_api_key'

export function getOpenAIKey() {
  try { return localStorage.getItem(KEY_STORAGE) || '' } catch { return '' }
}

export function setOpenAIKey(key) {
  try {
    if (key) localStorage.setItem(KEY_STORAGE, key.trim())
    else localStorage.removeItem(KEY_STORAGE)
    return true
  } catch { return false }
}

export function maskKey(k) {
  if (!k) return ''
  const t = k.trim()
  if (t.length <= 8) return '••••'
  return t.slice(0, 4) + '••••' + t.slice(-4)
}
