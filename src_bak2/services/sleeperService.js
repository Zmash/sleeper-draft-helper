const API_BASE = 'https://api.sleeper.app/v1';

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

export async function fetchUser(username) {
  if (!username) throw new Error('username required');
  return fetchJson(`${API_BASE}/user/${encodeURIComponent(username)}`);
}

export async function fetchUserById(userId) {
  if (!userId) throw new Error('userId required');
  return fetchJson(`${API_BASE}/user/${encodeURIComponent(userId)}`);
}

export async function resolveUserId({ username, userId }) {
  let resolvedId = userId;
  let user = null;
  if (!resolvedId && username) {
    user = await fetchUser(username);
    resolvedId = user?.user_id || user?.userId || user?.id;
  }
  if (!resolvedId) throw new Error('Unable to resolve user id. Provide username or userId.');
  return { userId: String(resolvedId), user };
}

export async function fetchLeagues(userId, year) {
  if (!userId) throw new Error('userId required');
  if (!year) throw new Error('year required');
  return fetchJson(`${API_BASE}/user/${userId}/leagues/nfl/${year}`);
}

export async function fetchLeagueDrafts(leagueId) {
  if (!leagueId) throw new Error('leagueId required');
  return fetchJson(`${API_BASE}/league/${leagueId}/drafts`);
}

export async function fetchDraft(draftId) {
  if (!draftId) throw new Error('draftId required');
  return fetchJson(`${API_BASE}/draft/${draftId}`);
}

export async function fetchDraftPicks(draftId) {
  if (!draftId) throw new Error('draftId required');
  return fetchJson(`${API_BASE}/draft/${draftId}/picks`);
}

/**
 * Human-friendly label for drafts.
 * Falls back to ID if no meta is available.
 */
export function formatDraftLabel(d = {}) {
  const id = d.draft_id || d.id || '';
  const name = d.name || '';
  const t = d.type || d.draft_type || '';
  const rounds = d.settings?.rounds ?? d.rounds ?? '';
  const teams = d.settings?.teams ?? d.teams ?? '';

  const parts = [];
  if (name) parts.push(name);
  if (t) parts.push(t);
  if (rounds) parts.push(`${rounds} rds`);
  if (teams) parts.push(`${teams} teams`);

  return parts.join(' · ') || id || 'Draft';
}

/**
 * Current pick label from picks array, e.g. "Pick 3.04".
 */
export function getCurrentPickLabel(picks = []) {
  if (!Array.isArray(picks) || !picks.length) return '';
  const last = picks[picks.length - 1];
  if (!last) return '';
  const rnd = last.round ?? '';
  const pn = last.pick_no ?? '';
  if (!rnd && !pn) return '';
  return pn && rnd ? `Pick ${rnd}.${String(pn).padStart(2, '0')}` : `Pick ${pn}`;
}
