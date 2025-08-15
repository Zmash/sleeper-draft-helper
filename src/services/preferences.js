// Sleeper Draft Helper - Player Preferences
// Storage nur fÃ¼r FAVORITE und AVOID; NEUTRAL = nicht vorhanden
const STORAGE_KEY = 'sdh.playerPreferences.v1';

export const PlayerPreference = {
  FAVORITE: 'favorite',
  AVOID: 'avoid',
};

export function loadPreferences() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function savePreferences(map) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
  }
}

// Liefert 'favorite' | 'avoid' | null (null = neutral)
export function getPreference(map, playerId) {
  return map[playerId] || null;
}

// pref: 'favorite' | 'avoid' | null
export function setPreference(map, playerId, pref) {
  const next = { ...map };
  if (pref === null) {
    delete next[playerId]; // Neutral = entfernen
  } else {
    next[playerId] = pref;
  }
  savePreferences(next);
  return next;
}
