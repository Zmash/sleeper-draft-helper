import { describe, it, expect } from 'vitest'
import {
  FFC_FORMATS, normalizeFfcPos, normalizeFfcPlayer, isDynastyFromQuery,
  extractEcrData, normalizeFantasyProsPlayer, FP_POSITIONS, FP_SCORING_URLS,
} from './rankings'
import { normalizePlayerName } from '../utils/formatting'

describe('normalizeFfcPos', () => {
  it('FFC nennt Kicker PK — wir nennen ihn K', () => {
    expect(normalizeFfcPos('PK')).toBe('K')
  })
  it('DEF bleibt DEF', () => {
    expect(normalizeFfcPos('DEF')).toBe('DEF')
  })
  it('normale Positionen bleiben unveraendert und werden gross geschrieben', () => {
    expect(normalizeFfcPos('rb')).toBe('RB')
  })
})

describe('FFC_FORMATS', () => {
  it('ist eine Whitelist — kein Pfad-Durchreichen aus der Query', () => {
    expect(FFC_FORMATS).toContain('ppr')
    expect(FFC_FORMATS).toContain('2qb')
    expect(FFC_FORMATS).not.toContain('../../etc/passwd')
  })
})

describe('normalizeFfcPlayer', () => {
  const raw = {
    player_id: 5670, name: 'Bijan Robinson', position: 'RB', team: 'ATL',
    adp: 1.7, adp_formatted: '1.02', times_drafted: 241, high: 1, low: 4, stdev: 0.7, bye: 11,
  }
  it('bildet auf die Board-Form ab', () => {
    const p = normalizeFfcPlayer(raw)
    expect(p.name).toBe('Bijan Robinson')
    expect(p.pos).toBe('RB')
    expect(p.adp).toBe(1.7)
    expect(p.bye).toBe(11)
    expect(p.stdev).toBe(0.7)
  })
  it('setzt nname fuer den Merge — identisch zur Client-Normalisierung', () => {
    // Leerzeichen bleiben erhalten! normalizePlayerName strippt nur [^a-z\s]
    // und die Suffixe jr/sr/ii/iii/iv. Ein zusammengezogenes "bijanrobinson"
    // wuerde gegen das Board nie matchen.
    expect(normalizeFfcPlayer(raw).nname).toBe('bijan robinson')
  })
  it('strippt Suffixe wie die Client-Funktion', () => {
    expect(normalizeFfcPlayer({ ...raw, name: 'Marvin Harrison Jr.' }).nname).toBe('marvin harrison')
  })
  it('normalisiert PK zu K', () => {
    expect(normalizeFfcPlayer({ ...raw, position: 'PK' }).pos).toBe('K')
  })
})

describe('extractEcrData', () => {
  it('extrahiert das eingebettete ecrData-Objekt aus dem Seiten-HTML', () => {
    const html = `<script>window.foo=1; var ecrData = {"type":"Draft PPR","count":2,"players":[{"player_name":"A"},{"player_name":"B"}]}; more();</script>`
    const d = extractEcrData(html)
    expect(d.type).toBe('Draft PPR')
    expect(d.players).toHaveLength(2)
    expect(d.players[1].player_name).toBe('B')
  })

  it('kommt mit verschachtelten Objekten und geschweiften Klammern in Strings klar', () => {
    // Ein naives Regex bis zur ersten schliessenden Klammer wuerde hier abbrechen.
    const html = `var ecrData = {"a":{"b":1},"note":"nicht } hier","players":[{"x":"}{"}]};`
    const d = extractEcrData(html)
    expect(d.a.b).toBe(1)
    expect(d.note).toBe('nicht } hier')
    expect(d.players[0].x).toBe('}{')
  })

  it('liefert null, wenn kein ecrData vorhanden ist', () => {
    expect(extractEcrData('<html>nichts</html>')).toBeNull()
  })
})

describe('FP_POSITIONS', () => {
  it('ist eine Whitelist der relevanten Offensiv-Positionen + K/DST', () => {
    expect(FP_POSITIONS).toEqual(expect.arrayContaining(['QB', 'RB', 'WR', 'TE', 'K', 'DST']))
    // IDP-Positionen gehoeren nicht ins Redraft-Board
    expect(FP_POSITIONS).not.toContain('LB')
    expect(FP_POSITIONS).not.toContain('DB')
  })
})

describe('FP_SCORING_URLS', () => {
  it('mappt die drei Scoring-Varianten auf die Cheatsheet-Seiten', () => {
    expect(FP_SCORING_URLS.ppr).toContain('ppr-cheatsheets.php')
    expect(FP_SCORING_URLS.half).toContain('half-point-ppr-cheatsheets.php')
    expect(FP_SCORING_URLS.std).toContain('consensus-cheatsheets.php')
  })
})

describe('normalizeFantasyProsPlayer', () => {
  const raw = {
    player_id: 17298, player_name: 'Ja\'Marr Chase', player_team_id: 'CIN',
    player_position_id: 'WR', pos_rank: 'WR1', tier: 1, rank_ecr: 3,
    player_bye_week: '6',
  }
  it('bildet auf die Board-Rang-Form ab (wie FantasyCalc/KTC)', () => {
    const p = normalizeFantasyProsPlayer(raw)
    expect(p.name).toBe('Ja\'Marr Chase')
    expect(p.team).toBe('CIN')
    expect(p.pos).toBe('WR')
    expect(p.posRank).toBe('WR1')
    expect(p.tier).toBe(1)
    expect(p.ecr).toBe(3)
    expect(p.rk).toBe('3')
    expect(p.bye).toBe('6')
  })
  it('setzt Redraft-Leerfelder (kein ADP/Dynasty/Alter aus der Quelle)', () => {
    const p = normalizeFantasyProsPlayer(raw)
    expect(p.adp).toBeNull()
    expect(p.dynasty_value).toBeNull()
    expect(p.age).toBeNull()
    expect(p.years_exp).toBeNull()
  })
  it('setzt nname fuer den Markt-Merge — strippt Suffixe wie die Client-Funktion', () => {
    expect(normalizeFantasyProsPlayer(raw).nname).toBe(normalizePlayerName('Ja\'Marr Chase'))
    expect(normalizeFantasyProsPlayer({ ...raw, player_name: 'Marvin Harrison Jr.' }).nname).toBe('marvin harrison')
  })
})

describe('isDynastyFromQuery', () => {
  it('default ist true — der Rookie-Pfad bleibt unberuehrt (Regression)', () => {
    expect(isDynastyFromQuery(undefined)).toBe(true)
    expect(isDynastyFromQuery('')).toBe(true)
  })
  it('nur der explizite String "false" schaltet ab', () => {
    expect(isDynastyFromQuery('false')).toBe(false)
    expect(isDynastyFromQuery('true')).toBe(true)
    expect(isDynastyFromQuery('irgendwas')).toBe(true)
  })
})
