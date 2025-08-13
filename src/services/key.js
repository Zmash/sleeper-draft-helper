export const OPENAI_KEY_STORAGE = 'sdh_openai_api_key'

export function getOpenAIKey() {
  try { return localStorage.getItem(OPENAI_KEY_STORAGE) || '' } catch { return '' }
}

export function setOpenAIKey(key) {
  try {
    if (key) localStorage.setItem(OPENAI_KEY_STORAGE, key.trim())
    else localStorage.removeItem(OPENAI_KEY_STORAGE)
    return true
  } catch {
    return false
  }
}

export function maskKey(k) {
  if (!k) return ''
  const t = k.trim()
  if (t.length <= 8) return '••••'
  return t.slice(0,4) + '••••' + t.slice(-4)
}
