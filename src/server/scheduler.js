import cron from 'node-cron'
import { readSubs, removeSub as removePushSub, sendPush as sendPushReal } from './push.js'
import { checkUserLeagues as checkUserLeaguesReal, composeMessage } from './lineupCheck.js'

export const CRON_MORNING = '0 8 * * *'
export const CRON_PREGAME_FRI = '30 0 * * 5'
export const CRON_PREGAME_SUN = '30 17 * * 0'
export const CRON_TZ = 'Europe/Berlin'

export async function runCheck({ type, deps = {} }) {
  const {
    loadSubs = readSubs,
    checkUserLeagues = checkUserLeaguesReal,
    sendPush = sendPushReal,
    removeSub = removePushSub,
    season = String(new Date().getFullYear()),
  } = deps
  const subs = await loadSubs()
  let checked = 0
  let sent = 0
  let pruned = 0
  for (const sub of subs) {
    checked += 1
    try {
      const { warnings, pickups } = await checkUserLeagues({ username: sub.sleeperUsername, season })
      const msg = composeMessage({ warnings, pickups, type })
      if (!msg) continue
      await sendPush(sub, msg)
      sent += 1
    } catch (e) {
      if (e?.statusCode === 410 || e?.statusCode === 404) {
        try { await removeSub(sub.endpoint) } catch { /* schon weg */ }
        pruned += 1
      } else {
        console.warn(`[scheduler] check failed (${sub.sleeperUsername})`, e?.message || e)
      }
    }
  }
  console.log(`[scheduler] ${type}: checked=${checked} sent=${sent} pruned=${pruned}`)
  return { checked, sent, pruned }
}

export function startScheduler({ schedule = cron.schedule } = {}) {
  if (process.env.SDH_SCHEDULER !== '1') return []
  const jobs = [
    schedule(CRON_MORNING, () => runCheck({ type: 'morning' }).catch((e) => console.warn('[scheduler] morning failed', e)), { timezone: CRON_TZ }),
    schedule(CRON_PREGAME_FRI, () => runCheck({ type: 'pregame' }).catch((e) => console.warn('[scheduler] pregame failed', e)), { timezone: CRON_TZ }),
    schedule(CRON_PREGAME_SUN, () => runCheck({ type: 'pregame' }).catch((e) => console.warn('[scheduler] pregame failed', e)), { timezone: CRON_TZ }),
  ]
  console.log('[scheduler] aktiv (morning + pregame Fr/So, Europe/Berlin)')
  return jobs
}
