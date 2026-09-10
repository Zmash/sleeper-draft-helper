import fs from 'fs'
import os from 'os'
import path from 'path'
import webpush from 'web-push'

export const PUSH_FILE = process.env.SDH_PUSH_FILE || path.join(os.tmpdir(), 'sdh-push.json')
const MAX_SUBS = 500

export function getVapidConfig() {
  const publicKey = process.env.SDH_VAPID_PUBLIC_KEY || null
  const privateKey = process.env.SDH_VAPID_PRIVATE_KEY || null
  const subject = process.env.SDH_VAPID_SUBJECT || null
  if (!publicKey || !privateKey || !subject) return null
  return { publicKey, privateKey, subject }
}

export function readSubs(file = PUSH_FILE) {
  try {
    const raw = fs.readFileSync(file, 'utf8')
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr : []
  } catch { return [] }
}

function writeSubs(all, file) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const tmp = `${file}.${process.pid}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(all.slice(0, MAX_SUBS)))
  fs.renameSync(tmp, file)
}

export function addSub({ subscription, sleeperUsername }, file = PUSH_FILE) {
  const endpoint = subscription?.endpoint
  const keys = subscription?.keys
  const user = String(sleeperUsername || '').trim()
  if (!endpoint || !keys?.p256dh || !keys?.auth || !user) {
    throw new Error('Ungültige Subscription (endpoint/keys/username fehlen)')
  }
  const all = readSubs(file).filter((s) => s.endpoint !== endpoint)
  all.push({ endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth }, sleeperUsername: user, createdAt: new Date().toISOString() })
  writeSubs(all, file)
  return true
}

export function removeSub(endpoint, file = PUSH_FILE) {
  writeSubs(readSubs(file).filter((s) => s.endpoint !== String(endpoint)), file)
  return true
}

export async function sendPush(sub, payload) {
  const vapid = getVapidConfig()
  if (!vapid) throw new Error('VAPID nicht konfiguriert')
  webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey)
  return webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, JSON.stringify(payload))
}
