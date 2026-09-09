import { describe, it, expect } from 'vitest'
import {
  FFC_FORMATS, normalizeFfcPos, normalizeFfcPlayer, isDynastyFromQuery,
  extractEcrData, extractEmbeddedJson, normalizeFantasyProsPlayer, FP_POSITIONS, FP_SCORING_URLS,
  SLEEPER_ADP_FIELD, normalizeSleeperAdpPlayer, normalizeKtcPlayer, fantasyProsPositionUrl, sleeperWeekProjectionsUrl,
  normalizeSleeperWeekPlayer,
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

describe('extractEmbeddedJson', () => {
  it('extrahiert ein eingebettetes Array (nicht nur Objekte)', () => {
    // KTCs Rankings-Seite rendert serverseitig nur ~50 Zeilen und laedt den
    // Rest per Infinite-Scroll nach -- das eingebettete playersArray hat alle.
    const html = `<script>var playersArray = [{"playerName":"A"},{"playerName":"B"},{"playerName":"C"}];</script>`
    const d = extractEmbeddedJson(html, 'playersArray', '[', ']')
    expect(d).toHaveLength(3)
    expect(d[1].playerName).toBe('B')
  })

  it('liefert null, wenn der Marker nicht vorkommt', () => {
    expect(extractEmbeddedJson('<html>nichts</html>', 'playersArray', '[', ']')).toBeNull()
  })
})

describe('normalizeKtcPlayer', () => {
  const raw = {
    playerID: 1415, playerName: 'Jahmyr Gibbs', team: 'DET', position: 'RB',
    age: 24.5, seasonsExperience: 3, byeWeek: 6,
    oneQBValues: { value: 9999, rank: 2, positionalRank: 2, overallTier: 1, rookieRank: 1, rookiePositionalRank: 1, rookieTier: 1 },
    superflexValues: { value: 9998, rank: 1, positionalRank: 1, overallTier: 1, rookieRank: 1, rookiePositionalRank: 1, rookieTier: 1 },
  }

  it('nutzt oneQBValues per Default', () => {
    const p = normalizeKtcPlayer(raw)
    expect(p.dynasty_value).toBe(9999)
    expect(p.ecr).toBe(2)
    expect(p.posRank).toBe('RB2')
    expect(p.tier).toBe('Tier 1')
  })

  it('nutzt superflexValues, wenn superflex:true', () => {
    const p = normalizeKtcPlayer(raw, { superflex: true })
    expect(p.dynasty_value).toBe(9998)
    expect(p.ecr).toBe(1)
  })

  it('nutzt rookieRank statt rank, wenn rookie:true -- Rang unter Rookies, nicht unter allen Spielern', () => {
    const p = normalizeKtcPlayer(
      { ...raw, oneQBValues: { ...raw.oneQBValues, rank: 42, rookieRank: 3, rookiePositionalRank: 1, rookieTier: 2 } },
      { rookie: true }
    )
    expect(p.ecr).toBe(3)
    expect(p.posRank).toBe('RB1')
    expect(p.tier).toBe('Tier 2')
  })

  it('setzt nname fuer den Markt-Merge', () => {
    expect(normalizeKtcPlayer(raw).nname).toBe(normalizePlayerName('Jahmyr Gibbs'))
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
    player_bye_week: '6', rank_min: '1', rank_max: '6', rank_std: '1.00',
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
  it('konvertiert die Experten-Panel-Streuung (rank_min/rank_max/rank_std) aus Strings zu Zahlen', () => {
    const p = normalizeFantasyProsPlayer(raw)
    expect(p.rank_min).toBe(1)
    expect(p.rank_max).toBe(6)
    expect(p.rank_std).toBe(1)
  })
  it('rank_min/rank_max/rank_std bleiben null, wenn die Quelle sie nicht liefert', () => {
    const p = normalizeFantasyProsPlayer({ ...raw, rank_min: undefined, rank_max: undefined, rank_std: undefined })
    expect(p.rank_min).toBeNull()
    expect(p.rank_max).toBeNull()
    expect(p.rank_std).toBeNull()
  })
})

describe('SLEEPER_ADP_FIELD', () => {
  it('mappt die vier App-Formate auf die Sleeper-Stat-Felder', () => {
    expect(SLEEPER_ADP_FIELD.ppr).toBe('adp_ppr')
    expect(SLEEPER_ADP_FIELD['half-ppr']).toBe('adp_half_ppr')
    expect(SLEEPER_ADP_FIELD.standard).toBe('adp_std')
    expect(SLEEPER_ADP_FIELD['2qb']).toBe('adp_2qb')
  })
  it('deckt genau die FFC-Format-Whitelist ab (gleicher format-Parameter)', () => {
    expect(Object.keys(SLEEPER_ADP_FIELD).sort()).toEqual([...FFC_FORMATS].sort())
  })
})

describe('normalizeSleeperAdpPlayer', () => {
  const raw = {
    player: { first_name: 'Bijan', last_name: 'Robinson', position: 'RB', team: 'ATL' },
    stats: { adp_ppr: 1.4, adp_half_ppr: 1.5, adp_std: 1.2, adp_2qb: 2.4 },
  }
  it('liest das format-spezifische ADP-Feld', () => {
    expect(normalizeSleeperAdpPlayer(raw, 'adp_ppr').adp).toBe(1.4)
    expect(normalizeSleeperAdpPlayer(raw, 'adp_half_ppr').adp).toBe(1.5)
    expect(normalizeSleeperAdpPlayer(raw, 'adp_2qb').adp).toBe(2.4)
  })
  it('bildet auf die FFC-Markt-Form ab (Name/Pos/Team + nname)', () => {
    const p = normalizeSleeperAdpPlayer(raw, 'adp_ppr')
    expect(p.name).toBe('Bijan Robinson')
    expect(p.pos).toBe('RB')
    expect(p.team).toBe('ATL')
    expect(p.nname).toBe('bijan robinson')
  })
  it('999 ist der Sentinel fuer "ungerankt" und wird null (z. B. K/DEF)', () => {
    const dst = { player: { first_name: 'Washington', last_name: 'Commanders', position: 'DEF', team: 'WAS' }, stats: { adp_ppr: 999.0 } }
    expect(normalizeSleeperAdpPlayer(dst, 'adp_ppr').adp).toBeNull()
  })
  it('fehlendes/ungueltiges ADP-Feld wird null', () => {
    expect(normalizeSleeperAdpPlayer({ player: { first_name: 'X' }, stats: {} }, 'adp_ppr').adp).toBeNull()
  })
  it('kennt keine Streuung/Bye — die Quelle liefert sie nicht (bleiben null)', () => {
    const p = normalizeSleeperAdpPlayer(raw, 'adp_ppr')
    expect(p.bye).toBeNull()
    expect(p.high).toBeNull()
    expect(p.low).toBeNull()
    expect(p.stdev).toBeNull()
    expect(p.times_drafted).toBeNull()
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

describe('fantasyProsPositionUrl', () => {
  it('QB und DST haben keine Scoring-Variante', () => {
    expect(fantasyProsPositionUrl('QB', 'week', 'ppr')).toBe('https://www.fantasypros.com/nfl/rankings/qb.php')
    expect(fantasyProsPositionUrl('DEF', 'week', 'ppr')).toBe('https://www.fantasypros.com/nfl/rankings/dst.php')
    expect(fantasyProsPositionUrl('DEF', 'ros', 'std')).toBe('https://www.fantasypros.com/nfl/rankings/ros-dst.php')
  })

  it('TE hat Scoring-Suffix, Weekly und ROS', () => {
    expect(fantasyProsPositionUrl('TE', 'week', 'ppr')).toBe('https://www.fantasypros.com/nfl/rankings/ppr-te.php')
    expect(fantasyProsPositionUrl('TE', 'week', 'half')).toBe('https://www.fantasypros.com/nfl/rankings/half-point-ppr-te.php')
    expect(fantasyProsPositionUrl('TE', 'week', 'std')).toBe('https://www.fantasypros.com/nfl/rankings/te.php')
    expect(fantasyProsPositionUrl('TE', 'ros', 'ppr')).toBe('https://www.fantasypros.com/nfl/rankings/ros-ppr-te.php')
  })
})

describe('normalizeFantasyProsPlayer mit Weekly-Feldern', () => {
  it('uebernimmt fantasy_pts und opponent, wenn vorhanden', () => {
    const raw = { player_name: 'Lamar Jackson', rank_ecr: 1, player_team_id: 'BAL', player_position_id: 'QB', fantasy_pts: '21.4', player_opponent: 'at IND' }
    const out = normalizeFantasyProsPlayer(raw)
    expect(out.fantasy_pts).toBe(21.4)
    expect(out.opponent).toBe('at IND')
  })

  it('liefert null, wenn die Felder fehlen (ROS/Cheatsheet)', () => {
    const raw = { player_name: 'Josh Allen', rank_ecr: 1, player_team_id: 'BUF', player_position_id: 'QB' }
    const out = normalizeFantasyProsPlayer(raw)
    expect(out.fantasy_pts).toBeNull()
    expect(out.opponent).toBeNull()
  })

  it('leere Strings werden zu null statt 0 (Number-Str-Falle)', () => {
    const raw = { player_name: 'Third Stringer', rank_ecr: '', player_team_id: 'NYJ', player_position_id: 'QB', fantasy_pts: '' }
    const out = normalizeFantasyProsPlayer(raw)
    expect(out.ecr).toBeNull()
    expect(out.fantasy_pts).toBeNull()
  })
})

describe('Sleeper Wochen-Projektionen', () => {
  it('URL mit Season/Week-Pfad und allen Waiver-Positionen', () => {
    expect(sleeperWeekProjectionsUrl(2026, 1)).toBe('https://api.sleeper.com/projections/nfl/2026/1?season_type=regular&position%5B%5D=QB&position%5B%5D=RB&position%5B%5D=WR&position%5B%5D=TE&position%5B%5D=DEF')
  })

  it('normalisiert Skill-Spieler und DEF (Sleeper-ID als Schluessel)', () => {
    const qb = normalizeSleeperWeekPlayer({ player_id: 4881, team: 'BAL', opponent: 'IND', player: { fantasy_positions: ['QB'], team: 'BAL' }, stats: { pts_ppr: 19.5, pts_half_ppr: 19.0, pts_std: 18.5 } })
    expect(qb).toEqual({ sleeper_id: '4881', pos: 'QB', team: 'BAL', opponent: 'IND', pts_ppr: 19.5, pts_half_ppr: 19.0, pts_std: 18.5 })
    const def = normalizeSleeperWeekPlayer({ player_id: 'SEA', team: 'SEA', opponent: 'SF', player: { fantasy_positions: ['DEF'], team: 'SEA' }, stats: { pts_ppr: 7.8, pts_half_ppr: 7.8, pts_std: 7.8 } })
    expect(def.sleeper_id).toBe('SEA')
    expect(def.pos).toBe('DEF')
  })

  it('fehlende stats werden null (keine 0)', () => {
    expect(normalizeSleeperWeekPlayer({ player_id: 1, player: {}, stats: {} }).pts_ppr).toBeNull()
  })
})
