import Papa from 'papaparse'
import { normalizePlayerName } from '../utils/formatting'

export function parseFantasyProsCsv(text) {
  if (!text?.trim()) return []
  const parsed = Papa.parse(text, { header: true, skipEmptyLines: true })

  return (parsed.data || []).map((row, idx) => ({
    id: idx + 1,
    rk: row['RK'] || String(idx + 1),
    tier: row['TIERS'] || '',
    name: row['PLAYER NAME'] || row['Player'] || row['Name'] || '',
    team: row['TEAM'] || row['Team'] || '',
    pos: (row['POS'] || row['Position'] || '').replace(/\d+/g, ''),
    bye: row['BYE WEEK'] || row['Bye'] || '',
    // Umwandeln in X/5 format zur besseren übersicht und kürzeren darstellung 
    sos: (() => {
      const raw = row['SOS SEASON'] || row['SOS'] || ''
      const m = String(raw).match(/(\d)\s*(?:out\s*of|\/)\s*5/i)
      return m ? `${m[1]}/5` : raw
    })(),
    ecrVsAdp: row['ECR VS. ADP'] || row['ECRvsADP'] || '',
    nname: normalizePlayerName(row['PLAYER NAME'] || row['Player'] || row['Name'] || ''),
    status: null,     // null | 'me' | 'other'
    pick_no: null,
    picked_by: null,
  }))
}
