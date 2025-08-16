import Papa from 'papaparse'
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

    return {
      id: idx + 1,
      rk: rkRaw || String(idx + 1),
      ecr: ecrNum, // numerischer ECR zusätzlich zu rk
      tier: row['TIERS'] || '',
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

      nname: normalizePlayerName(row['PLAYER NAME'] || row['Player'] || row['Name'] || ''),
      status: null,     // null | 'me' | 'other'
      pick_no: null,
      picked_by: null,
    }
  })
}