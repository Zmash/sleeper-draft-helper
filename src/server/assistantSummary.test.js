import { describe, it, expect, vi } from 'vitest'
import { buildAssistantSummary, standingOf, tokenMatches } from './assistantSummary.js'
import { registerApiRoutes, DEFAULT_MODEL, ASSISTANT_RATE_LIMIT } from './apiRoutes.js'

const roster = (roster_id, owner_id, wins, losses, fpts) => ({ roster_id, owner_id, settings: { wins, losses, ties: 0, fpts, fpts_decimal: 50 } })

describe('buildAssistantSummary', () => {
  const deps = {
    fetchState: async () => ({ season: '2027', league_season: '2026', week: 9 }),
    resolveUserId: async () => 'me',
    fetchLeagues: async (_u, season) => (season === '2026' ? [{ league_id: 'L1', name: 'FFL-Bochum', settings: { type: 0 } }] : []),
    fetchRosters: async () => [roster(1, 'me', 6, 2, 900), roster(2, 'u2', 7, 1, 800), roster(3, 'u3', 6, 2, 950)],
    fetchUsers: async () => [{ user_id: 'u3', display_name: 'kalle', metadata: { team_name: 'Die Bullen' } }],
    fetchMatchups: async () => [
      { roster_id: 1, matchup_id: 4, points: 88.2 },
      { roster_id: 3, matchup_id: 4, points: 70.1 },
      { roster_id: 2, matchup_id: 5, points: 0 },
    ],
    checkUserLeagues: async () => ({
      warnings: [{ leagueName: 'FFL-Bochum', playerName: 'A', pos: 'WR', team: 'BUF', severity: 'red', reason: 'bye' }],
      pickups: [{ leagueName: 'FFL-Bochum', name: 'B', pos: 'RB', team: 'NYJ' }, { leagueName: 'Andere', name: 'C', pos: 'TE' }],
    }),
  }

  it('nimmt league_season, rechnet Platz/Bilanz und findet den Gegner', async () => {
    const out = await buildAssistantSummary({ username: 'zmash', deps })
    expect(out).toMatchObject({ season: '2026', week: 9 })
    expect(out.leagues).toEqual([{
      name: 'FFL-Bochum', league_id: 'L1', typ: 'Redraft', platz: 3, teams: 3, bilanz: '6-2', punkte: 900.5,
      gegner: { name: 'Die Bullen', punkte: 70.1, eigene_punkte: 88.2 },
      warnungen: [{ spieler: 'A', pos: 'WR', team: 'BUF', stufe: 'red', grund: 'bye' }],
      pickups: [{ spieler: 'B', pos: 'RB', team: 'NYJ' }],
    }])
  })

  it('standingOf: bei gleichen Siegen entscheiden die Punkte', () => {
    expect(standingOf([roster(1, 'a', 5, 3, 700), roster(2, 'b', 5, 3, 800)], 1)).toBe(2)
  })
})

describe('tokenMatches', () => {
  it('nur der exakte Bearer-Token passt', () => {
    expect(tokenMatches('Bearer geheim', 'geheim')).toBe(true)
    expect(tokenMatches('Bearer geheim2', 'geheim')).toBe(false)
    expect(tokenMatches('geheim', 'geheim')).toBe(false)
    expect(tokenMatches(undefined, 'geheim')).toBe(false)
    expect(tokenMatches('Bearer x', null)).toBe(false)
  })
})

describe('GET /api/assistant/summary', () => {
  function capture(opts = {}) {
    const gets = {}
    const summary = vi.fn(async ({ username }) => ({ season: '2026', week: 9, leagues: [], username }))
    registerApiRoutes(
      { get: (p, h) => { gets[p] = h }, post: () => {} },
      { model: DEFAULT_MODEL, assistantToken: 'geheim', assistantUsername: 'zmash', assistantSummary: summary, ...opts },
    )
    return { route: gets['/api/assistant/summary'], summary }
  }
  function makeRes() {
    const res = { headers: {} }
    res.status = (code) => { res.statusCode = code; return res }
    res.json = (body) => { res.body = body; return res }
    res.set = (k, v) => { res.headers[k] = v; return res }
    res.end = () => res
    return res
  }
  const req = (auth, ip = '1.1.1.1', query = {}) => ({ headers: auth ? { authorization: auth } : {}, ip, query })

  it('ohne SDH_ASSISTANT_TOKEN ist die Route aus (404)', async () => {
    const { route, summary } = capture({ assistantToken: null })
    const res = makeRes()
    await route(req('Bearer geheim'), res)
    expect(res.statusCode).toBe(404)
    expect(summary).not.toHaveBeenCalled()
  })

  it('fehlender oder falscher Token: 401 ohne Abruf', async () => {
    const { route, summary } = capture()
    for (const auth of [null, 'Bearer falsch', 'geheim']) {
      const res = makeRes()
      await route(req(auth), res)
      expect(res.statusCode).toBe(401)
    }
    expect(summary).not.toHaveBeenCalled()
  })

  it('richtiger Token: Daten fuer den festen Benutzer, danach aus dem Cache', async () => {
    const { route, summary } = capture()
    const r1 = makeRes()
    await route(req('Bearer geheim', '1.1.1.1', { username: 'fremd' }), r1)
    expect(r1.statusCode).toBeUndefined()
    expect(r1.body).toMatchObject({ season: '2026', week: 9, username: 'zmash' })
    const r2 = makeRes()
    await route(req('Bearer geheim'), r2)
    expect(summary).toHaveBeenCalledTimes(1)
  })

  it('Fehler beim Laden: 502 ohne Interna', async () => {
    const { route } = capture({ assistantSummary: async () => { throw new Error('Sleeper 500: https://intern') } })
    const res = makeRes()
    await route(req('Bearer geheim'), res)
    expect(res.statusCode).toBe(502)
    expect(JSON.stringify(res.body)).not.toContain('intern')
  })

  it('drosselt nach dem Limit pro IP (429)', async () => {
    const { route } = capture()
    for (let i = 0; i < ASSISTANT_RATE_LIMIT; i++) await route(req('Bearer falsch', '9.9.9.9'), makeRes())
    const res = makeRes()
    await route(req('Bearer geheim', '9.9.9.9'), res)
    expect(res.statusCode).toBe(429)
  })
})
