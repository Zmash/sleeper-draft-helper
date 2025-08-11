/**
 * Centralized localStorage helpers.
 * Keep all persistence paths in one place to avoid scattering.
 */

const KEY = 'sleeper-draft-helper';

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function save(partial) {
  try {
    const current = load() || {};
    const next = { ...current, ...partial };
    localStorage.setItem(KEY, JSON.stringify(next));
    return next;
  } catch {
    return null;
  }
}

export function setItem(path, value) {
  try {
    const current = load() || {};
    setDeep(current, path, value);
    localStorage.setItem(KEY, JSON.stringify(current));
    return current;
  } catch {
    return null;
  }
}

export function getItem(path, defaultValue = null) {
  try {
    const current = load();
    if (!current) return defaultValue;
    const val = getDeep(current, path);
    return typeof val === 'undefined' ? defaultValue : val;
  } catch {
    return defaultValue;
  }
}

function setDeep(obj, path, value) {
  const parts = String(path).split('.').filter(Boolean);
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    cur[p] = cur[p] && typeof cur[p] === 'object' ? cur[p] : {};
    cur = cur[p];
  }
  cur[parts[parts.length - 1]] = value;
}

function getDeep(obj, path) {
  const parts = String(path).split('.').filter(Boolean);
  let cur = obj;
  for (const p of parts) {
    if (!cur || typeof cur !== 'object') return undefined;
    cur = cur[p];
  }
  return cur;
}
