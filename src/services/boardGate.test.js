import { describe, it, expect } from 'vitest'
import { isAdviceButtonDisabled } from './boardGate'

describe('isAdviceButtonDisabled', () => {
  it('sperrt waehrend "drafting" ohne livePicks (Reload-Luecke)', () => {
    expect(isAdviceButtonDisabled({ draft: { status: 'drafting' }, livePicks: [] })).toBe(true)
    expect(isAdviceButtonDisabled({ draft: { status: 'drafting' }, livePicks: null })).toBe(true)
  })
  it('bleibt aktiv, sobald livePicks waehrend "drafting" da sind', () => {
    expect(isAdviceButtonDisabled({ draft: { status: 'drafting' }, livePicks: [{ pick_no: 1 }] })).toBe(false)
  })
  it('bleibt vor Draft-Start (pre_draft) aktiv, auch ohne livePicks', () => {
    expect(isAdviceButtonDisabled({ draft: { status: 'pre_draft' }, livePicks: [] })).toBe(false)
  })
  it('bleibt nach Draft-Ende (complete) aktiv', () => {
    expect(isAdviceButtonDisabled({ draft: { status: 'complete' }, livePicks: [{ pick_no: 1 }] })).toBe(false)
  })
  it('kein Draft ⇒ nicht gesperrt', () => {
    expect(isAdviceButtonDisabled({ draft: null, livePicks: [] })).toBe(false)
    expect(isAdviceButtonDisabled({})).toBe(false)
  })
})
