// LocalStorage keys
export const STORAGE_KEY = 'draft-helper-state-v3'
export const THEME_STORAGE_KEY = 'draft-helper-theme' // 'dark' | 'light'
export const SETUP_KEY = 'sdh.setup.v2'

export const saveToLocalStorage = (partial) => {
  const previous = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
  const next = { ...previous, ...partial }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
}

export const loadFromLocalStorage = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
  } catch {
    return {}
  }
}

export function loadSetup() {
  try {
    return JSON.parse(localStorage.getItem(SETUP_KEY) || '{}')
  } catch {
    return {}
  }
}

export function saveSetup(obj) {
  try {
    const prev = loadSetup()
    const next = { ...prev, ...(obj || {}) }
    localStorage.setItem(SETUP_KEY, JSON.stringify(next))
  } catch {}
}
