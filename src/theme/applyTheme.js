import { THEMES, DEFAULT_THEME_ID, DEFAULT_LIGHT_ID, DEFAULT_DARK_ID } from './themes'

function firstOfKind(kind, fallback) {
  return THEMES.find((t) => t.kind === kind)?.id ?? fallback
}

export function resolveInitialTheme() {
  if (typeof window === 'undefined' || !window.matchMedia) return DEFAULT_THEME_ID
  return window.matchMedia('(prefers-color-scheme: light)').matches
    ? firstOfKind('light', DEFAULT_LIGHT_ID)
    : firstOfKind('dark', DEFAULT_DARK_ID)
}

export function applyTheme(themeId) {
  const id = THEMES.some((t) => t.id === themeId) ? themeId : DEFAULT_THEME_ID
  if (typeof document !== 'undefined') document.documentElement.dataset.theme = id
  return id
}
