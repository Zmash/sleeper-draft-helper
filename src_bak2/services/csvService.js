// src/services/csvService.js
/**
 * Handles FantasyPros CSV with headers:
 * "RK", TIERS, "PLAYER NAME", TEAM, "POS", "BYE WEEK", "SOS SEASON", "ECR VS. ADP"
 */

export function parseCsv(text = '') {
  const lines = (text || '').replace(/\r\n?/g, '\n').split('\n');
  const cleaned = trimEmpty(lines);
  if (!cleaned.length) return { headers: [], rows: [] };

  const headers = splitCsvLine(cleaned[0]).map((h) => String(h || '').trim());
  const rows = [];
  for (let i = 1; i < cleaned.length; i++) {
    const cols = splitCsvLine(cleaned[i]);
    if (!cols.length || cols.every((c) => String(c).trim() === '')) continue;
    const row = Object.create(null);
    headers.forEach((h, idx) => { row[h] = cols[idx] ?? ''; });
    rows.push(row);
  }
  return { headers, rows };
}

function trimEmpty(lines) {
  let a = 0, b = lines.length - 1;
  while (a <= b && String(lines[a]).trim() === '') a++;
  while (b >= a && String(lines[b]).trim() === '') b--;
  return lines.slice(a, b + 1);
}

// Supports quoted fields and escaped quotes ("")
function splitCsvLine(line = '') {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      out.push(cur); cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

export function mapFantasyProsRowsToPlayers(rows = []) {
  const out = [];
  for (const r of rows) {
    const rk = toNumber(get(r, ['RK']));
    const name = get(r, ['PLAYER NAME', 'PLAYER', 'NAME']);
    const team = get(r, ['TEAM']);
    const posRaw = get(r, ['POS', 'POSITION']);
    const bye = toNumber(get(r, ['BYE WEEK', 'BYE']));
    const sos = get(r, ['SOS SEASON', 'SOS']);
    const ecrVsAdp = get(r, ['ECR VS. ADP', 'ECR VS ADP', 'ECR–ADP', 'ECR-ADP']);

    const { pos, posRank } = parsePos(posRaw);
    out.push({
      rk: Number.isFinite(rk) ? rk : (String(get(r, ['RK'])).trim() || ''),
      name: (name || '').replaceAll('"', '').trim(),
      team: (team || '').trim(),
      pos,
      posRank, // optional, not shown but useful
      bye: Number.isFinite(bye) ? bye : (String(get(r, ['BYE WEEK'])).trim() || ''),
      sos: (sos || '').trim(),
      ecrVsAdp: (ecrVsAdp || '').trim(),
    });
  }
  return out;
}

// helpers
function get(obj, keys) {
  const dict = obj || {};
  for (const k of keys) {
    const hit = findKey(dict, k);
    if (hit) return dict[hit];
  }
  return '';
}
function findKey(obj, keyLike) {
  const target = String(keyLike).toLowerCase();
  const keys = Object.keys(obj || {});
  for (const k of keys) {
    if (k.toLowerCase() === target) return k;
  }
  for (const k of keys) {
    if (k.toLowerCase().includes(target)) return k;
  }
  return null;
}
function toNumber(v) {
  const n = Number(String(v ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : NaN;
}
function parsePos(v = '') {
  const s = String(v || '').toUpperCase().trim();
  const m = s.match(/^([A-Z]+)\s*([0-9]+)?/);
  if (!m) return { pos: s || '', posRank: undefined };
  return { pos: m[1], posRank: m[2] ? Number(m[2]) : undefined };
}
