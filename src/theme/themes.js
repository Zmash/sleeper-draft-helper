export const THEMES = [
  { id: 'broadcast-dark', label: 'Broadcast Dark', kind: 'dark' },
  { id: 'broadcast-light', label: 'Broadcast Light', kind: 'light' },
  { id: 'broadcast-pinkluke', label: 'Broadcast PinkLuke', kind: 'dark' },
  { id: 'broadcast-volt', label: 'Broadcast Volt', kind: 'dark' },
  { id: 'broadcast-ferrari', label: 'Broadcast Ferrari', kind: 'dark' },
  { id: 'broadcast-nike', label: 'Broadcast Nike', kind: 'light' },
  { id: 'broadcast-spotify', label: 'Broadcast Spotify', kind: 'dark' },
]

export const DEFAULT_THEME_ID = 'broadcast-dark'

// Map preferred color-scheme → first matching theme in the registry.
// Used by resolveInitialTheme() so the system preference picks a sensible default
// even after additional dark/light variants are registered.
export const DEFAULT_LIGHT_ID = 'broadcast-light'
export const DEFAULT_DARK_ID = 'broadcast-dark'
