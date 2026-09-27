// Fantasy-Punkte eines ESPN-Scoring-Plays je Spieler schaetzen. ESPN liefert
// nur Text ("Ja'Marr Chase 23 Yd pass from Joe Burrow (Evan McPherson Kick)"),
// keine Stat-Zeilen -- also Rollen aus dem Text lesen und mit dem Liga-Scoring
// (Sleeper scoring_settings) bewerten. Gezaehlt wird nur, was im Play selbst
// steckt: TD + Yards des Plays + Reception. Bonus-Regeln (100-Yard, First
// Downs, ...) bleiben aussen vor -- lieber etwas zu niedrig als geraten.

const YDS = '(\\d+)\\s*(?:yd|yds|yard|yards|yrds)'
const RE_PASS = new RegExp(`^(.+?)\\s+(?:${YDS}\\s+)?pass\\s+from\\s+(.+?)(?:\\s+for\\s+${YDS})?$`, 'i')
const RE_RUN = new RegExp(`^(.+?)\\s+${YDS}\\s+(?:run|rush)$`, 'i')
const RE_FG = new RegExp(`^(.+?)\\s+${YDS}\\s+field\\s+goal`, 'i')
const RE_KICK = /^(.+?)\s+kick$/i
const RE_2PT_PASS = /^(.+?)\s+pass\s+to\s+(.+?)\s+for\s+two[- ]point/i
const RE_2PT_RUN = /^(.+?)\s+(?:run|rush)\s+for\s+two[- ]point/i
const RE_SAFETY = /safety/i
const RE_ST = /(punt return|kickoff return|kick return|blocked)/i

// Sleeper-Standardwerte, falls eine Liga einen Schluessel nicht mitliefert.
// rec = 1 wie in weekProjections.detectScoringType.
const DEFAULTS = {
  pass_td: 4, pass_yd: 0.04, rush_td: 6, rush_yd: 0.1, rec_td: 6, rec_yd: 0.1, rec: 1,
  pass_2pt: 2, rush_2pt: 2, rec_2pt: 2, xpm: 1, def_td: 6, safe: 2,
  fgm_0_19: 3, fgm_20_29: 3, fgm_30_39: 3, fgm_40_49: 4, fgm_50p: 5,
}

function val(scoring, key) {
  const n = Number(scoring?.[key])
  return Number.isFinite(n) ? n : (DEFAULTS[key] ?? 0)
}

function fgPoints(scoring, dist) {
  const band = dist < 20 ? 'fgm_0_19' : dist < 30 ? 'fgm_20_29' : dist < 40 ? 'fgm_30_39' : dist < 50 ? 'fgm_40_49'
    : null
  let pts = band ? val(scoring, band)
    : dist < 60 && scoring?.fgm_50_59 != null ? val(scoring, 'fgm_50_59')
      : dist >= 60 && scoring?.fgm_60p != null ? val(scoring, 'fgm_60p')
        : val(scoring, 'fgm_50p')
  if (scoring?.fgm != null) pts += val(scoring, 'fgm')
  if (scoring?.fgm_yds != null) pts += val(scoring, 'fgm_yds') * dist
  return pts
}

// "Ja'Marr Chase" == "JaMarr Chase", "Kenneth Walker III" == "Kenneth Walker".
export function normName(s) {
  return String(s || '').toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .replace(/\s+(jr|sr|ii|iii|iv|v)$/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// Text -> Liste von Rollen { kind, name, yds }. Unbekanntes Format -> [].
export function parseScoringPlay(text) {
  const raw = String(text || '').trim()
  const m = raw.match(/^(.*?)\s*(?:\((.*)\))?$/)
  const main = (m?.[1] || '').trim()
  const extra = (m?.[2] || '').trim()
  const roles = []
  let r
  if ((r = main.match(RE_PASS))) {
    const yds = Number(r[2] ?? r[4] ?? 0)
    roles.push({ kind: 'rec', name: r[1], yds }, { kind: 'pass', name: r[3], yds })
  } else if ((r = main.match(RE_RUN))) {
    roles.push({ kind: 'rush', name: r[1], yds: Number(r[2]) })
  } else if ((r = main.match(RE_FG))) {
    roles.push({ kind: 'fg', name: r[1], yds: Number(r[2]) })
  }
  if (extra && !/(fail|block|no good|missed)/i.test(extra)) {
    if ((r = extra.match(RE_2PT_PASS))) roles.push({ kind: 'pass2', name: r[1] }, { kind: 'rec2', name: r[2] })
    else if ((r = extra.match(RE_2PT_RUN))) roles.push({ kind: 'rush2', name: r[1] })
    else if ((r = extra.match(RE_KICK))) roles.push({ kind: 'xp', name: r[1] })
  }
  return roles
}

function rolePoints(role, scoring, pos) {
  const y = role.yds || 0
  switch (role.kind) {
    case 'rec': return val(scoring, 'rec_td') + y * val(scoring, 'rec_yd') + val(scoring, 'rec')
      + (pos === 'TE' ? Number(scoring?.bonus_rec_te) || 0 : 0)
    case 'pass': return val(scoring, 'pass_td') + y * val(scoring, 'pass_yd')
    case 'rush': return val(scoring, 'rush_td') + y * val(scoring, 'rush_yd')
    case 'fg': return fgPoints(scoring, y)
    case 'xp': return val(scoring, 'xpm')
    case 'pass2': return val(scoring, 'pass_2pt')
    case 'rec2': return val(scoring, 'rec_2pt')
    case 'rush2': return val(scoring, 'rush_2pt')
    default: return 0
  }
}

const round1 = (n) => Math.round(n * 10) / 10

// Punkte, die `player` durch `play` in einer Liga mit `scoring` bekommt;
// null, wenn sich keine Rolle zuordnen laesst.
export function playPointsFor(play, player, scoring) {
  if (player.pos === 'DEF') {
    if (RE_SAFETY.test(play.text)) return val(scoring, 'safe')
    return RE_ST.test(play.text) && scoring?.st_td != null ? val(scoring, 'st_td') : val(scoring, 'def_td')
  }
  const me = normName(player.name)
  if (!me) return null
  const mine = parseScoringPlay(play.text).filter((r) => normName(r.name) === me)
  if (!mine.length) return null
  return round1(mine.reduce((sum, r) => sum + rolePoints(r, scoring, player.pos), 0))
}

// Ueber alle Ligen des Spielers den hoechsten Wert -- gleiche Konvention wie
// bei Punkten/Projektion in buildPlayers.
export function playPoints(play, player) {
  const leagues = player.leagues?.length ? player.leagues : [{}]
  let best = null
  for (const l of leagues) {
    const p = playPointsFor(play, player, l.scoring || null)
    if (p != null && (best == null || p > best)) best = p
  }
  return best
}
