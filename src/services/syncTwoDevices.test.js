// @vitest-environment node
//
// Zwei Geraete gegen einen Fake-Briefkasten. Node statt jsdom, weil
// crypto.subtle in jsdom fehlt (siehe syncCrypto.test.js) — localStorage wird
// dafuer selbst gestellt und zwischen den Geraeten umgeschaltet.
//
// Deckt genau die Beschwerde ab: "mal wird alles uebertragen, mal gefuehlt nur
// von PC zu Handy".
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { couple, syncOnce } from './syncClient.js'

const SECRET = 'A'.repeat(43)

function makeStore() {
  const m = new Map()
  return {
    get length() { return m.size },
    key: (i) => [...m.keys()][i] ?? null,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)) },
    removeItem: (k) => { m.delete(k) },
    clear: () => m.clear(),
  }
}

let server
let realFetch

function fakeServer() {
  let room = null
  let counter = 0
  return {
    get room() { return room },
    fetch: async (_url, opts = {}) => {
      if (opts.method === 'POST') {
        const { iv, ciphertext } = JSON.parse(opts.body)
        room = { stamp: `s${counter++}`, iv, ciphertext }
        return { ok: true, status: 200, json: async () => ({ stamp: room.stamp }) }
      }
      if (!room) return { ok: false, status: 404, json: async () => ({}) }
      if (opts.headers?.['If-None-Match'] === `"${room.stamp}"`) {
        return { ok: true, status: 304, json: async () => ({}) }
      }
      return { ok: true, status: 200, json: async () => room }
    },
  }
}

const pc = makeStore()
const phone = makeStore()

// syncClient liest localStorage ueber das Global — Geraetewechsel = Umschalten.
async function on(device, fn) {
  globalThis.localStorage = device
  return await fn()
}

beforeEach(() => {
  pc.clear()
  phone.clear()
  server = fakeServer()
  realFetch = globalThis.fetch
  globalThis.fetch = server.fetch
})

afterEach(() => {
  globalThis.fetch = realFetch
  delete globalThis.localStorage
})

describe('Zwei Geraete', () => {
  it('verliert die Handy-Aenderung nicht, wenn der PC zuerst gepusht hat', async () => {
    // Ausgangslage: PC hat einen Stand und laedt ihn hoch.
    await on(pc, async () => {
      pc.setItem('sdh.playerPreferences.v2', 'alt')
      pc.setItem('sdh-board-v1', 'alt')
      couple(SECRET)
      expect(await syncOnce()).toBe('pushed')
    })

    // Handy koppelt und uebernimmt den vorhandenen Stand vollstaendig.
    await on(phone, async () => {
      couple(SECRET)
      expect(await syncOnce()).toBe('pulled')
      expect(phone.getItem('sdh-board-v1')).toBe('alt')
    })

    // Beide aendern jetzt gleichzeitig, aber VERSCHIEDENE Keys.
    phone.setItem('sdh.playerPreferences.v2', 'handy-markierung')
    pc.setItem('sdh-board-v1', 'pc-board')

    // Der PC ist das Geraet mit dem dauerhaften Takt und ist zuerst dran.
    await on(pc, async () => { expect(await syncOnce()).toBe('pushed') })

    // Genau hier hat das Handy frueher seine Markierung weggeworfen.
    await on(phone, async () => { expect(await syncOnce()).toBe('pulled') })
    expect(phone.getItem('sdh.playerPreferences.v2')).toBe('handy-markierung')
    expect(phone.getItem('sdh-board-v1')).toBe('pc-board')

    // Und der PC bekommt die Handy-Markierung auch wirklich zu sehen.
    await on(pc, async () => { expect(await syncOnce()).toBe('pulled') })
    expect(pc.getItem('sdh.playerPreferences.v2')).toBe('handy-markierung')
    expect(pc.getItem('sdh-board-v1')).toBe('pc-board')
  })

  // Ohne diese Eigenschaft haetten die Geraete einander endlos angestupst.
  it('kommt zur Ruhe, wenn nichts mehr zu tun ist', async () => {
    await on(pc, async () => {
      pc.setItem('sdh-board-v1', 'x')
      couple(SECRET)
      await syncOnce()
    })
    await on(phone, async () => {
      couple(SECRET)
      await syncOnce()
      expect(await syncOnce()).toBe('idle')
    })
    await on(pc, async () => { expect(await syncOnce()).toBe('idle') })
    await on(phone, async () => { expect(await syncOnce()).toBe('idle') })
  })

  // Ein Key, den nur ein Geraet kennt, muss beim anderen ankommen statt
  // zwischen beiden hin und her zu wandern.
  it('traegt einseitige Keys hinueber und bleibt danach still', async () => {
    await on(pc, async () => {
      pc.setItem('sdh-board-v1', 'x')
      couple(SECRET)
      await syncOnce()
    })
    await on(phone, async () => {
      couple(SECRET)
      await syncOnce()
    })

    phone.setItem('sdh.nur-am-handy', 'y')
    await on(phone, async () => { expect(await syncOnce()).toBe('pushed') })
    await on(pc, async () => { expect(await syncOnce()).toBe('pulled') })
    expect(pc.getItem('sdh.nur-am-handy')).toBe('y')

    await on(pc, async () => { expect(await syncOnce()).toBe('idle') })
    await on(phone, async () => { expect(await syncOnce()).toBe('idle') })
  })
})
