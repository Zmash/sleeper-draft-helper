// LocalStorage keys
export const STORAGE_KEY = 'draft-helper-state-v3'
export const THEME_STORAGE_KEY = 'draft-helper-theme' // 'dark' | 'light'

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
