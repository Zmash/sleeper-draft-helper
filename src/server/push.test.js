import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { readSubs, addSub, removeSub } from './push.js'

let dir
let file
beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdh-push-test-')); file = path.join(dir, 'push.json') })
afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }) })

const sub = () => ({ endpoint: 'https://push.example/e1', keys: { p256dh: 'p', auth: 'a' }, sleeperUsername: 'Zmash' })

describe('push storage', () => {
  it('liest leeres Array wenn Datei fehlt', () => {
    expect(readSubs(file)).toEqual([])
  })

  it('speichert ein Abo mit Username und liest es zurück', () => {
    addSub({ subscription: sub(), sleeperUsername: 'Zmash' }, file)
    const all = readSubs(file)
    expect(all).toHaveLength(1)
    expect(all[0].sleeperUsername).toBe('Zmash')
    expect(all[0].endpoint).toBe('https://push.example/e1')
  })

  it('überschreibt statt zu doppeln bei gleichem endpoint', () => {
    addSub({ subscription: sub(), sleeperUsername: 'Alt' }, file)
    addSub({ subscription: sub(), sleeperUsername: 'Neu' }, file)
    const all = readSubs(file)
    expect(all).toHaveLength(1)
    expect(all[0].sleeperUsername).toBe('Neu')
  })

  it('entfernt ein Abo per endpoint', () => {
    addSub({ subscription: sub(), sleeperUsername: 'Zmash' }, file)
    removeSub('https://push.example/e1', file)
    expect(readSubs(file)).toEqual([])
  })

  it('wirft bei ungültigem Abo (ohne endpoint)', () => {
    expect(() => addSub({ subscription: { keys: {} }, sleeperUsername: 'x' }, file)).toThrow()
  })
})
