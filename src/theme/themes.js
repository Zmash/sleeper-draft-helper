export const THEMES = [
  { id: 'broadcast-dark', label: 'Broadcast Dark', kind: 'dark' },
  { id: 'broadcast-light', label: 'Broadcast Light', kind: 'light' },
  { id: 'broadcast-pinkluke', label: 'Broadcast PinkLuke', kind: 'dark' },
  { id: 'broadcast-crimson', label: 'Broadcast Crimson', kind: 'dark' },
  { id: 'broadcast-vikings', label: 'Broadcast Vikings', kind: 'dark' },
]

export const DEFAULT_THEME_ID = 'broadcast-dark'

// Map preferred color-scheme → first matching theme in the registry.
// Used by resolveInitialTheme() so the system preference picks a sensible default
// even after additional dark/light variants are registered.
export const DEFAULT_LIGHT_ID = 'broadcast-light'
export const DEFAULT_DARK_ID = 'broadcast-dark'
