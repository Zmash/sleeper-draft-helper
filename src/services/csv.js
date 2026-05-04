import Papa from 'papaparse'

export function exportBoardAsCsv(players) {
  const headers = ['Rank', 'Name', 'Position', 'Team', 'Age', 'Tier', 'Dynasty Value', 'Bye', 'SOS', 'ECR±ADP', 'ADP', 'Pick']
  const escapeCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const rows = [
    headers.map(escapeCell).join(','),
    ...players.map(p => [
      p.rk, p.name, p.pos, p.team,
      p.age ?? '', p.tier ?? '', p.dynasty_value ?? '',
      p.bye ?? '', p.sos ?? '', p.ecrVsAdp ?? '', p.adp ?? '',
      p.pick_no ?? '',
    ].map(escapeCell).join(',')),
  ].join('\n')

  const blob = new Blob([rows], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `rankings_${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
import { normalizePlayerName } from '../utils/formatting'

// kleines Helper für robuste Zahl-Parsing (auch "+3", "-1.5", "3,2" etc.)
function toNum(v) {
  if (v === undefined || v === null) return null
  const s = String(v).trim().replace(',', '.')
  const n = parseFloat(s)
  return Number.isFinite(n) ? n : null
}

export function parseFantasyProsCsv(text) {
  if (!text?.trim()) return []
  const parsed = Papa.parse(text, { header: true, skipEmptyLines: true })

  return (parsed.data || []).map((row, idx) => {
    // ECR / Rank
    const rkRaw = row['RK']
    const ecrNum = toNum(rkRaw) ?? (idx + 1)

    // Delta zwischen ECR und ADP (verschiedene Header-Varianten absichern)
    const ecrVsAdpRaw =
      row['ECR VS. ADP'] ??
      row['ECR vs. ADP'] ??
      row['ECRvsADP'] ??
      row['ECR-ADP'] ??
      row['ECR_VS_ADP']

    const ecrVsAdpNum = toNum(ecrVsAdpRaw)

    // ADP = ECR + (ECRvsADP); falls Delta fehlt, kein ADP
    const adp = (Number.isFinite(ecrNum) && Number.isFinite(ecrVsAdpNum))
      ? (ecrNum + ecrVsAdpNum)
      : null

    // Dynasty Value (FantasyPros dynasty/rookie rankings)
    const dynastyValueRaw =
      row['DYNASTY VALUE'] ??
      row['Dynasty Value'] ??
      row['DYN VALUE'] ??
      row['DYN. VALUE'] ??
      row['VALUE'] ??
      row['Value'] ??
      null
    const dynastyValue = toNum(dynastyValueRaw)

    // Age / Experience (relevant für Dynasty)
    const ageRaw = row['AGE'] ?? row['Age'] ?? null
    const ageNum = toNum(ageRaw)

    const expRaw = row['EXP'] ?? row['YRS EXP'] ?? row['Experience'] ?? null
    const expNum = toNum(expRaw)

    return {
      id: idx + 1,
      rk: rkRaw || String(idx + 1),
      ecr: ecrNum, // numerischer ECR zusätzlich zu rk
      tier: row['TIERS'] || row['TIER'] || '',
      name: row['PLAYER NAME'] || row['Player'] || row['Name'] || '',
      team: row['TEAM'] || row['Team'] || '',
      pos: (row['POS'] || row['Position'] || '').replace(/\d+/g, ''),
      bye: row['BYE WEEK'] || row['Bye'] || '',
      // Umwandeln in X/5 format zur besseren Übersicht
      sos: (() => {
        const raw = row['SOS SEASON'] || row['SOS'] || ''
        const m = String(raw).match(/(\d)\s*(?:out\s*of|\/)\s*5/i)
        return m ? `${m[1]}/5` : raw
      })(),
      ecrVsAdp: ecrVsAdpRaw ?? '',   // Original-String beibehalten (z.B. "+3")
      adp: Number.isFinite(adp) ? adp : null, // berechneter ADP
      dynasty_value: Number.isFinite(dynastyValue) ? dynastyValue : null,
      age: Number.isFinite(ageNum) ? ageNum : null,
      years_exp: Number.isFinite(expNum) ? expNum : null,

      nname: normalizePlayerName(row['PLAYER NAME'] || row['Player'] || row['Name'] || ''),
      status: null,     // null | 'me' | 'other'
      pick_no: null,
      picked_by: null,
    }
  })
}