import { THEMES, DEFAULT_THEME_ID } from './themes'

export function resolveInitialTheme() {
  if (typeof window === 'undefined' || !window.matchMedia) return DEFAULT_THEME_ID
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'broadcast-light' : 'broadcast-dark'
}

export function applyTheme(themeId) {
  const id = THEMES.some((t) => t.id === themeId) ? themeId : DEFAULT_THEME_ID
  if (typeof document !== 'undefined') document.documentElement.dataset.theme = id
  return id
}
