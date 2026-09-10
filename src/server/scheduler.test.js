import { describe, it, expect, vi } from 'vitest'
import { runCheck } from './scheduler.js'

const sub = { endpoint: 'https://push.example/e1', keys: { p256dh: 'p', auth: 'a' }, sleeperUsername: 'Zmash' }

function deps(over = {}) {
  return {
    loadSubs: async () => [sub],
    checkUserLeagues: async () => ({
      warnings: [{ leagueName: 'Dynasty', playerName: 'A.J. Brown', pos: 'WR', team: 'NE', severity: 'red', reason: 'out' }],
      pickups: [],
    }),
    sendPush: vi.fn(async () => {}),
    removeSub: vi.fn(),
    ...over,
  }
}

describe('runCheck', () => {
  it('sendet genau eine Nachricht bei Warnungen', async () => {
    const d = deps()
    const res = await runCheck({ type: 'pregame', deps: d })
    expect(d.sendPush).toHaveBeenCalledTimes(1)
    expect(res).toEqual({ checked: 1, sent: 1, pruned: 0 })
  })

  it('sendet nichts ohne Befunde', async () => {
    const d = deps({ checkUserLeagues: async () => ({ warnings: [], pickups: [] }) })
    const res = await runCheck({ type: 'morning', deps: d })
    expect(d.sendPush).not.toHaveBeenCalled()
    expect(res.sent).toBe(0)
  })

  it('löscht tote Abos bei 410 und zählt sie', async () => {
    const err = new Error('gone'); err.statusCode = 410
    const d = deps({ sendPush: vi.fn(async () => { throw err }) })
    const res = await runCheck({ type: 'morning', deps: d })
    expect(d.removeSub).toHaveBeenCalledWith('https://push.example/e1')
    expect(res.pruned).toBe(1)
  })

  it('ein fehlerhafter User bricht die anderen nicht ab', async () => {
    const d = deps({
      loadSubs: async () => [sub, { ...sub, endpoint: 'https://push.example/e2' }],
      checkUserLeagues: vi.fn()
        .mockRejectedValueOnce(new Error('Sleeper down'))
        .mockResolvedValueOnce({ warnings: [], pickups: [] }),
    })
    const res = await runCheck({ type: 'morning', deps: d })
    expect(res.checked).toBe(2)
  })
})
