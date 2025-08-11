/**
 * General purpose utilities shared across the app.
 */

export function cx(...cls) {
  return cls.filter(Boolean).join(' ');
}

export function parseDraftId(input = '') {
  const trimmed = String(input || '').trim();
  if (!trimmed) return '';
  // Try URL pattern first
  const m = trimmed.match(/draft\/([A-Za-z0-9_-]+)/i);
  return m ? m[1] : trimmed;
}

export function clamp(n, min = 0, max = 100) {
  const x = Number(n);
  if (!Number.isFinite(x)) return min;
  return Math.max(min, Math.min(max, x));
}

export function toPercent(n, d) {
  const num = Number(n), den = Number(d);
  if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0) return 0;
  return Math.round((num / den) * 100);
}

export function normalizeName(first = '', last = '') {
  const f = String(first || '').trim();
  const l = String(last || '').trim();
  return `${f} ${l}`.trim();
}
